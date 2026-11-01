// Umumiy yordamchi funksiyalar

import { DEFAULT_PRIVACY_URL } from './constants.js';

export const now = () => Math.floor(Date.now() / 1000);

const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

// Telegram HTML xabarlari uchun matnni xavfsiz qilish
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => HTML_ESC[c]);

// 180000 -> "180 000"
export const fmtNum = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

// Telefon raqamini "+998901234567" ko'rinishiga keltiradi.
// strict: faqat O'zbekiston raqamlari (qo'lda yozilganda).
export function normalizePhone(input, { strict = false } = {}) {
  let d = String(input ?? '').replace(/\D/g, '');
  if (d.length === 9) d = `998${d}`;
  if (/^998\d{9}$/.test(d)) return `+${d}`;
  if (!strict && d.length >= 10 && d.length <= 15) return `+${d}`;
  return null;
}

// "+998901234567" -> "+998 90 123 45 67"
export function formatPhone(phone) {
  const d = String(phone ?? '').replace(/\D/g, '');
  if (/^998\d{9}$/.test(d)) return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
  return d ? `+${d}` : '';
}

// Bloger profiliga havola: to'liq havola yoki platforma + username
export function profileUrl(platform, profile) {
  const p = String(profile ?? '').trim();
  if (!p) return null;
  if (/^https?:\/\/\S+$/i.test(p)) return p;
  if (/^[\w-]+(\.[\w-]+)+\/\S*$/i.test(p)) return `https://${p}`;
  const u = p.replace(/^@/, '');
  if (!/^[\w.]{2,64}$/.test(u)) return null;
  switch (platform) {
    case 'Instagram': return `https://instagram.com/${u}`;
    case 'TikTok': return `https://www.tiktok.com/@${u}`;
    case 'YouTube': return `https://www.youtube.com/@${u}`;
    case 'Telegram': return `https://t.me/${u}`;
    default: return null;
  }
}

// Qidiruv uchun: kichik harf, apostrof turlari olib tashlanadi
export const normSearch = (s) => String(s ?? '').toLowerCase().replace(/[‘’'ʻʼ`´]/g, '').replace(/ё/g, 'е').trim();

export const guessLang = (code) => (String(code || '').toLowerCase().startsWith('ru') ? 'ru' : 'uz');

export function isRegistered(user) {
  return Boolean(user && user.role && user.reg_step === 'done' && user.registered_at);
}

export function privacyUrl(env, lang) {
  const base = (env && env.PRIVACY_URL) || DEFAULT_PRIVACY_URL;
  return lang === 'ru' ? `${base}?lang=ru` : base;
}

export function adminIds(env) {
  return String(env.ADMIN_IDS || '')
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isSafeInteger(n) && n > 0);
}

export function isAdmin(id, env) {
  return String(env.ADMIN_IDS || '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .includes(String(id));
}
