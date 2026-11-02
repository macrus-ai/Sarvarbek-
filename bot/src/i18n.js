// Bot matnlari (o'zbekcha va ruscha)

import { ALL_REGIONS, CATEGORIES, NICHES, REGIONS, findFollowers, findReach } from './constants.js';
import { esc, fmtNum, formatPhone, profileDisplay, profileUrl } from './util.js';

export const catLabel = (id, lang) => CATEGORIES.find((c) => c.id === id)?.[lang === 'ru' ? 'ru' : 'uz'] ?? id ?? '';
// Bloger yo'nalishi. Eski profillarda biznes toifasi (masalan, "services") bo'lishi mumkin.
export const nicheLabel = (id, lang) =>
  NICHES.find((n) => n.id === id)?.[lang === 'ru' ? 'ru' : 'uz'] ?? catLabel(id, lang);

// Hudud nomi. 'all' — butun O'zbekiston (faqat e'lonlarda)
export function regionLabel(id, lang) {
  const key = lang === 'ru' ? 'ru' : 'uz';
  if (id === ALL_REGIONS) return key === 'ru' ? 'Весь Узбекистан' : 'Butun O‘zbekiston';
  return REGIONS.find((r) => r.id === id)?.[key] ?? '';
}

// Hudud ma'lum bo'lsa "📍 Samarqand" qatori, aks holda bo'sh
const regionLine = (id, lang) => (regionLabel(id, lang) ? `📍 ${esc(regionLabel(id, lang))}` : '');

// Blogerning auditoriyasi joylashgan hudud: "📍 Auditoriya: Samarqand"
const audienceLine = (id, lang) =>
  regionLabel(id, lang) ? `📍 ${lang === 'ru' ? 'Аудитория' : 'Auditoriya'}: ${esc(regionLabel(id, lang))}` : '';

export function followersLabel(id) {
  const f = findFollowers(id);
  if (!f) return id ?? '';
  return f.max ? `${fmtNum(f.min)} – ${fmtNum(f.max)}` : `${fmtNum(f.min)}+`;
}

// O'rtacha ko'rishlar: "500 – 1 000", "500 gacha", "50 000+"
export function reachLabel(id, lang) {
  const r = findReach(id);
  if (!r) return '';
  if (!r.min) return lang === 'ru' ? `до ${fmtNum(r.max)}` : `${fmtNum(r.max)} gacha`;
  return r.max ? `${fmtNum(r.min)} – ${fmtNum(r.max)}` : `${fmtNum(r.min)}+`;
}

// Ko'rishlar nimaniki: Instagram — storis, Telegram — post, TikTok va YouTube — video
const reachWhat = (platform, lang) =>
  ({ Instagram: lang === 'ru' ? 'сторис' : 'storis', Telegram: lang === 'ru' ? 'пост' : 'post' })[platform] ||
  (lang === 'ru' ? 'видео' : 'video');

const reachLine = (u, lang) =>
  u.reach ? `👁 ${lang === 'ru' ? 'Просмотры' : 'Ko‘rishlar'} (${reachWhat(u.platform, lang)}): ${reachLabel(u.reach, lang)}` : '';

const PLATFORM_ICON = { Instagram: '📸', TikTok: '🎵', YouTube: '▶️', Telegram: '✈️' };

// "📸 Instagram: instagram.com/user" — havolani bosib profilni ochish mumkin
const profileLine = (platform, profile) => {
  const url = profileUrl(platform, profile);
  const shown = url ? `<a href="${esc(url)}">${esc(profileDisplay(url))}</a>` : esc(profile);
  return `${PLATFORM_ICON[platform] || '🔗'} ${esc(platform)}: ${shown}`;
};

// Xabardagi foydalanuvchi nomi: Telegramdagi profiliga havola bilan
const mention = (id, name) => `<a href="tg://user?id=${Number(id)}">${esc(name)}</a>`;
const at = (username) => (username ? ` (@${esc(username)})` : '');

const EXAMPLE = {
  Instagram: 'https://instagram.com/username',
  TikTok: 'https://www.tiktok.com/@username',
  YouTube: 'https://youtube.com/@kanal',
  Telegram: 'https://t.me/kanal'
};

// Moderatsiya kartasidagi profil qatorlari (guruhda ko'rinadi)
function profileLines(u, lang) {
  const ru = lang === 'ru';
  const person = `👤 ${mention(u.tg_id, u.name || u.first_name || '')}${at(u.username)}`;
  const phone = `📞 ${esc(formatPhone(u.phone))}`;
  const language = `🌐 ${u.lang === 'ru' ? 'Русский' : 'O‘zbekcha'}`;
  if (u.role === 'business') {
    return [`🏪 <b>${esc(u.company)}</b> · ${esc(catLabel(u.category, lang))}`, person, phone, language];
  }
  const stats = u.stats_file_id
    ? (ru ? '📊 Скриншот статистики — на фото' : '📊 Statistika skrinshoti — rasmda')
    : (ru ? '📊 Скриншот статистики не отправлен' : '📊 Statistika skrinshoti yuborilmagan');
  return [
    person,
    phone,
    profileLine(u.platform, u.profile),
    `👥 ${followersLabel(u.followers)} ${ru ? 'подписчиков' : 'obunachi'}`,
    reachLine(u, lang),
    `🏷 ${esc(nicheLabel(u.niche, lang))}`,
    audienceLine(u.region, lang),
    stats,
    language
  ].filter(Boolean);
}

