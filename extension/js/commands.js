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
    
    // Handle partner left notification
    if (data.command === 'partner_left') {
      const sourceUser = data.source_user || 'Partner';
      console.log(`[Netflix Connect] Partner left video: ${sourceUser}`);
      
      if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
        ncNotifications.showNote(`${sourceUser} stopped watching`, 3000);
      } else if (typeof window.npShowHelperNote === 'function') {
        window.npShowHelperNote(`${sourceUser} stopped watching`);
      }
      return;
    }
    
    // Handle playback commands
    const video = ncGetVideo();
    if (!video) return;
    
    switch (data.command) {
      case 'play':
        video.play().catch(() => {});
        // IMMEDIATE dashboard update for play
        ncTelemetry.push({ action: 'dashboard_play', dashboard_instant: true });
        break;
      case 'pause':
        video.pause();
        // IMMEDIATE dashboard update for pause
        ncTelemetry.push({ action: 'dashboard_pause', dashboard_instant: true });
        break;
      case 'seek':
        if (Number.isFinite(data.seconds)) {
          window.dispatchEvent(
            new CustomEvent('np-seek', { detail: { ms: Number(data.seconds) * 1000 } })
          );
          // IMMEDIATE dashboard update for seek
          ncTelemetry.push({ action: 'dashboard_seek', dashboard_instant: true });
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
      
      // === Speed Sync ===
      case 'sync_speed':
        // Partner changed playback speed - match their speed
        console.log(`[Netflix Connect] Sync speed received: ${data.playback_rate}x`);
        
        if (data.playback_rate && video.playbackRate !== data.playback_rate) {
          ncEvents.syncState.ignoreNextRateChange = true;
          video.playbackRate = data.playback_rate;
          
          if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
            ncNotifications.showNote(`Speed changed to ${data.playback_rate}x`, 2000);
          }
          ncTelemetry.push({ action: 'sync_speed_received' });
        }
        break;
      
      // === Skip Sync (intro/recap/credits) ===
      case 'sync_skip':
        // Partner clicked skip - sync to their position
        console.log(`[Netflix Connect] Sync skip received: ${data.skip_type} @ ${data.seconds}s`);
        
        // Check video is ready before acting
        if (video.readyState < 2) {
          console.log('[Netflix Connect] Video not ready, skipping sync_skip');
          break;
        }
        
        // Seek to where partner is after skip
        if (Number.isFinite(data.seconds)) {
          ncEvents.syncState.ignoreNextEvent = true;
          window.dispatchEvent(
            new CustomEvent('np-seek', { detail: { ms: Number(data.seconds) * 1000 } })
          );
          
          const skipLabel = data.skip_type === 'intro' ? 'Skipped intro' : 
                           data.skip_type === 'recap' ? 'Skipped recap' : 'Skipped credits';
          
          if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
            ncNotifications.showNote(skipLabel + ' (synced)', 2000);
          }
          ncTelemetry.push({ action: `sync_skip_${data.skip_type}_received` });
        }
        break;
      
      // === Tab visibility sync ===
      case 'sync_tab_away':
        // Partner switched away from Netflix tab
        console.log(`[Netflix Connect] Partner switched away from tab`);
        
        // Pause our video too
        ncEvents.syncState.ignoreNextEvent = true;
        video.pause();
        
        if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
          ncNotifications.showNote(`${data.source_user} stepped away`, 3000);
        }
        ncTelemetry.push({ action: 'sync_tab_away_received' });
        break;
      
      case 'sync_tab_back':
        // Partner returned to Netflix tab
        console.log(`[Netflix Connect] Partner returned to tab`);
        
        if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
          ncNotifications.showNote(`${data.source_user} is back!`, 2000);
        }
        ncTelemetry.push({ action: 'sync_tab_back_received' });
        break;
      
      // === Watchlist notification ===
      case 'watchlist_added':
        // Someone added something to watchlist
        console.log(`[Netflix Connect] ${data.added_by} added "${data.title}" to watchlist`);
        
        if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
          // Show different message if it was you or your partner
          if (data.added_by === ncUser.current) {
            ncNotifications.show({
              type: 'info',
              title: 'Added to Watchlist',
              message: `"${data.title}" saved for later`,
              duration: 3000
            });
          } else {
            ncNotifications.show({
              type: 'info',
              title: `${data.added_by} added to Watchlist`,
              message: `"${data.title}"`,
              duration: 4000
            });
          }
        }
        break;
      
      // === Watchlist removed notification ===
      case 'watchlist_removed':
        console.log(`[Netflix Connect] ${data.removed_by} removed "${data.title}" from watchlist`);
        
        if (typeof ncNotifications !== 'undefined' && ncNotifications.container) {
          if (data.removed_by === ncUser.current) {
            ncNotifications.show({
              type: 'info',
              title: 'Removed from Watchlist',
              message: `"${data.title}"`,
              duration: 3000
            });
          } else {
            ncNotifications.show({
              type: 'info',
              title: `${data.removed_by} removed from Watchlist`,
              message: `"${data.title}"`,
              duration: 4000
            });
          }
        }
        break;
    }
  }
};
