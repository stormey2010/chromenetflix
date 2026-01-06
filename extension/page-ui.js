(() => {
  if (window.__np_ui_installed) return;
  window.__np_ui_installed = true;

  const HELPER_ID = 'netflix-party-connected-message';
  const NOTIFY_ID = 'np-helper-notify';
  let observer = null;
  let target = null;

  function ensureHelper() {
    let el = document.getElementById(HELPER_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = HELPER_ID;
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:8px;height:8px;background:#e50914;border-radius:50%;animation:npPulse 1.5s infinite;"></div>
          <span>Watching Together</span>
        </div>
      `;
      el.style.cssText = [
        'position:fixed',
        'left:50%',
        'top:20px',
        'transform:translateX(-50%) translateY(-10px)',
        'padding:12px 20px',
        'border-radius:4px',
        'background:rgba(0,0,0,0.85)',
        'backdrop-filter:blur(10px)',
        'color:#ffffff',
        'font-size:14px',
        'font-weight:600',
        'font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'letter-spacing:0.5px',
        'z-index:1000000',
        'pointer-events:none',
        'box-shadow:0 4px 20px rgba(0,0,0,0.5),0 0 0 1px rgba(229,9,20,0.3)',
        'opacity:0',
        'transition:opacity 0.3s ease,transform 0.3s ease'
      ].join(';');
      
      // Add pulse animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes npPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `;
      document.head.appendChild(style);
      
      (document.body || document.documentElement).appendChild(el);
    }
    return el;
  }

  function setVisible(isVisible) {
    const el = ensureHelper();
    el.style.opacity = isVisible ? '1' : '0';
    el.style.transform = isVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-10px)';
  }

  function evaluate() {
    if (!target) return;
    const isActive = target.classList.contains('active');
    setVisible(isActive);
  }

  function attachObserver() {
    if (!target) return;
    observer = new MutationObserver(evaluate);
    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
    evaluate();
  }
 
  function findTargetAndWatch(attempts = 0) {
    if (target) return;
    target = document.querySelector('div[data-uia="player"]');
    if (target) {
      attachObserver();
      return;
    }
    if (attempts > 20) return;
    setTimeout(() => findTargetAndWatch(attempts + 1), 250);
  }

  findTargetAndWatch();

  // Lightweight toast-style notification callable from the page context.
  function ensureNotify() {
    let el = document.getElementById(NOTIFY_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = NOTIFY_ID;
      el.style.cssText = [
        'position:fixed',
        'bottom:100px',
        'left:30px',
        'transform:translateX(-20px)',
        'max-width:320px',
        'padding:16px 20px',
        'background:rgba(0,0,0,0.9)',
        'backdrop-filter:blur(10px)',
        'color:#ffffff',
        'font-size:15px',
        'font-weight:500',
        'font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'border-radius:4px',
        'border-left:4px solid #e50914',
        'box-shadow:0 8px 30px rgba(0,0,0,0.4)',
        'z-index:1000001',
        'opacity:0',
        'transition:opacity 0.3s ease,transform 0.3s ease',
        'pointer-events:none',
        'will-change:opacity,transform'
      ].join(';');
      (document.body || document.documentElement).appendChild(el);
    }
    return el;
  }

  let hideTimer = null;

  window.npShowHelperNote = function npShowHelperNote(message = 'Helper ping') {
    const el = ensureNotify();
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    el.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="width:24px;height:24px;background:linear-gradient(135deg,#e50914,#b20710);border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="font-size:12px;">N</span>
        </div>
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#808080;margin-bottom:4px;">Netflix Connect</div>
          <div>${message}</div>
        </div>
      </div>
    `;
    el.style.opacity = '1';
    el.style.transform = 'translateX(0)';
    hideTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-20px)';
    }, 5200);
  };
})();
