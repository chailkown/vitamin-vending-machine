export const getProfileStorageKey = (userId) => `health-app-profile-v1-${userId}`;
export const loadUserProfile = (storage, userId, fallback) => {
  if (!userId) return { ...fallback };
  try {
    const value = JSON.parse(storage.getItem(getProfileStorageKey(userId)) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? { ...fallback, ...value } : { ...fallback };
  } catch { return { ...fallback }; }
};
// Persist only on an explicit save, never an empty fallback on mount.
export const saveUserProfile = (storage, userId, profile) => {
  if (!userId) throw new Error('로그인이 필요합니다.');
  storage.setItem(getProfileStorageKey(userId), JSON.stringify(profile));
};
