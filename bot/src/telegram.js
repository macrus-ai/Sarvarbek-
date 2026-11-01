// Telegram Bot API bilan ishlash va mini ilova ma'lumotlarini tekshirish

const enc = new TextEncoder();
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

async function hmacSha256(keyBytes, data) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, typeof data === 'string' ? enc.encode(data) : data));
}

export async function sha256Hex(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

// Webhook va /setup uchun maxfiy kalit. Bot tokenidan hosil qilinadi,
// shuning uchun alohida sozlama kerak emas (deploy workflow ham xuddi shunday hisoblaydi).
export async function webhookSecret(botToken) {
  return (await sha256Hex(`ovoza-webhook:${botToken}`)).slice(0, 48);
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Telegram.WebApp.initData ni tekshiradi (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
// To'g'ri bo'lsa { user, authDate } qaytaradi, aks holda null.
export async function validateInitData(initData, botToken, { maxAge = 86400, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  const fields = [];
  for (const [key, value] of params) if (key !== 'hash') fields.push([key, value]);
  fields.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const secret = await hmacSha256(enc.encode('WebAppData'), botToken);
  const sign = async (list) => hex(await hmacSha256(secret, list.map(([k, v]) => `${k}=${v}`).join('\n')));

  let valid = safeEqual(await sign(fields), hash);
  // Ba'zi mijozlar "signature" maydonini ham yuboradi; u hash hisobiga kirmasligi mumkin
  if (!valid && params.has('signature')) valid = safeEqual(await sign(fields.filter(([k]) => k !== 'signature')), hash);
  if (!valid) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || nowSec - authDate > maxAge) return null;

  let user;
  try {
    user = JSON.parse(params.get('user') || 'null');
  } catch {
    return null;
  }
  if (!user || !Number.isSafeInteger(user.id)) return null;
  return { user, authDate };
}

export class TelegramError extends Error {
  constructor(method, description, code) {
    super(`${method}: ${description}`);
    this.code = code;
    this.description = description;
  }
}

export function createTelegram(token) {
  async function request(method, body, headers = {}) {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers, body });
    let data;
    try {
      data = await res.json();
    } catch {
      data = { ok: false, description: `HTTP ${res.status}` };
    }
    if (!data.ok) throw new TelegramError(method, data.description || 'error', data.error_code);
    return data.result;
  }

  const call = (method, params = {}) => request(method, JSON.stringify(params), { 'content-type': 'application/json' });

  // Faylni (rasmni) multipart/form-data bilan yuklaydi
  function upload(method, field, file, params = {}) {
    const form = new FormData();
    for (const [key, value] of Object.entries(params)) {
      if (value != null) form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    form.append(field, new Blob([file.bytes], { type: file.type }), file.name);
    return request(method, form);
  }

  const html = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } };

  return {
    call,
    send: (chatId, text, extra = {}) => call('sendMessage', { chat_id: chatId, text, ...html, ...extra }),
    edit: (chatId, messageId, text, extra = {}) =>
      call('editMessageText', { chat_id: chatId, message_id: messageId, text, ...html, ...extra }),
    // photo — Telegramdagi file_id
    photo: (chatId, photo, caption, extra = {}) =>
      call('sendPhoto', { chat_id: chatId, photo, caption, parse_mode: 'HTML', ...extra }),
    // Yangi rasmni yuklaydi; javobdagi message.photo da file_id'lar bo'ladi
    uploadPhoto: (chatId, file, caption, extra = {}) =>
      upload('sendPhoto', 'photo', file, { chat_id: chatId, caption, parse_mode: 'HTML', ...extra }),
    editCaption: (chatId, messageId, caption, extra = {}) =>
      call('editMessageCaption', { chat_id: chatId, message_id: messageId, caption, parse_mode: 'HTML', ...extra }),
    answer: (callbackId, text, showAlert = false) =>
      call('answerCallbackQuery', { callback_query_id: callbackId, ...(text ? { text, show_alert: showAlert } : {}) }),
    // Faylni yuklab olish manzili. Unda token bor: faqat serverda ishlatiladi, tashqariga berilmaydi.
    fileUrl: (filePath) => `https://api.telegram.org/file/bot${token}/${filePath}`
  };
}
