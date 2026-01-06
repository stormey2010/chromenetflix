/**
 * Netflix Connect - User Management
 * Handles user identity and storage
 */

const ncUser = {
  current: null,
  loaded: false,
  
  async load() {
    try {
      const res = await chrome.storage.sync.get(['user']);
      if (res?.user) {
        this.current = res.user;
        console.log('[Netflix Connect] User loaded:', this.current);
      } else {
        this.current = 'unknown';
        console.warn('[Netflix Connect] No user set in storage');
      }
    } catch (e) {
      this.current = 'unknown';
      console.error('[Netflix Connect] Failed to load user:', e);
    }
    this.loaded = true;
    return this.current;
  },
  
  setupChangeListener() {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.user) {
        this.current = changes.user.newValue || 'unknown';
        console.log('[Netflix Connect] User changed to:', this.current);
      }
    });
  }
};
