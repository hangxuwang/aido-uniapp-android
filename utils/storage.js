const STORAGE_KEY = 'aido_local_state_v1';

const defaultState = {
  sshProfiles: [],
  aiProfiles: [],
  activeSshProfileId: '',
  activeAiProfileId: '',
  activeConversationId: '',
  conversations: []
};

function safeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadState() {
  try {
    const saved = uni.getStorageSync(STORAGE_KEY);
    if (!saved) {
      return safeClone(defaultState);
    }
    return {
      ...safeClone(defaultState),
      ...saved
    };
  } catch (error) {
    console.warn('loadState failed', error);
    return safeClone(defaultState);
  }
}

export function saveState(state) {
  uni.setStorageSync(STORAGE_KEY, safeClone(state));
}

export function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function upsertById(list, item) {
  const next = [...list];
  const index = next.findIndex((row) => row.id === item.id);
  if (index >= 0) {
    next.splice(index, 1, item);
  } else {
    next.unshift(item);
  }
  return next;
}
