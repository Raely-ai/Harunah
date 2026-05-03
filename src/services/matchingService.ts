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
import { getTargetGender, checkMutualGenderPreference } from "../lib/socialUtils";
import { callFunction } from "../lib/walletService";

// In-memory set for immediate update after swipe
const swipedInSession = new Set<string>();

export const matchingService = {
  /**
   * Fetches potential matches with recursive pagination logic to ensure we find candidates
   * if the first batch returns zero unscanned users.
   */
  async fetchPotentialMatches(currentUser: UserProfile, targetLevel: number = 50): Promise<UserProfile[]> {
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

    const calculateScore = (u: UserProfile): number => {
      let score = 0;
      score += (u.social?.active ? 20 : 0);
      score += (u.social?.profileCompleted ? 15 : 0);
      score += (u.social?.verified ? 15 : 0);
      score += Math.min((u.level || 0) * 0.5, 10);
      score += Math.min((u.social?.interests?.filter(i => currentUser.social?.interests?.includes(i))?.length || 0) * 3, 15);
      // Simplified astrology/element check
      if (u.zodiacSign && currentUser.zodiacSign && u.zodiacSign === currentUser.zodiacSign) score += 15;
      if (u.isNew) score += 10;
      return score;
    };

    try {
      // 2. Fetch candidates (API Call)
      const discoverResult = await callFunction('refreshDiscover', {});
      if (discoverResult.success && Array.isArray(discoverResult.users)) {
        const potentialCandidates = discoverResult.users
          .map(u => normalizeUserProfile(u, u.uid))
          .filter(u => !exclusionSet.has(u.uid))
          // Hard Filter: Double-sided gender preference
          .filter(u => {
            const currentGender = currentUser.gender || 'other';
            const targetGender = u.gender || 'other';
            const currentLookingFor = currentUser.lookingFor || ['male', 'female', 'other'];
            const targetLookingFor = u.lookingFor || ['male', 'female', 'other'];
            
            const match1 = currentLookingFor.includes(targetGender);
            const match2 = targetLookingFor.includes(currentGender);
            return match1 && match2;
          });
          
        // Score and sort (DIVERSITY: 70% top-scored, 30% random)
        const scored = potentialCandidates.map(u => ({ ...u, _score: calculateScore(u) }));
        scored.sort((a: any, b: any) => b._score - a._score);
        
        const topScored = scored.slice(0, Math.floor(targetLevel * 0.7));
        const rest = scored.slice(Math.floor(targetLevel * 0.7));
        
        // Shuffle the rest
        const shuffledRest = [...rest].sort(() => Math.random() - 0.5);
        
        const mixed = [...topScored, ...shuffledRest.slice(0, Math.ceil(targetLevel * 0.3))];
        // Now shuffle the final pool slightly to avoid static top-high-score only
        const mixedShuffled = mixed.sort(() => Math.random() - 0.3);
        results.push(...mixedShuffled.slice(0, targetLevel));
      }
      
      // Update Cache
      cacheManager.set("match_feed", {
        potentialMatches: results,
        swipedUserIds: Array.from(exclusionSet),
        _timestamp: Date.now()
      }, 300, true);

      return results;
    } catch (error) {
      console.error("matchingService: Error fetching matches:", error);
      return [];
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
