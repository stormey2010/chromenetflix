/**
 * Netflix Connect - Main Entry Point
 * Orchestrates all modules for the content script
 */

(() => {
  // Skip sandboxed/child frames to avoid CSP/sandbox errors
  if (window.top !== window) return;

  console.log('[Netflix Connect] Initializing...');

  // Start unified ticker system
  ncTicker.start();

  // Initialize modules that don't need user
  ncInjector.init();
  ncEvents.init();
  ncShareButton.init();
  ncMessages.init();
  
  // Setup user change listener
  ncUser.setupChangeListener();
  
  // Load user and start streams
  ncUser.load().then(() => {
    ncTelemetry.start();
    ncCommands.startStream();
    ncNavigation.init();
    ncNotifications.init();
    ncDriftChecker.start();
    console.log('[Netflix Connect] All modules initialized for user:', ncUser.current);
  });
})();
