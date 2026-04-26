/**
 * Tests for storage.js
 *
 * Verifies:
 * - Save/load user profile round-trip
 * - Save/load conversation round-trip
 * - Active conversation save/load/clear
 * - Clear all data
 */

// Mock AsyncStorage
const mockStorage = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key, value) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  getItem: jest.fn((key) => {
    return Promise.resolve(mockStorage[key] || null);
  }),
  removeItem: jest.fn((key) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys) => {
    keys.forEach((key) => delete mockStorage[key]);
    return Promise.resolve();
  }),
}));

const {
  saveUserProfile,
  loadUserProfile,
  saveConversation,
  loadConversations,
  deleteConversation,
  saveActiveConversation,
  loadActiveConversation,
  clearActiveConversation,
  clearAllData,
} = require('../storage');

beforeEach(() => {
  // Clear mock storage between tests
  Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  jest.clearAllMocks();
});

// ─── User Profile ───────────────────────────────────────────────────────────

describe('User Profile', () => {
  test('saves and loads a user profile', async () => {
    await saveUserProfile({ age: 45, gender: 'male', smoking: true });
    const profile = await loadUserProfile();
    expect(profile).not.toBeNull();
    expect(profile.age).toBe(45);
    expect(profile.gender).toBe('male');
    expect(profile.smoking).toBe(true);
  });

  test('merges new data into existing profile', async () => {
    await saveUserProfile({ age: 45, gender: 'male' });
    await saveUserProfile({ smoking: false });
    const profile = await loadUserProfile();
    expect(profile.age).toBe(45);
    expect(profile.gender).toBe('male');
    expect(profile.smoking).toBe(false);
  });

  test('returns null when no profile exists', async () => {
    const profile = await loadUserProfile();
    expect(profile).toBeNull();
  });

  test('adds updatedAt timestamp', async () => {
    await saveUserProfile({ age: 30 });
    const profile = await loadUserProfile();
    expect(profile.updatedAt).toBeDefined();
  });
});

// ─── Conversations ──────────────────────────────────────────────────────────

describe('Conversations', () => {
  const sampleMessages = [
    { id: '1', text: 'Hello', isUser: true, timestamp: new Date().toISOString() },
    { id: '2', text: 'Hi there!', isUser: false, timestamp: new Date().toISOString() },
  ];

  test('saves and loads a conversation', async () => {
    await saveConversation('conv-1', sampleMessages, { stage: 'initial' });
    const convos = await loadConversations();
    expect(convos.length).toBe(1);
    expect(convos[0].id).toBe('conv-1');
    expect(convos[0].messages).toHaveLength(2);
  });

  test('updates an existing conversation', async () => {
    await saveConversation('conv-1', sampleMessages, { stage: 'initial' });
    const moreMessages = [
      ...sampleMessages,
      { id: '3', text: 'Follow up', isUser: true, timestamp: new Date().toISOString() },
    ];
    await saveConversation('conv-1', moreMessages, { stage: 'gathering' });
    const convos = await loadConversations();
    expect(convos.length).toBe(1);
    expect(convos[0].messages).toHaveLength(3);
  });

  test('stores multiple conversations', async () => {
    await saveConversation('conv-1', sampleMessages, {});
    await saveConversation('conv-2', sampleMessages, {});
    const convos = await loadConversations();
    expect(convos.length).toBe(2);
  });

  test('deletes a conversation by ID', async () => {
    await saveConversation('conv-1', sampleMessages, {});
    await saveConversation('conv-2', sampleMessages, {});
    await deleteConversation('conv-1');
    const convos = await loadConversations();
    expect(convos.length).toBe(1);
    expect(convos[0].id).toBe('conv-2');
  });

  test('returns empty array when no conversations exist', async () => {
    const convos = await loadConversations();
    expect(convos).toEqual([]);
  });
});

// ─── Active Conversation ────────────────────────────────────────────────────

describe('Active Conversation', () => {
  test('saves and loads active conversation', async () => {
    const messages = [{ id: '1', text: 'test', isUser: true }];
    await saveActiveConversation('active-1', messages, { stage: 'initial' });
    const active = await loadActiveConversation();
    expect(active).not.toBeNull();
    expect(active.id).toBe('active-1');
    expect(active.messages).toHaveLength(1);
  });

  test('clears active conversation', async () => {
    await saveActiveConversation('active-1', [], {});
    await clearActiveConversation();
    const active = await loadActiveConversation();
    expect(active).toBeNull();
  });
});

// ─── Clear All Data ─────────────────────────────────────────────────────────

describe('clearAllData', () => {
  test('removes all stored data', async () => {
    await saveUserProfile({ age: 50 });
    await saveConversation('conv-1', [], {});
    await saveActiveConversation('active-1', [], {});
    
    await clearAllData();
    
    const profile = await loadUserProfile();
    const convos = await loadConversations();
    const active = await loadActiveConversation();
    
    expect(profile).toBeNull();
    expect(convos).toEqual([]);
    expect(active).toBeNull();
  });
});
