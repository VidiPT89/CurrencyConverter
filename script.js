(() => {
  const API_URL = 'https://open.er-api.com/v6/latest/USD';
  const CACHE_KEY = 'currencyConverter.ratesCache';
  const HISTORY_KEY = 'currencyConverter.history';
  const LANG_KEY = 'currencyConverter.lang';
  const MAX_HISTORY = 50;

  const statusEl = document.getElementById('status');
  const statusTextEl = document.getElementById('status-text');
  const formEl = document.getElementById('converter-form');
  const amountEl = document.getElementById('amount');
  const fromSelect = document.getElementById('from-currency');
  const toSelect = document.getElementById('to-currency');
  const swapBtn = document.getElementById('swap-btn');
  const resultEl = document.getElementById('result');
  const resultAmountEl = document.getElementById('result-amount');
  const resultRateEl = document.getElementById('result-rate');
  const historyListEl = document.getElementById('history-list');
  const historyEmptyEl = document.getElementById('history-empty');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const langToggle = document.getElementById('lang-toggle');

  let ratesData = null; // { base, rates, fetchedAt }
  let isOffline = false;
  let lang = localStorage.getItem(LANG_KEY) || 'pt';
  let lastConversion = null;
  let lastStatusState = { mode: null };

  const CURRENCY_TO_FLAG = {
    USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', BRL: '🇧🇷', CHF: '🇨🇭',
    CAD: '🇨🇦', AUD: '🇦🇺', CNY: '🇨🇳', HKD: '🇭🇰', NZD: '🇳🇿', SEK: '🇸🇪',
    NOK: '🇳🇴', DKK: '🇩🇰', PLN: '🇵🇱', CZK: '🇨🇿', HUF: '🇭🇺', RON: '🇷🇴',
    RUB: '🇷🇺', TRY: '🇹🇷', INR: '🇮🇳', IDR: '🇮🇩', KRW: '🇰🇷', MXN: '🇲🇽',
    SGD: '🇸🇬', THB: '🇹🇭', ZAR: '🇿🇦', ILS: '🇮🇱', AED: '🇦🇪', SAR: '🇸🇦',
    ARS: '🇦🇷', CLP: '🇨🇱', COP: '🇨🇴', PHP: '🇵🇭', MYR: '🇲🇾', VND: '🇻🇳',
    EGP: '🇪🇬', NGN: '🇳🇬', PKR: '🇵🇰', BDT: '🇧🇩', UAH: '🇺🇦', ISK: '🇮🇸',
    HRK: '🇭🇷', BGN: '🇧🇬', KWD: '🇰🇼', QAR: '🇶🇦', TWD: '🇹🇼', PEN: '🇵🇪',
    MAD: '🇲🇦', DZD: '🇩🇿', KES: '🇰🇪', GHS: '🇬🇭',
  };

  const I18N = {
    pt: {
      title: 'Conversor de Moedas',
      tagline: 'Taxas de câmbio em tempo real, sempre à mão',
      loading: 'A carregar taxas...',
      onlineStatus: (base) => `Taxas atualizadas (base ${base})`,
      offlineStatus: (minutes) => `Offline: a usar cotações em cache (há ${minutes} min)`,
      offlineNoCache: 'Sem ligação e sem cache disponível. Tenta novamente mais tarde.',
      amountLabel: 'Valor',
      fromLabel: 'De',
      toLabel: 'Para',
      convertBtn: 'Converter',
      historyTitle: 'Histórico de Conversões',
      clearBtn: 'Limpar',
      historyEmpty: 'Ainda não tens conversões.',
      developedBy: 'Desenvolvido por',
      invalidAmount: 'Indica um valor válido.',
      conversionError: 'Não foi possível converter. Verifica as moedas selecionadas.',
      cachedRate: ' (cotação em cache)',
      justNow: 'agora mesmo',
      minutesAgo: (m) => `há ${m} min`,
      hoursAgo: (h) => `há ${h} h`,
    },
    en: {
      title: 'Currency Converter',
      tagline: 'Real-time exchange rates, always at hand',
      loading: 'Loading rates...',
      onlineStatus: (base) => `Rates updated (base ${base})`,
      offlineStatus: (minutes) => `Offline: using cached rates (${minutes} min ago)`,
      offlineNoCache: 'No connection and no cache available. Try again later.',
      amountLabel: 'Amount',
      fromLabel: 'From',
      toLabel: 'To',
      convertBtn: 'Convert',
      historyTitle: 'Conversion History',
      clearBtn: 'Clear',
      historyEmpty: "You don't have any conversions yet.",
      developedBy: 'Developed by',
      invalidAmount: 'Please enter a valid amount.',
      conversionError: 'Could not convert. Check the selected currencies.',
      cachedRate: ' (cached rate)',
      justNow: 'just now',
      minutesAgo: (m) => `${m} min ago`,
      hoursAgo: (h) => `${h} h ago`,
    },
  };

  function t(key) {
    return I18N[lang][key];
  }

  function localeFor() {
    return lang === 'pt' ? 'pt-PT' : 'en-US';
  }

  function refreshStatusText() {
    if (lastStatusState.mode === 'online') {
      statusTextEl.textContent = t('onlineStatus')(lastStatusState.base);
    } else if (lastStatusState.mode === 'offline') {
      statusTextEl.textContent = lastStatusState.noCache
        ? t('offlineNoCache')
        : t('offlineStatus')(lastStatusState.minutes);
    } else {
      statusTextEl.textContent = t('loading');
    }
  }

  function applyTranslations() {
    document.documentElement.lang = lang === 'pt' ? 'pt-PT' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const value = I18N[lang][key];
      if (typeof value === 'string') {
        el.textContent = value;
      }
    });
    langToggle.classList.toggle('lang-en', lang === 'en');
    refreshStatusText();
    if (!resultEl.hidden && lastConversion) {
      renderResult(lastConversion.amount, lastConversion.from, lastConversion.to, lastConversion.result, lastConversion.rate);
    }
    renderHistory();
  }

  function setLang(newLang) {
    lang = newLang;
    localStorage.setItem(LANG_KEY, lang);
    applyTranslations();
  }

  langToggle.addEventListener('click', () => {
    setLang(lang === 'pt' ? 'en' : 'pt');
  });

  function setStatus(mode, data) {
    lastStatusState = { mode, ...data };
    statusEl.className = 'status' + (mode ? ` ${mode}` : '');
    refreshStatusText();
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // localStorage unavailable (private mode, quota, etc.) - ignore silently
    }
  }

  async function fetchRates() {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`API error (${response.status})`);
    }
    const json = await response.json();
    if (!json || !json.rates) {
      throw new Error('Invalid API response');
    }
    return { base: json.base_code || 'USD', rates: json.rates, fetchedAt: Date.now() };
  }

  function flagFor(code) {
    return CURRENCY_TO_FLAG[code] || '💱';
  }

  function populateSelects(rates) {
    const codes = Object.keys(rates).sort();
    const previousFrom = fromSelect.value;
    const previousTo = toSelect.value;

    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';

    for (const code of codes) {
      const label = `${flagFor(code)} ${code}`;

      const optionFrom = document.createElement('option');
      optionFrom.value = code;
      optionFrom.textContent = label;
      fromSelect.appendChild(optionFrom);

      const optionTo = document.createElement('option');
      optionTo.value = code;
      optionTo.textContent = label;
      toSelect.appendChild(optionTo);
    }

    fromSelect.value = codes.includes(previousFrom) ? previousFrom : 'USD';
    toSelect.value = codes.includes(previousTo) ? previousTo : (codes.includes('BRL') ? 'BRL' : codes[1] || codes[0]);
  }

  async function loadRates() {
    const cached = readCache();

    try {
      const fresh = await fetchRates();
      ratesData = fresh;
      isOffline = false;
      writeCache(fresh);
      populateSelects(fresh.rates);
      setStatus('online', { base: fresh.base });
      return;
    } catch (err) {
      if (cached) {
        ratesData = cached;
        isOffline = true;
        populateSelects(cached.rates);
        const ageMinutes = Math.round((Date.now() - cached.fetchedAt) / 60000);
        setStatus('offline', { minutes: ageMinutes, noCache: false });
      } else {
        setStatus('offline', { noCache: true });
      }
    }
  }

  function convert(amount, from, to) {
    if (!ratesData) return null;
    const { rates } = ratesData;
    if (!rates[from] || !rates[to]) return null;
    // rates are relative to base (USD): value_in_base = amount / rates[from]
    const rate = rates[to] / rates[from];
    return { result: amount * rate, rate };
  }

  function formatNumber(value, locale) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(value);
  }

  function animateNumber(el, endValue, locale) {
    const duration = 500;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = endValue * eased;
      el.textContent = formatNumber(current, locale);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = formatNumber(endValue, locale);
      }
    }

    requestAnimationFrame(step);
  }

  function renderResult(amount, from, to, result, rate) {
    const locale = localeFor();
    resultEl.hidden = false;
    resultAmountEl.textContent = `${formatNumber(amount, locale)} ${from} = `;
    const valueSpan = document.createElement('span');
    resultAmountEl.appendChild(valueSpan);
    animateNumber(valueSpan, result, locale);
    resultAmountEl.append(` ${to}`);
    resultRateEl.textContent = `1 ${from} = ${formatNumber(rate, locale)} ${to}${isOffline ? t('cachedRate') : ''}`;
  }

  function readHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // ignore storage failures
    }
  }

  function addHistoryEntry(entry) {
    const history = readHistory();
    history.unshift(entry);
    const trimmed = history.slice(0, MAX_HISTORY);
    writeHistory(trimmed);
    renderHistory(trimmed);
  }

  function relativeTime(timestamp) {
    const diffMs = Date.now() - timestamp;
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return t('justNow');
    if (minutes < 60) return t('minutesAgo')(minutes);
    const hours = Math.floor(minutes / 60);
    return t('hoursAgo')(hours);
  }

  function renderHistory(history) {
    const entries = history || readHistory();
    const locale = localeFor();
    historyListEl.innerHTML = '';
    historyEmptyEl.hidden = entries.length > 0;

    entries.forEach((entry, index) => {
      const li = document.createElement('li');
      li.style.animationDelay = `${Math.min(index, 8) * 30}ms`;
      li.innerHTML = `
        <span>${flagFor(entry.from)} ${formatNumber(entry.amount, locale)} ${entry.from} → ${flagFor(entry.to)} ${formatNumber(entry.result, locale)} ${entry.to}</span>
        <time>${relativeTime(entry.date)}</time>
      `;
      historyListEl.appendChild(li);
    });
  }

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    const amount = parseFloat(amountEl.value);
    const from = fromSelect.value;
    const to = toSelect.value;

    if (!Number.isFinite(amount) || amount < 0) {
      resultEl.hidden = false;
      resultAmountEl.textContent = t('invalidAmount');
      resultRateEl.textContent = '';
      return;
    }

    const conversion = convert(amount, from, to);
    if (!conversion) {
      resultEl.hidden = false;
      resultAmountEl.textContent = t('conversionError');
      resultRateEl.textContent = '';
      return;
    }

    lastConversion = { amount, from, to, result: conversion.result, rate: conversion.rate };
    renderResult(amount, from, to, conversion.result, conversion.rate);
    addHistoryEntry({
      amount,
      from,
      to,
      result: conversion.result,
      rate: conversion.rate,
      date: Date.now(),
    });
  });

  swapBtn.addEventListener('click', () => {
    const temp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = temp;
    swapBtn.classList.add('spin');
    setTimeout(() => swapBtn.classList.remove('spin'), 400);
  });

  clearHistoryBtn.addEventListener('click', () => {
    writeHistory([]);
    renderHistory([]);
  });

  applyTranslations();
  renderHistory();
  loadRates();
})();

