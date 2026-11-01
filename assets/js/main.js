/* Ovoza — sayt skriptlari: til, menyu, tablar, katalog, kalkulyator va Telegram bot havolalari. */
(() => {
  'use strict';

  const CONFIG = Object.assign({ botUsername: 'Ovozauz_bot', defaultLang: 'uz' }, window.OVOZA_CONFIG || {});
  const I18N = window.OVOZA_I18N;
  const DATA = window.OVOZA_DATA;
  const LANG_KEY = 'ovoza-lang';

  let lang = 'uz';
  const filter = { cat: 'all', platform: 'all', q: '' };

  /* ---------- Yordamchilar ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function t(key, ...args) {
    const value = I18N.ui[lang][key] ?? I18N.ui.uz[key];
    if (typeof value === 'function') return value(...args);
    return value ?? key;
  }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  const group3 = (n, sep) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const money = (n) => `${group3(n, ' ')} ${t('currency')}`;
  const parseNum = (s) => {
    const digits = String(s).replace(/\D/g, '').slice(0, 9);
    return digits ? parseInt(digits, 10) : 0;
  };
  const norm = (s) => String(s).toLowerCase().replace(/[‘’'ʻʼ`´]/g, '').replace(/ё/g, 'е').trim();

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* xotira yopiq bo'lsa, tanlov eslab qolinmaydi */ }
  }

  /* ---------- Telegram bot havolalari ---------- */
  const botLink = (role) => `https://t.me/${CONFIG.botUsername}?start=${role}-${lang}`;

  function updateBotLinks() {
    $$('[data-bot-start]').forEach((a) => {
      a.href = botLink(a.dataset.botStart);
    });
  }

  /* ---------- Til ---------- */
  function collectI18n() {
    $$('[data-i18n]').forEach((el) => { el._uz = el.innerHTML; });
    $$('[data-i18n-ph]').forEach((el) => { el._uzPh = el.getAttribute('placeholder') || ''; });
    $$('[data-i18n-aria]').forEach((el) => { el._uzAria = el.getAttribute('aria-label') || ''; });
  }

  function translateStatic() {
    const ru = lang === 'ru' ? I18N.ru : null;
    $$('[data-i18n]').forEach((el) => {
      const v = ru && ru[el.dataset.i18n];
      el.innerHTML = v != null ? v : el._uz;
    });
    $$('[data-i18n-ph]').forEach((el) => {
      const v = ru && ru[el.dataset.i18nPh];
      el.setAttribute('placeholder', v != null ? v : el._uzPh);
    });
    $$('[data-i18n-aria]').forEach((el) => {
      const v = ru && ru[el.dataset.i18nAria];
      el.setAttribute('aria-label', v != null ? v : el._uzAria);
    });
  }

  function setLang(next) {
    lang = next === 'ru' ? 'ru' : 'uz';
    document.documentElement.lang = lang;
    translateStatic();
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    updateBurger();
    renderChips();
    renderCampaigns();
    updateCalc();
    updateBotLinks();
    storageSet(LANG_KEY, lang);
  }

  /* ---------- Menyu ---------- */
  function updateBurger() {
    const burger = $('.burger');
    const open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-label', t(open ? 'menuClose' : 'menuOpen'));
    $('use', burger).setAttribute('href', open ? '#i-close' : '#i-menu');
  }

  function setMenu(open) {
    $('.site-header').classList.toggle('is-open', open);
    $('.burger').setAttribute('aria-expanded', String(open));
    updateBurger();
  }

  function initNav() {
    const header = $('.site-header');
    const burger = $('.burger');

    burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
    $('#nav').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('click', (e) => { if (!header.contains(e.target)) setMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        setMenu(false);
        burger.focus();
      }
    });

    const wide = window.matchMedia('(min-width: 961px)');
    const onWide = (e) => { if (e.matches) setMenu(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);

    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Ko'rinib turgan bo'limni menyuda belgilash
    if ('IntersectionObserver' in window) {
      const links = $$('#nav a[href^="#"]:not(.nav-cta)');
      const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((a) => a.removeAttribute('aria-current'));
          const link = byId.get(entry.target.id);
          if (link) link.setAttribute('aria-current', 'true');
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      byId.forEach((_, id) => {
        const section = document.getElementById(id);
        if (section) io.observe(section);
      });
    }
  }

  /* ---------- Tablar ---------- */
  function selectTab(group, tab, onChange) {
    $$('[role="tab"]', group).forEach((btn) => {
      const on = btn === tab;
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (onChange) onChange(tab);
  }

  function initTabs(group, onChange) {
    const tabs = $$('[role="tab"]', group);
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => selectTab(group, tab, onChange));
      tab.addEventListener('keydown', (e) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = tabs[(i + step + tabs.length) % tabs.length];
        next.focus();
        selectTab(group, next, onChange);
      });
    });
  }

  /* ---------- Reklama e'lonlari katalogi ---------- */
  function catName(id, l = lang) {
    const cat = DATA.categories.find((c) => c.id === id);
    return cat ? cat[l] : id;
  }

  function matches(c, ignoreCat) {
    if (!ignoreCat && filter.cat !== 'all' && c.cat !== filter.cat) return false;
    if (filter.platform !== 'all' && !c.platforms.includes(filter.platform)) return false;
    const q = norm(filter.q);
    if (q) {
      const hay = norm([
        c.title.uz, c.title.ru, c.seller.uz, c.seller.ru, c.city.uz, c.city.ru,
        catName(c.cat, 'uz'), catName(c.cat, 'ru'), c.platforms.join(' ')
      ].join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function renderChips() {
    const cats = [{ id: 'all' }, ...DATA.categories];
    $('#cat-chips').innerHTML = cats.map((c) => {
      const label = c.id === 'all' ? t('allCats') : c[lang];
      return `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="false">${esc(label)}<span class="chip-n"></span></button>`;
    }).join('');
    updateChips();
  }

  function updateChips() {
    $$('#cat-chips .chip').forEach((chip) => {
      const id = chip.dataset.cat;
      const n = DATA.campaigns.filter((c) => (id === 'all' || c.cat === id) && matches(c, true)).length;
      chip.setAttribute('aria-pressed', String(filter.cat === id));
      $('.chip-n', chip).textContent = n;
    });
  }

  function metaRow(label, value) {
    return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  }

  function cardHTML(c) {
    return `<article class="camp">
      <div class="camp-top"><span class="tag">${esc(catName(c.cat))}</span><span class="slots">${esc(t('slotsLeft', c.slots - c.taken))}</span></div>
      <h3 class="camp-title">${esc(c.title[lang])}</h3>
      <p class="camp-seller"><svg class="i" aria-hidden="true"><use href="#i-pin"></use></svg><span>${esc(c.seller[lang])} · ${esc(c.city[lang])}</span></p>
      <div class="camp-value"><span>${esc(t('value'))}</span><strong>${money(c.value)}</strong></div>
      <dl class="camp-meta">${metaRow(t('format'), c.format[lang])}${metaRow(t('requirement'), t('followers', c.minFollowers))}${metaRow(t('deadline'), t('days', c.days))}</dl>
      <ul class="camp-platforms" aria-label="${esc(t('platforms'))}">${c.platforms.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      <a class="btn btn-primary btn-block" href="${botLink('blogger')}" data-bot-start="blogger" target="_blank" rel="noopener">${esc(t('applyInBot'))}</a>
    </article>`;
  }

  function renderCampaigns() {
    const list = DATA.campaigns.filter((c) => matches(c, false));
    $('#cat-grid').innerHTML = list.map(cardHTML).join('');
    $('#cat-count').textContent = t('found', list.length);
    $('#cat-empty').hidden = list.length > 0;
  }

  function initCatalog() {
    $('#cat-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      filter.cat = chip.dataset.cat;
      updateChips();
      renderCampaigns();
    });
    $('#cat-search').addEventListener('input', (e) => {
      filter.q = e.target.value;
      updateChips();
      renderCampaigns();
    });
    $('#cat-platform').addEventListener('change', (e) => {
      filter.platform = e.target.value;
      updateChips();
      renderCampaigns();
    });
    $('#cat-reset').addEventListener('click', () => {
      filter.cat = 'all';
      filter.platform = 'all';
      filter.q = '';
      $('#cat-search').value = '';
      $('#cat-platform').value = 'all';
      updateChips();
      renderCampaigns();
    });
  }

  /* ---------- Kalkulyator ---------- */
  function updateCalc() {
    const cost = parseNum($('#calc-cost').value);
    const ad = parseNum($('#calc-ad').value);
    const n = Math.max(1, parseInt($('#calc-count').value, 10) || 1);
    const barter = cost * n;
    const paid = ad * n;
    const max = Math.max(barter, paid);
    const saving = paid - barter;

    $('#calc-count-out').textContent = n;
    $('#res-paid').textContent = money(paid);
    $('#res-barter').textContent = money(barter);
    $('#bar-paid').style.width = max ? `${(paid / max) * 100}%` : '0%';
    $('#bar-barter').style.width = max ? `${(barter / max) * 100}%` : '0%';
    $('#res-saving').textContent = money(Math.max(0, saving));

    let note = t('noSaving');
    if (!max) note = t('calcEmpty');
    else if (saving > 0) note = t('saveNote', Math.round((saving / paid) * 100));
    $('#res-note').textContent = note;
  }

  function initCalc() {
    ['#calc-cost', '#calc-ad'].forEach((sel) => {
      const input = $(sel);
      input.addEventListener('input', updateCalc);
      input.addEventListener('blur', () => { input.value = group3(parseNum(input.value), ' '); });
    });
    $('#calc-count').addEventListener('input', updateCalc);
    $('#calc').addEventListener('submit', (e) => e.preventDefault());
  }

  /* ---------- Ishga tushirish ---------- */
  function init() {
    if (!I18N || !DATA) return;
    collectI18n();
    initNav();
    initTabs($('#how-tabs'));
    initCatalog();
    initCalc();
    $$('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
    $('#year').textContent = String(new Date().getFullYear());
    setLang(storageGet(LANG_KEY) || CONFIG.defaultLang);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
