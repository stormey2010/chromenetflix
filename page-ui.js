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
      el.textContent = 'Netflix Party Connected';
      el.style.cssText = [
        'position:fixed',
        'left:50%',
        'top:24px',
        'transform:translateX(-50%)',
        'padding:8px 12px',
        'border-radius:10px',
        'background:rgba(12, 16, 24, 0)',
        'color:#e5e7eb',
        'font-size:15px',
        'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'z-index:1000000',
        'pointer-events:none',
        'box-shadow:0 8px 30px rgba(0,0,0,0.35)',
        'opacity:0'
      ].join(';');
      (document.body || document.documentElement).appendChild(el);
    }
    return el;
  }

  function setVisible(isVisible) {
    const el = ensureHelper();
    el.style.opacity = isVisible ? '1' : '0';
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
        'top:10%',
        'left:25px',
        'transform:translateY(-8px)',
        'max-width:260px',
        'padding:15px 18px',
        'color:#e5e7eb',
        'font-size:17px',
        'border-left:2px solid #e71414ff',
        'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'z-index:1000001',
        'opacity:0',
        'transition:opacity 260ms ease, transform 260ms ease',
        'pointer-events:none',
        'will-change:opacity, transform'
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
    el.textContent = message;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    hideTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
    }, 5200);
  };
})();
