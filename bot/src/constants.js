// Miqyos: toifalar, platformalar va obunachilar oraliqlari.
// Saytdagi (assets/js/campaigns.js) ro'yxat faqat namuna e'lonlar uchun: bo'sh toifa chiplari chiqmasligi uchun
// u ataylab qisqa qoldirilgan. Bot va mini ilova shu fayldagi ro'yxatdan foydalanadi.

// Biznes sohalari: ikki bosqich. Avval katta soha (SECTORS), keyin uning ichidan aniq tur.
// Bazada (users.category, campaigns.category) faqat tur id'si saqlanadi. Eski id'lar (beauty, food, clothes, kids,
// tech, home, services) tur sifatida saqlab qolingan, shuning uchun eski biznes va e'lonlar buzilmaydi.
// Soha id'lari "g_" bilan boshlanadi: ular tur id'lari bilan aralashmaydi (filtrda ikkalasi ham ishlaydi).
export const SECTORS = [
  {
    id: 'g_food', uz: 'Oziq-ovqat va ichimliklar', ru: 'Еда и напитки',
    items: [
      { id: 'cafe', uz: 'Kafe va restoran', ru: 'Кафе и рестораны' },
      { id: 'fastfood', uz: 'Fast-fud', ru: 'Фастфуд' },
      { id: 'bakery', uz: 'Qandolat va nonvoyxona', ru: 'Кондитерская и пекарня' },
      { id: 'grocery', uz: 'Oziq-ovqat do‘koni', ru: 'Продуктовый магазин' },
      { id: 'drinks', uz: 'Ichimlik va suv', ru: 'Напитки и вода' },
      { id: 'food', uz: 'Boshqa (oziq-ovqat)', ru: 'Другое (еда)' }
    ]
  },
  {
    id: 'g_beauty', uz: 'Go‘zallik va parvarish', ru: 'Красота и уход',
    items: [
      { id: 'salon', uz: 'Salon va sartaroshxona', ru: 'Салон и барбершоп' },
      { id: 'nails', uz: 'Manikyur va qosh-kiprik', ru: 'Маникюр и брови-ресницы' },
      { id: 'cosmetics', uz: 'Kosmetika va parfyumeriya', ru: 'Косметика и парфюмерия' },
      { id: 'spa', uz: 'Spa va massaj', ru: 'Спа и массаж' },
      { id: 'beauty', uz: 'Boshqa (go‘zallik)', ru: 'Другое (красота)' }
    ]
  },
  {
    id: 'g_fashion', uz: 'Moda va kiyim', ru: 'Мода и одежда',
    items: [
      { id: 'clothes', uz: 'Kiyim', ru: 'Одежда' },
      { id: 'shoes', uz: 'Poyabzal', ru: 'Обувь' },
      { id: 'bags', uz: 'Sumka va aksessuarlar', ru: 'Сумки и аксессуары' },
      { id: 'jewelry', uz: 'Zargarlik va soatlar', ru: 'Украшения и часы' }
    ]
  },
  {
    id: 'g_kids', uz: 'Bolalar va oila', ru: 'Дети и семья',
    items: [
      { id: 'toys', uz: 'Bolalar kiyimi va o‘yinchoqlar', ru: 'Детская одежда и игрушки' },
      { id: 'baby', uz: 'Onalar va chaqaloqlar mahsulotlari', ru: 'Товары для мам и малышей' },
      { id: 'kidsclub', uz: 'Bog‘cha va rivojlantirish markazi', ru: 'Детский сад и развивающий центр' },
      { id: 'kids', uz: 'Boshqa (bolalar uchun)', ru: 'Другое (для детей)' }
    ]
  },
  {
    id: 'g_health', uz: 'Tibbiyot va salomatlik', ru: 'Медицина и здоровье',
    items: [
      { id: 'clinic', uz: 'Klinika va diagnostika', ru: 'Клиника и диагностика' },
      { id: 'dental', uz: 'Stomatologiya', ru: 'Стоматология' },
      { id: 'pharmacy', uz: 'Dorixona va vitaminlar', ru: 'Аптека и витамины' },
      { id: 'optics', uz: 'Optika', ru: 'Оптика' },
      { id: 'wellness', uz: 'Psixolog va sog‘lom turmush', ru: 'Психолог и здоровый образ жизни' },
      { id: 'health', uz: 'Boshqa (tibbiyot)', ru: 'Другое (медицина)' }
    ]
  },
  {
    id: 'g_sport', uz: 'Sport va fitnes', ru: 'Спорт и фитнес',
    items: [
      { id: 'gym', uz: 'Sport zal va fitnes', ru: 'Спортзал и фитнес' },
      { id: 'sportgoods', uz: 'Sport anjomlari', ru: 'Спорттовары' },
      { id: 'yoga', uz: 'Yoga, raqs va jang san‘ati', ru: 'Йога, танцы и единоборства' },
      { id: 'sport', uz: 'Boshqa (sport)', ru: 'Другое (спорт)' }
    ]
  },
  {
    id: 'g_education', uz: 'Ta‘lim', ru: 'Образование',
    items: [
      { id: 'courses', uz: 'O‘quv markazi va kurslar', ru: 'Учебный центр и курсы' },
      { id: 'languages', uz: 'Til markazi', ru: 'Языковой центр' },
      { id: 'online', uz: 'Onlayn kurs', ru: 'Онлайн-курс' },
      { id: 'tutor', uz: 'Repetitor va bolalar to‘garagi', ru: 'Репетитор и детский кружок' },
      { id: 'education', uz: 'Boshqa (ta‘lim)', ru: 'Другое (образование)' }
    ]
  },
  {
    id: 'g_home', uz: 'Uy, mebel va qurilish', ru: 'Дом, мебель и строительство',
    items: [
      { id: 'furniture', uz: 'Mebel', ru: 'Мебель' },
      { id: 'building', uz: 'Qurilish materiallari', ru: 'Стройматериалы' },
      { id: 'repair', uz: 'Ta‘mirlash va dizayn', ru: 'Ремонт и дизайн' },
      { id: 'cleaning', uz: 'Tozalash va kimyoviy tozalash', ru: 'Уборка и химчистка' },
      { id: 'home', uz: 'Uy-ro‘zg‘or buyumlari', ru: 'Товары для дома' }
    ]
  },
  {
    id: 'g_tech', uz: 'Texnika va IT', ru: 'Техника и IT',
    items: [
      { id: 'phones', uz: 'Telefon va gadjetlar', ru: 'Телефоны и гаджеты' },
      { id: 'computers', uz: 'Kompyuter va maishiy texnika', ru: 'Компьютеры и бытовая техника' },
      { id: 'it', uz: 'IT va dasturiy xizmatlar', ru: 'IT и программные услуги' },
      { id: 'tech', uz: 'Boshqa (texnika)', ru: 'Другое (техника)' }
    ]
  },
  {
    id: 'g_auto', uz: 'Avto va transport', ru: 'Авто и транспорт',
    items: [
      { id: 'carsale', uz: 'Avtosalon', ru: 'Автосалон' },
      { id: 'carparts', uz: 'Ehtiyot qismlar', ru: 'Автозапчасти' },
      { id: 'carservice', uz: 'Avtoservis va yuvish', ru: 'Автосервис и мойка' },
      { id: 'taxi', uz: 'Taksi', ru: 'Такси' },
      { id: 'logistics', uz: 'Yuk va logistika', ru: 'Грузоперевозки и логистика' },
      { id: 'carrental', uz: 'Avtomobil ijarasi', ru: 'Аренда авто' },
      { id: 'auto', uz: 'Boshqa (avto)', ru: 'Другое (авто)' }
    ]
  },
  {
    id: 'g_travel', uz: 'Sayohat va dam olish', ru: 'Путешествия и отдых',
    items: [
      { id: 'tour', uz: 'Turfirma', ru: 'Турфирма' },
      { id: 'hotel', uz: 'Mehmonxona va hostel', ru: 'Отель и хостел' },
      { id: 'resort', uz: 'Dam olish maskani', ru: 'Зона отдыха' },
      { id: 'visa', uz: 'Aviachipta va viza', ru: 'Авиабилеты и визы' },
      { id: 'travel', uz: 'Boshqa (sayohat)', ru: 'Другое (путешествия)' }
    ]
  },
  {
    id: 'g_events', uz: 'Tadbirlar va ko‘ngilochar', ru: 'Мероприятия и развлечения',
    items: [
      { id: 'wedding', uz: 'To‘yxona va tadbir tashkilotchisi', ru: 'Банкетный зал и организатор мероприятий' },
      { id: 'photo', uz: 'Foto va video xizmati', ru: 'Фото и видео' },
      { id: 'gifts', uz: 'Sovg‘a va gullar', ru: 'Подарки и цветы' },
      { id: 'gamecenter', uz: 'O‘yin markazi', ru: 'Игровой центр' },
      { id: 'culture', uz: 'Kino, teatr va konsert', ru: 'Кино, театр и концерты' },
      { id: 'fun', uz: 'Boshqa (ko‘ngilochar)', ru: 'Другое (развлечения)' }
    ]
  },
  {
    id: 'g_realty', uz: 'Ko‘chmas mulk', ru: 'Недвижимость',
    items: [
      { id: 'agency', uz: 'Agentlik', ru: 'Агентство' },
      { id: 'developer', uz: 'Quruvchi kompaniya', ru: 'Застройщик' },
      { id: 'realrent', uz: 'Ijara', ru: 'Аренда' },
      { id: 'realty', uz: 'Boshqa (ko‘chmas mulk)', ru: 'Другое (недвижимость)' }
    ]
  },
  {
    id: 'g_business', uz: 'Biznes va moliya', ru: 'Бизнес и финансы',
    items: [
      { id: 'bank', uz: 'Bank va mikromoliya', ru: 'Банк и микрофинанс' },
      { id: 'insurance', uz: 'Sug‘urta', ru: 'Страхование' },
      { id: 'legal', uz: 'Yuridik va buxgalteriya', ru: 'Юридические и бухгалтерские услуги' },
      { id: 'marketing', uz: 'Reklama va marketing', ru: 'Реклама и маркетинг' },
      { id: 'business', uz: 'Boshqa (biznes xizmatlari)', ru: 'Другое (бизнес-услуги)' }
    ]
  },
  {
    id: 'g_agro', uz: 'Qishloq xo‘jaligi va ishlab chiqarish', ru: 'Сельское хозяйство и производство',
    items: [
      { id: 'farming', uz: 'Dehqonchilik va bog‘dorchilik', ru: 'Земледелие и садоводство' },
      { id: 'livestock', uz: 'Chorvachilik', ru: 'Животноводство' },
      { id: 'crafts', uz: 'Hunarmandchilik', ru: 'Ремесло' },
      { id: 'factory', uz: 'Fabrika va ishlab chiqarish', ru: 'Фабрика и производство' },
      { id: 'wholesale', uz: 'Ulgurji savdo', ru: 'Оптовая торговля' },
      { id: 'agro', uz: 'Boshqa (qishloq xo‘jaligi)', ru: 'Другое (сельское хозяйство)' }
    ]
  },
  {
    id: 'g_pets', uz: 'Uy hayvonlari', ru: 'Домашние животные',
    items: [
      { id: 'petshop', uz: 'Hayvon mahsulotlari', ru: 'Зоотовары' },
      { id: 'vet', uz: 'Veterinariya', ru: 'Ветеринария' },
      { id: 'pets', uz: 'Boshqa (uy hayvonlari)', ru: 'Другое (животные)' }
    ]
  },
  {
    id: 'g_other', uz: 'Boshqa', ru: 'Другое',
    items: [
      { id: 'services', uz: 'Boshqa xizmatlar', ru: 'Другие услуги' },
      { id: 'other', uz: 'Boshqa', ru: 'Другое' }
    ]
  }
];

