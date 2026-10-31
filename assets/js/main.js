/* Ovoza — sayt skriptlari: til, menyu, tablar, katalog, kalkulyator va formalar. */
(() => {
  'use strict';

  const CONFIG = Object.assign({ formEndpoint: '', defaultLang: 'uz' }, window.OVOZA_CONFIG || {});
  const I18N = window.OVOZA_I18N;
  const DATA = window.OVOZA_DATA;
  const LANG_KEY = 'ovoza-lang';
  const PHONE_RE = /^998\d{9}$/;

  let lang = 'uz';
  const filter = { cat: 'all', platform: 'all', q: '' };
  let currentCampaign = null;
  let signupResult = null; // { kind, name, demo }
  let applyResult = null; // { name, demo }

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
    refreshMessages();
    refreshResults();
    fillModal();
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

  /* ---------- Kampaniyalar katalogi ---------- */
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
      <button type="button" class="btn btn-primary btn-block" data-apply="${esc(c.id)}">${esc(t('apply'))}</button>
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
    $('#cat-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-apply]');
      if (btn) openApply(btn.dataset.apply);
    });
  }

  /* ---------- Kampaniyaga ariza oynasi ---------- */
  function fillModal() {
    if (!currentCampaign) return;
    const c = currentCampaign;
    $('#apply-title').textContent = c.title[lang];
    $('#apply-sub').textContent = `${c.seller[lang]} · ${c.city[lang]} · ${c.format[lang]}`;
    const select = $('#a-platform');
    const prev = select.value;
    select.innerHTML = c.platforms.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
    if (c.platforms.includes(prev)) select.value = prev;
  }

  function openApply(id) {
    currentCampaign = DATA.campaigns.find((c) => c.id === id) || null;
    if (!currentCampaign) return;
    const dialog = $('#apply-modal');
    const form = $('#form-apply');
    resetForm(form);
    applyResult = null;
    form.hidden = false;
    $('#apply-success').hidden = true;
    fillModal();
    document.documentElement.classList.add('modal-open');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    $('#a-name').focus();
  }

  function closeModal() {
    const dialog = $('#apply-modal');
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    document.documentElement.classList.remove('modal-open');
  }

  function initModal() {
    const dialog = $('#apply-modal');
    $$('[data-close-modal]', dialog).forEach((b) => b.addEventListener('click', closeModal));
    // Oynadan tashqariga bosilganda yopiladi
    dialog.addEventListener('click', (e) => { if (e.target === dialog) closeModal(); });
    dialog.addEventListener('close', () => document.documentElement.classList.remove('modal-open'));
  }

  /* ---------- Formalar ---------- */
  function formatPhone(value) {
    let d = value.replace(/\D/g, '');
    if (!d) return '';
    if ('998'.startsWith(d)) return `+${d}`;
    if (!d.startsWith('998')) d = `998${d}`;
    const r = d.slice(3, 12);
    let out = '+998';
    if (r.length) out += ` ${r.slice(0, 2)}`;
    if (r.length > 2) out += ` ${r.slice(2, 5)}`;
    if (r.length > 5) out += ` ${r.slice(5, 7)}`;
    if (r.length > 7) out += ` ${r.slice(7, 9)}`;
    return out;
  }

  function initPhone(input) {
    input.addEventListener('focus', () => { if (!input.value) input.value = '+998 '; });
    input.addEventListener('blur', () => { if (input.value.replace(/\D/g, '').length <= 3) input.value = ''; });
    input.addEventListener('input', () => { input.value = formatPhone(input.value); });
  }

  function controlsOf(form) {
    return $$('input, select, textarea', form).filter((c) => c.name);
  }

  function errorSlot(control) {
    const field = control.closest('.field');
    if (!field) return null;
    let slot = $('.field-error', field);
    if (!slot) {
      slot = document.createElement('p');
      slot.className = 'field-error';
      slot.id = `${control.id}-error`;
      slot.hidden = true;
      field.appendChild(slot);
      const described = [control.getAttribute('aria-describedby'), slot.id].filter(Boolean).join(' ');
      control.setAttribute('aria-describedby', described);
    }
    return slot;
  }

  function errorFor(control) {
    const v = control.value.trim();
    if (control.required && !v) return control.tagName === 'SELECT' ? 'errSelect' : 'errRequired';
    if (!v) return null;
    if (control.dataset.validate === 'phone' && !PHONE_RE.test(v.replace(/\D/g, ''))) return 'errPhone';
    if (control.dataset.validate === 'profile' && v.replace(/[@\s]/g, '').length < 3) return 'errProfile';
    return null;
  }

  function showError(control, key) {
    const slot = errorSlot(control);
    const field = control.closest('.field');
    if (field) field.classList.toggle('has-error', Boolean(key));
    if (key) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
    if (slot) {
      slot.dataset.key = key || '';
      slot.textContent = key ? t(key) : '';
      slot.hidden = !key;
    }
  }

  function setAlert(form, key) {
    let box = $('.form-alert', form);
    if (!box) {
      box = document.createElement('p');
      box.className = 'form-alert';
      box.setAttribute('role', 'alert');
      box.hidden = true;
      $('[type="submit"]', form).before(box);
    }
    box.dataset.key = key || '';
    box.textContent = key ? t(key) : '';
    box.hidden = !key;
  }

  function refreshMessages() {
    $$('.field-error, .form-alert').forEach((el) => {
      if (el.dataset.key) el.textContent = t(el.dataset.key);
    });
  }

  function resetForm(form) {
    form.reset();
    controlsOf(form).forEach((c) => showError(c, null));
    setAlert(form, null);
  }

  // Ma'lumotni yuborish. Manzil berilmagan bo'lsa, demo rejim.
  function send(payload) {
    if (!CONFIG.formEndpoint) return Promise.resolve({ demo: true });
    return fetch(CONFIG.formEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    }).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { demo: false };
    });
  }

  function initForm(form, onDone) {
    const controls = controlsOf(form);
    controls.forEach((c) => {
      errorSlot(c);
      const recheck = () => { if (c.getAttribute('aria-invalid') === 'true') showError(c, errorFor(c)); };
      c.addEventListener('input', recheck);
      c.addEventListener('change', recheck);
      if (c.dataset.validate === 'phone') initPhone(c);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let firstBad = null;
      controls.forEach((c) => {
        const key = errorFor(c);
        showError(c, key);
        if (key && !firstBad) firstBad = c;
      });
      if (firstBad) {
        firstBad.focus();
        return;
      }

      const payload = { type: form.dataset.kind, lang, sentAt: new Date().toISOString() };
      controls.forEach((c) => { payload[c.name] = c.value.trim(); });
      if (form.dataset.kind === 'apply' && currentCampaign) {
        payload.campaignId = currentCampaign.id;
        payload.campaign = currentCampaign.title.uz;
      }

      const btn = $('[type="submit"]', form);
      const label = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = t('sending');
      setAlert(form, null);

      send(payload)
        .then((res) => {
          onDone(payload, res);
          resetForm(form);
        })
        .catch(() => setAlert(form, 'errSend'))
        .finally(() => {
          btn.disabled = false;
          btn.innerHTML = label;
        });
    });
  }

  function refreshResults() {
    if (signupResult) {
      const key = signupResult.kind === 'blogger' ? 'okBlogger' : 'okBusiness';
      $('#success-text').textContent = t(key, signupResult.name);
      $('#success-demo').hidden = !signupResult.demo;
    }
    if (applyResult && currentCampaign) {
      $('#apply-success-text').textContent = t('okApply', applyResult.name, currentCampaign.title[lang]);
      $('#apply-demo').hidden = !applyResult.demo;
    }
  }

  function initSignup() {
    const group = $('#signup-tabs');
    const onTab = () => { $('#form-success').hidden = true; };
    initTabs(group, onTab);

    $('#success-again').addEventListener('click', () => {
      const active = $('[role="tab"][aria-selected="true"]', group);
      selectTab(group, active, onTab);
      const input = $(`#${active.getAttribute('aria-controls')} input`);
      if (input) input.focus();
    });

    // "Men biznes egasiman" / "Men blogerman" tugmalari kerakli formani ochadi
    $$('[data-role-link]').forEach((link) => {
      link.addEventListener('click', () => {
        const tab = $(`[role="tab"][data-role="${link.dataset.roleLink}"]`, group);
        if (tab) selectTab(group, tab, onTab);
      });
    });

    const onDone = (payload, res) => {
      signupResult = { kind: payload.type, name: payload.name, demo: res.demo };
      $('#form-business').hidden = true;
      $('#form-blogger').hidden = true;
      const box = $('#form-success');
      box.hidden = false;
      refreshResults();
      box.focus();
    };
    initForm($('#form-business'), onDone);
    initForm($('#form-blogger'), onDone);

    initForm($('#form-apply'), (payload, res) => {
      applyResult = { name: payload.name, demo: res.demo };
      $('#form-apply').hidden = true;
      const box = $('#apply-success');
      box.hidden = false;
      refreshResults();
      box.focus();
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
    initModal();
    initSignup();
    $$('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
    $('#year').textContent = String(new Date().getFullYear());
    setLang(storageGet(LANG_KEY) || CONFIG.defaultLang);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
