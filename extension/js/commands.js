/**
 * Netflix Connect - Commands Module
 * Handles receiving and executing playback commands
 */

const ncCommands = {
  stream: null,
  
  // Start command stream using shared SSE factory
  startStream() {
    if (this.stream) {
      this.stream.stop();
    }

    this.stream = ncCreateSSE(
      NC_CONFIG.ENDPOINTS.COMMAND_STREAM,
      (data) => this.handleMessage(data),
      { onOpen: () => console.log('[Netflix Connect] Command stream connected') }
    );
    this.stream.start();
  },
  
  // Stop command stream
  stopStream() {
    if (this.stream) {
      this.stream.stop();
      this.stream = null;
    }
  },
  
  // Handle incoming message
  handleMessage(data) {
    if (!data?.command) return;
    if (data.target_user && data.target_user !== ncUser.current) return;
    this.execute(data);
  },
  
  // Execute a command
  execute(data) {
    // Handle share command
    if (data.command === 'share' && data.url) {
      const title = data.title || 'content';
      const sourceUser = data.source_user || 'Partner';
      console.log(`[Netflix Connect] Received share: ${title} -> ${data.url}`);
      
      // Show rich notification instead of simple note
      if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
        ncNotifications.showShareReceived(sourceUser, title, data.url);
      } else if (typeof window.npShowHelperNote === 'function') {
        window.npShowHelperNote(`${sourceUser} shared "${title}" with you!`);
        setTimeout(() => {
          window.location.href = data.url;
        }, NC_CONFIG.SHARE_DISPLAY_MS);
      }
      
      // Don't auto-navigate - let user click the notification button
      return;
    }
    
    // Handle playback commands
    const video = ncGetVideo();
    if (!video) return;
    
    switch (data.command) {
      case 'play':
        video.play().catch(() => {});
        ncTelemetry.push({ action: 'dashboard_play' });
        break;
        
      case 'pause':
        video.pause();
        ncTelemetry.push({ action: 'dashboard_pause' });
        break;
        
      case 'seek':
        if (Number.isFinite(data.seconds)) {
          window.dispatchEvent(
            new CustomEvent('np-seek', { detail: { ms: Number(data.seconds) * 1000 } })
          );
          ncTelemetry.push({ action: 'dashboard_seek' });
        }
        break;
      
      // === Sync commands from partner ===
      case 'sync_pause':
        // Partner paused - pause our video and optionally seek to their time
        console.log(`[Netflix Connect] Sync pause received @ ${data.seconds}s`);
        
        // Check video is ready before acting
        if (video.readyState < 2) {
          console.log('[Netflix Connect] Video not ready, skipping sync_pause');
          break;
        }
        
        ncEvents.syncState.ignoreNextEvent = true;
        video.pause();
        
        // Only seek if a valid time > 0 is provided and difference is significant
        if (Number.isFinite(data.seconds) && data.seconds > 0) {
          const diff = Math.abs(video.currentTime - data.seconds);
          if (diff > 2) {  // Only seek if more than 2 seconds off
            ncEvents.syncState.ignoreNextEvent = true;
            window.dispatchEvent(
              new CustomEvent('np-seek', { detail: { ms: Number(data.seconds) * 1000 } })
            );
          }
        }
        ncTelemetry.push({ action: 'sync_pause_received' });
        break;
        
      case 'sync_play':
        // Partner played - seek to their time and play
        console.log(`[Netflix Connect] Sync play received @ ${data.seconds}s`);
        
        // Check video is ready before acting
        if (video.readyState < 2) {
          console.log('[Netflix Connect] Video not ready, skipping sync_play');
          break;
        }
        
        // Only seek if difference is significant
        if (Number.isFinite(data.seconds)) {
          const diff = Math.abs(video.currentTime - data.seconds);
          if (diff > 2) {  // Only seek if more than 2 seconds off
            ncEvents.syncState.ignoreNextEvent = true;
            window.dispatchEvent(
              new CustomEvent('np-seek', { detail: { ms: Number(data.seconds) * 1000 } })
            );
          }
        }
        ncEvents.syncState.ignoreNextEvent = true;
        video.play().catch(() => {});
        ncTelemetry.push({ action: 'sync_play_received' });
        break;
        
      case 'sync_seek':
        // Partner seeked/fast-forwarded - seek to their time
        console.log(`[Netflix Connect] Sync seek received @ ${data.seconds}s`);
        
        // Check video is ready before acting
        if (video.readyState < 2) {
          console.log('[Netflix Connect] Video not ready, skipping sync_seek');
          break;
        }
        
        if (Number.isFinite(data.seconds)) {
          const diff = Math.abs(video.currentTime - data.seconds);
          if (diff > 2) {  // Only seek if more than 2 seconds off
            ncEvents.syncState.ignoreNextEvent = true;
            window.dispatchEvent(
              new CustomEvent('np-seek', { detail: { ms: Number(data.seconds) * 1000 } })
            );
            ncTelemetry.push({ action: 'sync_seek_received' });
          } else {
            console.log(`[Netflix Connect] Skipping seek - only ${diff.toFixed(1)}s difference`);
          }
        }
        break;
    }
  }
};