const uz = {
  chooseLang: '🇺🇿 Tilni tanlang\n🇷🇺 Выберите язык',
  welcome: (url) =>
    `<b>Ovoza</b> platformasiga xush kelibsiz!\n\nBu yerda bizneslar mahsulot yoki xizmat evaziga blogerlar bilan barter hamkorlik qiladi.\n\nDavom etib, <a href="${esc(url)}">maxfiylik siyosati</a>ga rozilik bildirasiz.\n\nSiz kimsiz?`,
  roleBusiness: '🏪 Biznes egasiman',
  roleBlogger: '📸 Blogerman',
  welcomeAs: (role, url) =>
    `<b>Ovoza</b> platformasiga xush kelibsiz! ${role === 'business' ? 'Biznes' : 'Bloger'} sifatida ro‘yxatdan o‘tamiz, bir nechta savolga javob bering.\n\nDavom etib, <a href="${esc(url)}">maxfiylik siyosati</a>ga rozilik bildirasiz.`,
  askName: 'Ismingizni yozing:',
  askCompany: 'Do‘kon yoki kompaniyangiz nomini yozing:',
  askCategory: 'Mahsulot yoki xizmatingiz qaysi toifaga kiradi?',
  askPlatform: 'Asosiy ijtimoiy tarmog‘ingizni tanlang:',
  askProfile: (platform) =>
    `${PLATFORM_ICON[platform] || '🔗'} ${esc(platform)} ${platform === 'Instagram' || platform === 'TikTok' ? 'profilingiz' : 'kanalingiz'} havolasini yuboring.\n\nMasalan: ${EXAMPLE[platform] || 'https://…'}`,
  askReach: (platform) =>
    `👁 ${{ Instagram: 'Storislaringiz', Telegram: 'Postlaringiz' }[platform] || 'Videolaringiz'} o‘rtacha nechta ko‘rish to‘playdi?`,
  askStats: (platform) =>
    [
      '📊 Statistika skrinshotini rasm qilib yuboring.',
      '',
      {
        Instagram: 'Instagram: Professional panel → Statistika → Auditoriya (shaharlar, yosh, jins).',
        TikTok: 'TikTok: Analitika → Obunachilar (shaharlar, yosh, jins).',
        YouTube: 'YouTube Studio → Analitika → Auditoriya.',
        Telegram: 'Telegram: kanal → Statistika (obunachilar va ko‘rishlar).'
      }[platform] || '',
      '',
      'Bizneslar shu rasm orqali auditoriyangizni ko‘radi.'
    ].join('\n'),
  statsSkip: 'O‘tkazib yuborish',
  errStats: 'Iltimos, skrinshotni rasm (foto) sifatida yuboring yoki “O‘tkazib yuborish” tugmasini bosing.',
  askFollowers: 'Obunachilaringiz soni qancha?',
  askNiche: 'Blogingiz yo‘nalishini tanlang:',
  askRegion:
    '📍 Auditoriyangiz (obunachilaringizning asosiy qismi) qaysi hududda?\n\nBizneslar o‘z hududidagi auditoriyaga reklama qiladi. Masalan, Samarqanddagi kafe Samarqand auditoriyasiga ega blogerni qidiradi.',
  askPhone:
    'Oxirgi qadam: telefon raqamingizni yuboring. Pastdagi tugmani bosing 👇\n\nRaqamingiz faqat so‘rov qabul qilinganda ikkinchi tomonga ko‘rsatiladi.',
  phoneButton: '📱 Raqamni yuborish',
  phoneSaved: '✓ Raqam saqlandi.',
  errName: 'Ism 2–60 belgidan iborat bo‘lsin. Qaytadan yozing:',
  errCompany: 'Nom 2–80 belgidan iborat bo‘lsin. Qaytadan yozing:',
  errProfile: (platform) =>
    `Bu ${esc(platform)} havolasiga o‘xshamaydi. Havolani yoki @username ni yuboring.\n\nMasalan: ${EXAMPLE[platform] || 'https://…'}`,
  errPhone: 'Raqamni pastdagi tugma orqali yuboring yoki +998 90 123 45 67 ko‘rinishida yozing.',
  errContactNotOwn: 'Iltimos, o‘zingizning raqamingizni yuboring.',
  useButtons: 'Iltimos, yuqoridagi tugmalardan birini tanlang.',
  staleButton: 'Bu tugma eskirgan.',
  doneBusiness: (summary) =>
    `✅ <b>Ro‘yxatdan o‘tdingiz!</b>\n\n${summary}\n\nEndi ilovada reklama e’loni joylang. Blogerlar uni ko‘rib, so‘rov yuboradi, so‘rovlar shu botga keladi.`,
  doneBlogger: (summary) =>
    `✅ <b>Ro‘yxatdan o‘tdingiz!</b>\n\n${summary}\n\nIlovada reklama e’lonlarini ko‘ring va yoqqaniga so‘rov yuboring. Javoblar shu botga keladi.`,
  donePending: (summary) =>
    `✅ <b>Ro‘yxatdan o‘tdingiz!</b>\n\n${summary}\n\n⏳ <b>Profilingiz moderatsiyada.</b> Jamoamiz uni tez orada ko‘rib chiqadi va natijani shu yerga yozadi.`,
  pendingHome: '⏳ Profilingiz moderatsiyada. Tasdiqlangach shu yerga xabar keladi.',
  approvedBusiness:
    '🎉 <b>Profilingiz tasdiqlandi!</b>\n\nEndi ilovada reklama e’loni joylang. Blogerlar uni ko‘rib, so‘rov yuboradi, so‘rovlar shu botga keladi.',
  approvedBlogger:
    '🎉 <b>Profilingiz tasdiqlandi!</b>\n\nIlovada reklama e’lonlarini ko‘ring va yoqqaniga so‘rov yuboring. Javoblar shu botga keladi.',
  rejectedNotice:
    'Afsuski, profilingiz tasdiqlanmadi.\n\nMa’lumotlaringizni tekshirib (masalan, profil havolasi to‘g‘ri va ochiq ekanini), qayta yuborishingiz mumkin.',
  resubmit: '🔄 Qayta yuborish',
  editProfile: '✏️ Ma’lumotlarni o‘zgartirish',
  openApp: '🚀 Ilovani ochish',
  updateProfile: '✏️ Ma’lumotlarni yangilash',
  home: (name) => `Assalomu alaykum, ${esc(name)}! Reklama e’lonlari va so‘rovlar ilovada.`,
  help:
    '<b>Ovoza</b> — bizneslar va blogerlar uchun barter platformasi.\n\n/start — ro‘yxatdan o‘tish yoki bosh menyu\n/app — ilovani ochish\n/lang — tilni o‘zgartirish\n/privacy — maxfiylik siyosati\n/delete — ma’lumotlarimni o‘chirish\n/help — yordam',
  notRegistered: 'Avval ro‘yxatdan o‘ting: /start',
  langSaved: 'Til saqlandi: O‘zbekcha 🇺🇿',
  privacy: (url) => `Qaysi ma’lumotlar yig‘iladi va qanday ishlatiladi: <a href="${esc(url)}">maxfiylik siyosati</a>.\n\nMa’lumotlaringizni o‘chirish uchun /delete yuboring.`,
  myId: (id) => `Sizning Telegram ID: <code>${Number(id)}</code>`,
  deleteConfirm:
    'Profilingiz, e’lonlaringiz va so‘rovlaringiz butunlay o‘chiriladi. Buni qaytarib bo‘lmaydi. O‘chirilsinmi?',
  deleteYes: '🗑 Ha, o‘chirish',
  deleteNo: 'Bekor qilish',
  deleted: 'Ma’lumotlaringiz o‘chirildi. Qaytadan foydalanish uchun /start yuboring.',
  deleteCancelled: 'Bekor qilindi. Ma’lumotlaringiz joyida.',
  // Moderatsiya guruhidagi kartalar
  modNew: (u, resubmitted = false) =>
    [
      u.role === 'business' ? '#Yangi_biznes' : '#Yangi_bloger',
      '',
      ...profileLines(u, 'uz'),
      '',
      resubmitted ? '⏳ Moderatsiyada (qayta yuborildi)' : '⏳ Moderatsiyada'
    ].join('\n'),
  modUpdated: (u) =>
    [
      '#Profil_yangilandi',
      u.role === 'business' ? '🏪 Biznes' : '📸 Bloger',
      '',
      ...profileLines(u, 'uz'),
      '',
      '✅ Tasdiqlangan profil. Ma’lumotlar mos kelmasa, bloklang.'
    ].join('\n'),
  modApprove: '✅ Tasdiqlash',
  modReject: '❌ Rad etish',
  modBlock: '🚫 Bloklash',
  modProfile: '🔗 Profilni ochish',
  modApproved: (name) => `✅ <b>Tasdiqlandi</b> · ${esc(name)}`,
  modRejected: (name) => `❌ <b>Rad etildi</b> · ${esc(name)}`,
  modBlocked: (name) => `🚫 <b>Bloklandi</b> · ${esc(name)}`,
  modAlready: 'Bu profil bo‘yicha qaror allaqachon qabul qilingan.',
  modGone: 'Foydalanuvchi topilmadi: profil o‘chirilgan bo‘lishi mumkin.',
  modNoRights: 'Bu tugma faqat moderatorlar uchun.',
  pendingNone: 'Moderatsiyada profil yoki e’lon yo‘q.',
  pendingCount: (n) => `⏳ Moderatsiyada: ${n} ta profil. Eng eskilari:`,
  pendingAdsCount: (n) => `⏳ Moderatsiyada: ${n} ta reklama e’loni. Eng eskilari:`,
  groupBound: (which) =>
    [
      {
        blogger: '✅ Guruh ulandi: bu yerga yangi blogerlar keladi.',
        business: '✅ Guruh ulandi: bu yerga yangi bizneslar keladi.',
        ads: '✅ Guruh ulandi: bu yerga yangi reklama e’lonlari keladi.'
      }[which] || '✅ Guruh ulandi: bu yerga yangi blogerlar, bizneslar va reklama e’lonlari keladi.',
      '',
      'Tasdiqlash tugmalarini guruhning istalgan a’zosi bosa oladi, shuning uchun guruhga faqat jamoangizni qo‘shing.',
      '',
      '/moderatsiya — tasdiq kutayotgan profillar'
    ].join('\n'),
  groupHelp:
    'Guruhni ulash uchun:\n/ulash — hammasi shu guruhga\n/ulash bloger — yangi blogerlar\n/ulash biznes — yangi bizneslar\n/ulash elon — yangi reklama e’lonlari\n\n/moderatsiya — tasdiq kutayotgan profillar',
  groupNotAdmin: 'Guruhni faqat Ovoza adminlari ulay oladi.',
  adminNewCampaign: (c) =>
    [
      '#Yangi_elon',
      '📢 <b>Yangi reklama e’loni</b>',
      `«${esc(c.title)}» · ${esc(catLabel(c.category, 'uz'))}`,
      `🏪 ${esc(c.business_name)} (${mention(c.business_id, c.business_contact)})`,
      `💰 ${fmtNum(c.value)} so‘m · ${esc(String(c.platforms).split(',').join(', '))}`,
      `📝 ${esc(c.format)} · ${c.slots} o‘rin · ${c.days} kun`,
      regionLine(c.region, 'uz'),
      c.description ? `\n${esc(c.description)}` : '',
      c.moderation === 'pending' ? '\n⏳ Moderatsiyada: tasdiqlangach blogerlarga ko‘rinadi.' : ''
    ].filter(Boolean).join('\n').trim(),
  adminNewImage: (c) =>
    `#Elon_rasmi\n🖼 <b>Reklama e’loniga rasm qo‘shildi</b>\n«${esc(c.title)}» · 🏪 ${esc(c.business_name)} (${mention(c.business_id, c.business_contact)})${c.moderation === 'pending' ? '\n\n⏳ Moderatsiyada: tasdiqlangach blogerlarga ko‘rinadi.' : ''}`,
  adApproved: (name) => `✅ <b>E’lon tasdiqlandi</b> · ${esc(name)}`,
  adRejected: (name) => `❌ <b>E’lon rad etildi</b> · ${esc(name)}`,
  toBusinessAdPending: (title) =>
    `⏳ «${esc(title)}» reklama e’loningiz moderatsiyaga yuborildi. Jamoamiz tasdiqlagach blogerlar uni ilovada ko‘radi.`,
  toBusinessAdApproved: (title) => `✅ «${esc(title)}» reklama e’loningiz tasdiqlandi. Endi blogerlar uni ilovada ko‘radi.`,
  toBusinessAdRejected: (title) =>
    `«${esc(title)}» reklama e’loningiz tasdiqlanmadi. Shartlar va rasmni tekshirib, yangi e’lon joylashingiz mumkin.`,
  imageSaved: (title) => `🖼 «${esc(title)}» reklama e’loniga rasm qo‘shildi. Blogerlar uni ilovada ko‘radi.`,
  adminClose: '🚫 E’lonni yopish',
  adminClosed: '🚫 <b>Siz yopdingiz.</b>',
  adminAlreadyClosed: 'E’lon allaqachon yopilgan.',
  toBusinessClosed: (title) =>
    `«${esc(title)}» reklama e’loningiz moderator tomonidan yopildi. Savollar bo‘lsa, shu botga yozing.`,
  // Telegram profili va telefon raqami faqat qabul qilingach ko'rsatiladi (statusAccepted)
  newApplication: (a, decided = false) =>
    [
      '🆕 <b>Yangi so‘rov</b>',
      `Reklama e’loni: «${esc(a.title)}»`,
      '',
      ...[
        `👤 ${esc(a.blogger_name)}`,
        profileLine(a.platform, a.profile),
        `👥 ${followersLabel(a.followers)} obunachi`,
        reachLine(a, 'uz'),
        `🏷 ${esc(nicheLabel(a.niche, 'uz'))}`,
        audienceLine(a.region, 'uz'),
        a.stats_file_id ? '📊 Statistika skrinshoti — rasmda' : ''
      ].filter(Boolean),
      a.message ? `\n💬 ${esc(a.message)}` : '',
      decided ? '' : '\n🔒 Blogerning Telegrami va telefon raqami so‘rovni qabul qilganingizdan keyin ko‘rinadi.'
    ].join('\n').trim(),
  accept: '✅ Qabul qilish',
  reject: '❌ Rad etish',
  openRequests: '📋 Barcha so‘rovlar',
  statusAccepted: (a) =>
    [
      '✅ <b>Qabul qilindi.</b> Bloger bilan bog‘laning:',
      `👤 ${mention(a.blogger_id, a.blogger_name)}${at(a.blogger_username)}`,
      `📞 ${esc(formatPhone(a.blogger_phone))}`
    ].join('\n'),
  statusRejected: '❌ <b>Rad etildi.</b>',
  decidedAccepted: 'Qabul qilindi',
  decidedRejected: 'Rad etildi',
  toBloggerAccepted: (a) =>
    [
      '🎉 <b>So‘rovingiz qabul qilindi!</b>',
      `Reklama e’loni: «${esc(a.title)}»`,
      '',
      'Biznes bilan bog‘laning:',
      `🏪 ${esc(a.company)}`,
      `👤 ${mention(a.business_id, a.business_contact)}${at(a.business_username)}`,
      `📞 ${esc(formatPhone(a.business_phone))}`,
      '',
      `Kelishilgan format: ${esc(a.format)}.`
    ].join('\n'),
  toBloggerRejected: (a) => `So‘rovingiz rad etildi.\nReklama e’loni: «${esc(a.title)}»\n\nIlovada boshqa reklama e’lonlari ham bor.`,
  errAlreadyDecided: 'Bu so‘rov bo‘yicha qaror allaqachon qabul qilingan.',
  errCampaignFull: 'Bu reklama e’lonida bo‘sh o‘rin qolmagan.',
  errNotFound: 'So‘rov topilmadi.',
  stats: (s) =>
    `📊 <b>Statistika</b>\nBizneslar: ${s.businesses}\nBlogerlar: ${s.bloggers}\nModeratsiyada: ${s.pending} profil, ${s.pending_ads} e’lon\nFaol e’lonlar: ${s.active}\nSo‘rovlar: ${s.applications} (qabul qilingan: ${s.accepted})`,
  summaryBusiness: (u) =>
    `🏪 ${esc(u.company)}\n👤 ${esc(u.name)}\n🏷 ${esc(catLabel(u.category, 'uz'))}\n📞 ${esc(formatPhone(u.phone))}`,
  summaryBlogger: (u) =>
    [
      `👤 ${esc(u.name)}`,
      profileLine(u.platform, u.profile),
      `👥 ${followersLabel(u.followers)} obunachi`,
      reachLine(u, 'uz'),
      `🏷 ${esc(nicheLabel(u.niche, 'uz'))}`,
      audienceLine(u.region, 'uz'),
      `📊 Statistika: ${u.stats_file_id ? 'yuborildi ✅' : 'yuborilmadi'}`,
      `📞 ${esc(formatPhone(u.phone))}`
    ].filter(Boolean).join('\n'),
  commands: [
    { command: 'start', description: 'Ro‘yxatdan o‘tish yoki bosh menyu' },
    { command: 'app', description: 'Ilovani ochish' },
    { command: 'lang', description: 'Tilni o‘zgartirish' },
    { command: 'privacy', description: 'Maxfiylik siyosati' },
    { command: 'help', description: 'Yordam' }
  ],
  // Moderatsiya guruhida ko'rinadigan buyruqlar
  groupCommands: [
    { command: 'ulash', description: 'Guruhni moderatsiya uchun ulash (adminlar)' },
    { command: 'moderatsiya', description: 'Tasdiq kutayotgan profillar' },
    { command: 'stats', description: 'Statistika' }
  ],
  description:
    'Ovoza — bizneslar va blogerlar uchun barter platformasi. Bizneslar reklama e’loni joylaydi, blogerlar so‘rov yuboradi, javoblar shu botga keladi.',
  shortDescription: 'Mahsulot evaziga reklama: bizneslar va blogerlar uchun barter.'
};

