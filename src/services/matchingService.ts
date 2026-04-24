import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  startAfter, 
  QueryDocumentSnapshot,
  DocumentData
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserProfile, normalizeUserProfile } from "../types";
import { socialService } from "../lib/socialService";
import { cacheManager } from "../lib/cacheManager";
import { getTargetGender } from "../lib/socialUtils";
import { callFunction } from "../lib/walletService";

// In-memory set for immediate update after swipe
const swipedInSession = new Set<string>();

export const matchingService = {
  /**
   * Fetches potential matches with recursive pagination logic to ensure we find candidates
   * if the first batch returns zero unscanned users.
   */
  async fetchPotentialMatches(currentUser: UserProfile, targetLevel: number = 20): Promise<UserProfile[]> {
    const uid = currentUser.uid;
    const results: UserProfile[] = [];
    
    // 1. Get exclusion list (swipes, blocks, self)
    let swipedIds: string[] = [];
    try {
      swipedIds = await socialService.getSwipedUserIds(uid);
    } catch (err) {
      console.warn("fetchPotentialMatches: Failed to fetch swiped IDs, using empty list fallback");
    }
    
    const blockedIds = currentUser.social?.blockedUserIds || [];
    
    const exclusionSet = new Set<string>([
      uid, 
      ...swipedIds, 
      ...blockedIds, 
      ...Array.from(swipedInSession)
    ]);

    try {
      // 2. Primary: API Call (Direct Cloud Function to avoid recursion)
      const discoverResult = await callFunction('refreshDiscover', {});
      if (discoverResult.success && Array.isArray(discoverResult.users)) {
        const users = discoverResult.users
          .map(u => normalizeUserProfile(u, u.uid))
          .filter(u => !exclusionSet.has(u.uid));
          
        results.push(...users);
      }

      // 3. Fallback / Recursive Fetch: Directly from Firestore if needed
      // If we don't have enough results, we start a recursive query
      if (results.length < targetLevel) {
        const targetGender = getTargetGender(currentUser);
        let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
        let attempts = 0;
        const maxAttempts = 5; // Prevent Infinite Loops

        while (results.length < targetLevel && attempts < maxAttempts) {
          attempts++;
          
          let q = query(
            collection(db, "users"),
            where("social.enabled", "==", true),
            where("social.profileCompleted", "==", true),
            where("social.visible", "==", true),
            where("social.gender", "==", targetGender),
            limit(50) // Increased from 10 to 50 for wider scan
          );

          if (lastDoc) {
            q = query(q, startAfter(lastDoc));
          }

          const snapshot = await getDocs(q);
          if (snapshot.empty) break;

          lastDoc = snapshot.docs[snapshot.docs.length - 1];

          for (const doc of snapshot.docs) {
            if (!exclusionSet.has(doc.id)) {
              const user = normalizeUserProfile(doc.data(), doc.id);
              if (!results.some(r => r.uid === user.uid)) {
                results.push(user);
              }
              if (results.length >= targetLevel) break;
            }
          }
        }
      }

      // 4. Update Cache (Flexible timing)
      cacheManager.set("match_feed", {
        potentialMatches: results,
        swipedUserIds: Array.from(exclusionSet),
        _timestamp: Date.now()
      }, 300, true); // Reduced to 5 mins instead of 10 for better sync

      return results;
    } catch (error) {
      console.error("matchingService: Error fetching matches:", error);
      return results;
    }
  },

  /**
   * Tracks a swipe in the current session to prevent "ghost" candidates
   * from appearing again before a full re-fetch.
   */
  trackSwipe(targetUserId: string) {
    swipedInSession.add(targetUserId);
    
    // Sync with other swiped ID caches
    const cachedSwiped = cacheManager.get<string[]>("socialSwipedIds") || [];
    if (!cachedSwiped.includes(targetUserId)) {
      cacheManager.set("socialSwipedIds", [...cachedSwiped, targetUserId], 86400, true);
    }
    
    // Invalidate match feed cache partially or just update it
    const feed = cacheManager.get<any>("match_feed");
    if (feed && feed.potentialMatches) {
      feed.potentialMatches = feed.potentialMatches.filter((u: any) => u.uid !== targetUserId);
      feed.swipedUserIds = [...(feed.swipedUserIds || []), targetUserId];
      cacheManager.set("match_feed", feed, 300, true);
    }
  },

  /**
   * Clears session swipes if needed (e.g. on log out or deep refresh)
   */
  resetSessionSwipes() {
    swipedInSession.clear();
  }
};
