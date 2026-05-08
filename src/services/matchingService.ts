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
import { getTargetGender, checkGenderPreference } from "../lib/socialUtils";
import { callFunction } from "../lib/walletService";

// In-memory set for immediate update after swipe
const swipedInSession = new Set<string>();

export const matchingService = {
  /**
   * Fetches potential matches with recursive pagination logic to ensure we find candidates
   * if the first batch returns zero unscanned users.
   */
  async fetchPotentialMatches(currentUser: UserProfile, targetLevel: number = 50): Promise<UserProfile[]> {
    console.log(`[fetchPotentialMatches] DEBUG START: currentUser=${currentUser.uid}`);
    
    const uid = currentUser.uid;
    const results: UserProfile[] = [];
    
    // 1. Get exclusion list AND fetch candidates in parallel
    let swipedIds: string[] = [];
    
    try {
      console.log(`[fetchPotentialMatches] DEBUG: Parallel fetching swipedIds and refreshDiscover...`);
      const parallelStart = performance.now();
      const [swipedResults, discoverResult] = await Promise.all([
        (async () => {
          const start = performance.now();
          const res = await socialService.getSwipedUserIds(uid).catch(() => []);
          console.log(`[MATCH_PERF_SWIPED_IDS_MS] ${ (performance.now() - start).toFixed(2) }ms`);
          return res;
        })(),
        (async () => {
          const start = performance.now();
          const res = await callFunction('refreshDiscover', { mode: 'match' });
          console.log(`[MATCH_PERF_BACKEND_CALL_MS] ${ (performance.now() - start).toFixed(2) }ms`);
          return res;
        })()
      ]);
      console.log(`[MATCH_PERF_PARALLEL_TOTAL_MS] ${ (performance.now() - parallelStart).toFixed(2) }ms`);

      swipedIds = swipedResults;
      
      console.log(`[fetchPotentialMatches] DEBUG ROOT BACKEND RESULT:`, JSON.stringify({
        success: discoverResult?.success,
        hasUsers: !!discoverResult?.users,
        usersLen: discoverResult?.users?.length,
        status: discoverResult?.status
      }));

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
        if (u.zodiacSign && currentUser.zodiacSign && u.zodiacSign === currentUser.zodiacSign) score += 15;
        if (u.isNew) score += 10;
        return score;
      };

      const filterStart = performance.now();
      if (discoverResult.success && Array.isArray(discoverResult.users)) {
        console.log(`[fetchPotentialMatches] DEBUG BACKEND RETURNED: count=${discoverResult.users.length}, UIDs: ${discoverResult.users.map((u:any) => u.uid).join(',')}`);
        let potentialCandidates = discoverResult.users
          .map(u => normalizeUserProfile(u, u.uid))
          .filter(u => !exclusionSet.has(u.uid))
          .map(u => {
            const normalizeGender = (g: any): string => {
              if (!g) return "unknown";
              const lower = String(g).toLowerCase();
              if (lower === "erkek" || lower === "male" || lower === "man" || lower === "adam") return "male";
              if (lower === "kadın" || lower === "kadin" || lower === "female" || lower === "woman" || lower === "bayan") return "female";
              return "unknown";
            };

            const normalizeLookingFor = (lf: any): string[] => {
              if (!lf) return ["male", "female"]; 
              const p = Array.isArray(lf) ? lf.map(i => String(i).toLowerCase()) : [String(lf).toLowerCase()];
              let result: string[] = [];
              p.forEach(val => {
                if (val === "erkek" || val === "male" || val === "man" || val === "adam") result.push("male");
                if (val === "kadın" || val === "kadin" || val === "female" || val === "woman" || val === "bayan") result.push("female");
                if (val === "herkes" || val === "all" || val === "arkadaş" || val === "arkadas") {
                  result.push("male");
                  result.push("female");
                }
              });
              if (result.length === 0) return ["male", "female"];
              return result;
            };

            const currentGender = normalizeGender(currentUser.social?.gender || currentUser.gender);
            const targetGender = normalizeGender(u.socialGender || u.social?.gender || u.gender);
            
            // Automatic opposite gender target
            let currentOppositeGender = ["male", "female"];
            if (currentGender === "male") currentOppositeGender = ["female"];
            else if (currentGender === "female") currentOppositeGender = ["male"];

            // targetLookingFor is just for _mutualMatch score bonus
            const targetLookingFor = normalizeLookingFor(u.socialLookingFor || u.social?.lookingFor || u.lookingFor);

            const match1 = currentOppositeGender.includes(targetGender); // Do I want to see them?
            const match2 = targetLookingFor.includes(currentGender); // Do they want to see me?
            
            (u as any)._mutualMatch = match2; 
            (u as any)._iWantThem = match1;
            
            return u;
          })
          .filter(u => (u as any)._iWantThem); // ONLY SHOW who I want to see.
          
        if (potentialCandidates.length < 5 && discoverResult.users.length > 0) {
           console.warn(`[fetchPotentialMatches] DEBUG: Pool is low (${potentialCandidates.length})! Relaxing session exclusions.`);
           
           // Fallback: Focus only on strict swipedIds & blocked users
           const strictExclusionSet = new Set<string>([uid, ...swipedIds, ...blockedIds]);
           const relaxedCandidates = discoverResult.users
             .map(u => normalizeUserProfile(u, u.uid))
             .filter(u => !strictExclusionSet.has(u.uid))
             .map(u => {
               const normalizeGender = (g: any): string => {
                 if (!g) return "unknown";
                 const lower = String(g).toLowerCase();
                 if (lower === "erkek" || lower === "male" || lower === "man" || lower === "adam") return "male";
                 if (lower === "kadın" || lower === "kadin" || lower === "female" || lower === "woman" || lower === "bayan") return "female";
                 return "unknown";
               };
               const targetGender = normalizeGender(u.socialGender || u.social?.gender || u.gender);
               const currentGender = normalizeGender(currentUser.social?.gender || currentUser.gender);
               
               let currentOppositeGender = ["male", "female"];
               if (currentGender === "male") currentOppositeGender = ["female"];
               else if (currentGender === "female") currentOppositeGender = ["male"];
               
               const targetLookingFor = (function(lf: any): string[] {
                  if (!lf) return ["male", "female"];
                  const p = Array.isArray(lf) ? lf.map(i => String(i).toLowerCase()) : [String(lf).toLowerCase()];
                  let result: string[] = [];
                  p.forEach(val => {
                    if (val === "erkek" || val === "male" || val === "man" || val === "adam") result.push("male");
                    if (val === "kadın" || val === "kadin" || val === "female" || val === "woman" || val === "bayan") result.push("female");
                    if (val === "herkes" || val === "all" || val === "arkadaş" || val === "arkadas") { result.push("male"); result.push("female"); }
                  });
                  if (result.length === 0) return ["male", "female"];
                  return result;
               })(u.socialLookingFor || u.social?.lookingFor || u.lookingFor);

               const match1 = currentOppositeGender.includes(targetGender); // Do I want to see them?
               const match2 = targetLookingFor.includes(currentGender); // Do they want to see me?

               (u as any)._mutualMatch = match2;
               (u as any)._iWantThem = match1;

               return u;
             })
             .filter(u => (u as any)._iWantThem);
             
             if (relaxedCandidates.length > 0) {
               console.log(`[fetchPotentialMatches] DEBUG Fallback: Recovered ${relaxedCandidates.length} candidates by relaxing session sweeps!`);
               potentialCandidates = relaxedCandidates;
             }
        } else {
           console.log(`[fetchPotentialMatches] DEBUG: After initial filter, ${potentialCandidates.length} potential candidates remain. Raw size: ${discoverResult.users.length}`);
        }

          
        // Score and sort (DIVERSITY: 70% top-scored, 30% random)
        const scored = potentialCandidates.map(u => {
          let s = calculateScore(u);
          if ((u as any)._iWantThem) s += 50; // High bonus if they match what I am looking for
          else s -= 30; // heavy penalty if they don't match my lookingFor (so they go to bottom)

          if ((u as any)._mutualMatch) s += 30; // Solid bonus if they also want to see me
          else s -= 10; // Penalty if they don't want to see me
          return { ...u, _score: s }
        });
        scored.sort((a: any, b: any) => b._score - a._score);
        
        const topScored = scored.slice(0, Math.floor(targetLevel * 0.7));
        const rest = scored.slice(Math.floor(targetLevel * 0.7));
        
        // Shuffle the rest
        const shuffledRest = [...rest].sort(() => Math.random() - 0.5);
        
        const mixed = [...topScored, ...shuffledRest.slice(0, Math.ceil(targetLevel * 0.3))];
        // Now shuffle the final pool slightly to avoid static top-high-score only
        const mixedShuffled = mixed.sort(() => Math.random() - 0.3);
        const finalResults = mixedShuffled.slice(0, targetLevel);
        console.log(`[MATCH_PERF_FILTER_SCORE_MS] ${ (performance.now() - filterStart).toFixed(2) }ms. count: ${finalResults.length}`);
        results.push(...finalResults);
      }
      
      // Update Cache (only if we have results, so we don't accidentally cache an empty pool)
      if (results.length > 0) {
        cacheManager.set("match_feed", {
          potentialMatches: results,
          swipedUserIds: Array.from(exclusionSet),
          _timestamp: Date.now()
        }, 1800, true); // Increased TTL to 30 minutes
      }

      return results;
    } catch (error) {
      console.error("[fetchPotentialMatches] CALL ERROR matchingService: Error fetching matches:", error);
      return [];
    }
  },

  /**
   * Tracks a swipe in the current session to prevent "ghost" candidates
   * from appearing again before a full re-fetch.
   */
  trackSwipe(targetUserId: string, type?: 'like' | 'pass' | 'super_like') {
    swipedInSession.add(targetUserId);
    
    // Sync with other swiped ID caches
    if (type !== 'pass') {
      const cachedSwiped = cacheManager.get<string[]>("socialSwipedIds") || [];
      if (!cachedSwiped.includes(targetUserId)) {
        cacheManager.set("socialSwipedIds", [...cachedSwiped, targetUserId], 86400, true);
      }
    }
    
    // Invalidate match feed cache partially or just update it
    const feed = cacheManager.get<any>("match_feed");
    if (feed && feed.potentialMatches) {
      feed.potentialMatches = feed.potentialMatches.filter((u: any) => u.uid !== targetUserId);
      feed.swipedUserIds = [...(feed.swipedUserIds || []), targetUserId];
      cacheManager.set("match_feed", feed, 1800, true);
    }
  },

  /**
   * Clears session swipes if needed (e.g. on log out or deep refresh)
   */
  resetSessionSwipes() {
    swipedInSession.clear();
  }
};
