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

// Blogerlar yo'nalishi (bloger ro'yxatdan o'tishda bittasini tanlaydi). "other" doim oxirida turadi.
// Eski profillarda biznes toifasi id'lari (beauty, food, ...) saqlangan: ular shu ro'yxatda ham bor.
export const NICHES = [
  { id: 'beauty', uz: 'Go‘zallik va kosmetika', ru: 'Красота и косметика' },
  { id: 'clothes', uz: 'Moda va kiyim', ru: 'Мода и одежда' },
  { id: 'lifestyle', uz: 'Lifestyle', ru: 'Лайфстайл' },
  { id: 'food', uz: 'Ovqat va kafelar', ru: 'Еда и кафе' },
  { id: 'travel', uz: 'Sayohat', ru: 'Путешествия' },
  { id: 'sport', uz: 'Sport va fitnes', ru: 'Спорт и фитнес' },
  { id: 'health', uz: 'Sog‘liq', ru: 'Здоровье' },
  { id: 'kids', uz: 'Onalik va bolalar', ru: 'Мамы и дети' },
  { id: 'home', uz: 'Uy va interyer', ru: 'Дом и интерьер' },
  { id: 'tech', uz: 'Texnika va gadjetlar', ru: 'Техника и гаджеты' },
  { id: 'auto', uz: 'Avtomobillar', ru: 'Авто' },
  { id: 'education', uz: 'Ta’lim', ru: 'Образование' },
  { id: 'business', uz: 'Biznes va moliya', ru: 'Бизнес и финансы' },
  { id: 'humor', uz: 'Hazil va ko‘ngilochar', ru: 'Юмор и развлечения' },
  { id: 'games', uz: 'O‘yinlar', ru: 'Игры' },
  { id: 'music', uz: 'Musiqa', ru: 'Музыка' },
  { id: 'cinema', uz: 'Kino va seriallar', ru: 'Кино и сериалы' },
  { id: 'art', uz: 'Ijod va qo‘l mehnati', ru: 'Творчество и хендмейд' },
  { id: 'pets', uz: 'Uy hayvonlari', ru: 'Животные' },
  { id: 'news', uz: 'Yangiliklar', ru: 'Новости' },
  { id: 'other', uz: 'Boshqa', ru: 'Другое' }
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
export const isNiche = (id) => NICHES.some((n) => n.id === id);
export const isPlatform = (p) => PLATFORMS.includes(p);
export const findFollowers = (id) => FOLLOWERS.find((f) => f.id === id) || null;
