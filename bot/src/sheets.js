// Yangi ro'yxatdan o'tgan bloger va bizneslarni "Ovoza kunlik agent jadvali" (Google Sheets) ga yozadi.
// Jadval tomonida Apps Script web app (SHEETS_URL) qatorni "Yangi" holatida qo'shadi va egasiga xabar beradi.
// Kalit bot tokenidan hosil qilinadi: Apps Script ham tokenni biladi, alohida maxfiy kalit kerak emas.

import { catLabel, followersLabel, nicheLabel, regionLabel, viewsFacts } from './i18n.js';
import { sha256Hex } from './telegram.js';
import { formatPhone, profileUrl } from './util.js';

export async function sheetsKey(botToken) {
  return (await sha256Hex(`ovoza-sheets:${botToken}`)).slice(0, 48);
}

const joinFilled = (parts) => parts.filter(Boolean).join('; ');

// Profil havolasidan akkaunt nomi: https://instagram.com/user -> user
function handleOf(url) {
  const last = String(url ?? '').split('?')[0].split('/').filter(Boolean).pop() || '';
  return last.replace(/^@/, '');
}

// Jadvaldagi ustun nomlari bilan qator. Sana va Holat ("Yangi") ni Apps Script o'zi qo'yadi.
export function sheetRow(u) {
  const telegram = u.username ? `@${u.username}` : '';
  const note = `Telegram ID: ${u.tg_id}`;
  if (u.role === 'business') {
    return {
      sheet: 'Brendlar',
      row: {
        Nomi: u.company || '',
        Soha: catLabel(u.category, 'uz'),
        Aloqa: joinFilled([u.name, formatPhone(u.phone), telegram]),
        Manba: 'Telegram bot',
        Izoh: note
      }
    };
  }
  const url = profileUrl(u.platform, u.profile) || u.profile || '';
  const handle = handleOf(url);
  return {
    sheet: 'Blogerlar',
    row: {
      'Nomi (@handle)': handle ? `${u.name || ''} (@${handle})`.trim() : u.name || '',
      Platforma: u.platform || '',
      Soha: nicheLabel(u.niche, 'uz'),
      Shahar: regionLabel(u.region, 'uz'),
      Obunachilar: followersLabel(u.followers),
      Engagement: joinFilled(viewsFacts(u, 'uz').filter((f) => f.value).map((f) => `${f.label}: ${f.value}`)),
      Havola: url,
      'Ochiq aloqa': joinFilled([formatPhone(u.phone), telegram]),
      Manba: 'Telegram bot',
      Izoh: note
    }
  };
}

async function post(ctx, user) {
  const body = { key: await sheetsKey(ctx.env.BOT_TOKEN), ...sheetRow(user) };
  const res = await fetch(ctx.env.SHEETS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) console.warn('sheets: HTTP', res.status);
}

// Ro'yxatdan o'tish to'xtamasligi uchun xato faqat logga yoziladi.
// Cloudflare'da javobdan keyin fonda ishlaydi (waitUntil), testlarda esa oxirigacha kutiladi.
export function addToSheet(ctx, user) {
  if (!ctx.env.SHEETS_URL) return Promise.resolve();
  const task = post(ctx, user).catch((e) => console.warn('sheets failed:', e.message));
  if (ctx.exec?.waitUntil) {
    ctx.exec.waitUntil(task);
    return Promise.resolve();
  }
  return task;
}