// Hamma turlar bitta tekis ro'yxatda: tekshirish, nom topish va mini ilova uchun
export const CATEGORIES = SECTORS.flatMap((s) => s.items);

export const findSector = (id) => SECTORS.find((s) => s.id === id) || null;
export const sectorOfCategory = (id) => SECTORS.find((s) => s.items.some((c) => c.id === id)) || null;
export const isSector = (id) => SECTORS.some((s) => s.id === id);

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

// O'zbekiston hududlari: bloger qayerda yashaydi va reklama e'loni qaysi hudud uchun.
export const REGIONS = [
  { id: 'tashkent_city', uz: 'Toshkent shahri', ru: 'г. Ташкент' },
  { id: 'tashkent', uz: 'Toshkent viloyati', ru: 'Ташкентская обл.' },
  { id: 'andijan', uz: 'Andijon', ru: 'Андижан' },
  { id: 'bukhara', uz: 'Buxoro', ru: 'Бухара' },
  { id: 'fergana', uz: 'Farg‘ona', ru: 'Фергана' },
  { id: 'jizzakh', uz: 'Jizzax', ru: 'Джизак' },
  { id: 'namangan', uz: 'Namangan', ru: 'Наманган' },
  { id: 'navoi', uz: 'Navoiy', ru: 'Навои' },
  { id: 'kashkadarya', uz: 'Qashqadaryo', ru: 'Кашкадарья' },
  { id: 'karakalpakstan', uz: 'Qoraqalpog‘iston', ru: 'Каракалпакстан' },
  { id: 'samarkand', uz: 'Samarqand', ru: 'Самарканд' },
  { id: 'syrdarya', uz: 'Sirdaryo', ru: 'Сырдарья' },
  { id: 'surkhandarya', uz: 'Surxondaryo', ru: 'Сурхандарья' },
  { id: 'khorezm', uz: 'Xorazm', ru: 'Хорезм' }
];

