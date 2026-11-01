// Bot matnlari (o'zbekcha va ruscha)

import { CATEGORIES, findFollowers } from './constants.js';
import { esc, fmtNum, formatPhone } from './util.js';

export const catLabel = (id, lang) => CATEGORIES.find((c) => c.id === id)?.[lang === 'ru' ? 'ru' : 'uz'] ?? id ?? '';

export function followersLabel(id) {
  const f = findFollowers(id);
  if (!f) return id ?? '';
  return f.max ? `${fmtNum(f.min)} – ${fmtNum(f.max)}` : `${fmtNum(f.min)}+`;
}

// Xabardagi foydalanuvchi nomi: Telegramdagi profiliga havola bilan
const mention = (id, name) => `<a href="tg://user?id=${Number(id)}">${esc(name)}</a>`;
const at = (username) => (username ? ` (@${esc(username)})` : '');

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
  askProfile: 'Profilingiz havolasini yoki @username ni yozing:',
  askFollowers: 'Obunachilaringiz soni qancha?',
  askNiche: 'Blogingiz yo‘nalishini tanlang:',
  askPhone:
    'Oxirgi qadam: telefon raqamingizni yuboring. Pastdagi tugmani bosing 👇\n\nRaqamingiz faqat so‘rov qabul qilinganda ikkinchi tomonga ko‘rsatiladi.',
  phoneButton: '📱 Raqamni yuborish',
  phoneSaved: '✓ Raqam saqlandi.',
  errName: 'Ism 2–60 belgidan iborat bo‘lsin. Qaytadan yozing:',
  errCompany: 'Nom 2–80 belgidan iborat bo‘lsin. Qaytadan yozing:',
  errProfile: 'Havola yoki @username ni to‘g‘ri yozing (3–200 belgi):',
  errPhone: 'Raqamni pastdagi tugma orqali yuboring yoki +998 90 123 45 67 ko‘rinishida yozing.',
  errContactNotOwn: 'Iltimos, o‘zingizning raqamingizni yuboring.',
  useButtons: 'Iltimos, yuqoridagi tugmalardan birini tanlang.',
  staleButton: 'Bu tugma eskirgan.',
  doneBusiness: (summary) =>
    `✅ <b>Ro‘yxatdan o‘tdingiz!</b>\n\n${summary}\n\nEndi ilovada kampaniya joylang. Blogerlar uni ko‘rib, so‘rov yuboradi, so‘rovlar shu botga keladi.`,
  doneBlogger: (summary) =>
    `✅ <b>Ro‘yxatdan o‘tdingiz!</b>\n\n${summary}\n\nIlovada kampaniyalarni ko‘ring va yoqqaniga so‘rov yuboring. Javoblar shu botga keladi.`,
  openApp: '🚀 Ilovani ochish',
  updateProfile: '✏️ Ma’lumotlarni yangilash',
  home: (name) => `Assalomu alaykum, ${esc(name)}! Kampaniyalar va so‘rovlar ilovada.`,
  help:
    '<b>Ovoza</b> — bizneslar va blogerlar uchun barter platformasi.\n\n/start — ro‘yxatdan o‘tish yoki bosh menyu\n/app — ilovani ochish\n/lang — tilni o‘zgartirish\n/privacy — maxfiylik siyosati\n/delete — ma’lumotlarimni o‘chirish\n/help — yordam',
  notRegistered: 'Avval ro‘yxatdan o‘ting: /start',
  langSaved: 'Til saqlandi: O‘zbekcha 🇺🇿',
  privacy: (url) => `Qaysi ma’lumotlar yig‘iladi va qanday ishlatiladi: <a href="${esc(url)}">maxfiylik siyosati</a>.\n\nMa’lumotlaringizni o‘chirish uchun /delete yuboring.`,
  myId: (id) => `Sizning Telegram ID: <code>${Number(id)}</code>`,
  deleteConfirm:
    'Profilingiz, kampaniyalaringiz va so‘rovlaringiz butunlay o‘chiriladi. Buni qaytarib bo‘lmaydi. O‘chirilsinmi?',
  deleteYes: '🗑 Ha, o‘chirish',
  deleteNo: 'Bekor qilish',
  deleted: 'Ma’lumotlaringiz o‘chirildi. Qaytadan foydalanish uchun /start yuboring.',
  deleteCancelled: 'Bekor qilindi. Ma’lumotlaringiz joyida.',
  adminNewUser: (u) =>
    [
      `👤 <b>Yangi ${u.role === 'business' ? 'biznes' : 'bloger'}</b>`,
      u.role === 'business'
        ? `🏪 ${esc(u.company)} · ${esc(catLabel(u.category, 'uz'))}`
        : `📱 ${esc(u.platform)} · ${followersLabel(u.followers)} · ${esc(catLabel(u.niche, 'uz'))}\n🔗 ${esc(u.profile)}`,
      `${mention(u.tg_id, u.name)}${at(u.username)} · ${esc(formatPhone(u.phone))}`
    ].join('\n'),
  adminNewCampaign: (c) =>
    [
      '📢 <b>Yangi kampaniya</b>',
      `«${esc(c.title)}» · ${esc(catLabel(c.category, 'uz'))}`,
      `🏪 ${esc(c.business_name)} (${mention(c.business_id, c.business_contact)})`,
      `💰 ${fmtNum(c.value)} so‘m · ${esc(String(c.platforms).split(',').join(', '))}`,
      `📝 ${esc(c.format)} · ${c.slots} o‘rin · ${c.days} kun`,
      c.description ? `\n${esc(c.description)}` : ''
    ].join('\n').trim(),
  adminClose: '🚫 Kampaniyani yopish',
  adminClosed: '🚫 <b>Siz yopdingiz.</b>',
  adminAlreadyClosed: 'Kampaniya allaqachon yopilgan.',
  toBusinessClosed: (title) =>
    `Kampaniyangiz «${esc(title)}» moderator tomonidan yopildi. Savollar bo‘lsa, shu botga yozing.`,
  newApplication: (a) =>
    [
      '🆕 <b>Yangi so‘rov</b>',
      `Kampaniya: «${esc(a.title)}»`,
      '',
      `👤 ${mention(a.blogger_id, a.blogger_name)}${at(a.blogger_username)}`,
      `📱 ${esc(a.platform)} · ${followersLabel(a.followers)} obunachi`,
      `🔗 ${esc(a.profile)}`,
      `🏷 ${esc(catLabel(a.niche, 'uz'))}`,
      a.message ? `\n💬 ${esc(a.message)}` : ''
    ].join('\n').trim(),
  accept: '✅ Qabul qilish',
  reject: '❌ Rad etish',
  openRequests: '📋 Barcha so‘rovlar',
  statusAccepted: (a) => `✅ <b>Qabul qilindi.</b> Blogerning telefoni: ${esc(formatPhone(a.blogger_phone))}`,
  statusRejected: '❌ <b>Rad etildi.</b>',
  decidedAccepted: 'Qabul qilindi',
  decidedRejected: 'Rad etildi',
  toBloggerAccepted: (a) =>
    [
      '🎉 <b>So‘rovingiz qabul qilindi!</b>',
      `Kampaniya: «${esc(a.title)}»`,
      '',
      'Biznes bilan bog‘laning:',
      `🏪 ${esc(a.company)}`,
      `👤 ${mention(a.business_id, a.business_contact)}${at(a.business_username)}`,
      `📞 ${esc(formatPhone(a.business_phone))}`,
      '',
      `Kelishilgan format: ${esc(a.format)}.`
    ].join('\n'),
  toBloggerRejected: (a) => `So‘rovingiz rad etildi.\nKampaniya: «${esc(a.title)}»\n\nIlovada boshqa kampaniyalar ham bor.`,
  errAlreadyDecided: 'Bu so‘rov bo‘yicha qaror allaqachon qabul qilingan.',
  errCampaignFull: 'Bu kampaniyada bo‘sh o‘rin qolmagan.',
  errNotFound: 'So‘rov topilmadi.',
  stats: (s) =>
    `📊 <b>Statistika</b>\nBizneslar: ${s.businesses}\nBlogerlar: ${s.bloggers}\nFaol kampaniyalar: ${s.active}\nSo‘rovlar: ${s.applications} (qabul qilingan: ${s.accepted})`,
  summaryBusiness: (u) =>
    `🏪 ${esc(u.company)}\n👤 ${esc(u.name)}\n🏷 ${esc(catLabel(u.category, 'uz'))}\n📞 ${esc(formatPhone(u.phone))}`,
  summaryBlogger: (u) =>
    `👤 ${esc(u.name)}\n📱 ${esc(u.platform)} · ${followersLabel(u.followers)} obunachi\n🔗 ${esc(u.profile)}\n🏷 ${esc(catLabel(u.niche, 'uz'))}\n📞 ${esc(formatPhone(u.phone))}`,
  commands: [
    { command: 'start', description: 'Ro‘yxatdan o‘tish yoki bosh menyu' },
    { command: 'app', description: 'Ilovani ochish' },
    { command: 'lang', description: 'Tilni o‘zgartirish' },
    { command: 'privacy', description: 'Maxfiylik siyosati' },
    { command: 'help', description: 'Yordam' }
  ],
  description:
    'Ovoza — bizneslar va blogerlar uchun barter platformasi. Bizneslar kampaniya joylaydi, blogerlar so‘rov yuboradi, javoblar shu botga keladi.',
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
  askProfile: 'Напишите ссылку на профиль или @username:',
  askFollowers: 'Сколько у вас подписчиков?',
  askNiche: 'Выберите тематику блога:',
  askPhone:
    'Последний шаг: отправьте номер телефона. Нажмите кнопку ниже 👇\n\nНомер увидит другая сторона только после того, как отклик будет принят.',
  phoneButton: '📱 Отправить номер',
  phoneSaved: '✓ Номер сохранён.',
  errName: 'Имя должно быть от 2 до 60 символов. Напишите ещё раз:',
  errCompany: 'Название должно быть от 2 до 80 символов. Напишите ещё раз:',
  errProfile: 'Укажите ссылку или @username правильно (3–200 символов):',
  errPhone: 'Отправьте номер кнопкой ниже или напишите в формате +998 90 123 45 67.',
  errContactNotOwn: 'Пожалуйста, отправьте свой собственный номер.',
  useButtons: 'Пожалуйста, выберите один из вариантов выше.',
  staleButton: 'Эта кнопка устарела.',
  doneBusiness: (summary) =>
    `✅ <b>Регистрация завершена!</b>\n\n${summary}\n\nТеперь разместите кампанию в приложении. Блогеры увидят её и отправят отклики, а они придут в этот бот.`,
  doneBlogger: (summary) =>
    `✅ <b>Регистрация завершена!</b>\n\n${summary}\n\nСмотрите кампании в приложении и откликайтесь на понравившиеся. Ответы придут в этот бот.`,
  openApp: '🚀 Открыть приложение',
  updateProfile: '✏️ Обновить данные',
  home: (name) => `Здравствуйте, ${esc(name)}! Кампании и отклики — в приложении.`,
  help:
    '<b>Ovoza</b> — бартерная платформа для бизнеса и блогеров.\n\n/start — регистрация или главное меню\n/app — открыть приложение\n/lang — сменить язык\n/privacy — политика конфиденциальности\n/delete — удалить мои данные\n/help — помощь',
  notRegistered: 'Сначала пройдите регистрацию: /start',
  langSaved: 'Язык сохранён: Русский 🇷🇺',
  privacy: (url) => `Какие данные собираются и как используются: <a href="${esc(url)}">политика конфиденциальности</a>.\n\nЧтобы удалить свои данные, отправьте /delete.`,
  myId: (id) => `Ваш Telegram ID: <code>${Number(id)}</code>`,
  deleteConfirm: 'Ваш профиль, кампании и отклики будут удалены навсегда. Отменить это нельзя. Удалить?',
  deleteYes: '🗑 Да, удалить',
  deleteNo: 'Отмена',
  deleted: 'Ваши данные удалены. Чтобы снова пользоваться ботом, отправьте /start.',
  deleteCancelled: 'Отменено. Ваши данные на месте.',
  adminNewUser: (u) =>
    [
      `👤 <b>Новый ${u.role === 'business' ? 'бизнес' : 'блогер'}</b>`,
      u.role === 'business'
        ? `🏪 ${esc(u.company)} · ${esc(catLabel(u.category, 'ru'))}`
        : `📱 ${esc(u.platform)} · ${followersLabel(u.followers)} · ${esc(catLabel(u.niche, 'ru'))}\n🔗 ${esc(u.profile)}`,
      `${mention(u.tg_id, u.name)}${at(u.username)} · ${esc(formatPhone(u.phone))}`
    ].join('\n'),
  adminNewCampaign: (c) =>
    [
      '📢 <b>Новая кампания</b>',
      `«${esc(c.title)}» · ${esc(catLabel(c.category, 'ru'))}`,
      `🏪 ${esc(c.business_name)} (${mention(c.business_id, c.business_contact)})`,
      `💰 ${fmtNum(c.value)} сум · ${esc(String(c.platforms).split(',').join(', '))}`,
      `📝 ${esc(c.format)} · мест: ${c.slots} · дней: ${c.days}`,
      c.description ? `\n${esc(c.description)}` : ''
    ].join('\n').trim(),
  adminClose: '🚫 Закрыть кампанию',
  adminClosed: '🚫 <b>Вы закрыли кампанию.</b>',
  adminAlreadyClosed: 'Кампания уже закрыта.',
  toBusinessClosed: (title) =>
    `Ваша кампания «${esc(title)}» закрыта модератором. Если есть вопросы, напишите в этот бот.`,
  newApplication: (a) =>
    [
      '🆕 <b>Новый отклик</b>',
      `Кампания: «${esc(a.title)}»`,
      '',
      `👤 ${mention(a.blogger_id, a.blogger_name)}${at(a.blogger_username)}`,
      `📱 ${esc(a.platform)} · ${followersLabel(a.followers)} подписчиков`,
      `🔗 ${esc(a.profile)}`,
      `🏷 ${esc(catLabel(a.niche, 'ru'))}`,
      a.message ? `\n💬 ${esc(a.message)}` : ''
    ].join('\n').trim(),
  accept: '✅ Принять',
  reject: '❌ Отклонить',
  openRequests: '📋 Все отклики',
  statusAccepted: (a) => `✅ <b>Принято.</b> Телефон блогера: ${esc(formatPhone(a.blogger_phone))}`,
  statusRejected: '❌ <b>Отклонено.</b>',
  decidedAccepted: 'Принято',
  decidedRejected: 'Отклонено',
  toBloggerAccepted: (a) =>
    [
      '🎉 <b>Ваш отклик принят!</b>',
      `Кампания: «${esc(a.title)}»`,
      '',
      'Свяжитесь с бизнесом:',
      `🏪 ${esc(a.company)}`,
      `👤 ${mention(a.business_id, a.business_contact)}${at(a.business_username)}`,
      `📞 ${esc(formatPhone(a.business_phone))}`,
      '',
      `Согласованный формат: ${esc(a.format)}.`
    ].join('\n'),
  toBloggerRejected: (a) => `Ваш отклик отклонён.\nКампания: «${esc(a.title)}»\n\nВ приложении есть и другие кампании.`,
  errAlreadyDecided: 'По этому отклику решение уже принято.',
  errCampaignFull: 'В этой кампании не осталось свободных мест.',
  errNotFound: 'Отклик не найден.',
  stats: (s) =>
    `📊 <b>Статистика</b>\nБизнесы: ${s.businesses}\nБлогеры: ${s.bloggers}\nАктивные кампании: ${s.active}\nОтклики: ${s.applications} (принято: ${s.accepted})`,
  summaryBusiness: (u) =>
    `🏪 ${esc(u.company)}\n👤 ${esc(u.name)}\n🏷 ${esc(catLabel(u.category, 'ru'))}\n📞 ${esc(formatPhone(u.phone))}`,
  summaryBlogger: (u) =>
    `👤 ${esc(u.name)}\n📱 ${esc(u.platform)} · ${followersLabel(u.followers)} подписчиков\n🔗 ${esc(u.profile)}\n🏷 ${esc(catLabel(u.niche, 'ru'))}\n📞 ${esc(formatPhone(u.phone))}`,
  commands: [
    { command: 'start', description: 'Регистрация или главное меню' },
    { command: 'app', description: 'Открыть приложение' },
    { command: 'lang', description: 'Сменить язык' },
    { command: 'privacy', description: 'Политика конфиденциальности' },
    { command: 'help', description: 'Помощь' }
  ],
  description:
    'Ovoza — бартерная платформа для бизнеса и блогеров. Бизнес размещает кампании, блогеры откликаются, ответы приходят в этот бот.',
  shortDescription: 'Реклама за товар: бартер для бизнеса и блогеров.'
};

export const tr = (lang) => (lang === 'ru' ? ru : uz);
