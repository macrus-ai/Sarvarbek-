// Reklama e'lonlarining rasmlari.
//
// Rasm Telegramga yuklanadi (biznesning bot bilan chatiga, tasdiq sifatida) va Telegram serverida
// saqlanadi. Bazada faqat file_id turadi. Mini ilova rasmni /img/c/... manzilidan oladi:
// worker uni Telegramdan olib beradi, bot tokeni brauzerga chiqmaydi.

import { json } from './util.js';

// /img/c/12-<kalit>.jpg — katta rasm, /img/c/12-<kalit>-s.jpg — kartalar uchun kichigi
export const IMAGE_PATH = /^\/img\/c\/(\d+)-([0-9a-f]{16})(-s)?\.jpg$/;

// Fayl boshidagi baytlar bo'yicha turini aniqlaydi (Content-Type ga ishonilmaydi)
export function sniffImage(bytes) {
  const b = bytes;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return { type: 'image/png', ext: 'png' };
  }
  const ascii = (from, to) => String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { type: 'image/webp', ext: 'webp' };
  return null;
}

export function newImageKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');
}

// Telegram bir rasmning bir nechta o'lchamini qaytaradi. Kattasi e'lon sahifasiga,
// eni 480px dan kichik bo'lmagan eng kichigi kartalarga.
export function pickSizes(photo) {
  const sizes = [...(Array.isArray(photo) ? photo : [])].sort((a, b) => a.width * a.height - b.width * b.height);
  const large = sizes[sizes.length - 1];
  if (!large) return null;
  const thumb = sizes.find((s) => Math.max(s.width, s.height) >= 480) || large;
  return { fileId: large.file_id, thumbId: thumb.file_id };
}

// API javobidagi rasm manzillari (mini ilova bilan bir domenda)
export function imageOut(campaignId, row) {
  if (!row.image_file_id || !row.image_key) return null;
  const base = `/img/c/${campaignId}-${row.image_key}`;
  return { url: `${base}.jpg`, thumb: `${base}-s.jpg` };
}

export const imageUrlsOf = (origin, campaignId, key) => {
  const base = `${origin}/img/c/${campaignId}-${key}`;
  return [`${base}.jpg`, `${base}-s.jpg`];
};

// file_id → file_path. Telegram yuklab olish havolasi kamida bir soat amal qiladi.
const filePaths = new Map();
const FILE_PATH_TTL = 50 * 60 * 1000;

async function filePathOf(tg, fileId) {
  const hit = filePaths.get(fileId);
  if (hit && hit.until > Date.now()) return hit.path;
  const file = await tg.call('getFile', { file_id: fileId });
  if (!file?.file_path) throw new Error('getFile: file_path yo‘q');
  if (filePaths.size > 500) filePaths.clear();
  filePaths.set(fileId, { path: file.file_path, until: Date.now() + FILE_PATH_TTL });
  return file.file_path;
}

const notFound = () => new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });

// GET /img/c/:id-:kalit(-s).jpg
export async function serveImage(request, ctx, match, exec) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const [, id, key, small] = match;

  // Cloudflare keshi: bir xil rasm har safar Telegramdan olinmasin
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });
  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => null);
    if (hit) return hit;
  }

  const row = await ctx.db
    .prepare('SELECT image_file_id, image_thumb_id, image_key FROM campaigns WHERE id = ?1')
    .bind(Number(id))
    .first();
  if (!row || !row.image_file_id || row.image_key !== key) return notFound();

  const fileId = small ? row.image_thumb_id || row.image_file_id : row.image_file_id;
  let upstream;
  try {
    upstream = await fetch(ctx.tg.fileUrl(await filePathOf(ctx.tg, fileId)));
  } catch (e) {
    console.warn('image fetch failed:', e.message);
    return json({ error: 'image_unavailable' }, 502);
  }
  if (!upstream.ok) {
    filePaths.delete(fileId);
    return json({ error: 'image_unavailable' }, 502);
  }

  const response = new Response(upstream.body, {
    headers: {
      'content-type': 'image/jpeg',
      // Kalit har yangi rasmda o'zgaradi, shuning uchun manzil bo'yicha uzoq saqlash xavfsiz
      'cache-control': 'public, max-age=604800, immutable',
      'x-content-type-options': 'nosniff'
    }
  });
  if (cache) {
    const put = cache.put(cacheKey, response.clone()).catch(() => {});
    if (exec?.waitUntil) exec.waitUntil(put);
  }
  return response;
}

// Rasm o'chirilganda yoki almashtirilganda eski manzillarni keshdan olib tashlaydi (imkon qadar)
export async function forgetImage(origin, campaignId, key) {
  const cache = globalThis.caches?.default;
  if (!cache || !key) return;
  await Promise.all(imageUrlsOf(origin, campaignId, key).map((u) => cache.delete(u).catch(() => false)));
}
