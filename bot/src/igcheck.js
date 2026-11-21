// Instagram akkaunt mavjudligini Meta Graph API (Business Discovery) orqali tekshirish.
// Kerak: env.META_IG_USER_ID (bizning Instagram Business akkauntimiz ID'si) va env.META_ACCESS_TOKEN.
// Ular yo'q bo'lsa yoki Meta javob bermasa, tekshiruv o'tkazib yuboriladi: blogerni to'xtatmaymiz,
// profilni moderator ko'rib tasdiqlaydi.
//
// Natija: 'exists' — akkaunt topildi, 'missing' — topilmadi (yoki Professional emas), 'unknown' — aniqlab bo'lmadi.

const GRAPH = 'https://graph.facebook.com/v21.0';
// Meta: "Invalid user id" — Business Discovery shu akkauntni topa olmadi
const NOT_FOUND_CODE = 110;

// "https://instagram.com/madina" -> "madina"; post/reel/story havolalari va g'alati yo'llar -> null
export function instagramUsername(url) {
  let path;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  const parts = path.split('/').filter(Boolean);
  if (parts.length !== 1) return null;
  const name = parts[0].replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(name) ? name : null;
}

export async function checkInstagram(env, url) {
  if (!env.META_IG_USER_ID || !env.META_ACCESS_TOKEN) return 'unknown';
  const username = instagramUsername(url);
  if (!username) return 'unknown';

  const query = new URLSearchParams({
    fields: `business_discovery.username(${username}){username}`,
    access_token: env.META_ACCESS_TOKEN
  });
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(env.META_IG_USER_ID)}?${query}`, {
      signal: AbortSignal.timeout(4000)
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.business_discovery?.username) return 'exists';
    if (data?.error?.code === NOT_FOUND_CODE) return 'missing';
    // Token muddati o'tgan, limit tugagan, Meta ishlamayapti va hokazo
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
