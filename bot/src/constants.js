// Ovoza: toifalar, platformalar va obunachilar oraliqlari.
// Saytdagi (assets/js/campaigns.js) ro'yxatlar bilan bir xil saqlang.

export const CATEGORIES = [
  { id: 'beauty', uz: 'Go‘zallik', ru: 'Красота' },
  { id: 'food', uz: 'Oziq-ovqat va kafe', ru: 'Еда и кафе' },
  { id: 'clothes', uz: 'Kiyim', ru: 'Одежда' },
  { id: 'kids', uz: 'Bolalar uchun', ru: 'Детям' },
  { id: 'tech', uz: 'Texnika', ru: 'Техника' },
  { id: 'home', uz: 'Uy-ro‘zg‘or', ru: 'Для дома' },
  { id: 'services', uz: 'Xizmatlar', ru: 'Услуги' }
];

export const PLATFORMS = ['Instagram', 'Telegram', 'TikTok', 'YouTube'];

// max: null — yuqori chegara yo'q
export const FOLLOWERS = [
  { id: '1000-5000', min: 1000, max: 5000 },
  { id: '5000-10000', min: 5000, max: 10000 },
  { id: '10000-50000', min: 10000, max: 50000 },
  { id: '50000-100000', min: 50000, max: 100000 },
  { id: '100000+', min: 100000, max: null }
];

export const LIMITS = {
  activeCampaigns: 20, // bitta biznesning bir vaqtdagi faol reklama e'lonlari
  titleMin: 3,
  titleMax: 80,
  formatMax: 80,
  cityMax: 40,
  descriptionMax: 600,
  messageMax: 300,
  valueMin: 1000,
  valueMax: 1000000000,
  followersMax: 10000000,
  daysMax: 90,
  slotsMax: 100,
  imageMaxBytes: 5 * 1024 * 1024 // yuklanadigan rasm hajmi (mini ilova uni oldindan kichraytiradi)
};

export const LANGS = ['uz', 'ru'];

// Maxfiylik siyosati (saytda). wrangler.toml dagi PRIVACY_URL bilan almashtirish mumkin.
export const DEFAULT_PRIVACY_URL = 'https://macrus-ai.github.io/Sarvarbek-/privacy.html';

export const isCategory = (id) => CATEGORIES.some((c) => c.id === id);
export const isPlatform = (p) => PLATFORMS.includes(p);
export const findFollowers = (id) => FOLLOWERS.find((f) => f.id === id) || null;
