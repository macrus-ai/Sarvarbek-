/* Miqyos admin panel: moderatsiya, foydalanuvchilar, reklama e'lonlari, so'rovlar va sozlamalar.
   Kirish: botga /admin yuboriladi, bot bir martalik havola beradi (sessiya cookie'da). */
(() => {
  'use strict';

  const root = document.getElementById('admin');
  const toastEl = document.getElementById('toast');

  const state = {
    me: null,
    stats: null,
    bot: null,
    filters: {
      users: { q: '', role: '', status: '', page: 1 },
      ads: { q: '', moderation: '', status: '', page: 1 },
      requests: { status: '', page: 1 }
    },
    chart: 'users',
    options: null, // e'lonni tahrirlash uchun toifalar, hududlar (bir marta yuklanadi)
    busy: false
  };

  /* ---------- Yordamchilar ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
  const fmt = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const money = (n) => `${fmt(n)} so‘m`;
  const pad = (n) => String(n).padStart(2, '0');
  const date = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const MODERATION = { pending: 'Moderatsiyada', approved: 'Tasdiqlangan', rejected: 'Rad etilgan' };
  const AD_STATUS = { active: 'Faol', closed: 'Yopiq' };
  const APP_STATUS = { pending: 'Kutilmoqda', accepted: 'Qabul qilingan', rejected: 'Rad etilgan' };
  const ROLE = { blogger: 'Bloger', business: 'Biznes' };

  const pill = (cls, text) => `<span class="pill pill-${esc(cls)}">${esc(text)}</span>`;
  const userPill = (u) => (u.registered ? pill(u.moderation || 'muted', MODERATION[u.moderation] || '—') : pill('muted', 'Ro‘yxatdan o‘tmoqda'));
  const adPill = (c) => (c.moderation !== 'approved' ? pill(c.moderation, MODERATION[c.moderation]) : pill(c.status, AD_STATUS[c.status]));

  let toastTimer;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 3200);
  }

  const ERRORS = {
    unauthorized: 'Sessiya tugagan. Botga /admin yuborib, qaytadan kiring.',
    already: 'Bu bo‘yicha qaror allaqachon qabul qilingan.',
    not_found: 'Topilmadi: o‘chirilgan bo‘lishi mumkin.',
    network: 'Internet aloqasini tekshiring.',
    server: 'Serverda xatolik. Birozdan keyin urinib ko‘ring.'
  };
  const errorText = (e) => ERRORS[e.code] || ERRORS.server;

  async function api(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: {
          ...(method !== 'GET' ? { 'x-ovoza-admin': '1' } : {}),
          ...(body ? { 'content-type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch {
      throw Object.assign(new Error('network'), { code: 'network' });
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* bo'sh javob */
    }
    if (res.status === 401) {
      state.bot = data?.bot || state.bot;
      showLogin();
      throw Object.assign(new Error('unauthorized'), { code: 'unauthorized', silent: true });
    }
    if (!res.ok) throw Object.assign(new Error(data?.error || 'server'), { code: data?.error || 'server', data });
    return data;
  }

  /* ---------- Ikonkalar ---------- */
  const ICONS = {
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    megaphone: '<path d="M3 11v2a2 2 0 0 0 2 2h1l5 4V5L6 9H5a2 2 0 0 0-2 2z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
    inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5.5 5h13L21 13v6H3v-6z"/>',
    download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    userPlus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
  };
  const icon = (name) =>
    `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  const logo = `<svg class="logo" viewBox="7 7 86 86" aria-hidden="true"><polygon points="9,82 36,18 36,41.5 18.9,82" fill="#6A63F5"/><polygon points="18.9,82 36,41.5 36,60.7 27,82" fill="#3A33B8"/><polygon points="36,18 63,82 53.1,82 36,41.5" fill="#4F46E5"/><polygon points="36,41.5 53.1,82 45,82 36,60.7" fill="#262080"/><polygon points="55,82 63,82 59,72.5" fill="#1E1A66"/><polygon points="37,82 64,18 64,41.5 46.9,82" fill="#FF8B78"/><polygon points="46.9,82 64,41.5 64,60.7 55,82" fill="#E0533D"/><polygon points="64,18 91,82 81.1,82 64,41.5" fill="#FF6B57"/><polygon points="64,41.5 81.1,82 73,82 64,60.7" fill="#B8392A"/></svg>`;

  /* ---------- Karkas ---------- */
  // [manzil, nom, ikonka, guruh]
  const ROUTES = [
    ['', 'Bosh sahifa', 'home', 'Asosiy'],
    ['moderation', 'Moderatsiya', 'shield', 'Asosiy'],
    ['users', 'Foydalanuvchilar', 'users', 'Ma’lumotlar'],
    ['ads', 'Reklama e’lonlari', 'megaphone', 'Ma’lumotlar'],
    ['requests', 'So‘rovlar', 'inbox', 'Ma’lumotlar'],
    ['settings', 'Sozlamalar', 'gear', 'Tizim']
  ];

  const currentRoute = () => location.hash.replace(/^#\/?/, '').split('?')[0];
  const initials = (name) =>
    String(name || 'A').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'A';

  function shell(content) {
    const route = currentRoute();
    const s = state.stats;
    const pending = s ? s.pendingUsers + s.pendingAds : 0;
    const counts = { moderation: pending, requests: s ? s.waitingApplications : 0 };
    let group = '';
    const nav = ROUTES.map(([id, label, ic, g]) => {
      const title = g !== group ? `<div class="nav-group">${esc(g)}</div>` : '';
      group = g;
      return `${title}<a href="#/${id}" ${route === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${esc(label)}</span>${
        counts[id] ? `<span class="count">${fmt(counts[id])}</span>` : ''
      }</a>`;
    }).join('');
    const name = state.me?.name || 'Admin';
    const q = route === 'users' ? state.filters.users.q : '';
    return `<div class="layout">
      <aside class="side glass">
        <div class="brand"><span class="logo-box">${logo}</span><div><b>Miqyos</b><small>Boshqaruv markazi</small></div></div>
        <nav class="nav" aria-label="Bo‘limlar">${nav}</nav>
        <div class="side-foot">
          <div class="who"><span class="avatar sm">${esc(initials(name))}</span><span><b>${esc(name)}</b><small>ID ${esc(state.me?.id)}</small></span></div>
          <button type="button" class="btn" data-act="logout">${icon('logout')}<span>Chiqish</span></button>
        </div>
      </aside>
      <div class="content">
        <header class="topbar glass">
          <form class="search" data-form="search" role="search">
            ${icon('search')}
            <label class="sr-only" for="top-q">Foydalanuvchini qidirish</label>
            <input id="top-q" name="q" type="search" placeholder="Ism, kompaniya, @username, telefon yoki ID" value="${esc(q)}">
          </form>
          <div class="top-actions">
            <button type="button" class="round hide-sm" data-act="export" title="Excel’ga yuklab olish" aria-label="Excel’ga yuklab olish">${icon('download')}</button>
            <a class="round light" href="#/moderation" title="Moderatsiya" aria-label="Moderatsiya${pending ? `: ${pending} ta kutmoqda` : ''}">${icon('bell')}${pending ? '<span class="dot"></span>' : ''}</a>
            <div class="me"><span class="avatar">${esc(initials(name))}</span><div><b>${esc(name)}</b><small>Admin</small></div></div>
          </div>
        </header>
        <main class="main" id="main">${content}</main>
      </div>
    </div>`;
  }

  const loading = '<div class="empty"><div class="spinner" style="margin:0 auto"></div></div>';

  function showLogin() {
    const bot = state.bot ? `@${esc(state.bot)}` : 'Miqyos botiga';
    const link = state.bot ? `<a class="btn btn-primary" href="https://t.me/${esc(state.bot)}" target="_blank" rel="noopener">Botni ochish</a>` : '';
    root.innerHTML = `<div class="login"><div class="card">
      <span class="logo-box">${logo}</span>
      <h1>Miqyos admin panel</h1>
      <ol>
        <li>Telegramda ${bot} <code>/admin</code> buyrug‘ini yuboring.</li>
        <li>Bot yuborgan “Admin panelni ochish” tugmasini bosing.</li>
      </ol>
      <p class="muted small">Havola 10 daqiqa ichida bir marta ishlaydi. Faqat adminlar (ADMIN_IDS) kira oladi.</p>
      ${link}
    </div></div>`;
  }

  async function refreshStats() {
    state.stats = await api('/api/admin/stats');
    return state.stats;
  }

  async function render() {
    const route = currentRoute();
    const views = { '': viewDashboard, moderation: viewModeration, users: viewUsers, ads: viewAds, requests: viewRequests, settings: viewSettings };
    const view = views[route] || viewDashboard;
    root.innerHTML = shell(loading);
    try {
      await refreshStats();
      root.innerHTML = shell(await view());
    } catch (e) {
      if (!e.silent) root.innerHTML = shell(`<div class="empty">${esc(errorText(e))}</div>`);
    }
  }

  /* ---------- Bosh sahifa ---------- */
  const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
  const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

  function greeting() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return 'Xayrli tong';
    if (h >= 11 && h < 17) return 'Xayrli kun';
    if (h >= 17 && h < 22) return 'Xayrli kech';
    return 'Xayrli tun';
  }

  // Server kunni Toshkent vaqtida (UTC+5) beradi; brauzer qaysi zonada bo'lsa ham o'sha kun ko'rinadi
  const tashkentDay = (ts) => new Date((ts + 5 * 3600) * 1000);

  // Grafik: so'nggi 14 kun, ustunlar
  function barChart(daily, kind) {
    const values = daily.map((d) => d[kind] || 0);
    const max = Math.max(...values);
    // O'qdagi qiymatlar "chiroyli" sonlarga yaxlitlanadi
    const step = max <= 4 ? 1 : Math.ceil(max / 4 / (max > 40 ? 10 : 1)) * (max > 40 ? 10 : 1);
    const top = Math.max(4, step * 4);
    const axis = [4, 3, 2, 1, 0].map((k) => `<span>${fmt((top / 4) * k)}</span>`).join('');
    const bars = daily
      .map((d, i) => {
        const v = d[kind] || 0;
        const day = tashkentDay(d.date);
        const label = `${day.getUTCDate()}-${MONTHS[day.getUTCMonth()]}: ${v}`;
        return `<div class="bar ${i === daily.length - 1 ? 'today' : ''}" style="--h:${(v / top) * 100}%;--i:${i}" title="${esc(label)}"><b>${fmt(v)}</b></div>`;
      })
      .join('');
    const labels = daily.map((d) => `<span>${tashkentDay(d.date).getUTCDate()}</span>`).join('');
    return `<div class="bars ${kind === 'applications' ? 'apps' : ''}" role="img" aria-label="So‘nggi 14 kun">
      <div class="axis" aria-hidden="true">${axis}</div><div class="plot">${bars}</div><div class="labels" aria-hidden="true">${labels}</div></div>`;
  }

  // Donut: foydalanuvchilar tarkibi
  function donut(parts) {
    const total = parts.reduce((n, p) => n + p.value, 0);
    const r = 60;
    const c = 2 * Math.PI * r;
    const gap = parts.filter((p) => p.value).length > 1 ? 6 : 0;
    let offset = 0;
    const arcs = parts
      .filter((p) => p.value)
      .map((p) => {
        const len = Math.max(0, (p.value / total) * c - gap);
        const arc = `<circle r="${r}" cx="80" cy="80" stroke="${p.color}" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}"/>`;
        offset += (p.value / total) * c;
        return arc;
      })
      .join('');
    const legend = parts
      .map((p) => `<a href="${p.href}"><i style="background:${p.color}"></i><span>${esc(p.label)}</span><b>${fmt(p.value)}</b></a>`)
      .join('');
    return `<div class="donut-wrap"><div class="donut"><svg viewBox="0 0 160 160" aria-hidden="true">
        <circle r="${r}" cx="80" cy="80" stroke="var(--field)"/>${arcs}</svg>
        <div class="center"><strong>${fmt(total)}</strong><span>jami</span></div></div>
      <div class="legend">${legend}</div></div>`;
  }

  async function viewDashboard() {
    const s = state.stats;
    const kpi = ({ label, value, sub = '', href = '', ic, alert = false, tag = '' }) => {
      const el = href ? 'a' : 'div';
      return `<${el} class="kpi ${alert ? 'alert' : ''}" ${href ? `href="${href}"` : ''}>
        <span class="ic">${icon(ic)}</span>${tag ? `<span class="tag">${tag}</span>` : ''}
        <strong>${fmt(value)}</strong><span class="lbl">${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</${el}>`;
    };
    const pending = s.pendingUsers + s.pendingAds;
    const d = new Date();
    const first = String(state.me?.name || '').trim().split(/\s+/)[0];
    const daily = s.daily || [];
    const kind = state.chart;
    const sum = daily.reduce((n, x) => n + (x[kind] || 0), 0);
    const chartBtn = (k, label) => `<button type="button" data-act="chart" data-kind="${k}" aria-pressed="${kind === k}">${label}</button>`;
    return `<div class="head"><div><h1>${greeting()}${first ? `, ${esc(first)}` : ''}</h1>
        <p>${WEEKDAYS[d.getDay()]}, ${d.getDate()}-${MONTHS[d.getMonth()]} · ${pending ? `${pending} ta ish tasdiqlashni kutmoqda` : 'hamma narsa tartibda'}</p></div>
        <div class="btn-row">${exportButton}<a class="btn btn-primary" href="#/moderation">${icon('shield')}<span>Moderatsiya</span></a></div></div>
      <div class="overview">
        <section class="card">
          <div class="card-head"><div><h2>${kind === 'users' ? 'Yangi foydalanuvchilar' : 'Yangi so‘rovlar'}</h2>
            <p>So‘nggi 14 kunda ${fmt(sum)} ta</p></div>
            <div class="seg" role="group" aria-label="Grafik">${chartBtn('users', 'Foydalanuvchilar')}${chartBtn('applications', 'So‘rovlar')}</div></div>
          ${daily.length ? barChart(daily, kind) : '<p class="empty">Ma’lumot yo‘q</p>'}
        </section>
        <section class="card">
          <div class="card-head"><div><h2>Foydalanuvchilar tarkibi</h2><p>Bosib, ro‘yxatni oching</p></div></div>
          ${donut([
            { label: 'Blogerlar', value: s.bloggers, color: 'var(--c-blogger)', href: '#/users?role=blogger' },
            { label: 'Bizneslar', value: s.businesses, color: 'var(--c-business)', href: '#/users?role=business' },
            { label: 'Ro‘yxatda', value: s.incomplete, color: 'var(--c-incomplete)', href: '#/users?status=incomplete' }
          ])}
        </section>
      </div>
      <div class="kpis">
        ${kpi({ label: 'Profil tasdiq kutmoqda', value: s.pendingUsers, href: '#/moderation', ic: 'shield', alert: s.pendingUsers > 0, tag: s.pendingUsers ? pill('pending', 'Yangi') : '' })}
        ${kpi({ label: 'E’lon tasdiq kutmoqda', value: s.pendingAds, href: '#/moderation', ic: 'clock', alert: s.pendingAds > 0, tag: s.pendingAds ? pill('pending', 'Yangi') : '' })}
        ${kpi({ label: 'Blogerlar', value: s.bloggers, href: '#/users?role=blogger', ic: 'star' })}
        ${kpi({ label: 'Bizneslar', value: s.businesses, href: '#/users?role=business', ic: 'briefcase' })}
        ${kpi({ label: 'Faol reklama e’lonlari', value: s.activeAds, href: '#/ads', ic: 'megaphone' })}
        ${kpi({ label: 'So‘rovlar', value: s.applications, sub: `Qabul qilingan: ${fmt(s.accepted)} · kutilmoqda: ${fmt(s.waitingApplications)}`, href: '#/requests', ic: 'inbox' })}
        ${kpi({ label: 'Ro‘yxatdan o‘tmoqda', value: s.incomplete, sub: 'Savollarni oxirigacha javob bermaganlar', href: '#/users?status=incomplete', ic: 'userPlus' })}
        ${kpi({ label: 'Yangi: 7 kunda', value: s.week.users, sub: `E’lonlar: ${fmt(s.week.ads)} · so‘rovlar: ${fmt(s.week.applications)}`, ic: 'users', tag: s.week.users ? pill('approved', `+${fmt(s.week.users)}`) : '' })}
      </div>`;
  }

  /* ---------- Moderatsiya ---------- */
  const fact = (label, value) => (value ? `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>` : '');
  const link = (url, text) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text || url.replace(/^https?:\/\/(www\.)?/, ''))}</a>` : '');
  const tgLink = (u) => (u.username ? link(`https://t.me/${u.username}`, `@${u.username}`) : '');
  const photo = (src, alt = '') => (src ? `<button type="button" class="photo" data-act="zoom" data-src="${esc(src)}"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy"></button>` : '');

  // Kartochka tepasidagi rasm: ustida holat va toifa yorliqlari
  const cover = (src, alt, tag, price = '') => `<div class="cover">${photo(src, alt)}
    <div class="chips"><span class="chip">${icon('clock')}Moderatsiyada</span>${tag ? `<span class="chip">${esc(tag)}</span>` : ''}</div>
    ${price ? `<span class="chip price">${esc(price)}</span>` : ''}</div>`;

  function userFacts(u) {
    if (u.role === 'business') {
      return [
        fact('Kompaniya', esc(u.company)),
        fact('Toifa', esc(u.category)),
        fact('Ism', esc(u.name)),
        fact('Telegram', tgLink(u)),
        fact('Telefon', esc(u.phone))
      ].join('');
    }
    return [
      fact('Ism', esc(u.name)),
      fact('Platforma', esc(u.platform)),
      fact('Profil', link(u.profileUrl, u.profile) || esc(u.profile)),
      fact('Obunachilar', esc(u.followers)),
      ...(u.views || []).map((v) => fact(v.label, v.value ? esc(v.value) : '<span class="muted">kiritilmagan</span>')),
      fact('Yo‘nalish', esc(u.niche)),
      fact('Auditoriya', esc(u.region)),
      fact('Telegram', tgLink(u)),
      fact('Telefon', esc(u.phone)),
      fact('Statistika', u.statsImage ? 'skrinshot bor' : 'yuborilmagan')
    ].join('');
  }

  function userCard(u) {
    const title = u.role === 'business' ? u.company : u.name;
    return `<article class="card item">
      ${u.statsImage ? cover(u.statsImage, 'Statistika', ROLE[u.role]) : `<div class="item-tags">${userPill(u)}${pill('role', ROLE[u.role] || '')}</div>`}
      <div class="item-head"><div class="person"><span class="avatar sm">${esc(initials(title))}</span><div><h3>${esc(title)}</h3>
        <span class="muted small">${esc(ROLE[u.role] || '')} · ${date(u.registeredAt)}</span></div></div></div>
      <dl class="facts">${userFacts(u)}</dl>
      <div class="btn-row">
        <button type="button" class="btn btn-soft" data-act="open-user" data-id="${u.id}">${icon('eye')}<span>Batafsil</span></button>
        <button type="button" class="btn btn-ok" data-act="user-mod" data-id="${u.id}" data-action="approve">${icon('check')}<span>Tasdiqlash</span></button>
      </div>
      <button type="button" class="btn btn-danger" data-act="user-mod" data-id="${u.id}" data-action="reject">Rad etish</button>
    </article>`;
  }

  function adFacts(c) {
    return [
      fact('Biznes', `${esc(c.business.company)}${c.business.contact ? ` <span class="muted">(${esc(c.business.contact)})</span>` : ''}`),
      fact('Toifa', esc(c.category)),
      fact('Hudud', esc([c.region, c.city].filter(Boolean).join(', '))),
      fact('Qiymati', money(c.value)),
      fact('Platformalar', esc(c.platforms.join(', '))),
      fact('Format', esc(c.format)),
      fact('Talab', c.minFollowers ? `${fmt(c.minFollowers)}+ obunachi` : 'yo‘q'),
      fact('Muddat', `${c.days} kun`),
      fact('O‘rinlar', `${c.accepted} / ${c.slots}`)
    ].join('');
  }

  function adCard(c) {
    return `<article class="card item">
      ${c.image?.url ? cover(c.image.url, c.title, c.category, money(c.value)) : ''}
      ${c.image?.url ? '' : `<div class="item-tags">${adPill(c)}</div>`}
      <div class="item-head"><div><h3>${esc(c.title)}</h3><span class="muted small">${esc(c.business.company)} · ${date(c.createdAt)}</span></div></div>
      <dl class="facts">${adFacts(c)}</dl>
      ${c.description ? `<p class="quote">${esc(c.description)}</p>` : ''}
      <div class="btn-row">${adActions(c)}</div>
    </article>`;
  }

  function adActions(c) {
    const buttons = [];
    if (c.moderation === 'pending') {
      buttons.push(`<button type="button" class="btn btn-ok" data-act="ad-mod" data-id="${c.id}" data-action="approve">${icon('check')}<span>Tasdiqlash</span></button>`);
      buttons.push(`<button type="button" class="btn btn-danger" data-act="ad-mod" data-id="${c.id}" data-action="reject">Rad etish</button>`);
    }
    if (c.status === 'active' && c.moderation === 'approved') {
      buttons.push(`<button type="button" class="btn btn-danger" data-act="ad-close" data-id="${c.id}">Yopish</button>`);
    }
    if (c.moderation !== 'rejected') {
      buttons.push(`<button type="button" class="btn btn-soft" data-act="ad-edit" data-id="${c.id}">${icon('pencil')}<span>Tahrirlash</span></button>`);
    }
    return buttons.join('');
  }

  async function viewModeration() {
    const [users, ads] = await Promise.all([
      api('/api/admin/users?status=pending'),
      api('/api/admin/campaigns?moderation=pending&status=active')
    ]);
    const usersHtml = users.users.length ? `<div class="queue">${users.users.map(userCard).join('')}</div>` : '<div class="card empty">Tasdiq kutayotgan profil yo‘q.</div>';
    const adsHtml = ads.campaigns.length ? `<div class="queue">${ads.campaigns.map(adCard).join('')}</div>` : '<div class="card empty">Tasdiq kutayotgan e’lon yo‘q.</div>';
    return `<div class="head"><div><h1>Moderatsiya</h1><p>Tasdiqlansa foydalanuvchiga botda xabar boradi</p></div></div>
      <h2 class="section-title">Profillar ${users.total ? pill('pending', users.total) : ''}</h2>${usersHtml}
      <h2 class="section-title">Reklama e’lonlari ${ads.total ? pill('pending', ads.total) : ''}</h2>${adsHtml}`;
  }

  /* ---------- Ro'yxatlar ---------- */
  function pager(data, kind) {
    if (data.total <= data.pageSize) return `<div class="pager"><span>Jami: ${fmt(data.total)}</span></div>`;
    const from = (data.page - 1) * data.pageSize + 1;
    const to = Math.min(data.total, data.page * data.pageSize);
    return `<div class="pager"><span>${fmt(from)}–${fmt(to)} / ${fmt(data.total)}</span><div class="btn-row">
      <button type="button" class="btn" data-act="page" data-kind="${kind}" data-page="${data.page - 1}" ${data.page <= 1 ? 'disabled' : ''}>Oldingi</button>
      <button type="button" class="btn" data-act="page" data-kind="${kind}" data-page="${data.page + 1}" ${to >= data.total ? 'disabled' : ''}>Keyingi</button>
    </div></div>`;
  }

  const options = (pairs, selected) => pairs.map(([v, l]) => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const query = (obj) => new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== '' && v != null)).toString();

  // Bosh sahifadagi havolalar filtr bilan ochiladi (#/users?role=blogger)
  function applyHashFilters(kind) {
    const q = location.hash.split('?')[1];
    if (!q) return;
    const params = new URLSearchParams(q);
    const f = state.filters[kind];
    // Havoladagi filtr oldingi tanlovlar o'rniga to'liq qo'llanadi
    for (const key of Object.keys(f)) f[key] = params.get(key) || '';
    f.page = 1;
    history.replaceState(null, '', `#/${kind}`);
  }

  async function viewUsers() {
    applyHashFilters('users');
    const f = state.filters.users;
    const data = await api(`/api/admin/users?${query(f)}`);
    const rows = data.users
      .map(
        (u) => `<tr data-open="user" data-id="${u.id}">
          <td data-label="Ism"><strong>${esc(u.role === 'business' ? u.company || u.name : u.name)}</strong><span class="sub">${u.username ? `@${esc(u.username)} · ` : ''}ID ${u.id}</span></td>
          <td data-label="Rol">${u.role ? pill('role', ROLE[u.role]) : '—'}</td>
          <td data-label="Ma’lumot">${u.role === 'business' ? esc(u.category || '') : `${esc(u.platform || '')}${u.followers ? ` · ${esc(u.followers)}` : ''}<span class="sub">${esc(u.niche || '')}</span>`}</td>
          <td data-label="Hudud">${esc(u.region || '—')}</td>
          <td data-label="Telefon" class="num">${esc(u.phone || '—')}</td>
          <td data-label="Holat">${userPill(u)}</td>
          <td data-label="Sana" class="num">${date(u.registeredAt || u.createdAt)}</td>
        </tr>`
      )
      .join('');
    return `<div class="head"><div><h1>Foydalanuvchilar</h1><p>Bloger va bizneslar</p></div>${exportButton}</div>
      <form class="filters" data-form="users">
        <label class="sr-only" for="u-q">Qidiruv</label>
        <input id="u-q" class="control" name="q" type="search" placeholder="Ism, kompaniya, @username, telefon yoki ID" value="${esc(f.q)}">
        <select class="control" name="role" aria-label="Rol">${options([['', 'Barcha rollar'], ['blogger', 'Blogerlar'], ['business', 'Bizneslar']], f.role)}</select>
        <select class="control" name="status" aria-label="Holat">${options([['', 'Barcha holatlar'], ['pending', 'Moderatsiyada'], ['approved', 'Tasdiqlangan'], ['rejected', 'Rad etilgan'], ['incomplete', 'Ro‘yxatdan o‘tmoqda']], f.status)}</select>
        <button class="btn btn-primary" type="submit">Qidirish</button>
      </form>
      ${data.users.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Ism</th><th>Rol</th><th>Ma’lumot</th><th>Hudud</th><th>Telefon</th><th>Holat</th><th>Sana</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : '<div class="card empty">Hech kim topilmadi.</div>'}
      ${pager(data, 'users')}`;
  }

  async function viewAds() {
    applyHashFilters('ads');
    const f = state.filters.ads;
    const data = await api(`/api/admin/campaigns?${query(f)}`);
    const rows = data.campaigns
      .map(
        (c) => `<tr data-open="ad" data-id="${c.id}">
          <td data-label="E’lon">${c.image ? `<img class="thumb" src="${esc(c.image.thumb)}" alt="" loading="lazy">` : ''}<strong>${esc(c.title)}</strong><span class="sub">${esc(c.category)}</span></td>
          <td data-label="Biznes">${esc(c.business.company)}</td>
          <td data-label="Hudud">${esc(c.region || '—')}</td>
          <td data-label="Qiymati" class="num">${money(c.value)}</td>
          <td data-label="O‘rinlar" class="num">${c.accepted} / ${c.slots}</td>
          <td data-label="So‘rovlar" class="num">${c.applications}${c.pending ? ` <span class="sub">${c.pending} ta yangi</span>` : ''}</td>
          <td data-label="Holat">${adPill(c)}</td>
          <td data-label="Sana" class="num">${date(c.createdAt)}</td>
        </tr>`
      )
      .join('');
    return `<div class="head"><div><h1>Reklama e’lonlari</h1><p>Barcha bizneslarning e’lonlari</p></div></div>
      <form class="filters" data-form="ads">
        <label class="sr-only" for="a-q">Qidiruv</label>
        <input id="a-q" class="control" name="q" type="search" placeholder="E’lon, kompaniya yoki manzil" value="${esc(f.q)}">
        <select class="control" name="moderation" aria-label="Moderatsiya">${options([['', 'Barcha moderatsiya holatlari'], ['pending', 'Moderatsiyada'], ['approved', 'Tasdiqlangan'], ['rejected', 'Rad etilgan']], f.moderation)}</select>
        <select class="control" name="status" aria-label="Holat">${options([['', 'Faol va yopiq'], ['active', 'Faol'], ['closed', 'Yopiq']], f.status)}</select>
        <button class="btn btn-primary" type="submit">Qidirish</button>
      </form>
      ${data.campaigns.length ? `<div class="table-wrap"><table>
        <thead><tr><th>E’lon</th><th>Biznes</th><th>Hudud</th><th>Qiymati</th><th>O‘rinlar</th><th>So‘rovlar</th><th>Holat</th><th>Sana</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : '<div class="card empty">E’lon topilmadi.</div>'}
      ${pager(data, 'ads')}`;
  }

  async function viewRequests() {
    applyHashFilters('requests');
    const f = state.filters.requests;
    const data = await api(`/api/admin/applications?${query(f)}`);
    const rows = data.applications
      .map(
        (a) => `<tr>
          <td data-label="Sana" class="num">${date(a.createdAt)}</td>
          <td data-label="Bloger"><a href="#" data-act="open-user" data-id="${a.blogger.id}">${esc(a.blogger.name)}</a><span class="sub">${esc(a.blogger.platform || '')} · ${esc(a.blogger.followers || '')}</span></td>
          <td data-label="E’lon"><a href="#" data-act="open-ad" data-id="${a.campaign.id}">${esc(a.campaign.title)}</a></td>
          <td data-label="Biznes"><a href="#" data-act="open-user" data-id="${a.business.id}">${esc(a.business.company)}</a></td>
          <td data-label="Holat">${pill(a.status, APP_STATUS[a.status])}</td>
          <td data-label="Xabar">${esc(a.message || '—')}</td>
        </tr>`
      )
      .join('');
    return `<div class="head"><div><h1>So‘rovlar</h1><p>Blogerlarning e’lonlarga yuborgan so‘rovlari</p></div></div>
      <form class="filters" data-form="requests">
        <select class="control" name="status" aria-label="Holat">${options([['', 'Barcha so‘rovlar'], ['pending', 'Kutilmoqda'], ['accepted', 'Qabul qilingan'], ['rejected', 'Rad etilgan']], f.status)}</select>
        <button class="btn btn-primary" type="submit">Ko‘rsatish</button>
      </form>
      ${data.applications.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Sana</th><th>Bloger</th><th>E’lon</th><th>Biznes</th><th>Holat</th><th>Xabar</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : '<div class="card empty">So‘rov topilmadi.</div>'}
      ${pager(data, 'requests')}`;
  }

  /* ---------- Sozlamalar ---------- */
  async function viewSettings() {
    const s = await api('/api/admin/settings');
    state.bot = s.bot || state.bot;
    const KINDS = [
      ['blogger', 'Yangi blogerlar', '/ulash bloger'],
      ['business', 'Yangi bizneslar', '/ulash biznes'],
      ['ads', 'Reklama e’lonlari', '/ulash elon']
    ];
    const rows = KINDS.map(([kind, label, cmd]) => {
      const g = s.groups[kind];
      return `<div class="setting"><div><strong>${esc(label)}</strong><span class="sub">${
        g ? esc(g.title || `Guruh ID ${g.id}`) : kind === 'ads' && s.groups.business ? 'Hozircha bizneslar guruhiga keladi' : `Ulash uchun guruhda ${esc(cmd)} yozing`
      }</span></div>${g ? `<button type="button" class="btn btn-danger" data-act="unbind" data-kind="${kind}">Uzish</button>` : pill('muted', 'Ulanmagan')}</div>`;
    }).join('');
    return `<div class="head"><div><h1>Sozlamalar</h1></div></div>
      <div class="grid">
        <section class="card"><h2>Moderatsiya guruhlari</h2>
          <div class="grid" style="gap:8px">${rows}</div>
          <p class="muted small" style="margin-top:12px">Guruhni ulash: botni guruhga qo‘shing va guruhda <code>/ulash</code> (hammasi), <code>/ulash bloger</code>, <code>/ulash biznes</code> yoki <code>/ulash elon</code> yozing. Guruh ulanmagan bo‘lsa, xabarlar adminlarga shaxsan keladi.</p>
        </section>
        <section class="card"><h2>Hisob</h2>
          <p>${esc(state.me?.name || 'Admin')} · Telegram ID <b>${esc(state.me?.id)}</b>${s.bot ? ` · Bot: <a href="https://t.me/${esc(s.bot)}" target="_blank" rel="noopener">@${esc(s.bot)}</a>` : ''}</p>
          <p class="muted small" style="margin:8px 0 12px">Adminlar ro‘yxati GitHub’dagi ADMIN_IDS secretida. U yerdan olib tashlangan admin panelga kira olmaydi.</p>
          <button type="button" class="btn" data-act="logout">Chiqish</button>
        </section>
      </div>`;
  }

  /* ---------- Batafsil oyna ---------- */
  function openDrawer(html) {
    closeDrawer();
    const bg = document.createElement('div');
    bg.className = 'drawer-bg';
    bg.dataset.act = 'close-drawer';
    const panel = document.createElement('aside');
    panel.className = 'drawer';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.innerHTML = html;
    document.body.append(bg, panel);
    panel.querySelector('.close')?.focus();
  }

  function closeDrawer() {
    document.querySelectorAll('.drawer, .drawer-bg').forEach((el) => el.remove());
  }

  const drawerHead = (title, sub, statusPill) =>
    `<div class="drawer-head"><div><h2>${esc(title)}</h2><span class="muted small">${sub}</span></div>
      <button type="button" class="close" data-act="close-drawer" aria-label="Yopish">✕</button></div>${statusPill ? `<div>${statusPill}</div>` : ''}`;

  async function openUser(id) {
    openDrawer(loading);
    try {
      const { user: u, campaigns, applications } = await api(`/api/admin/users/${id}`);
      const actions = [];
      if (u.registered && u.moderation !== 'approved') actions.push(`<button type="button" class="btn btn-ok" data-act="user-mod" data-id="${u.id}" data-action="approve">Tasdiqlash</button>`);
      if (u.registered && u.moderation === 'pending') actions.push(`<button type="button" class="btn btn-danger" data-act="user-mod" data-id="${u.id}" data-action="reject">Rad etish</button>`);
      if (u.registered && u.moderation === 'approved') actions.push(`<button type="button" class="btn btn-danger" data-act="user-mod" data-id="${u.id}" data-action="block">Bloklash</button>`);
      actions.push(`<button type="button" class="btn btn-danger" data-act="user-delete" data-id="${u.id}">O‘chirish</button>`);
      const related = campaigns
        ? `<h3 class="section-title" style="margin:6px 0 0">Reklama e’lonlari (${campaigns.length})</h3><div class="related">${
            campaigns.map((c) => `<a class="row" href="#" data-act="open-ad" data-id="${c.id}"><span>${esc(c.title)}</span>${adPill(c)}</a>`).join('') || '<p class="muted small">Yo‘q</p>'
          }</div>`
        : `<h3 class="section-title" style="margin:6px 0 0">So‘rovlari (${applications.length})</h3><div class="related">${
            applications.map((a) => `<a class="row" href="#" data-act="open-ad" data-id="${a.campaign.id}"><span>${esc(a.campaign.title)} <span class="sub">${esc(a.business.company)}</span></span>${pill(a.status, APP_STATUS[a.status])}</a>`).join('') || '<p class="muted small">Yo‘q</p>'
          }</div>`;
      openDrawer(`${drawerHead(u.role === 'business' ? u.company || u.name : u.name, `${esc(ROLE[u.role] || '—')} · ID ${u.id} · ${date(u.registeredAt || u.createdAt)}`, userPill(u))}
        <section class="card"><dl class="facts">${userFacts(u)}${fact('Til', u.lang === 'ru' ? 'Ruscha' : 'O‘zbekcha')}</dl></section>
        ${photo(u.statsImage, 'Statistika')}
        <div class="btn-row">${actions.join('')}</div>
        ${related}`);
    } catch (e) {
      if (!e.silent) openDrawer(`${drawerHead('Xatolik', '', '')}<p>${esc(errorText(e))}</p>`);
    }
  }

  async function openAd(id) {
    openDrawer(loading);
    try {
      const { campaign: c, applications } = await api(`/api/admin/campaigns/${id}`);
      const related = applications
        .map(
          (a) => `<a class="row" href="#" data-act="open-user" data-id="${a.blogger.id}"><span>${esc(a.blogger.name)} <span class="sub">${esc(a.blogger.platform || '')} · ${esc(a.blogger.followers || '')}</span></span>${pill(a.status, APP_STATUS[a.status])}</a>`
        )
        .join('');
      openDrawer(`${drawerHead(c.title, `${date(c.createdAt)} · ID ${c.id}`, adPill(c))}
        ${photo(c.image?.url, c.title)}
        <section class="card"><dl class="facts">${adFacts(c)}</dl></section>
        ${c.description ? `<p class="quote">${esc(c.description)}</p>` : ''}
        <div class="btn-row">${adActions(c)}<button type="button" class="btn" data-act="open-user" data-id="${c.business.id}">Biznes profili</button></div>
        <h3 class="section-title" style="margin:6px 0 0">So‘rovlar (${applications.length})</h3>
        <div class="related">${related || '<p class="muted small">Hali so‘rov yo‘q</p>'}</div>`);
    } catch (e) {
      if (!e.silent) openDrawer(`${drawerHead('Xatolik', '', '')}<p>${esc(errorText(e))}</p>`);
    }
  }

  /* ---------- E'lonni tahrirlash ---------- */
  const FIELD_ERRORS = {
    title: 'Nomi 3–80 belgi bo‘lsin',
    category: 'Toifani tanlang',
    value: 'Qiymat 1 000 so‘mdan katta bo‘lsin',
    platforms: 'Kamida bitta platforma tanlang',
    format: 'Formatni yozing (2–80 belgi)',
    minFollowers: 'Obunachilar sonini to‘g‘ri yozing',
    days: 'Muddat 1–90 kun',
    slots: 'O‘rinlar 1–100, qabul qilingan blogerlardan kam bo‘lmasin',
    region: 'Hududni tanlang',
    city: 'Shahar nomi juda uzun',
    description: 'Tavsif 600 belgidan oshmasin'
  };

  async function editAd(id) {
    openDrawer(loading);
    try {
      const [{ campaign: c }, opts] = await Promise.all([
        api(`/api/admin/campaigns/${id}`),
        state.options || api('/api/admin/campaign-options')
      ]);
      state.options = opts;
      const L = opts.limits;
      const field = (name, label, control, hint = '') =>
        `<label class="field" data-field="${name}"><span>${esc(label)}</span>${control}${hint ? `<small class="muted">${esc(hint)}</small>` : ''}<em class="err" hidden></em></label>`;
      const input = (name, value, attrs = '') => `<input class="control" name="${name}" value="${esc(value ?? '')}" ${attrs}>`;
      const sectors = opts.sectors
        .map((g) => `<optgroup label="${esc(g.label)}">${g.items.map((i) => `<option value="${esc(i.id)}" ${i.id === c.raw.category ? 'selected' : ''}>${esc(i.label)}</option>`).join('')}</optgroup>`)
        .join('');
      // Eski toifa endi ro'yxatda bo'lmasa ham tanlangan holda ko'rinadi
      const known = opts.sectors.some((g) => g.items.some((i) => i.id === c.raw.category));
      const regions = opts.regions.map((r) => `<option value="${esc(r.id)}" ${r.id === c.raw.region ? 'selected' : ''}>${esc(r.label)}</option>`).join('');
      const platforms = opts.platforms
        .map((pl) => `<label class="check"><input type="checkbox" name="platforms" value="${esc(pl)}" ${c.platforms.includes(pl) ? 'checked' : ''}><span>${esc(pl)}</span></label>`)
        .join('');
      openDrawer(`${drawerHead('E’lonni tahrirlash', `ID ${c.id} · ${esc(c.business.company)}`, '')}
        <p class="notice">Saqlangach, biznesga botda “e’loningiz tahrirlandi” degan xabar boradi. Rasm, holat va so‘rovlar o‘zgarmaydi.</p>
        <form class="edit-form" data-edit-ad="${c.id}" novalidate>
          ${field('title', 'Nomi', input('title', c.title, `maxlength="${L.titleMax}" required`))}
          ${field('category', 'Toifa', `<select class="control" name="category">${known ? '' : `<option value="${esc(c.raw.category)}" selected>${esc(c.category)}</option>`}${sectors}</select>`)}
          <div class="two">
            ${field('value', 'Mahsulot qiymati (so‘m)', input('value', c.value, 'type="number" inputmode="numeric" min="1000" step="1000"'))}
            ${field('minFollowers', 'Kerakli obunachilar', input('minFollowers', c.minFollowers || '', 'type="number" inputmode="numeric" min="0" placeholder="Talab yo‘q"'))}
          </div>
          ${field('platforms', 'Platformalar', `<div class="checks">${platforms}</div>`)}
          ${field('format', 'Format', input('format', c.format, `maxlength="${L.formatMax}" placeholder="Masalan: 1 Reels + 2 Stories"`))}
          <div class="two">
            ${field('days', 'Muddat (kun)', input('days', c.days, `type="number" inputmode="numeric" min="1" max="${L.daysMax}"`))}
            ${field('slots', 'O‘rinlar', input('slots', c.slots, `type="number" inputmode="numeric" min="${Math.max(1, c.accepted)}" max="${L.slotsMax}"`), c.accepted ? `Qabul qilingan: ${c.accepted}` : '')}
          </div>
          <div class="two">
            ${field('region', 'Hudud', `<select class="control" name="region">${regions}</select>`)}
            ${field('city', 'Shahar yoki manzil', input('city', c.city, `maxlength="${L.cityMax}" placeholder="Ixtiyoriy"`))}
          </div>
          ${field('description', 'Tavsif', `<textarea class="control" name="description" rows="5" maxlength="${L.descriptionMax}" placeholder="Ixtiyoriy">${esc(c.description)}</textarea>`)}
          <div class="btn-row sticky-actions">
            <button type="button" class="btn btn-soft" data-act="open-ad" data-id="${c.id}">Bekor qilish</button>
            <button type="submit" class="btn btn-primary">${icon('check')}<span>Saqlash</span></button>
          </div>
        </form>`);
      document.querySelector('.edit-form [name="title"]')?.focus();
    } catch (e) {
      if (!e.silent) openDrawer(`${drawerHead('Xatolik', '', '')}<p>${esc(errorText(e))}</p>`);
    }
  }

  async function saveAd(form) {
    if (state.busy) return;
    const fd = new FormData(form);
    const num = (k) => (String(fd.get(k) || '').trim() === '' ? '' : Number(fd.get(k)));
    const body = {
      title: String(fd.get('title') || '').trim(),
      category: fd.get('category'),
      value: num('value'),
      platforms: fd.getAll('platforms'),
      format: String(fd.get('format') || '').trim(),
      minFollowers: num('minFollowers'),
      days: num('days'),
      slots: num('slots'),
      region: fd.get('region'),
      city: String(fd.get('city') || '').trim(),
      description: String(fd.get('description') || '').trim()
    };
    form.querySelectorAll('.field').forEach((f) => {
      f.classList.remove('bad');
      f.querySelector('.err').hidden = true;
    });
    const button = form.querySelector('[type=submit]');
    state.busy = true;
    button.disabled = true;
    const id = Number(form.dataset.editAd);
    try {
      await api(`/api/admin/campaigns/${id}`, { method: 'PATCH', body });
      toast('Saqlandi. Biznesga botda xabar bordi.');
      state.busy = false;
      // Orqadagi ro'yxat ham yangilanadi, keyin e'lon oynasi qayta ochiladi
      await render();
      openAd(id);
    } catch (e) {
      const fields = e.data?.fields || [];
      if (fields.length) {
        fields.forEach((name) => {
          const f = form.querySelector(`[data-field="${name}"]`);
          if (!f) return;
          f.classList.add('bad');
          const err = f.querySelector('.err');
          err.textContent = FIELD_ERRORS[name] || 'Tekshiring';
          err.hidden = false;
        });
        form.querySelector('.bad')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        toast('Ba’zi maydonlarni tuzating');
      } else if (!e.silent) toast(errorText(e));
    } finally {
      state.busy = false;
      button.disabled = false;
    }
  }

  /* ---------- Excel'ga yuklab olish ---------- */
  // Hamma ma'lumot: blogerlar, bizneslar, reklama e'lonlari va so'rovlar — to'rt varaqli bitta fayl.
  // Server 500 tadan beradi, fayl brauzerda yasaladi (xlsx.js).
  const exportButton = `<button type="button" class="btn btn-soft" data-act="export">${icon('download')}<span>Excel’ga yuklab olish</span></button>`;

  const dateCell = (ts) => (ts ? date(ts) : '');
  const yesNo = (v, yes, no) => (v ? yes : no);
  const LANG = { uz: 'O‘zbekcha', ru: 'Ruscha' };

  // [sarlavha, qiymat, ustun kengligi]
  const EXPORT_SHEETS = [
    {
      name: 'Blogerlar',
      kind: 'users',
      filter: (r) => r.role === 'blogger',
      columns: [
        ['Telegram ID', (r) => r.id, 13],
        ['Ism', (r) => r.name, 20],
        ['Telegram', (r) => (r.username ? `@${r.username}` : ''), 18],
        ['Telefon', (r) => r.phone, 18],
        ['Platforma', (r) => r.platform, 11],
        ['Profil', (r) => r.profile, 38],
        ['Obunachilar', (r) => r.followers, 18],
        ['Reels (o‘rtacha)', (r) => r.reels, 16],
        ['Postlar (o‘rtacha)', (r) => r.posts, 16],
        ['Istoriya (o‘rtacha)', (r) => r.stories, 16],
        ['Qamrov (30 kun)', (r) => r.accounts, 18],
        ['Ko‘rishlar (Telegram, YouTube)', (r) => r.views, 18],
        ['Reels va postlar (eski)', (r) => r.legacy, 16],
        ['Yo‘nalish', (r) => r.niche, 22],
        ['Auditoriya hududi', (r) => r.region, 20],
        ['Statistika skrinshoti', (r) => yesNo(r.stats, 'bor', 'yo‘q'), 12],
        ['Holat', (r) => MODERATION[r.moderation] || r.moderation, 14],
        ['Yangi e’lonlar haqida xabar', (r) => yesNo(r.notifyAds, 'yoqilgan', 'o‘chirilgan'), 14],
        ['Til', (r) => LANG[r.lang] || r.lang, 11],
        ['Ro‘yxatdan o‘tgan', (r) => dateCell(r.registeredAt), 17],
        ['So‘rovlar', (r) => r.applications, 10]
      ]
    },
    {
      name: 'Bizneslar',
      kind: 'users',
      filter: (r) => r.role === 'business',
      columns: [
        ['Telegram ID', (r) => r.id, 13],
        ['Kompaniya', (r) => r.company, 26],
        ['Toifa', (r) => r.category, 18],
        ['Kontakt (ism)', (r) => r.name, 20],
        ['Telegram', (r) => (r.username ? `@${r.username}` : ''), 18],
        ['Telefon', (r) => r.phone, 18],
        ['Holat', (r) => MODERATION[r.moderation] || r.moderation, 14],
        ['Til', (r) => LANG[r.lang] || r.lang, 11],
        ['Ro‘yxatdan o‘tgan', (r) => dateCell(r.registeredAt), 17],
        ['E’lonlar', (r) => r.campaigns, 10]
      ]
    },
    {
      name: 'E’lonlar',
      kind: 'campaigns',
      columns: [
        ['ID', (r) => r.id, 7],
        ['Nomi', (r) => r.title, 28],
        ['Biznes', (r) => r.company, 24],
        ['Kontakt', (r) => r.contact, 18],
        ['Toifa', (r) => r.category, 18],
        ['Hudud', (r) => r.region, 20],
        ['Shahar', (r) => r.city, 14],
        ['Mahsulot qiymati (so‘m)', (r) => r.value, 14],
        ['Platformalar', (r) => r.platforms, 18],
        ['Format', (r) => r.format, 26],
        ['Kerakli obunachilar', (r) => r.minFollowers, 12],
        ['Muddat (kun)', (r) => r.days, 9],
        ['O‘rinlar', (r) => r.slots, 9],
        ['Holat', (r) => AD_STATUS[r.status] || r.status, 10],
        ['Moderatsiya', (r) => MODERATION[r.moderation] || r.moderation, 14],
        ['So‘rovlar', (r) => r.applications, 10],
        ['Qabul qilingan', (r) => r.accepted, 10],
        ['Kutilmoqda', (r) => r.pending, 10],
        ['Yaratilgan', (r) => dateCell(r.createdAt), 17],
        ['Tavsif', (r) => r.description, 40]
      ]
    },
    {
      name: 'So‘rovlar',
      kind: 'applications',
      columns: [
        ['ID', (r) => r.id, 7],
        ['Holat', (r) => APP_STATUS[r.status] || r.status, 14],
        ['Sana', (r) => dateCell(r.createdAt), 17],
        ['E’lon ID', (r) => r.campaignId, 9],
        ['E’lon', (r) => r.title, 28],
        ['Biznes', (r) => r.company, 24],
        ['Bloger ID', (r) => r.bloggerId, 13],
        ['Bloger', (r) => r.bloggerName, 20],
        ['Telegram', (r) => (r.bloggerUsername ? `@${r.bloggerUsername}` : ''), 18],
        ['Telefon', (r) => r.bloggerPhone, 18],
        ['Platforma', (r) => r.platform, 11],
        ['Obunachilar', (r) => r.followers, 18],
        ['Profil', (r) => r.profile, 38],
        ['Xabar', (r) => r.message, 40]
      ]
    }
  ];

  async function fetchAllRows(kind, onProgress) {
    const rows = [];
    for (let page = 1; page <= 1000; page += 1) {
      const data = await api(`/api/admin/export/${kind}?page=${page}`);
      rows.push(...data.rows);
      onProgress(rows.length);
      if (!data.rows.length || rows.length >= data.total) break;
    }
    return rows;
  }

  function saveFile(bytes, filename) {
    const url = URL.createObjectURL(
      new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function exportExcel(button) {
    if (state.busy) return;
    if (!window.OvozaXlsx) {
      toast('Sahifani yangilab, qaytadan urinib ko‘ring.');
      return;
    }
    state.busy = true;
    button.disabled = true;
    const label = button.innerHTML;
    // Dumaloq tugmada (tepa qator) matn sig'maydi, jarayon xabarda ko'rinadi
    const compact = button.classList.contains('round');
    const progress = (text) => {
      if (compact) toast(text);
      else button.innerHTML = `${icon('download')}<span>${esc(text)}</span>`;
    };
    try {
      const data = {};
      for (const [kind, title] of [['users', 'Foydalanuvchilar'], ['campaigns', 'E’lonlar'], ['applications', 'So‘rovlar']]) {
        data[kind] = await fetchAllRows(kind, (n) => progress(`${title}: ${fmt(n)}`));
      }
      progress('Fayl tayyorlanmoqda…');
      const sheets = EXPORT_SHEETS.map((s) => {
        const rows = s.filter ? data[s.kind].filter(s.filter) : data[s.kind];
        return {
          name: s.name,
          header: s.columns.map(([h]) => h),
          widths: s.columns.map(([, , w]) => w),
          rows: rows.map((r) => s.columns.map(([, get]) => get(r)))
        };
      });
      const d = new Date();
      saveFile(window.OvozaXlsx.build(sheets), `miqyos-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.xlsx`);
      const count = (name) => sheets.find((s) => s.name === name).rows.length;
      toast(`Yuklab olindi: ${fmt(count('Blogerlar'))} bloger, ${fmt(count('Bizneslar'))} biznes, ${fmt(count('E’lonlar'))} e’lon`);
    } catch (e) {
      if (!e.silent) toast(errorText(e));
    } finally {
      button.innerHTML = label;
      button.disabled = false;
      state.busy = false;
    }
  }

  /* ---------- Amallar ---------- */
  async function act(button, fn, done) {
    if (state.busy) return;
    state.busy = true;
    button.disabled = true;
    try {
      await fn();
      toast(done);
      closeDrawer();
      await render();
    } catch (e) {
      if (!e.silent) toast(errorText(e));
      button.disabled = false;
    } finally {
      state.busy = false;
    }
  }

  const MOD_TEXT = {
    approve: ['', 'Tasdiqlandi. Foydalanuvchiga botda xabar bordi.'],
    reject: ['Profil rad etilsinmi? Foydalanuvchiga xabar boradi.', 'Rad etildi'],
    block: ['Foydalanuvchi bloklansinmi? U ilovadan foydalana olmaydi, biznes bo‘lsa e’lonlari yopiladi.', 'Bloklandi']
  };

  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-act], tr[data-open]');
    if (!el) return;
    if (el.tagName === 'A' && el.dataset.act) event.preventDefault();
    const id = Number(el.dataset.id);
    if (el.matches('tr[data-open]')) {
      if (el.dataset.open === 'user') openUser(id);
      else openAd(id);
      return;
    }
    switch (el.dataset.act) {
      case 'open-user':
        openUser(id);
        break;
      case 'open-ad':
        openAd(id);
        break;
      case 'close-drawer':
        closeDrawer();
        break;
      case 'zoom': {
        const box = document.createElement('div');
        box.className = 'lightbox';
        box.dataset.act = 'close-zoom';
        box.innerHTML = `<img src="${esc(el.dataset.src)}" alt="">`;
        document.body.append(box);
        break;
      }
      case 'close-zoom':
        el.remove();
        break;
      case 'user-mod': {
        const [question, done] = MOD_TEXT[el.dataset.action];
        if (question && !window.confirm(question)) return;
        act(el, () => api(`/api/admin/users/${id}/moderation`, { method: 'POST', body: { action: el.dataset.action } }), done);
        break;
      }
      case 'user-delete':
        if (!window.confirm('Foydalanuvchi va uning barcha ma’lumotlari (e’lonlari, so‘rovlari) butunlay o‘chirilsinmi? Buni qaytarib bo‘lmaydi.')) return;
        act(el, () => api(`/api/admin/users/${id}`, { method: 'DELETE' }), 'O‘chirildi');
        break;
      case 'ad-mod': {
        const approve = el.dataset.action === 'approve';
        if (!approve && !window.confirm('E’lon rad etilsinmi? U yopiladi va biznesga xabar boradi.')) return;
        act(el, () => api(`/api/admin/campaigns/${id}/moderation`, { method: 'POST', body: { action: el.dataset.action } }), approve ? 'E’lon tasdiqlandi: blogerlarga ko‘rinadi' : 'E’lon rad etildi');
        break;
      }
      case 'ad-edit':
        editAd(id);
        break;
      case 'ad-close':
        if (!window.confirm('E’lon yopilsinmi? Blogerlar uni ko‘rmaydi, biznesga xabar boradi.')) return;
        act(el, () => api(`/api/admin/campaigns/${id}/close`, { method: 'POST' }), 'E’lon yopildi');
        break;
      case 'unbind':
        if (!window.confirm('Guruh uzilsinmi? Xabarlar boshqa guruhga yoki adminlarga shaxsan keladi.')) return;
        act(el, () => api(`/api/admin/settings/groups/${el.dataset.kind}`, { method: 'DELETE' }), 'Guruh uzildi');
        break;
      case 'page': {
        state.filters[el.dataset.kind].page = Number(el.dataset.page) || 1;
        render();
        break;
      }
      case 'export':
        exportExcel(el);
        break;
      case 'chart':
        // Grafik turi almashadi, ma'lumot qayta yuklanmaydi
        state.chart = el.dataset.kind === 'applications' ? 'applications' : 'users';
        viewDashboard().then((html) => {
          if (currentRoute() === '') root.innerHTML = shell(html);
        });
        break;
      case 'logout':
        api('/api/admin/logout', { method: 'POST' })
          // Chiqqandan keyin /me 401 qaytaradi va kirish sahifasi bot nomi bilan ochiladi
          .then(() => api('/api/admin/me'))
          .catch((e) => {
            if (!e.silent) toast(errorText(e));
          });
        break;
      default:
        break;
    }
  });

  document.addEventListener('submit', (event) => {
    const edit = event.target.closest('form[data-edit-ad]');
    if (edit) {
      event.preventDefault();
      saveAd(edit);
      return;
    }
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    const kind = form.dataset.form;
    if (kind === 'search') {
      // Tepadagi qidiruv: foydalanuvchilar ro'yxatida, boshqa filtrlarsiz
      Object.assign(state.filters.users, { q: String(new FormData(form).get('q') || '').trim(), role: '', status: '', page: 1 });
      if (currentRoute() === 'users') render();
      else location.hash = '#/users';
      return;
    }
    const f = state.filters[kind];
    for (const [key, value] of new FormData(form)) f[key] = String(value).trim();
    f.page = 1;
    render();
  });

  // Filtr tanlansa darhol qo'llanadi
  document.addEventListener('change', (event) => {
    const form = event.target.closest('form[data-form]');
    if (form && event.target.tagName === 'SELECT') form.requestSubmit();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const zoom = document.querySelector('.lightbox');
    if (zoom) zoom.remove();
    else closeDrawer();
  });

  window.addEventListener('hashchange', () => {
    closeDrawer();
    render();
  });

  /* ---------- Ishga tushirish ---------- */
  async function boot() {
    try {
      state.me = (await api('/api/admin/me')).admin;
    } catch (e) {
      if (!e.silent) root.innerHTML = `<div class="login"><div class="card"><h1>Xatolik</h1><p>${esc(errorText(e))}</p></div></div>`;
      return;
    }
    await render();
  }

  boot();
})();