// E'lon butun O'zbekiston uchun (mahsulot yetkazib beriladi yoki onlayn xizmat)
export const ALL_REGIONS = 'all';

// Ro'yxatdan o'tishda va e'lonlarda tanlanadigan platformalar.
// TikTok O'zbekistonda 2021-yildan bloklangan, shuning uchun 2026-11 da ro'yxatdan olindi.
// Blokdan chiqarilsa, uni shu ro'yxatga qaytaring: qolgan kod (havolalar, ko'rishlar, matnlar) TikTok'ni biladi.
export const PLATFORMS = ['Instagram', 'Telegram', 'YouTube'];

// Blogerning o'rtacha ko'rishlari: Telegram — post, TikTok/YouTube — video.
// Instagramda shu oraliqlar istoriya (users.reach) va postlar (users.posts_views) uchun.
export const REACH = [
  { id: '0-500', min: 0, max: 500 },
  { id: '500-1000', min: 500, max: 1000 },
  { id: '1000-3000', min: 1000, max: 3000 },
  { id: '3000-10000', min: 3000, max: 10000 },
  { id: '10000-50000', min: 10000, max: 50000 },
  { id: '50000+', min: 50000, max: null }
];

// Instagram: reels o'rtacha ko'rishlari (odatda istoriyadan ko'p), users.reels_views.
// Eski users.reels_reach ("Reels va postlar") ham shu oraliqlarda saqlangan.
export const REELS_REACH = [
  { id: '0-1000', min: 0, max: 1000 },
  { id: '1000-5000', min: 1000, max: 5000 },
  { id: '5000-20000', min: 5000, max: 20000 },
  { id: '20000-100000', min: 20000, max: 100000 },
  { id: '100000-500000', min: 100000, max: 500000 },
  { id: '500000+', min: 500000, max: null }
];

