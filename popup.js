// popup.js

const LANG = {
  en: {
    title: 'MAX STAKE LOG',
    highest: 'Highest',
    lowest: 'Lowest',
    average: 'Average',
    overlay: 'Overlay',
    export: 'Export CSV',
    clear: 'Clear',
    entries: 'entries',
    entry: 'entry',
    emptyTitle: 'MS',
    emptyText: 'No max stakes recorded yet.<br>Place a bet on Bet365 to see data here.',
    clearConfirm: 'Clear all logged max stakes?',
    noData: 'No data to export.',
    today: 'Today',
  },
  pt: {
    title: 'LOG DE STAKE MÁXIMA',
    highest: 'Maior',
    lowest: 'Menor',
    average: 'Média',
    overlay: 'Overlay',
    export: 'Exportar CSV',
    clear: 'Limpar',
    entries: 'registros',
    entry: 'registro',
    emptyTitle: 'MS',
    emptyText: 'Nenhuma stake máxima registrada.<br>Faça uma aposta na Bet365 para ver os dados aqui.',
    clearConfirm: 'Limpar todos os registros de stake máxima?',
    noData: 'Nenhum dado para exportar.',
    today: 'Hoje',
  }
};

let currentLang = 'en';

function loadLang(cb) {
  chrome.storage.local.get('lang', (r) => { currentLang = r.lang || 'en'; if (cb) cb(); });
}
function saveLang(lang) {
  currentLang = lang;
  chrome.storage.local.set({ lang });
}
function t(key) { return LANG[currentLang]?.[key] || LANG.en[key] || key; }

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
}

function formatBadge(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
  return Math.round(value).toString();
}

function formatDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' });
  if (isToday) return `${t('today')} ${time}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }) + ' ' + time;
}

// Format timestamp for CSV in BRT (America/Sao_Paulo)
function formatTimestampBRT(ts) {
  const d = new Date(ts);
  return d.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + ' BRT';
}

function getLevel(value, avg) {
  if (value >= avg * 1.5) return 'high';
  if (value <= avg * 0.5) return 'low';
  return 'mid';
}

function renderLog(log) {
  const listEl = document.getElementById('log-list');
  const countEl = document.getElementById('count');
  const statsEl = document.getElementById('stats');

  const word = log.length === 1 ? t('entry') : t('entries');
  countEl.textContent = `${log.length} ${word}`;

  if (log.length === 0) {
    statsEl.style.display = 'none';
    listEl.innerHTML = `
      <div class="empty">
        <div class="icon">${t('emptyTitle')}</div>
        <p>${t('emptyText')}</p>
      </div>
    `;
    return;
  }

  const values = log.map(e => e.maxStake);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  statsEl.style.display = 'grid';
  document.getElementById('stat-max').textContent = formatBadge(max);
  document.getElementById('stat-min').textContent = formatBadge(min);
  document.getElementById('stat-avg').textContent = formatBadge(avg);

  listEl.innerHTML = log.map(item => {
    const info = item.eventInfo?.eventName || '—';
    const odds = item.eventInfo?.odds ? ` @ ${item.eventInfo.odds}` : '';
    const level = getLevel(item.maxStake, avg);
    return `
      <div class="log-item ${level}">
        <div class="log-left">
          <span class="log-info" title="${info}${odds}">${info}</span>
          <span class="log-date">${formatDate(item.timestamp)}${odds}</span>
        </div>
        <div class="log-right">
          <span class="log-ms">${formatCurrency(item.maxStake)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ── Init ──
loadLang(() => {
  applyI18n();
  chrome.runtime.sendMessage({ action: 'GET_LOG' }, (log) => renderLog(log || []));
});

// ── Language toggle ──
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    saveLang(btn.dataset.lang);
    applyI18n();
    chrome.runtime.sendMessage({ action: 'GET_LOG' }, (log) => renderLog(log || []));
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'SET_LANG', lang: currentLang });
    });
  });
});

// ── Show overlay ──
document.getElementById('btn-show').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'SHOW_OVERLAY' });
  });
});

// ── Export CSV (BRT timestamps) ──
document.getElementById('btn-export').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'EXPORT_LOG' }, (log) => {
    if (!log || log.length === 0) { alert(t('noData')); return; }

    const headers = ['Timestamp (BRT)', 'Max Stake (BRL)', 'Match', 'Odds'];
    const rows = log.map(item => [
      formatTimestampBRT(item.timestamp),
      item.maxStake,
      '"' + (item.eventInfo?.eventName || '').replace(/"/g, '""') + '"',
      item.eventInfo?.odds || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `b365_max_stakes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

// ── Clear ──
document.getElementById('btn-clear').addEventListener('click', () => {
  if (confirm(t('clearConfirm'))) {
    chrome.runtime.sendMessage({ action: 'CLEAR_LOG' }, () => renderLog([]));
  }
});
