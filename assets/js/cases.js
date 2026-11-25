/* Miqyos — "Real keyslar": biznes tasdiqlagan barter hamkorliklari.
   Ma'lumot botning ochiq API'sidan keladi (config.js dagi apiBase):
     GET /public/cases        — keyslari bor bizneslar
     GET /public/cases/<id>   — biznesning reklama e'lonlari va har biri bo'yicha blogerlar natijasi
   Bosh sahifada (#cases-section) — so'nggi bizneslar, keyslar.html da — to'liq ro'yxat yoki bitta biznes (?b=<id>). */
(() => {
  'use strict';

  const CONFIG = Object.assign({ apiBase: '', defaultLang: 'uz' }, window.OVOZA_CONFIG || {});
  const LANG_KEY = 'ovoza-lang';
  const API = String(CONFIG.apiBase || '').replace(/\/+$/, '');

  const TEXT = {
    uz: {
      loading: 'Yuklanmoqda…',
      loadError: 'Keyslarni yuklab bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.',
      retry: 'Qayta urinish',
      emptyTitle: 'Birinchi keyslar tayyorlanmoqda',
      emptyText: 'Bizneslar blogerlar bilan birinchi barterlarni bajarmoqda. Biznes natijani tasdiqlashi bilan hamkorlik shu yerda paydo bo‘ladi.',
      emptyCta: 'Birinchilardan bo‘ling',
      cases: (n) => `${n} ta hamkorlik`,
      bloggers: (n) => `${n} ta bloger`,
      views: (n) => `${n3(n)} ko‘rish`,
      statCases: 'Tasdiqlangan hamkorlik',
      statBusinesses: 'Biznes',
      statViews: 'Ko‘rishlar',
      statBloggers: 'Bloger',
      statCampaigns: 'Reklama e’loni',
      statRating: 'O‘rtacha baho',
      open: 'Keyslarni ko‘rish',
      allCases: 'Barcha keyslar',
      backToList: 'Barcha keyslar',
      notFound: 'Bu biznesning keyslari topilmadi. Ehtimol, havola eskirgan.',
      value: 'Mahsulot qiymati',
      format: 'Format',
      active: 'Faol e’lon',
      closed: 'Yopilgan',
      resultsTitle: (n) => (n ? `Blogerlar natijasi · ${n}` : 'Blogerlar natijasi'),
      noResults: 'Bu e’lon bo‘yicha natijalar hali tasdiqlanmagan.',
      watchPost: 'Postni ko‘rish',
      profile: 'Profil',
      followers: (r) => `${r} obunachi`,
      review: 'Biznes fikri',
      bloggerNote: 'Bloger izohi',
      confirmed: (d) => `Tasdiqlangan: ${d}`,
      verified: 'Biznes tasdiqlagan',
      pageTitle: 'Real keyslar · Miqyos',
      bizTitle: (name) => `${name}: keyslar · Miqyos`,
      currency: 'so‘m',
      months: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
      date: (d, m, y) => `${y}-yil ${d}-${m}`
    },
    ru: {
      loading: 'Загрузка…',
      loadError: 'Не удалось загрузить кейсы. Проверьте интернет и попробуйте снова.',
      retry: 'Повторить',
      emptyTitle: 'Первые кейсы уже в работе',
      emptyText: 'Бизнесы проводят первые бартеры с блогерами. Как только бизнес подтвердит результат, сотрудничество появится здесь.',
      emptyCta: 'Станьте одним из первых',
      cases: (n) => `${n} ${plural(n, 'сотрудничество', 'сотрудничества', 'сотрудничеств')}`,
      bloggers: (n) => `${n} ${plural(n, 'блогер', 'блогера', 'блогеров')}`,
      views: (n) => `${n3(n)} ${plural(n, 'просмотр', 'просмотра', 'просмотров')}`,
      statCases: 'Подтверждённых сотрудничеств',
      statBusinesses: 'Бизнесов',
      statViews: 'Просмотров',
      statBloggers: 'Блогеров',
      statCampaigns: 'Объявлений',
      statRating: 'Средняя оценка',
      open: 'Смотреть кейсы',
      allCases: 'Все кейсы',
      backToList: 'Все кейсы',
      notFound: 'Кейсы этого бизнеса не найдены. Возможно, ссылка устарела.',
      value: 'Стоимость продукта',
      format: 'Формат',
      active: 'Активное объявление',
      closed: 'Закрыто',
      resultsTitle: (n) => (n ? `Результаты блогеров · ${n}` : 'Результаты блогеров'),
      noResults: 'Результаты по этому объявлению ещё не подтверждены.',
      watchPost: 'Смотреть пост',
      profile: 'Профиль',
      followers: (r) => `${r} подписчиков`,
      review: 'Отзыв бизнеса',
      bloggerNote: 'Комментарий блогера',
      confirmed: (d) => `Подтверждено: ${d}`,
      verified: 'Подтверждено бизнесом',
      pageTitle: 'Реальные кейсы · Miqyos',
      bizTitle: (name) => `${name}: кейсы · Miqyos`,
      currency: 'сум',
      months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
      date: (d, m, y) => `${d} ${m} ${y}`
    }
  };

  // Sahifadagi matnlar (keyslar.html), kalit = data-c18n
  const STATIC = {
    uz: {
      eyebrow: 'Real keyslar',
      title: 'Blogerlar bizneslar uchun qilgan reklamalar',
      lead: 'Har bir keys haqiqiy: bloger reklamani joylagan, biznes esa natijani botda «Bajarildi» deb tasdiqlagan.',
      home: 'Bosh sahifa',
      start: 'Biznes sifatida boshlash',
      privacy: 'Maxfiylik siyosati'
    },
    ru: {
      eyebrow: 'Реальные кейсы',
      title: 'Реклама, которую блогеры сделали для бизнеса',
      lead: 'Каждый кейс настоящий: блогер опубликовал рекламу, а бизнес подтвердил результат в боте кнопкой «Выполнено».',
      home: 'Главная',
      start: 'Начать как бизнес',
      privacy: 'Политика конфиденциальности'
    }
  };

  /* ---------- Yordamchilar ---------- */
  function n3(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
  // Tashqi havolalar faqat http(s)
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let lang = 'uz';
  const t = (key, ...args) => {
    const v = TEXT[lang][key] ?? TEXT.uz[key];
    return typeof v === 'function' ? v(...args) : v;
  };
  const L = (obj) => (obj ? obj[lang] || obj.uz || '' : '');
  const money = (n) => `${n3(n)} ${t('currency')}`;
  function fmtDate(sec) {
    if (!sec) return '';
    const d = new Date(sec * 1000);
    return t('date', d.getDate(), t('months')[d.getMonth()], d.getFullYear());
  }
  const initial = (name) => (String(name || '?').trim()[0] || '?').toUpperCase();

  const ICON = {
    Instagram: 'i-instagram',
    YouTube: 'i-youtube',
    Telegram: 'i-send'
  };
  const svg = (id) => `<svg class="i" aria-hidden="true"><use href="#${id}"></use></svg>`;
  const platformIcon = (p) => svg(ICON[p] || 'i-megaphone');

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* xotira yopiq */ }
  }

  async function getJSON(path) {
    if (!API) throw new Error('no_api');
    const res = await fetch(`${API}${path}`, { headers: { accept: 'application/json' } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'server'), { status: res.status });
    return data;
  }

  // Bir xil ma'lumotni qayta yuklamaslik uchun (til almashganda faqat qayta chiziladi)
  const cache = new Map();
  async function load(path) {
    if (!cache.has(path)) {
      cache.set(path, getJSON(path).catch((e) => { cache.delete(path); throw e; }));
    }
    return cache.get(path);
  }

  /* ---------- Bloklar ---------- */
  function statsHTML(items) {
    return `<dl class="case-stats">${items
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`)
      .join('')}</dl>`;
  }

  function businessCardHTML(b) {
    const cover = b.cover
      ? `<img class="case-cover" src="${esc(b.cover.thumb)}" alt="" loading="lazy" decoding="async">`
      : `<span class="case-cover case-cover-empty" aria-hidden="true">${esc(initial(b.name))}</span>`;
    const tag = L(b.sector) || L(b.category);
    const facts = [t('cases', b.cases), t('bloggers', b.bloggers), b.views ? t('views', b.views) : null].filter(Boolean);
    return `<a class="case-card" href="keyslar.html?b=${encodeURIComponent(b.id)}">
      ${cover}
      <div class="case-card-body">
        <div class="case-card-top">${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<span class="case-ok">${svg('i-shield')}${esc(t('verified'))}</span></div>
        <h3 class="case-name">${esc(b.name)}</h3>
        ${L(b.region) ? `<p class="case-region">${svg('i-pin')}<span>${esc(L(b.region))}</span></p>` : ''}
        <ul class="case-facts">${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        <span class="case-more">${esc(t('open'))}${svg('i-arrow')}</span>
      </div>
    </a>`;
  }

  function emptyHTML() {
    const bot = (window.OVOZA_CONFIG && window.OVOZA_CONFIG.botUsername) || 'miqyosbot';
    return `<div class="empty case-empty">
      <span class="case-empty-ico">${svg('i-star')}</span>
      <strong>${esc(t('emptyTitle'))}</strong>
      <p>${esc(t('emptyText'))}</p>
      <a class="btn btn-primary btn-sm" href="https://t.me/${esc(bot)}?start=business-${lang}" target="_blank" rel="noopener">${esc(t('emptyCta'))}</a>
    </div>`;
  }

  function errorHTML() {
    return `<div class="empty"><p>${esc(t('loadError'))}</p><button type="button" class="btn btn-outline btn-sm" data-cases-retry>${esc(t('retry'))}</button></div>`;
  }

  function resultHTML(r) {
    const b = r.blogger || {};
    const post = safeUrl(r.postUrl);
    const profile = safeUrl(b.profileUrl);
    const name = profile
      ? `<a href="${esc(profile)}" target="_blank" rel="noopener nofollow">${esc(b.name)}</a>`
      : esc(b.name);
    // Obunachilar oralig'i: "10000-50000" → "10 000 – 50 000", "100000+" → "100 000+"
    const range = String(b.followers || '').replace(/\d+/g, (d) => n3(d)).replace('-', ' – ');
    const meta = [b.platform, range ? t('followers', range) : null].filter(Boolean).join(' · ');
    const stars = r.rating ? `<span class="stars" aria-label="${r.rating}/5">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>` : '';
    return `<li class="result-item">
      <div class="result-head">
        <span class="result-ava">${platformIcon(r.postPlatform || b.platform)}</span>
        <div class="result-who"><strong>${name}</strong>${meta ? `<span>${esc(meta)}</span>` : ''}</div>
        ${r.views ? `<span class="result-views">${esc(t('views', r.views))}</span>` : ''}
      </div>
      ${r.review ? `<figure class="result-review"><blockquote>${esc(r.review)}</blockquote><figcaption>${esc(t('review'))} ${stars}</figcaption></figure>` : stars ? `<p class="result-stars">${esc(t('review'))} ${stars}</p>` : ''}
      ${r.note ? `<p class="result-note"><span>${esc(t('bloggerNote'))}:</span> ${esc(r.note)}</p>` : ''}
      <div class="result-foot">
        <span class="result-date">${svg('i-check')}${esc(t('confirmed', fmtDate(r.confirmedAt)))}</span>
        ${post ? `<a class="btn btn-outline btn-sm" href="${esc(post)}" target="_blank" rel="noopener nofollow">${esc(t('watchPost'))}${svg('i-arrow')}</a>` : ''}
      </div>
    </li>`;
  }

  function campaignHTML(c) {
    const image = c.image ? `<img class="ccase-img" src="${esc(c.image.url)}" alt="${esc(c.title)}" loading="lazy" decoding="async">` : '';
    const where = [L(c.region), c.city].filter(Boolean).join(' · ');
    const status = c.active
      ? `<span class="slots">${esc(t('active'))}</span>`
      : `<span class="ccase-closed">${esc(t('closed'))}</span>`;
    const list = c.results.length
      ? `<ul class="result-list">${c.results.map(resultHTML).join('')}</ul>`
      : `<p class="ccase-wait">${svg('i-clock')}<span>${esc(t('noResults'))}</span></p>`;
    return `<article class="ccase${c.results.length ? '' : ' ccase-pending'}" id="e${c.id}">
      <div class="ccase-info">
        ${image}
        <div class="ccase-text">
          <div class="camp-top">${L(c.category) ? `<span class="tag">${esc(L(c.category))}</span>` : ''}${status}</div>
          <h3 class="camp-title">${esc(c.title)}</h3>
          ${where ? `<p class="camp-seller">${svg('i-pin')}<span>${esc(where)}</span></p>` : ''}
          <dl class="camp-meta">
            <div><dt>${esc(t('value'))}</dt><dd>${esc(money(c.value))}</dd></div>
            <div><dt>${esc(t('format'))}</dt><dd>${esc(c.format)}</dd></div>
          </dl>
          <ul class="camp-platforms">${c.platforms.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="ccase-results">
        <h4>${esc(t('resultsTitle', c.results.length))}</h4>
        ${list}
      </div>
    </article>`;
  }

  /* ---------- Bosh sahifadagi bo'lim ---------- */
  async function renderHomeSection(root) {
    const grid = $('#cases-grid', root);
    const more = $('#cases-more', root);
    grid.innerHTML = `<p class="case-loading">${esc(t('loading'))}</p>`;
    try {
      const data = await load('/public/cases');
      const list = data.businesses || [];
      if (!list.length) {
        grid.innerHTML = emptyHTML();
        if (more) more.hidden = true;
        return;
      }
      grid.innerHTML = `${statsHTML([
        [t('statCases'), n3(data.totals.cases)],
        [t('statBusinesses'), n3(data.totals.businesses)],
        [t('statViews'), data.totals.views ? n3(data.totals.views) : null]
      ])}<div class="case-grid">${list.slice(0, 6).map(businessCardHTML).join('')}</div>`;
      if (more) {
        more.hidden = false;
        $('span', more).textContent = t('allCases');
      }
    } catch (e) {
      grid.innerHTML = errorHTML();
    }
  }

  /* ---------- keyslar.html ---------- */
  async function renderPage(root) {
    const id = new URLSearchParams(window.location.search).get('b');
    const out = $('#cases-out', root);
    const head = $('#cases-head', root);
    out.innerHTML = `<p class="case-loading">${esc(t('loading'))}</p>`;

    if (!id) {
      head.hidden = false;
      document.title = t('pageTitle');
      try {
        const data = await load('/public/cases');
        const list = data.businesses || [];
        out.innerHTML = list.length
          ? `${statsHTML([
              [t('statCases'), n3(data.totals.cases)],
              [t('statBusinesses'), n3(data.totals.businesses)],
              [t('statViews'), data.totals.views ? n3(data.totals.views) : null]
            ])}<div class="case-grid">${list.map(businessCardHTML).join('')}</div>`
          : emptyHTML();
      } catch (e) {
        out.innerHTML = errorHTML();
      }
      return;
    }

    head.hidden = true;
    try {
      const data = await load(`/public/cases/${encodeURIComponent(id)}`);
      const b = data.business;
      document.title = t('bizTitle', b.name);
      const tag = L(b.sector) || L(b.category);
      out.innerHTML = `
        <a class="case-back" href="keyslar.html">${svg('i-arrow')}<span>${esc(t('backToList'))}</span></a>
        <header class="biz-head">
          <span class="biz-ava" aria-hidden="true">${esc(initial(b.name))}</span>
          <div>
            <div class="case-card-top">${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<span class="case-ok">${svg('i-shield')}${esc(t('verified'))}</span></div>
            <h1 class="biz-name">${esc(b.name)}</h1>
            ${L(b.region) ? `<p class="case-region">${svg('i-pin')}<span>${esc(L(b.region))}</span></p>` : ''}
          </div>
        </header>
        ${statsHTML([
          [t('statCases'), n3(b.cases)],
          [t('statCampaigns'), n3(b.campaigns)],
          [t('statBloggers'), n3(b.bloggers)],
          [t('statViews'), b.views ? n3(b.views) : null],
          [t('statRating'), b.rating ? `${String(b.rating).replace('.', lang === 'ru' ? ',' : '.')} / 5` : null]
        ])}
        <div class="ccase-list">${data.campaigns.map(campaignHTML).join('')}</div>`;
    } catch (e) {
      out.innerHTML = e.status === 404
        ? `<div class="empty"><p>${esc(t('notFound'))}</p><a class="btn btn-outline btn-sm" href="keyslar.html">${esc(t('allCases'))}</a></div>`
        : errorHTML();
    }
  }

  /* ---------- Til va ishga tushirish ---------- */
  function translatePage() {
    const dict = STATIC[lang];
    $$('[data-c18n]').forEach((el) => {
      if (!el._uz) el._uz = el.textContent;
      el.textContent = lang === 'uz' ? el._uz : dict[el.dataset.c18n] ?? el._uz;
    });
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    document.documentElement.lang = lang;
    const bot = (window.OVOZA_CONFIG && window.OVOZA_CONFIG.botUsername) || 'miqyosbot';
    $$('[data-bot-start]').forEach((a) => { a.href = `https://t.me/${bot}?start=${a.dataset.botStart}-${lang}`; });
  }

  function init() {
    const home = $('#cases-section');
    const page = $('#cases-page');
    if (!home && !page) return;
    const run = () => (page ? renderPage(page) : renderHomeSection(home));

    if (page) {
      // keyslar.html: tilni shu skript boshqaradi (?lang=ru yoki saytda tanlangani)
      const q = new URLSearchParams(window.location.search).get('lang');
      lang = q === 'ru' || q === 'uz' ? q : storageGet(LANG_KEY) === 'ru' ? 'ru' : CONFIG.defaultLang === 'ru' ? 'ru' : 'uz';
      translatePage();
      $$('[data-lang]').forEach((b) => b.addEventListener('click', () => {
        lang = b.dataset.lang === 'ru' ? 'ru' : 'uz';
        storageSet(LANG_KEY, lang);
        translatePage();
        run();
      }));
      const year = $('#year');
      if (year) year.textContent = String(new Date().getFullYear());
    } else {
      // Bosh sahifa: tilni main.js boshqaradi
      lang = document.documentElement.lang === 'ru' ? 'ru' : 'uz';
      document.addEventListener('miqyos:lang', (e) => {
        lang = e.detail === 'ru' ? 'ru' : 'uz';
        run();
      });
    }

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-cases-retry]')) run();
    });
    run();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
