/**
 * Shared store for tracking processed notification IDs across
 * Firestore listeners and Push Notification listeners.
 * Prevents double toasts when both fire for the same event.
 */
export const processedNotificationIds = new Set<string>();

/**
 * Clean up old IDs periodically to keep memory usage low
 */
export const cleanupOldNotificationIds = () => {
    if (processedNotificationIds.size > 200) {
        const idsArray = Array.from(processedNotificationIds);
        const toKeep = idsArray.slice(idsArray.length - 100);
        processedNotificationIds.clear();
        toKeep.forEach(id => processedNotificationIds.add(id));
    }
};

/**
 * Check if a notification / message ID has already been processed
 */
export const isNotificationProcessed = (id: string | null | undefined): boolean => {
    if (!id) return false;
    return processedNotificationIds.has(id);
};

/**
 * Mark a notification / message ID as processed
 */
export const markNotificationProcessed = (id: string | null | undefined) => {
    if (!id) return;
    processedNotificationIds.add(id);
    cleanupOldNotificationIds();
};
