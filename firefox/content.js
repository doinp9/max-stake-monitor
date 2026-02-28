// content.js — Firefox version (injects via script tag instead of world: MAIN)

(function () {
  'use strict';

  // ── Inject interceptor into page context via script tag ──
  // Firefox allows extension scripts to bypass page CSP
  const script = document.createElement('script');
  script.src = browser.runtime.getURL('injected.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  // ── i18n ──
  const LANG = {
    en: {
      maxStake: 'MAX STAKE',
      recent: 'RECENT',
      waiting: 'Waiting for bet...',
    },
    pt: {
      maxStake: 'STAKE MÁXIMA',
      recent: 'RECENTE',
      waiting: 'Aguardando aposta...',
    }
  };

  let currentLang = 'en';

  function t(key) {
    return LANG[currentLang]?.[key] || LANG.en[key] || key;
  }

  function loadLang() {
    browser.storage.local.get('lang').then((result) => {
      currentLang = result.lang || 'en';
      updateOverlayLabels();
    });
  }

  function updateOverlayLabels() {
    if (!overlay) return;
    const title = overlay.querySelector('#b365-ms-title');
    const label = overlay.querySelector('#b365-ms-label');
    const histTitle = overlay.querySelector('#b365-ms-history-title');
    if (title) title.textContent = t('maxStake');
    if (label) label.textContent = t('maxStake');
    if (histTitle) histTitle.textContent = t('recent');
  }

  loadLang();

  // ── Overlay UI ──
  let overlay = null;
  let isMinimized = false;

  function createOverlay() {
    if (overlay) return;

    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    overlay = document.createElement('div');
    overlay.id = 'b365-ms-overlay';
    overlay.innerHTML = `
      <div id="b365-ms-header">
        <span id="b365-ms-title">${t('maxStake')}</span>
        <div id="b365-ms-controls">
          <button id="b365-ms-minimize" title="Minimize">−</button>
          <button id="b365-ms-close" title="Close">×</button>
        </div>
      </div>
      <div id="b365-ms-body">
        <div id="b365-ms-current">
          <div id="b365-ms-label">${t('maxStake')}</div>
          <div id="b365-ms-value">${t('waiting')}</div>
          <div id="b365-ms-meta"></div>
        </div>
        <div id="b365-ms-history">
          <div id="b365-ms-history-title">${t('recent')}</div>
          <div id="b365-ms-history-list"></div>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #b365-ms-overlay {
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 999999;
        width: 280px;
        background: #0e0e0e;
        border: 2px solid #016443;
        border-radius: 6px;
        font-family: 'Montserrat', sans-serif;
        color: #ffffff;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        overflow: hidden;
        transition: all 0.25s ease;
        cursor: default;
        user-select: none;
      }
      #b365-ms-overlay.minimized { width: auto; border-radius: 6px; }
      #b365-ms-overlay.minimized #b365-ms-body { display: none; }
      #b365-ms-overlay.minimized #b365-ms-title { font-size: 12px; }
      #b365-ms-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 14px; background: #016443; cursor: move;
      }
      #b365-ms-title { font-size: 13px; font-weight: 800; color: #FFDF00; letter-spacing: 0.5px; }
      #b365-ms-controls { display: flex; gap: 4px; }
      #b365-ms-controls button {
        background: rgba(0,0,0,0.25); border: none; color: rgba(255,255,255,0.7);
        width: 22px; height: 22px; border-radius: 3px; cursor: pointer; font-size: 14px;
        font-family: 'Montserrat', sans-serif; display: flex; align-items: center; justify-content: center;
        transition: all 0.15s;
      }
      #b365-ms-controls button:hover { background: rgba(0,0,0,0.4); color: #fff; }
      #b365-ms-body { padding: 14px; }
      #b365-ms-current { text-align: center; padding: 10px 0; }
      #b365-ms-label { font-size: 9px; font-weight: 700; letter-spacing: 2px; color: #888; margin-bottom: 6px; text-transform: uppercase; }
      #b365-ms-value { font-size: 30px; font-weight: 800; color: #FFDF00; transition: all 0.3s; }
      #b365-ms-value.flash { transform: scale(1.08); color: #ffe94d; }
      #b365-ms-meta { font-size: 10px; font-weight: 500; color: #666; margin-top: 8px; line-height: 1.4; }
      #b365-ms-history { margin-top: 12px; border-top: 1px solid #222; padding-top: 10px; }
      #b365-ms-history-title { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: #666; margin-bottom: 8px; text-transform: uppercase; }
      #b365-ms-history-list { max-height: 150px; overflow-y: auto; }
      #b365-ms-history-list::-webkit-scrollbar { width: 3px; }
      #b365-ms-history-list::-webkit-scrollbar-thumb { background: #016443; border-radius: 2px; }
      .b365-ms-history-item {
        display: flex; justify-content: space-between; align-items: center;
        padding: 6px 8px; margin-bottom: 3px; background: #1a1a1a; border-radius: 4px;
        font-size: 12px; transition: background 0.12s;
      }
      .b365-ms-history-item:hover { background: #222; }
      .b365-ms-history-item .ms-val { color: #FFDF00; font-weight: 700; font-size: 13px; }
      .b365-ms-history-item .ms-time { color: #555; font-size: 10px; font-weight: 500; }
      .b365-ms-history-item .ms-info { color: #999; font-size: 10px; font-weight: 500; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `;

    document.documentElement.appendChild(style);
    document.documentElement.appendChild(overlay);

    // Drag
    let isDragging = false, startX, startY, startLeft, startTop;
    const header = overlay.querySelector('#b365-ms-header');
    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      const rect = overlay.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY; startLeft = rect.left; startTop = rect.top;
      overlay.style.transition = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      overlay.style.left = (startLeft + e.clientX - startX) + 'px';
      overlay.style.top = (startTop + e.clientY - startY) + 'px';
      overlay.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => { isDragging = false; overlay.style.transition = 'all 0.25s ease'; });

    // Controls
    overlay.querySelector('#b365-ms-minimize').addEventListener('click', () => {
      isMinimized = !isMinimized;
      overlay.classList.toggle('minimized', isMinimized);
      overlay.querySelector('#b365-ms-minimize').textContent = isMinimized ? '+' : '−';
    });
    overlay.querySelector('#b365-ms-close').addEventListener('click', () => { overlay.style.display = 'none'; });
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
  }
  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  const sessionHistory = [];

  function updateOverlay(data) {
    createOverlay();
    if (overlay.style.display === 'none') overlay.style.display = '';
    const valueEl = overlay.querySelector('#b365-ms-value');
    const metaEl = overlay.querySelector('#b365-ms-meta');
    const historyList = overlay.querySelector('#b365-ms-history-list');

    valueEl.textContent = formatCurrency(data.maxStake);
    valueEl.classList.add('flash');
    setTimeout(() => valueEl.classList.remove('flash'), 300);

    const metaParts = [];
    if (data.eventInfo?.eventName) metaParts.push(data.eventInfo.eventName);
    if (data.eventInfo?.odds) metaParts.push(`@ ${data.eventInfo.odds}`);
    metaParts.push(formatTime(data.timestamp));
    metaEl.innerHTML = metaParts.join(' · ');

    sessionHistory.unshift(data);
    historyList.innerHTML = sessionHistory.slice(0, 20).map(item => {
      const info = item.eventInfo?.eventName || '—';
      const odds = item.eventInfo?.odds ? ` @ ${item.eventInfo.odds}` : '';
      return `<div class="b365-ms-history-item">
        <span class="ms-info" title="${info}">${info}${odds}</span>
        <span class="ms-val">${formatCurrency(item.maxStake)}</span>
        <span class="ms-time">${formatTime(item.timestamp)}</span>
      </div>`;
    }).join('');
  }

  // Listen for messages from injected script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'B365_MAX_STAKE') return;
    const data = event.data.data;
    updateOverlay(data);
    browser.runtime.sendMessage({ action: 'NEW_MAX_STAKE', data: data });
  });

  // Listen for messages from popup
  browser.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'SHOW_OVERLAY') { createOverlay(); overlay.style.display = ''; }
    if (msg.action === 'SET_LANG') { currentLang = msg.lang; updateOverlayLabels(); }
  });

  console.log('[B365-MS content.js] Firefox content script loaded ✓');
})();