const ru = {
  chooseLang: uz.chooseLang,
  welcome: (url) =>
    `Добро пожаловать в <b>Ovoza</b>!\n\nЗдесь бизнес и блогеры сотрудничают по бартеру: товар или услуга в обмен на рекламу.\n\nПродолжая, вы соглашаетесь с <a href="${esc(url)}">политикой конфиденциальности</a>.\n\nКто вы?`,
  roleBusiness: '🏪 У меня бизнес',
  roleBlogger: '📸 Я блогер',
  welcomeAs: (role, url) =>
    `Добро пожаловать в <b>Ovoza</b>! Регистрация для ${role === 'business' ? 'бизнеса' : 'блогера'}: ответьте на несколько вопросов.\n\nПродолжая, вы соглашаетесь с <a href="${esc(url)}">политикой конфиденциальности</a>.`,
  askName: 'Напишите ваше имя:',
  askCompany: 'Напишите название магазина или компании:',
  askCategory: 'К какой категории относится ваш товар или услуга?',
  askPlatform: 'Выберите основную соцсеть:',
  askProfile: (platform) =>
    `${PLATFORM_ICON[platform] || '🔗'} Отправьте ссылку на ${platform === 'Instagram' || platform === 'TikTok' ? 'ваш профиль' : 'ваш канал'} в ${esc(platform)}.\n\nНапример: ${EXAMPLE[platform] || 'https://…'}`,
  askReach: (platform) =>
    `👁 Сколько в среднем просмотров набирают ваши ${{ Instagram: 'сторис', Telegram: 'посты' }[platform] || 'видео'}?`,
  askStats: (platform) =>
    [
      '📊 Отправьте скриншот статистики фотографией.',
      '',
      {
        Instagram: 'Instagram: Профессиональная панель → Статистика → Аудитория (города, возраст, пол).',
        TikTok: 'TikTok: Аналитика → Подписчики (города, возраст, пол).',
        YouTube: 'YouTube Studio → Аналитика → Аудитория.',
        Telegram: 'Telegram: канал → Статистика (подписчики и просмотры).'
      }[platform] || '',
      '',
      'По этому скриншоту бизнес увидит вашу аудиторию.'
    ].join('\n'),
  statsSkip: 'Пропустить',
  errStats: 'Пожалуйста, отправьте скриншот как фото или нажмите «Пропустить».',
  askFollowers: 'Сколько у вас подписчиков?',
  askNiche: 'Выберите тематику блога:',
  askRegion:
    '📍 В каком регионе ваша аудитория (большая часть подписчиков)?\n\nБизнес рекламируется для аудитории своего региона. Например, кафе в Самарканде ищет блогера с самаркандской аудиторией.',
  askPhone:
    'Последний шаг: отправьте номер телефона. Нажмите кнопку ниже 👇\n\nНомер увидит другая сторона только после того, как отклик будет принят.',
  phoneButton: '📱 Отправить номер',
  phoneSaved: '✓ Номер сохранён.',
  errName: 'Имя должно быть от 2 до 60 символов. Напишите ещё раз:',
  errCompany: 'Название должно быть от 2 до 80 символов. Напишите ещё раз:',
  errProfile: (platform) =>
    `Это не похоже на ссылку ${esc(platform)}. Отправьте ссылку или @username.\n\nНапример: ${EXAMPLE[platform] || 'https://…'}`,
  errPhone: 'Отправьте номер кнопкой ниже или напишите в формате +998 90 123 45 67.',
  errContactNotOwn: 'Пожалуйста, отправьте свой собственный номер.',
  useButtons: 'Пожалуйста, выберите один из вариантов выше.',
  staleButton: 'Эта кнопка устарела.',
  doneBusiness: (summary) =>
    `✅ <b>Регистрация завершена!</b>\n\n${summary}\n\nТеперь разместите рекламное объявление в приложении. Блогеры увидят его и отправят отклики, а они придут в этот бот.`,
  doneBlogger: (summary) =>
    `✅ <b>Регистрация завершена!</b>\n\n${summary}\n\nСмотрите рекламные объявления в приложении и откликайтесь на понравившиеся. Ответы придут в этот бот.`,
  donePending: (summary) =>
    `✅ <b>Регистрация завершена!</b>\n\n${summary}\n\n⏳ <b>Ваш профиль на модерации.</b> Команда скоро его проверит и напишет результат сюда.`,
  pendingHome: '⏳ Ваш профиль на модерации. Когда его одобрят, мы напишем сюда.',
  approvedBusiness:
    '🎉 <b>Ваш профиль одобрен!</b>\n\nТеперь разместите рекламное объявление в приложении. Блогеры увидят его и отправят отклики, а они придут в этот бот.',
  approvedBlogger:
    '🎉 <b>Ваш профиль одобрен!</b>\n\nСмотрите рекламные объявления в приложении и откликайтесь на понравившиеся. Ответы придут в этот бот.',
  rejectedNotice:
    'К сожалению, ваш профиль не одобрен.\n\nПроверьте данные (например, что ссылка на профиль верная и профиль открыт) и отправьте их повторно.',
  resubmit: '🔄 Отправить повторно',
  editProfile: '✏️ Изменить данные',
  openApp: '🚀 Открыть приложение',
  updateProfile: '✏️ Обновить данные',
  home: (name) => `Здравствуйте, ${esc(name)}! Рекламные объявления и отклики — в приложении.`,
  help:
    '<b>Ovoza</b> — бартерная платформа для бизнеса и блогеров.\n\n/start — регистрация или главное меню\n/app — открыть приложение\n/lang — сменить язык\n/privacy — политика конфиденциальности\n/delete — удалить мои данные\n/help — помощь',
  notRegistered: 'Сначала пройдите регистрацию: /start',
  langSaved: 'Язык сохранён: Русский 🇷🇺',
  privacy: (url) => `Какие данные собираются и как используются: <a href="${esc(url)}">политика конфиденциальности</a>.\n\nЧтобы удалить свои данные, отправьте /delete.`,
  myId: (id) => `Ваш Telegram ID: <code>${Number(id)}</code>`,
  deleteConfirm: 'Ваш профиль, объявления и отклики будут удалены навсегда. Отменить это нельзя. Удалить?',
  deleteYes: '🗑 Да, удалить',
  deleteNo: 'Отмена',
  deleted: 'Ваши данные удалены. Чтобы снова пользоваться ботом, отправьте /start.',
  deleteCancelled: 'Отменено. Ваши данные на месте.',
  modNew: (u, resubmitted = false) =>
    [
      u.role === 'business' ? '#Yangi_biznes' : '#Yangi_bloger',
      '',
      ...profileLines(u, 'ru'),
      '',
      resubmitted ? '⏳ На модерации (отправлен повторно)' : '⏳ На модерации'
    ].join('\n'),
  modUpdated: (u) =>
    [
      '#Profil_yangilandi',
      u.role === 'business' ? '🏪 Бизнес' : '📸 Блогер',
      '',
      ...profileLines(u, 'ru'),
      '',
      '✅ Профиль одобрен. Если данные не подходят, заблокируйте.'
    ].join('\n'),
  modApprove: '✅ Одобрить',
  modReject: '❌ Отклонить',
  modBlock: '🚫 Заблокировать',
  modProfile: '🔗 Открыть профиль',
  modApproved: (name) => `✅ <b>Одобрено</b> · ${esc(name)}`,
  modRejected: (name) => `❌ <b>Отклонено</b> · ${esc(name)}`,
  modBlocked: (name) => `🚫 <b>Заблокировано</b> · ${esc(name)}`,
  modAlready: 'Решение по этому профилю уже принято.',
  modGone: 'Пользователь не найден: возможно, профиль удалён.',
  modNoRights: 'Эта кнопка только для модераторов.',
  pendingNone: 'На модерации нет ни профилей, ни объявлений.',
  pendingCount: (n) => `⏳ Профилей на модерации: ${n}. Самые ранние:`,
  pendingAdsCount: (n) => `⏳ Объявлений на модерации: ${n}. Самые ранние:`,
  groupBound: (which) =>
    [
      {
        blogger: '✅ Группа подключена: сюда будут приходить новые блогеры.',
        business: '✅ Группа подключена: сюда будут приходить новые бизнесы.',
        ads: '✅ Группа подключена: сюда будут приходить новые рекламные объявления.'
      }[which] || '✅ Группа подключена: сюда будут приходить новые блогеры, бизнесы и рекламные объявления.',
      '',
      'Кнопки модерации может нажать любой участник группы, поэтому добавляйте в неё только свою команду.',
      '',
      '/moderatsiya — профили, ожидающие проверки'
    ].join('\n'),
  groupHelp:
    'Чтобы подключить группу:\n/ulash — всё в эту группу\n/ulash bloger — новые блогеры\n/ulash biznes — новые бизнесы\n/ulash elon — новые рекламные объявления\n\n/moderatsiya — профили, ожидающие проверки',
  groupNotAdmin: 'Подключить группу могут только администраторы Ovoza.',
  adminNewCampaign: (c) =>
    [
      '#Yangi_elon',
      '📢 <b>Новое рекламное объявление</b>',
      `«${esc(c.title)}» · ${esc(catLabel(c.category, 'ru'))}`,
      `🏪 ${esc(c.business_name)} (${mention(c.business_id, c.business_contact)})`,
      `💰 ${fmtNum(c.value)} сум · ${esc(String(c.platforms).split(',').join(', '))}`,
      `📝 ${esc(c.format)} · мест: ${c.slots} · дней: ${c.days}`,
      regionLine(c.region, 'ru'),
      c.description ? `\n${esc(c.description)}` : '',
      c.moderation === 'pending' ? '\n⏳ На модерации: блогеры увидят после одобрения.' : ''
    ].filter(Boolean).join('\n').trim(),
  adminNewImage: (c) =>
    `#Elon_rasmi\n🖼 <b>К рекламному объявлению добавлено фото</b>\n«${esc(c.title)}» · 🏪 ${esc(c.business_name)} (${mention(c.business_id, c.business_contact)})${c.moderation === 'pending' ? '\n\n⏳ На модерации: блогеры увидят после одобрения.' : ''}`,
  adApproved: (name) => `✅ <b>Объявление одобрено</b> · ${esc(name)}`,
  adRejected: (name) => `❌ <b>Объявление отклонено</b> · ${esc(name)}`,
  toBusinessAdPending: (title) =>
    `⏳ Ваше рекламное объявление «${esc(title)}» отправлено на модерацию. После одобрения блогеры увидят его в приложении.`,
  toBusinessAdApproved: (title) => `✅ Ваше рекламное объявление «${esc(title)}» одобрено. Теперь блогеры видят его в приложении.`,
  toBusinessAdRejected: (title) =>
    `Ваше рекламное объявление «${esc(title)}» не одобрено. Проверьте условия и фото и разместите новое объявление.`,
  imageSaved: (title) => `🖼 Фото добавлено к рекламному объявлению «${esc(title)}». Блогеры увидят его в приложении.`,
  adminClose: '🚫 Закрыть объявление',
  adminClosed: '🚫 <b>Вы закрыли объявление.</b>',
  adminAlreadyClosed: 'Объявление уже закрыто.',
  toBusinessClosed: (title) =>
    `Ваше рекламное объявление «${esc(title)}» закрыто модератором. Если есть вопросы, напишите в этот бот.`,
  newApplication: (a, decided = false) =>
    [
      '🆕 <b>Новый отклик</b>',
      `Объявление: «${esc(a.title)}»`,
      '',
      ...[
        `👤 ${esc(a.blogger_name)}`,
        profileLine(a.platform, a.profile),
        `👥 ${followersLabel(a.followers)} подписчиков`,
        reachLine(a, 'ru'),
        `🏷 ${esc(nicheLabel(a.niche, 'ru'))}`,
        audienceLine(a.region, 'ru'),
        a.stats_file_id ? '📊 Скриншот статистики — на фото' : ''
      ].filter(Boolean),
      a.message ? `\n💬 ${esc(a.message)}` : '',
      decided ? '' : '\n🔒 Telegram и телефон блогера будут видны после того, как вы примете отклик.'
    ].join('\n').trim(),
  accept: '✅ Принять',
  reject: '❌ Отклонить',
  openRequests: '📋 Все отклики',
  statusAccepted: (a) =>
    [
      '✅ <b>Принято.</b> Свяжитесь с блогером:',
      `👤 ${mention(a.blogger_id, a.blogger_name)}${at(a.blogger_username)}`,
      `📞 ${esc(formatPhone(a.blogger_phone))}`
    ].join('\n'),
  statusRejected: '❌ <b>Отклонено.</b>',
  decidedAccepted: 'Принято',
  decidedRejected: 'Отклонено',
  toBloggerAccepted: (a) =>
    [
      '🎉 <b>Ваш отклик принят!</b>',
      `Объявление: «${esc(a.title)}»`,
      '',
      'Свяжитесь с бизнесом:',
      `🏪 ${esc(a.company)}`,
      `👤 ${mention(a.business_id, a.business_contact)}${at(a.business_username)}`,
      `📞 ${esc(formatPhone(a.business_phone))}`,
      '',
      `Согласованный формат: ${esc(a.format)}.`
    ].join('\n'),
  toBloggerRejected: (a) => `Ваш отклик отклонён.\nОбъявление: «${esc(a.title)}»\n\nВ приложении есть и другие объявления.`,
  errAlreadyDecided: 'По этому отклику решение уже принято.',
  errCampaignFull: 'В этом объявлении не осталось свободных мест.',
  errNotFound: 'Отклик не найден.',
  stats: (s) =>
    `📊 <b>Статистика</b>\nБизнесы: ${s.businesses}\nБлогеры: ${s.bloggers}\nНа модерации: профилей ${s.pending}, объявлений ${s.pending_ads}\nАктивные объявления: ${s.active}\nОтклики: ${s.applications} (принято: ${s.accepted})`,
  summaryBusiness: (u) =>
    `🏪 ${esc(u.company)}\n👤 ${esc(u.name)}\n🏷 ${esc(catLabel(u.category, 'ru'))}\n📞 ${esc(formatPhone(u.phone))}`,
  summaryBlogger: (u) =>
    [
      `👤 ${esc(u.name)}`,
      profileLine(u.platform, u.profile),
      `👥 ${followersLabel(u.followers)} подписчиков`,
      reachLine(u, 'ru'),
      `🏷 ${esc(nicheLabel(u.niche, 'ru'))}`,
      audienceLine(u.region, 'ru'),
      `📊 Статистика: ${u.stats_file_id ? 'отправлена ✅' : 'не отправлена'}`,
      `📞 ${esc(formatPhone(u.phone))}`
    ].filter(Boolean).join('\n'),
  commands: [
    { command: 'start', description: 'Регистрация или главное меню' },
    { command: 'app', description: 'Открыть приложение' },
    { command: 'lang', description: 'Сменить язык' },
    { command: 'privacy', description: 'Политика конфиденциальности' },
    { command: 'help', description: 'Помощь' }
  ],
  groupCommands: [
    { command: 'ulash', description: 'Подключить группу для модерации (админы)' },
    { command: 'moderatsiya', description: 'Профили, ожидающие проверки' },
    { command: 'stats', description: 'Статистика' }
  ],
  description:
    'Ovoza — бартерная платформа для бизнеса и блогеров. Бизнес размещает рекламные объявления, блогеры откликаются, ответы приходят в этот бот.',
  shortDescription: 'Реклама за товар: бартер для бизнеса и блогеров.'
};

export const tr = (lang) => (lang === 'ru' ? ru : uz);
