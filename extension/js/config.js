/**
 * Netflix Connect - Configuration
 * Shared constants and configuration values
 */

// API endpoints - Change to localhost for local development
const NC_API_BASE = 'http://localhost:8765';

// Store the API key here (hardcoded)
const NC_API_KEY = '30b742d6-19c5-429d-a13d-f9a24e1464e6';

const NC_CONFIG = {
  API_KEY: NC_API_KEY,
  API_BASE: NC_API_BASE,
  ENDPOINTS: {
    TELEMETRY: `${NC_API_BASE}/telemetry`,
    EVENTS_STREAM: `${NC_API_BASE}/events/stream`,
    COMMAND_STREAM: `${NC_API_BASE}/command/stream`,
    NAV_UPDATE: `${NC_API_BASE}/nav/update`,
    NAV_STREAM: `${NC_API_BASE}/nav/stream`,
    COMMAND: `${NC_API_BASE}/command`,
    SYNC: `${NC_API_BASE}/sync`,
    SYNC_DRIFT: `${NC_API_BASE}/sync/drift`,
    INVITE_STREAM: `${NC_API_BASE}/invite/stream`,
    INVITE_SEND: `${NC_API_BASE}/invite/send`,
    INVITE_ACCEPT: `${NC_API_BASE}/invite/accept`,
    INVITE_REJECT: `${NC_API_BASE}/invite/reject`,
    INVITE_STATUS: `${NC_API_BASE}/invite/status`,
    // Library endpoints
    WATCHLIST: `${NC_API_BASE}/watchlist`,
    WATCHLIST_ADD: `${NC_API_BASE}/watchlist/add`,
    WATCHLIST_REMOVE: `${NC_API_BASE}/watchlist/remove`,
    STATS: `${NC_API_BASE}/stats`,
    STATS_UPDATE: `${NC_API_BASE}/stats/update`,
    SESSION_START: `${NC_API_BASE}/session/start`,
    SESSION_END: `${NC_API_BASE}/session/end`,
  },
  
  // Timing constants
  TELEMETRY_INTERVAL_MS: 2000,
  URL_POLL_INTERVAL_MS: 500,
  MODAL_POLL_INTERVAL_MS: 300,
  SLOW_DEBOUNCE_MS: 400,
  FAST_DEBOUNCE_MS: 100,
  THROTTLE_MS: 300,
  NAV_DELAY_MS: 500,
  SHARE_DISPLAY_MS: 1500,
  DRIFT_CHECK_INTERVAL_MS: 120000,  // 2 minutes
  DRIFT_THRESHOLD_S: 5,  // 5 seconds
  
  // Retry settings
  INITIAL_RETRY_MS: 500,
  MAX_RETRY_MS: 5000,
};

// Utility to ensure HTTPS
function ncForceHttps(url) {
  return url.replace(/^http:\/\//i, 'https://');
}

// Build API URL helper
function ncApiUrl(path) {
  return ncForceHttps(new URL(path, NC_CONFIG.API_BASE).toString());
}