// Instagram qamrovi: oxirgi 30 kunda qamrab olingan akkauntlar ("Accounts reached"), users.accounts_reached
export const ACCOUNTS_REACHED = [
  { id: '0-5000', min: 0, max: 5000 },
  { id: '5000-20000', min: 5000, max: 20000 },
  { id: '20000-100000', min: 20000, max: 100000 },
  { id: '100000-500000', min: 100000, max: 500000 },
  { id: '500000-1000000', min: 500000, max: 1000000 },
  { id: '1000000+', min: 1000000, max: null }
];

// Profil havolasi qaysi saytda bo'lishi kerak
export const PLATFORM_HOSTS = {
  Instagram: ['instagram.com', 'instagr.am'],
  TikTok: ['tiktok.com'],
  YouTube: ['youtube.com', 'youtu.be'],
  Telegram: ['t.me', 'telegram.me']
};

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
  imageMaxBytes: 5 * 1024 * 1024, // yuklanadigan rasm hajmi (mini ilova uni oldindan kichraytiradi)
  // Yangi e'lon haqida bitta cron ishga tushishida nechta blogerga xabar yuboriladi (har daqiqada).
  // Cloudflare bepul tarifida bitta ishga tushishda 50 ta tashqi so'rov (Telegram + D1) mumkin:
  // rasmli xabar ikki urinish olishi mumkin, shuning uchun 15 ta. Pullik tarifda wrangler.toml dagi AD_NOTIFY_BATCH bilan oshiring.
  adNotifyBatch: 15
};

export const LANGS = ['uz', 'ru'];

// Platforma nomi: botning Telegram'dagi ismi va menyu tugmasi (/setup sozlaydi)
export const BRAND = 'Miqyos';

// Maxfiylik siyosati (saytda). wrangler.toml dagi PRIVACY_URL bilan almashtirish mumkin.
export const DEFAULT_PRIVACY_URL = 'https://miqyos.uz/privacy.html';

export const isCategory = (id) => CATEGORIES.some((c) => c.id === id);
export const isNiche = (id) => NICHES.some((n) => n.id === id);
export const isRegion = (id) => REGIONS.some((r) => r.id === id);
export const isCampaignRegion = (id) => id === ALL_REGIONS || isRegion(id);
export const isPlatform = (p) => PLATFORMS.includes(p);
export const findFollowers = (id) => FOLLOWERS.find((f) => f.id === id) || null;
export const findReach = (id) => REACH.find((r) => r.id === id) || null;
export const findReelsReach = (id) => REELS_REACH.find((r) => r.id === id) || null;
export const findAccountsReached = (id) => ACCOUNTS_REACHED.find((r) => r.id === id) || null;
