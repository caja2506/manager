/**
 * Team Domain Module
 * ==================
 * [Phase M.3] Ownership barrel for team management,
 * user profiles, RBAC, and Telegram integration.
 */

// --- Data Hook ---
export { useEngineeringData } from '../../hooks/useEngineeringData';

// --- Services ---
export {
    subscribeToRbacUsers,
    subscribeToUserProfiles,
    updateRbacRole,
    updateUserDisplayName,
    removeRbacUser,
} from '../../services/userAdminService';

export {
    getUserProfile,
    updateUserProfile,
    ensureUserProfile,
} from '../../services/userProfileService';

export {
    initializeUserSettings,
    saveUserSetting,
    getUserSettings,
} from '../../services/userSettingsHelpers';

// --- Notifications ---
export {
    subscribeToNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from '../../services/notificationService';
