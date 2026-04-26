import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER_PROFILE: '@oncoconnect_user_profile',
  CONVERSATIONS: '@oncoconnect_conversations',
  ACTIVE_CONVERSATION: '@oncoconnect_active_conversation',
};

const MAX_CONVERSATIONS = 100;

// ─── User Profile ───────────────────────────────────────────────────────────

/**
 * Save user health profile (age, gender, risk factors) across sessions.
 * @param {object} profile
 */
export const saveUserProfile = async (profile) => {
  try {
    const existing = await loadUserProfile();
    const merged = { ...existing, ...profile, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.error('saveUserProfile error:', err);
    return null;
  }
};

/**
 * Load persisted user profile.
 * @returns {Promise<object|null>}
 */
export const loadUserProfile = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.USER_PROFILE);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('loadUserProfile error:', err);
    return null;
  }
};

// ─── Conversations ──────────────────────────────────────────────────────────

/**
 * Save a conversation session.
 * @param {string} conversationId
 * @param {Array} messages
 * @param {object} triageState
 */
export const saveConversation = async (conversationId, messages, triageState) => {
  try {
    const all = await loadConversations();
    const existing = all.findIndex((c) => c.id === conversationId);
    const entry = {
      id: conversationId,
      messages,
      triageState,
      updatedAt: new Date().toISOString(),
      preview: messages.filter((m) => m.isUser).slice(-1)[0]?.text || '',
    };

    if (existing >= 0) {
      all[existing] = entry;
    } else {
      all.unshift(entry);
    }

    // Keep only the latest N conversations
    const trimmed = all.slice(0, MAX_CONVERSATIONS);
    await AsyncStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(trimmed));
    return true;
  } catch (err) {
    console.error('saveConversation error:', err);
    return false;
  }
};

/**
 * Load all saved conversations (newest first).
 * @returns {Promise<Array>}
 */
export const loadConversations = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CONVERSATIONS);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('loadConversations error:', err);
    return [];
  }
};

/**
 * Delete a single conversation by ID.
 * @param {string} conversationId
 */
export const deleteConversation = async (conversationId) => {
  try {
    const all = await loadConversations();
    const filtered = all.filter((c) => c.id !== conversationId);
    await AsyncStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('deleteConversation error:', err);
    return false;
  }
};

// ─── Active Conversation (auto-resume) ──────────────────────────────────────

/**
 * Save the currently active conversation for auto-resume on next app launch.
 */
export const saveActiveConversation = async (conversationId, messages, triageState) => {
  try {
    await AsyncStorage.setItem(
      KEYS.ACTIVE_CONVERSATION,
      JSON.stringify({ id: conversationId, messages, triageState, savedAt: new Date().toISOString() })
    );
    return true;
  } catch (err) {
    console.error('saveActiveConversation error:', err);
    return false;
  }
};

/**
 * Load the last active conversation for resume.
 * @returns {Promise<{id: string, messages: Array, triageState: object}|null>}
 */
export const loadActiveConversation = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ACTIVE_CONVERSATION);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('loadActiveConversation error:', err);
    return null;
  }
};

/**
 * Clear the active conversation marker (e.g. when user starts a new chat).
 */
export const clearActiveConversation = async () => {
  try {
    await AsyncStorage.removeItem(KEYS.ACTIVE_CONVERSATION);
    return true;
  } catch (err) {
    console.error('clearActiveConversation error:', err);
    return false;
  }
};

// ─── Danger Zone ────────────────────────────────────────────────────────────

/**
 * Wipe all persisted data (profile + conversations).
 */
export const clearAllData = async () => {
  try {
    await AsyncStorage.multiRemove(Object.values(KEYS));
    return true;
  } catch (err) {
    console.error('clearAllData error:', err);
    return false;
  }
};

export default {
  saveUserProfile,
  loadUserProfile,
  saveConversation,
  loadConversations,
  deleteConversation,
  saveActiveConversation,
  loadActiveConversation,
  clearActiveConversation,
  clearAllData,
};
