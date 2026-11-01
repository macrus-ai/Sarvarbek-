/* Ovoza mini ilovasi: blogerlar reklama e'lonlarini ko'radi va so'rov yuboradi,
   bizneslar reklama e'loni joylaydi va so'rovlarga javob beradi. */
(() => {
  'use strict';

  const tg = window.Telegram?.WebApp ?? null;
  const root = document.getElementById('app');
  const toastEl = document.getElementById('toast');

  /* ---------- Matnlar ---------- */
  const fmt = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  const TEXT = {
    uz: {
      currency: 'so‘m',
      roleBusiness: 'Biznes',
      roleBlogger: 'Bloger',
      nav: 'Bo‘limlar',
      back: 'Orqaga',
      tabBrowse: 'E’lonlar',
      tabMine: 'So‘rovlarim',
      tabMyCampaigns: 'E’lonlarim',
      tabRequests: 'So‘rovlar',
      browseTitle: 'Reklama e’lonlari',
      mineTitle: 'Mening so‘rovlarim',
      myCampaignsTitle: 'Reklama e’lonlarim',
      requestsTitle: 'So‘rovlar',
      search: 'Qidiruv',
      searchPh: 'Mahsulot, do‘kon yoki shahar',
      categories: 'Toifalar',
      allCats: 'Hammasi',
      platform: 'Platforma',
      allPlatforms: 'Barcha platformalar',
      emptyBrowse: 'Hozircha faol reklama e’loni yo‘q. Yangilari paydo bo‘lishi bilan shu yerda ko‘rinadi.',
      emptyFiltered: 'Bu filtr bo‘yicha reklama e’loni topilmadi.',
      slotsLeft: (n) => `${n} ta o‘rin bor`,
      full: 'O‘rinlar to‘lgan',
      value: 'Mahsulot qiymati',
      format: 'Format',
      requirement: 'Talab',
      deadline: 'Muddat',
      slots: 'Bo‘sh o‘rinlar',
      platforms: 'Platformalar',
      description: 'Tavsif',
      followersMin: (n) => `${fmt(n)}+ obunachi`,
      noRequirement: 'Talab yo‘q',
      days: (n) => `${n} kun`,
      slotsOf: (left, total) => `${left} / ${total}`,
      statusPending: 'Kutilmoqda',
      statusAccepted: 'Qabul qilindi',
      statusRejected: 'Rad etildi',
      yourStatus: 'So‘rovingiz holati',
      messageLabel: 'Biznesga xabar',
      optional: 'ixtiyoriy',
      messagePh: 'Nega aynan siz mos kelasiz? Masalan, auditoriyangiz haqida.',
      apply: 'So‘rov yuborish',
      applied: 'So‘rov yuborilgan',
      unavailable: 'So‘rov qabul qilinmaydi',
      applySent: 'So‘rov yuborildi. Javob botga keladi.',
      emptyMine: 'Siz hali so‘rov yubormagansiz. E’lonlar bo‘limidan yoqqanini tanlang.',
      toBrowse: 'Reklama e’lonlarini ko‘rish',
      waiting: 'Biznes javobini kutyapmiz. Javob botga keladi.',
      rejectedNote: 'Bu safar rad etildi. Boshqa e’lonlarni ko‘ring.',
      contactBusiness: 'Biznes bilan bog‘laning',
      contactBlogger: 'Bloger bilan bog‘laning',
      newCampaign: 'Yangi reklama e’loni',
      newShort: 'Yangi',
      emptyMyCampaigns: 'Hali reklama e’loni joylamagansiz. Birinchisini joylang: blogerlar uni ko‘rib, so‘rov yuboradi.',
      active: 'Faol',
      closed: 'Yopiq',
      acceptedOf: (a, s) => `Qabul qilingan: ${a} / ${s}`,
      pendingN: (n) => `${n} ta yangi so‘rov`,
      closeCampaign: 'Yopish',
      reopenCampaign: 'Qayta ochish',
      viewRequests: 'So‘rovlar',
      closeConfirm: 'E’lon yopilsa, blogerlar uni ko‘rmaydi. Yopilsinmi?',
      campaignClosed: 'E’lon yopildi',
      campaignReopened: 'E’lon qayta ochildi',
      fTitle: 'Mahsulot yoki xizmat',
      fTitlePh: 'Masalan, Tabiiy yuz kremi',
      fCategory: 'Toifa',
      choose: 'Tanlang',
      fValue: 'Mahsulot qiymati, so‘m',
      fValuePh: '150 000',
      fPlatforms: 'Platformalar',
      fFormat: 'Reklama formati',
      fFormatPh: 'Masalan, 1 Reels + 2 Stories',
      fMin: 'Kamida obunachi',
      fMinHint: '0 — talab yo‘q',
      fDays: 'Muddat, kun',
      fSlots: 'Blogerlar soni',
      fCity: 'Shahar',
      fCityPh: 'Masalan, Toshkent',
      fDesc: 'Tavsif',
      fDescPh: 'Mahsulot, shartlar va yetkazib berish haqida',
      fImage: 'Rasm',
      imageAdd: 'Rasm qo‘shish',
      imageHint: 'Rasmli e’lon ko‘proq e’tibor tortadi',
      imageChange: 'Almashtirish',
      imageRemove: 'Olib tashlash',
      imageRemoveConfirm: 'Rasm olib tashlansinmi?',
      imageUploading: 'Rasm yuklanmoqda…',
      imageSaved: 'Rasm saqlandi',
      imageRemoved: 'Rasm olib tashlandi',
      imageAfterFail: 'E’lon joylandi, lekin rasm yuklanmadi. E’lon sahifasida qayta qo‘shib ko‘ring.',
      publishing: 'Joylanmoqda…',
      publish: 'E’lonni joylash',
      published: 'Reklama e’loni joylandi. Blogerlar uni hozir ko‘ra oladi.',
      e_title: '3–80 belgi yozing',
      e_category: 'Toifani tanlang',
      e_value: '1 000 so‘mdan 1 mlrd so‘mgacha',
      e_platforms: 'Kamida bitta platformani tanlang',
      e_format: 'Formatni yozing',
      e_minFollowers: '0 dan 10 000 000 gacha',
      e_days: '1 dan 90 gacha',
      e_slots: '1 dan 100 gacha',
      e_city: '40 belgidan oshmasin',
      e_description: '600 belgidan oshmasin',
      filterNew: 'Yangi',
      filterAll: 'Hammasi',
      emptyRequests: 'Hozircha so‘rov yo‘q. Blogerlar so‘rov yuborsa, shu yerda va botda ko‘rinadi.',
      emptyRequestsNew: 'Yangi so‘rov yo‘q. Ko‘rib chiqilganlari “Hammasi” bo‘limida.',
      accept: 'Qabul qilish',
      reject: 'Rad etish',
      openProfile: 'Profilni ochish',
      rejectConfirm: 'So‘rov rad etilsinmi? Blogerga xabar boradi.',
      acceptedToast: 'Qabul qilindi. Blogerga aloqa ma’lumotlaringiz yuborildi.',
      rejectedToast: 'Rad etildi',
      notTelegramTitle: 'Ilovani Telegramda oching',
      notTelegramText: 'Bu Ovoza botining mini ilovasi. Uni botdagi “Ilovani ochish” tugmasi orqali oching.',
      unregisteredTitle: 'Avval ro‘yxatdan o‘ting',
      unregisteredText: 'Botga /start yozing va bir nechta savolga javob bering. Shundan keyin ilova to‘liq ishlaydi.',
      toBot: 'Botga qaytish',
      authErrorTitle: 'Kirib bo‘lmadi',
      authErrorText: 'Ilovani yopib, botdan qayta oching.',
      loadErrorTitle: 'Yuklab bo‘lmadi',
      loadErrorText: 'Internet aloqasini tekshirib, qayta urinib ko‘ring.',
      retry: 'Qayta urinish',
      err_network: 'Internet aloqasini tekshirib, qayta urinib ko‘ring.',
      err_server: 'Serverda xatolik. Birozdan keyin qayta urinib ko‘ring.',
      err_unauthorized: 'Sessiya eskirgan. Ilovani yopib, qayta oching.',
      err_not_registered: 'Avval botda ro‘yxatdan o‘ting.',
      err_forbidden: 'Bu amal siz uchun emas.',
      err_not_found: 'Topilmadi. Ehtimol, yopilgan.',
      err_invalid: 'Ma’lumotlarni tekshiring.',
      err_campaign_closed: 'E’lon yopilgan.',
      err_campaign_full: 'O‘rinlar to‘lgan.',
      err_already_applied: 'Bu e’longa allaqachon so‘rov yuborgansiz.',
      err_already_decided: 'Bu so‘rov bo‘yicha qaror allaqachon qabul qilingan.',
      err_followers_low: (d) => `Bu e’lon uchun kamida ${fmt(d.min)} obunachi kerak.`,
      err_too_many_campaigns: (d) => `Bir vaqtda ${d.limit} tadan ortiq faol e’lon bo‘lmaydi. Eskisini yoping.`,
      err_image_invalid: 'Bu fayl rasm emas yoki buzilgan. JPG yoki PNG rasm tanlang.',
      err_image_too_large: (d) => `Rasm ${d.limitMb || 5} MB dan katta bo‘lmasin.`,
      err_image_failed: 'Rasmni yuklab bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.',
      err_image_read: 'Bu rasmni ochib bo‘lmadi. Boshqa rasm tanlang.',
      err_image_shape: 'Rasm juda uzun yoki juda tor. Boshqa rasm tanlang.'
    },
    ru: {
      currency: 'сум',
      roleBusiness: 'Бизнес',
      roleBlogger: 'Блогер',
      nav: 'Разделы',
      back: 'Назад',
      tabBrowse: 'Объявления',
      tabMine: 'Мои отклики',
      tabMyCampaigns: 'Мои объявления',
      tabRequests: 'Отклики',
      browseTitle: 'Рекламные объявления',
      mineTitle: 'Мои отклики',
      myCampaignsTitle: 'Мои объявления',
      requestsTitle: 'Отклики',
      search: 'Поиск',
      searchPh: 'Товар, магазин или город',
      categories: 'Категории',
      allCats: 'Все',
      platform: 'Платформа',
      allPlatforms: 'Все платформы',
      emptyBrowse: 'Пока нет активных объявлений. Новые появятся здесь.',
      emptyFiltered: 'По этим фильтрам объявлений нет.',
      slotsLeft: (n) => `Осталось мест: ${n}`,
      full: 'Мест нет',
      value: 'Стоимость продукта',
      format: 'Формат',
      requirement: 'Требование',
      deadline: 'Срок',
      slots: 'Свободные места',
      platforms: 'Платформы',
      description: 'Описание',
      followersMin: (n) => `от ${fmt(n)} подписчиков`,
      noRequirement: 'Без требований',
      days: (n) => {
        const m10 = n % 10;
        const m100 = n % 100;
        const word = m10 === 1 && m100 !== 11 ? 'день' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'дня' : 'дней';
        return `${n} ${word}`;
      },
      slotsOf: (left, total) => `${left} / ${total}`,
      statusPending: 'На рассмотрении',
      statusAccepted: 'Принят',
      statusRejected: 'Отклонён',
      yourStatus: 'Статус отклика',
      messageLabel: 'Сообщение бизнесу',
      optional: 'необязательно',
      messagePh: 'Почему вы подходите? Например, расскажите об аудитории.',
      apply: 'Откликнуться',
      applied: 'Отклик отправлен',
      unavailable: 'Отклики не принимаются',
      applySent: 'Отклик отправлен. Ответ придёт в бот.',
      emptyMine: 'Вы ещё не отправляли отклики. Выберите объявление в разделе «Объявления».',
      toBrowse: 'Смотреть объявления',
      waiting: 'Ждём ответа бизнеса. Ответ придёт в бот.',
      rejectedNote: 'В этот раз отклонено. Посмотрите другие объявления.',
      contactBusiness: 'Свяжитесь с бизнесом',
      contactBlogger: 'Свяжитесь с блогером',
      newCampaign: 'Новое объявление',
      newShort: 'Создать',
      emptyMyCampaigns: 'У вас ещё нет объявлений. Разместите первое: блогеры увидят его и откликнутся.',
      active: 'Активно',
      closed: 'Закрыто',
      acceptedOf: (a, s) => `Принято: ${a} / ${s}`,
      pendingN: (n) => `Новых откликов: ${n}`,
      closeCampaign: 'Закрыть',
      reopenCampaign: 'Открыть снова',
      viewRequests: 'Отклики',
      closeConfirm: 'Закрытое объявление блогеры не увидят. Закрыть?',
      campaignClosed: 'Объявление закрыто',
      campaignReopened: 'Объявление снова открыто',
      fTitle: 'Товар или услуга',
      fTitlePh: 'Например, натуральный крем для лица',
      fCategory: 'Категория',
      choose: 'Выберите',
      fValue: 'Стоимость продукта, сум',
      fValuePh: '150 000',
      fPlatforms: 'Платформы',
      fFormat: 'Формат рекламы',
      fFormatPh: 'Например, 1 Reels + 2 Stories',
      fMin: 'Минимум подписчиков',
      fMinHint: '0 — без требований',
      fDays: 'Срок, дней',
      fSlots: 'Число блогеров',
      fCity: 'Город',
      fCityPh: 'Например, Ташкент',
      fDesc: 'Описание',
      fDescPh: 'О товаре, условиях и доставке',
      fImage: 'Фото',
      imageAdd: 'Добавить фото',
      imageHint: 'Объявления с фото привлекают больше внимания',
      imageChange: 'Заменить',
      imageRemove: 'Удалить',
      imageRemoveConfirm: 'Удалить фото?',
      imageUploading: 'Фото загружается…',
      imageSaved: 'Фото сохранено',
      imageRemoved: 'Фото удалено',
      imageAfterFail: 'Объявление размещено, но фото не загрузилось. Добавьте его снова на странице объявления.',
      publishing: 'Размещаем…',
      publish: 'Разместить объявление',
      published: 'Объявление размещено. Блогеры уже видят его.',
      e_title: 'От 3 до 80 символов',
      e_category: 'Выберите категорию',
      e_value: 'От 1 000 сум до 1 млрд сум',
      e_platforms: 'Выберите хотя бы одну платформу',
      e_format: 'Укажите формат',
      e_minFollowers: 'От 0 до 10 000 000',
      e_days: 'От 1 до 90',
      e_slots: 'От 1 до 100',
      e_city: 'Не больше 40 символов',
      e_description: 'Не больше 600 символов',
      filterNew: 'Новые',
      filterAll: 'Все',
      emptyRequests: 'Пока откликов нет. Когда блогеры откликнутся, они появятся здесь и в боте.',
      emptyRequestsNew: 'Новых откликов нет. Просмотренные — во вкладке «Все».',
      accept: 'Принять',
      reject: 'Отклонить',
      openProfile: 'Открыть профиль',
      rejectConfirm: 'Отклонить отклик? Блогер получит уведомление.',
      acceptedToast: 'Принято. Блогеру отправлены ваши контакты.',
      rejectedToast: 'Отклонено',
      notTelegramTitle: 'Откройте приложение в Telegram',
      notTelegramText: 'Это мини-приложение бота Ovoza. Откройте его кнопкой «Открыть приложение» в боте.',
      unregisteredTitle: 'Сначала пройдите регистрацию',
      unregisteredText: 'Напишите боту /start и ответьте на несколько вопросов. После этого приложение заработает полностью.',
      toBot: 'Вернуться в бот',
      authErrorTitle: 'Не удалось войти',
      authErrorText: 'Закройте приложение и откройте его снова из бота.',
      loadErrorTitle: 'Не удалось загрузить',
      loadErrorText: 'Проверьте интернет и попробуйте ещё раз.',
      retry: 'Повторить',
      err_network: 'Проверьте интернет и попробуйте ещё раз.',
      err_server: 'Ошибка сервера. Попробуйте чуть позже.',
      err_unauthorized: 'Сессия устарела. Закройте и снова откройте приложение.',
      err_not_registered: 'Сначала пройдите регистрацию в боте.',
      err_forbidden: 'Это действие вам недоступно.',
      err_not_found: 'Не найдено. Возможно, объявление закрыто.',
      err_invalid: 'Проверьте данные.',
      err_campaign_closed: 'Объявление закрыто.',
      err_campaign_full: 'Мест не осталось.',
      err_already_applied: 'Вы уже откликнулись на это объявление.',
      err_already_decided: 'По этому отклику решение уже принято.',
      err_followers_low: (d) => `Для этого объявления нужно от ${fmt(d.min)} подписчиков.`,
      err_too_many_campaigns: (d) => `Одновременно можно держать не больше ${d.limit} активных объявлений. Закройте старое.`,
      err_image_invalid: 'Файл не похож на изображение. Выберите фото JPG или PNG.',
      err_image_too_large: (d) => `Фото должно быть не больше ${d.limitMb || 5} МБ.`,
      err_image_failed: 'Не удалось загрузить фото. Попробуйте чуть позже.',
      err_image_read: 'Не удалось открыть это фото. Выберите другое.',
      err_image_shape: 'Фото слишком вытянутое. Выберите другое.'
    }
  };

  /* ---------- Holat ---------- */
  const state = {
    lang: 'uz',
    user: null,
    meta: null,
    role: null,
    tab: null,
    view: null, // null | { name: 'detail', id } | { name: 'new' }
    filters: { category: '', platform: '', q: '' },
    data: { campaigns: null, mine: null, myCampaigns: null, requests: null },
    detail: null,
    form: null,
    errors: {},
    requestFilter: 'pending',
    scroll: {},
    busy: false,
    imageBusy: false // e'lon sahifasida rasm yuklanmoqda
  };

  /* ---------- Yordamchilar ---------- */
  function t(key, ...args) {
    const dict = TEXT[state.lang] || TEXT.uz;
    const value = key in dict ? dict[key] : TEXT.uz[key];
    if (typeof value === 'function') return value(...args);
    return value ?? key;
  }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
  const money = (n) => `${fmt(n)} ${t('currency')}`;
  const catName = (id) => state.meta?.categories.find((c) => c.id === id)?.[state.lang] ?? id ?? '';
  // Bloger yo'nalishi; eski profillarda biznes toifasi bo'lishi mumkin
  const nicheName = (id) => state.meta?.niches?.find((n) => n.id === id)?.[state.lang] ?? catName(id);
  const initial = (name) => (String(name || '?').trim()[0] || '?').toUpperCase();

  function followersLabel(id) {
    const f = state.meta?.followers.find((x) => x.id === id);
    if (!f) return id || '';
    return f.max ? `${fmt(f.min)} – ${fmt(f.max)}` : `${fmt(f.min)}+`;
  }

  function date(ts) {
    const d = new Date(ts * 1000);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  }

  const supports = (version) => Boolean(tg?.isVersionAtLeast?.(version));

  function haptic(type) {
    try {
      tg?.HapticFeedback?.notificationOccurred(type);
    } catch {
      /* eski versiyalarda yo'q */
    }
  }

  let toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 3200);
  }

  function confirmAction(message) {
    return new Promise((resolve) => {
      if (supports('6.2') && tg.showConfirm) {
        try {
          tg.showConfirm(message, (ok) => resolve(Boolean(ok)));
          return;
        } catch {
          /* pastdagi oddiy oynaga o'tamiz */
        }
      }
      resolve(window.confirm(message));
    });
  }

  function openLink(url) {
    if (!url) return;
    if (/^https:\/\/t\.me\//.test(url) && tg?.openTelegramLink) tg.openTelegramLink(url);
    else if (tg?.openLink) tg.openLink(url);
    else window.open(url, '_blank', 'noopener');
  }

  // body — JSON qilib yuboriladi, blob — xom fayl (rasm)
  async function api(path, { method = 'GET', body, blob } = {}) {
    let res;
    try {
      res = await fetch(path, {
        method,
        headers: {
          'x-telegram-init-data': tg?.initData || '',
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...(blob ? { 'content-type': blob.type || 'application/octet-stream' } : {})
        },
        body: blob || (body ? JSON.stringify(body) : undefined)
      });
    } catch {
      throw Object.assign(new Error('network'), { code: 'network', data: {} });
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* bo'sh javob */
    }
    if (!res.ok) {
      const code = data?.error || (res.status >= 500 ? 'server' : 'invalid');
      throw Object.assign(new Error(code), { code, data: data || {} });
    }
    return data;
  }

  const errorText = (e) => {
    const key = `err_${e.code}`;
    const dict = TEXT[state.lang] || TEXT.uz;
    return key in dict ? t(key, e.data || {}) : t('err_server');
  };

  /* ---------- Rasmlar ---------- */
  const IMAGE_MAX_SIDE = 1280;

  const imageError = (code) => Object.assign(new Error(code), { code, data: {} });

  // Tanlangan rasmni kichraytiradi va JPEG qiladi: tez yuklanadi, trafik kam ketadi
  async function prepareImage(file) {
    if (!file || (file.type && !file.type.startsWith('image/'))) throw imageError('image_invalid');
    const src = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(imageError('image_read'));
        el.src = src;
      });
      const w0 = img.naturalWidth;
      const h0 = img.naturalHeight;
      if (!w0 || !h0) throw imageError('image_read');
      if (Math.max(w0, h0) / Math.min(w0, h0) > 20) throw imageError('image_shape'); // Telegram cheklovi
      const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(w0, h0));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w0 * scale));
      canvas.height = Math.max(1, Math.round(h0 * scale));
      const g = canvas.getContext('2d');
      g.fillStyle = '#ffffff'; // shaffof PNG qora bo'lib qolmasin
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!blob) throw imageError('image_read');
      return blob;
    } finally {
      URL.revokeObjectURL(src);
    }
  }

  // target: 'form' (yangi e'lon) yoki 'detail' (mavjud e'lon)
  const fileInput = (target) =>
    `<input type="file" class="sr-only" accept="image/jpeg,image/png,image/webp,image/*" data-image="${target}">`;

  function imagePickerHTML(target) {
    return `<label class="img-pick">${fileInput(target)}${icon('image')}<span>${esc(t('imageAdd'))}</span><small>${esc(t('imageHint'))}</small></label>`;
  }

  function imageEditorHTML(target, src, alt) {
    const busy = target === 'detail' && state.imageBusy;
    return `<figure class="img-figure ${busy ? 'is-busy' : ''}">
      <img class="detail-img" src="${esc(src)}" alt="${esc(alt)}">
      ${busy ? `<div class="img-overlay" role="status"><div class="spinner"></div><span>${esc(t('imageUploading'))}</span></div>` : ''}
      <figcaption class="btn-row img-actions">
        <label class="btn btn-quiet btn-sm">${fileInput(target)}${icon('image')}<span>${esc(t('imageChange'))}</span></label>
        <button type="button" class="btn btn-quiet btn-sm" data-act="image-remove" data-target="${target}" ${busy ? 'disabled' : ''}>${esc(t('imageRemove'))}</button>
      </figcaption>
    </figure>`;
  }

  /* ---------- Ikonkalar ---------- */
  const ICONS = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5.5 5h13L21 13v6H3v-6z"/>',
    megaphone: '<path d="M3 11v2a2 2 0 0 0 2 2h1l5 4V5L6 9H5a2 2 0 0 0-2 2z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    send: '<path d="M21 3 3 10.5l7 2.5 2.5 7zM21 3 10 13"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'
  };

  const icon = (name) =>
    `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  const logo = (cls = '') =>
    `<svg class="${cls}" viewBox="0 0 36 36" aria-hidden="true"><rect class="lm-bg" width="36" height="36" rx="11"/><circle class="lm-dot" cx="14" cy="18" r="5"/><path class="lm-wave" d="M21 12.5a8 8 0 0 1 0 11M25.5 9a13 13 0 0 1 0 18" fill="none" stroke-width="2.6" stroke-linecap="round"/></svg>`;

  /* ---------- Umumiy bloklar ---------- */
  const statusPill = (status) => {
    const key = { pending: 'statusPending', accepted: 'statusAccepted', rejected: 'statusRejected' }[status];
    return `<span class="pill pill-${esc(status)}">${esc(t(key))}</span>`;
  };

  const skeleton = (n = 3) =>
    Array.from({ length: n }, () => '<div class="card skeleton" aria-hidden="true"><span></span><span></span><span></span></div>').join('');

  const emptyHTML = (text, iconName, action = '') =>
    `<div class="empty"><span class="empty-icon">${icon(iconName)}</span><p>${esc(text)}</p>${action}</div>`;

  function contactHTML(title, { name, phone, username }) {
    const tel = phone ? phone.replace(/\s/g, '') : '';
    return `<div class="contact">
      <span class="contact-title">${esc(title)}</span>
      ${name ? `<span class="contact-row">${icon('user')}<span>${esc(name)}</span></span>` : ''}
      ${phone ? `<a class="contact-row" href="tel:${esc(tel)}">${icon('phone')}<span>${esc(phone)}</span></a>` : ''}
      ${username ? `<button type="button" class="contact-row" data-act="link" data-url="https://t.me/${esc(username)}">${icon('send')}<span>@${esc(username)}</span></button>` : ''}
    </div>`;
  }

  /* ---------- Ekranlar ---------- */
  function header() {
    const showBack = state.view && !(supports('6.1') && tg.BackButton);
    const back = showBack ? `<button type="button" class="icon-btn" data-act="back" aria-label="${esc(t('back'))}">${icon('back')}</button>` : '';
    const role = state.role === 'business' ? t('roleBusiness') : t('roleBlogger');
    return `<header class="top">${back}<div class="brand">${logo()}<span>Ovoza</span></div><span class="role-chip">${esc(role)}</span></header>`;
  }

  function tabBar() {
    const pending = state.data.requests ? state.data.requests.filter((r) => r.status === 'pending').length : 0;
    const tabs =
      state.role === 'business'
        ? [['campaigns', t('tabMyCampaigns'), 'megaphone', 0], ['requests', t('tabRequests'), 'inbox', pending]]
        : [['browse', t('tabBrowse'), 'search', 0], ['mine', t('tabMine'), 'inbox', 0]];
    const buttons = tabs
      .map(([id, label, ic, badge]) =>
        `<button type="button" class="tab" data-act="tab" data-tab="${id}" ${state.tab === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${esc(label)}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</button>`)
      .join('');
    return `<nav class="tabbar" aria-label="${esc(t('nav'))}"><div class="tabbar-inner">${buttons}</div></nav>`;
  }

  // Bloger: reklama e'lonlari ro'yxati
  function browseHTML() {
    const cats = [{ id: '', label: t('allCats') }, ...state.meta.categories.map((c) => ({ id: c.id, label: c[state.lang] }))];
    const platformOptions = state.meta.platforms
      .map((p) => `<option value="${esc(p)}" ${state.filters.platform === p ? 'selected' : ''}>${esc(p)}</option>`)
      .join('');
    return `
      <h1 class="view-title">${esc(t('browseTitle'))}</h1>
      <div class="filters">
        <label class="search">${icon('search')}<span class="sr-only">${esc(t('search'))}</span>
          <input id="f-q" class="control" type="search" enterkeyhint="search" autocomplete="off" placeholder="${esc(t('searchPh'))}" value="${esc(state.filters.q)}">
        </label>
        <div class="chips" id="f-cats" role="group" aria-label="${esc(t('categories'))}">
          ${cats.map((c) => `<button type="button" class="chip" data-act="cat" data-id="${c.id}" aria-pressed="${state.filters.category === c.id}">${esc(c.label)}</button>`).join('')}
        </div>
        <select id="f-platform" class="control" aria-label="${esc(t('platform'))}">
          <option value="">${esc(t('allPlatforms'))}</option>${platformOptions}
        </select>
      </div>
      <div class="main-list" id="list">${browseListHTML()}</div>`;
  }

  function browseListHTML() {
    const list = state.data.campaigns;
    if (!list) return skeleton(3);
    const filtered = state.filters.q || state.filters.category || state.filters.platform;
    if (!list.length) return emptyHTML(filtered ? t('emptyFiltered') : t('emptyBrowse'), 'search');
    return list.map(campaignCardHTML).join('');
  }

  // Kartadagi rasm (sarlavha pastda yozilgani uchun alt bo'sh)
  const cardImage = (c) =>
    c.image ? `<img class="card-img" src="${esc(c.image.thumb)}" alt="" loading="lazy" decoding="async">` : '';

  function campaignCardHTML(c) {
    let status = `<span class="slots">${esc(t('slotsLeft', c.left))}</span>`;
    if (c.myStatus) status = statusPill(c.myStatus);
    else if (c.left <= 0) status = `<span class="pill pill-muted">${esc(t('full'))}</span>`;
    const where = [c.businessName, c.city].filter(Boolean).join(' · ');
    return `<a class="card card-link" href="?c=${c.id}" data-act="open" data-id="${c.id}">
      ${cardImage(c)}
      <div class="row"><span class="tag">${esc(catName(c.category))}</span>${status}</div>
      <h3>${esc(c.title)}</h3>
      ${where ? `<p class="muted">${esc(where)}</p>` : ''}
      <div class="row"><span class="value">${money(c.value)}</span><span class="platforms">${c.platforms.map((p) => `<span>${esc(p)}</span>`).join('')}</span></div>
    </a>`;
  }

  // Bloger: yuborilgan so'rovlar
  function mineHTML() {
    const list = state.data.mine;
    const title = `<h1 class="view-title">${esc(t('mineTitle'))}</h1>`;
    if (!list) return title + skeleton(2);
    if (!list.length) {
      return title + emptyHTML(t('emptyMine'), 'inbox', `<button type="button" class="btn btn-primary" data-act="tab" data-tab="browse">${esc(t('toBrowse'))}</button>`);
    }
    return title + list.map((a) => {
      let footer = `<p class="muted">${esc(t('waiting'))}</p>`;
      if (a.status === 'accepted' && a.contact) footer = contactHTML(t('contactBusiness'), a.contact);
      if (a.status === 'rejected') footer = `<p class="muted">${esc(t('rejectedNote'))}</p>`;
      const thumb = a.campaign.image
        ? `<img class="thumb" src="${esc(a.campaign.image.thumb)}" alt="" loading="lazy" decoding="async">`
        : '';
      return `<article class="card">
        <div class="row"><span class="muted">${esc(a.campaign.businessName)}</span>${statusPill(a.status)}</div>
        <div class="title-row">${thumb}<h3>${esc(a.campaign.title)}</h3></div>
        <div class="row"><span class="value">${money(a.campaign.value)}</span><span class="muted">${esc(a.campaign.format)}</span></div>
        ${footer}
        <span class="muted small">${date(a.createdAt)}</span>
      </article>`;
    }).join('');
  }

  // Biznes: o'z reklama e'lonlari
  function myCampaignsHTML() {
    const list = state.data.myCampaigns;
    const head = `<div class="head-row"><h1 class="view-title">${esc(t('myCampaignsTitle'))}</h1>
      <button type="button" class="btn btn-primary btn-sm" data-act="new" aria-label="${esc(t('newCampaign'))}">${icon('plus')}<span>${esc(t('newShort'))}</span></button></div>`;
    if (!list) return head + skeleton(2);
    if (!list.length) {
      return head + emptyHTML(t('emptyMyCampaigns'), 'megaphone', `<button type="button" class="btn btn-primary" data-act="new">${esc(t('newCampaign'))}</button>`);
    }
    return head + list.map((c) => `
      <a class="card card-link" href="?c=${c.id}" data-act="open" data-id="${c.id}">
        ${cardImage(c)}
        <div class="row"><span class="tag">${esc(catName(c.category))}</span><span class="pill pill-${c.status}">${esc(t(c.status))}</span></div>
        <h3>${esc(c.title)}</h3>
        <div class="row"><span class="value">${money(c.value)}</span><span class="muted">${esc(t('acceptedOf', c.accepted, c.slots))}</span></div>
        ${c.pending ? `<span class="pending-note">${esc(t('pendingN', c.pending))}</span>` : ''}
      </a>`).join('');
  }

  // Biznes: kelgan so'rovlar
  function requestsHTML() {
    const list = state.data.requests;
    const title = `<h1 class="view-title">${esc(t('requestsTitle'))}</h1>`;
    if (!list) return title + skeleton(2);
    const pending = list.filter((r) => r.status === 'pending');
    const seg = `<div class="seg" role="tablist">
      <button type="button" role="tab" data-act="req-filter" data-id="pending" aria-selected="${state.requestFilter === 'pending'}">${esc(t('filterNew'))}${pending.length ? ` · ${pending.length}` : ''}</button>
      <button type="button" role="tab" data-act="req-filter" data-id="all" aria-selected="${state.requestFilter === 'all'}">${esc(t('filterAll'))}</button>
    </div>`;
    if (!list.length) return title + emptyHTML(t('emptyRequests'), 'inbox');
    const shown = state.requestFilter === 'pending' ? pending : list;
    if (!shown.length) return title + seg + emptyHTML(t('emptyRequestsNew'), 'check');
    return title + seg + shown.map(requestCardHTML).join('');
  }

  function requestCardHTML(r) {
    const b = r.blogger;
    const actions =
      r.status === 'pending'
        ? `<div class="btn-row">
            <button type="button" class="btn btn-primary" data-act="decide" data-id="${r.id}" data-decision="accept">${esc(t('accept'))}</button>
            <button type="button" class="btn btn-quiet" data-act="decide" data-id="${r.id}" data-decision="reject">${esc(t('reject'))}</button>
          </div>`
        : '';
    const contact = r.status === 'accepted' ? contactHTML(t('contactBlogger'), { phone: b.phone, username: b.username }) : '';
    const profile = b.profileUrl
      ? `<button type="button" class="link-btn" data-act="link" data-url="${esc(b.profileUrl)}">${icon('link')}<span>${esc(t('openProfile'))}</span></button>`
      : `<span class="muted">${esc(b.profile)}</span>`;
    return `<article class="card">
      <div class="row"><span class="muted">${esc(r.campaign.title)}</span>${statusPill(r.status)}</div>
      <div class="person"><span class="ava">${esc(initial(b.name))}</span>
        <div><strong>${esc(b.name)}</strong>${b.username ? `<span class="muted">@${esc(b.username)}</span>` : ''}</div>
      </div>
      <div class="facts"><span>${esc(b.platform)} · ${esc(followersLabel(b.followers))}</span><span>${esc(nicheName(b.niche))}</span></div>
      ${profile}
      ${r.message ? `<blockquote class="quote">${esc(r.message)}</blockquote>` : ''}
      ${actions}${contact}
      <span class="muted small">${date(r.createdAt)}</span>
    </article>`;
  }

  // Reklama e'loni sahifasi
  function detailHTML() {
    const c = state.detail;
    if (!c) return skeleton(1);
    const where = [c.businessName, c.city].filter(Boolean).join(' · ');
    const rows = [
      [t('format'), c.format],
      [t('requirement'), c.minFollowers > 0 ? t('followersMin', c.minFollowers) : t('noRequirement')],
      [t('deadline'), t('days', c.days)],
      [t('slots'), t('slotsOf', c.left, c.slots)],
      [t('platforms'), c.platforms.join(', ')]
    ];
    let top = `<span class="slots">${esc(t('slotsLeft', c.left))}</span>`;
    if (c.own) top = `<span class="pill pill-${c.status}">${esc(t(c.status))}</span>`;
    else if (c.myStatus) top = statusPill(c.myStatus);
    else if (c.left <= 0) top = `<span class="pill pill-muted">${esc(t('full'))}</span>`;

    const canApply = state.role === 'blogger' && !c.myStatus && c.status === 'active' && c.left > 0;
    const applyField = canApply
      ? `<div class="field">
          <label for="apply-msg">${esc(t('messageLabel'))}<span class="opt">${esc(t('optional'))}</span></label>
          <textarea id="apply-msg" class="control" data-keep maxlength="300" placeholder="${esc(t('messagePh'))}"></textarea>
        </div>`
      : '';
    const status = c.myStatus ? `<div class="notice"><span>${esc(t('yourStatus'))}:</span>${statusPill(c.myStatus)}</div>` : '';
    const ownStats = c.own
      ? `<div class="notice"><span>${esc(t('acceptedOf', c.accepted, c.slots))}</span>${c.pending ? `<span class="pending-note">${esc(t('pendingN', c.pending))}</span>` : ''}</div>`
      : '';

    let image = '';
    if (c.own) image = c.image ? imageEditorHTML('detail', c.image.url, c.title) : imagePickerHTML('detail');
    else if (c.image) image = `<img class="detail-img" src="${esc(c.image.url)}" alt="${esc(c.title)}">`;
    if (c.own && !c.image && state.imageBusy) {
      image = `<div class="img-pick is-busy" role="status"><div class="spinner"></div><span>${esc(t('imageUploading'))}</span></div>`;
    }

    return `<article class="detail">
      ${image}
      <div class="row"><span class="tag">${esc(catName(c.category))}</span>${top}</div>
      <h1 class="detail-title">${esc(c.title)}</h1>
      ${where ? `<p class="muted">${esc(where)}</p>` : ''}
      <div class="value-box"><span>${esc(t('value'))}</span><strong>${money(c.value)}</strong></div>
      <dl class="card meta">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${c.description ? `<section class="card"><h2 class="card-title">${esc(t('description'))}</h2><p class="pre">${esc(c.description)}</p></section>` : ''}
      ${ownStats}${status}${applyField}
    </article>`;
  }

  function detailActions() {
    const c = state.detail;
    if (!c) return '';
    if (c.own) {
      const toggle =
        c.status === 'active'
          ? `<button type="button" class="btn btn-quiet" data-act="campaign-status" data-status="closed">${esc(t('closeCampaign'))}</button>`
          : `<button type="button" class="btn btn-secondary" data-act="campaign-status" data-status="active">${esc(t('reopenCampaign'))}</button>`;
      return `${toggle}<button type="button" class="btn btn-primary" data-act="tab" data-tab="requests">${esc(t('viewRequests'))}</button>`;
    }
    if (state.role !== 'blogger') return '';
    if (c.myStatus) return `<button type="button" class="btn btn-secondary" disabled>${icon('check')}<span>${esc(t('applied'))}</span></button>`;
    if (c.status !== 'active' || c.left <= 0) return `<button type="button" class="btn btn-quiet" disabled>${esc(t('unavailable'))}</button>`;
    return `<button type="button" class="btn btn-primary" data-act="apply">${esc(t('apply'))}</button>`;
  }

  // Yangi reklama e'loni formasi
  function newHTML() {
    const f = state.form;
    const e = state.errors;
    const field = (name, label, control, extra = '') =>
      `<div class="field ${e[name] ? 'err' : ''}" data-field="${name}">
        ${label}${control}${e[name] ? `<span class="err-text">${esc(t(`e_${name}`))}</span>` : extra}
      </div>`;
    const lbl = (id, text, opt = false) => `<label for="${id}">${esc(text)}${opt ? `<span class="opt">${esc(t('optional'))}</span>` : ''}</label>`;
    const categories = state.meta.categories
      .map((c) => `<option value="${c.id}" ${f.category === c.id ? 'selected' : ''}>${esc(c[state.lang])}</option>`)
      .join('');
    const platforms = state.meta.platforms
      .map((p) => `<button type="button" class="chip" data-act="toggle-platform" data-id="${esc(p)}" aria-pressed="${f.platforms.includes(p)}">${esc(p)}</button>`)
      .join('');

    return `<h1 class="view-title">${esc(t('newCampaign'))}</h1>
      <form class="form card" id="campaign-form" novalidate>
        <div class="field">
          <span class="label">${esc(t('fImage'))}<span class="opt">${esc(t('optional'))}</span></span>
          ${f.image ? imageEditorHTML('form', f.image.url, f.title) : imagePickerHTML('form')}
        </div>
        ${field('title', lbl('nc-title', t('fTitle')), `<input id="nc-title" class="control" maxlength="80" placeholder="${esc(t('fTitlePh'))}" value="${esc(f.title)}">`)}
        ${field('category', lbl('nc-category', t('fCategory')), `<select id="nc-category" class="control"><option value="" ${f.category ? '' : 'selected'} disabled>${esc(t('choose'))}</option>${categories}</select>`)}
        ${field('value', lbl('nc-value', t('fValue')), `<input id="nc-value" class="control" inputmode="numeric" autocomplete="off" placeholder="${esc(t('fValuePh'))}" value="${esc(f.value)}">`)}
        ${field('platforms', `<span class="label">${esc(t('fPlatforms'))}</span>`, `<div class="toggles" role="group">${platforms}</div>`)}
        ${field('format', lbl('nc-format', t('fFormat')), `<input id="nc-format" class="control" maxlength="80" placeholder="${esc(t('fFormatPh'))}" value="${esc(f.format)}">`)}
        <div class="grid-2">
          ${field('days', lbl('nc-days', t('fDays')), `<input id="nc-days" class="control" inputmode="numeric" autocomplete="off" value="${esc(f.days)}">`)}
          ${field('slots', lbl('nc-slots', t('fSlots')), `<input id="nc-slots" class="control" inputmode="numeric" autocomplete="off" value="${esc(f.slots)}">`)}
        </div>
        ${field('minFollowers', lbl('nc-min', t('fMin')), `<input id="nc-min" class="control" inputmode="numeric" autocomplete="off" value="${esc(f.minFollowers)}">`, `<span class="hint">${esc(t('fMinHint'))}</span>`)}
        ${field('city', lbl('nc-city', t('fCity'), true), `<input id="nc-city" class="control" maxlength="40" placeholder="${esc(t('fCityPh'))}" value="${esc(f.city)}">`)}
        ${field('description', lbl('nc-desc', t('fDesc'), true), `<textarea id="nc-desc" class="control" maxlength="600" placeholder="${esc(t('fDescPh'))}">${esc(f.description)}</textarea>`)}
      </form>`;
  }

  /* ---------- Chizish ---------- */
  function render() {
    // Yozilayotgan matnni saqlab qolamiz
    const keep = {};
    root.querySelectorAll('[data-keep]').forEach((el) => {
      keep[el.id] = el.value;
    });

    let body;
    let bottom;
    if (state.view?.name === 'detail') {
      body = detailHTML();
      const actions = detailActions();
      bottom = actions ? `<div class="actionbar"><div class="actionbar-inner">${actions}</div></div>` : '';
    } else if (state.view?.name === 'new') {
      body = newHTML();
      const label = state.busy ? t('publishing') : t('publish');
      bottom = `<div class="actionbar"><div class="actionbar-inner"><button type="button" class="btn btn-primary" data-act="create" ${state.busy ? 'disabled' : ''}>${esc(label)}</button></div></div>`;
    } else {
      body = { browse: browseHTML, mine: mineHTML, campaigns: myCampaignsHTML, requests: requestsHTML }[state.tab]();
      bottom = tabBar();
    }

    root.innerHTML = `${header()}<main class="main">${body}</main>${bottom}`;
    Object.entries(keep).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });
    syncBackButton();
  }

  function renderList() {
    const list = document.getElementById('list');
    if (list && !state.view && state.tab === 'browse') list.innerHTML = browseListHTML();
    else render();
  }

  function screen(kind) {
    const button =
      kind === 'unregistered'
        ? `<button type="button" class="btn btn-primary" data-act="close-app">${esc(t('toBot'))}</button>`
        : kind === 'loadError'
          ? `<button type="button" class="btn btn-primary" data-act="retry">${esc(t('retry'))}</button>`
          : '';
    root.innerHTML = `<div class="screen"><div class="screen-card">
      ${logo('screen-logo')}
      <h1>${esc(t(`${kind}Title`))}</h1>
      <p>${esc(t(`${kind}Text`))}</p>
      ${button}
    </div></div>`;
    syncBackButton();
  }

  function syncBackButton() {
    if (!supports('6.1') || !tg.BackButton) return;
    if (state.view) tg.BackButton.show();
    else tg.BackButton.hide();
  }

  /* ---------- Ma'lumot yuklash ---------- */
  let campaignsRequest = 0;

  async function loadCampaigns() {
    const token = ++campaignsRequest;
    const params = new URLSearchParams();
    if (state.filters.category) params.set('category', state.filters.category);
    if (state.filters.platform) params.set('platform', state.filters.platform);
    if (state.filters.q.trim()) params.set('q', state.filters.q.trim());
    try {
      const data = await api(`/api/campaigns?${params}`);
      if (token !== campaignsRequest) return; // eskirgan javob
      state.data.campaigns = data.campaigns;
      renderList();
    } catch (e) {
      if (token === campaignsRequest) toast(errorText(e));
    }
  }

  async function loadTab({ silent = false } = {}) {
    const tab = state.tab;
    try {
      if (tab === 'browse') return loadCampaigns();
      if (tab === 'mine') state.data.mine = (await api('/api/my/applications')).applications;
      if (tab === 'campaigns') state.data.myCampaigns = (await api('/api/my/campaigns')).campaigns;
      if (tab === 'requests') state.data.requests = (await api('/api/requests')).requests;
      if (state.tab === tab && !state.view) render();
    } catch (e) {
      if (!silent) toast(errorText(e));
    }
    return undefined;
  }

  // Biznes uchun: pastki paneldagi yangi so'rovlar sonini yangilash
  async function loadRequestsBadge() {
    try {
      state.data.requests = (await api('/api/requests')).requests;
      if (!state.view) render();
    } catch {
      /* belgi muhim emas */
    }
  }

  /* ---------- Harakatlar ---------- */
  function switchTab(tab) {
    if (!state.view && state.tab === tab) {
      window.scrollTo(0, 0);
      return;
    }
    state.tab = tab;
    state.view = null;
    state.detail = null;
    render();
    window.scrollTo(0, 0);
    loadTab();
  }

  async function openDetail(id) {
    const list = [...(state.data.campaigns || []), ...(state.data.myCampaigns || [])];
    state.scroll[state.tab] = window.scrollY;
    state.view = { name: 'detail', id };
    state.detail = list.find((c) => c.id === id) || null;
    render();
    window.scrollTo(0, 0);
    try {
      const data = await api(`/api/campaigns/${id}`);
      if (state.view?.name === 'detail' && state.view.id === id) {
        state.detail = data.campaign;
        render();
      }
    } catch (e) {
      toast(errorText(e));
      if (e.code === 'not_found') goBack();
    }
  }

  function goBack() {
    if (!state.view) return;
    state.view = null;
    state.detail = null;
    state.errors = {};
    render();
    window.scrollTo(0, state.scroll[state.tab] || 0);
    loadTab({ silent: true });
  }

  function openNew() {
    state.scroll[state.tab] = window.scrollY;
    state.view = { name: 'new' };
    state.form = state.form || {
      title: '', category: '', value: '', platforms: ['Instagram'], format: '', minFollowers: '0', days: '7', slots: '3', city: '', description: ''
    };
    state.errors = {};
    render();
    window.scrollTo(0, 0);
  }

  function readForm() {
    const val = (id) => document.getElementById(id)?.value ?? '';
    Object.assign(state.form, {
      title: val('nc-title').trim(),
      category: val('nc-category'),
      value: val('nc-value'),
      format: val('nc-format').trim(),
      minFollowers: val('nc-min'),
      days: val('nc-days'),
      slots: val('nc-slots'),
      city: val('nc-city').trim(),
      description: val('nc-desc').trim()
    });
  }

  const digits = (v) => {
    const s = String(v ?? '').replace(/[\s ]/g, '');
    return /^\d+$/.test(s) ? Number(s) : NaN;
  };

  function validateForm(f) {
    const errors = {};
    const inRange = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
    if (f.title.length < 3 || f.title.length > 80) errors.title = true;
    if (!f.category) errors.category = true;
    if (!inRange(digits(f.value), 1000, 1000000000)) errors.value = true;
    if (!f.platforms.length) errors.platforms = true;
    if (f.format.length < 2 || f.format.length > 80) errors.format = true;
    const min = f.minFollowers === '' ? 0 : digits(f.minFollowers);
    if (!inRange(min, 0, 10000000)) errors.minFollowers = true;
    if (!inRange(digits(f.days), 1, 90)) errors.days = true;
    if (!inRange(digits(f.slots), 1, 100)) errors.slots = true;
    if (f.city.length > 40) errors.city = true;
    if (f.description.length > 600) errors.description = true;
    return errors;
  }

  function focusFirstError() {
    const first = root.querySelector('.field.err');
    if (!first) return;
    first.scrollIntoView({ block: 'center' });
    first.querySelector('input, select, textarea')?.focus({ preventScroll: true });
  }

  async function submitCampaign(button) {
    if (state.busy) return;
    readForm();
    const f = state.form;
    state.errors = validateForm(f);
    if (Object.keys(state.errors).length) {
      haptic('error');
      render();
      focusFirstError();
      return;
    }
    state.busy = true;
    button.disabled = true;
    button.textContent = t('publishing');
    try {
      const created = await api('/api/campaigns', {
        method: 'POST',
        body: {
          title: f.title,
          category: f.category,
          value: digits(f.value),
          platforms: f.platforms,
          format: f.format,
          minFollowers: f.minFollowers === '' ? 0 : digits(f.minFollowers),
          days: digits(f.days),
          slots: digits(f.slots),
          city: f.city,
          description: f.description
        }
      });
      // Rasm alohida yuklanadi. U yuklanmasa ham e'lon joylangan bo'ladi.
      let imageFailed = false;
      if (f.image) {
        try {
          await api(`/api/campaigns/${created.campaign.id}/image`, { method: 'PUT', blob: f.image.blob });
        } catch {
          imageFailed = true;
        }
        URL.revokeObjectURL(f.image.url);
      }
      haptic(imageFailed ? 'warning' : 'success');
      toast(imageFailed ? t('imageAfterFail') : t('published'));
      state.form = null;
      state.view = null;
      state.tab = 'campaigns';
      state.data.myCampaigns = null;
      render();
      window.scrollTo(0, 0);
      loadTab();
    } catch (e) {
      haptic('error');
      if (e.code === 'invalid' && Array.isArray(e.data.fields)) {
        state.errors = Object.fromEntries(e.data.fields.map((name) => [name, true]));
        state.busy = false; // tugma qayta faol chizilsin
        render();
        focusFirstError();
      } else {
        toast(errorText(e));
        button.disabled = false;
        button.textContent = t('publish');
      }
    } finally {
      state.busy = false;
    }
  }

  // Rasm tanlandi: yangi e'lon formasida saqlab turiladi, mavjud e'longa darhol yuklanadi
  async function onImagePicked(input) {
    const file = input.files?.[0];
    const target = input.dataset.image;
    input.value = '';
    if (!file) return;
    if (target === 'form') readForm();
    let blob;
    try {
      blob = await prepareImage(file);
    } catch (e) {
      haptic('error');
      toast(errorText(e));
      return;
    }

    if (target === 'form') {
      if (state.view?.name !== 'new' || !state.form) return;
      if (state.form.image) URL.revokeObjectURL(state.form.image.url);
      state.form.image = { blob, url: URL.createObjectURL(blob) };
      render();
      return;
    }

    const c = state.detail;
    if (!c?.own || state.imageBusy) return;
    state.imageBusy = true;
    render();
    try {
      const data = await api(`/api/campaigns/${c.id}/image`, { method: 'PUT', blob });
      if (state.detail?.id === c.id) state.detail = data.campaign;
      state.data.myCampaigns = null;
      haptic('success');
      toast(t('imageSaved'));
    } catch (e) {
      haptic('error');
      toast(errorText(e));
    } finally {
      state.imageBusy = false;
      if (state.view?.name === 'detail') render();
    }
  }

  async function removeImage(target, button) {
    if (target === 'form') {
      readForm();
      if (state.form?.image) URL.revokeObjectURL(state.form.image.url);
      if (state.form) state.form.image = null;
      render();
      return;
    }
    const c = state.detail;
    if (!c?.own || state.imageBusy || state.busy) return;
    if (!(await confirmAction(t('imageRemoveConfirm')))) return;
    state.busy = true;
    button.disabled = true;
    try {
      const data = await api(`/api/campaigns/${c.id}/image`, { method: 'DELETE' });
      if (state.detail?.id === c.id) state.detail = data.campaign;
      state.data.myCampaigns = null;
      haptic('success');
      toast(t('imageRemoved'));
      render();
    } catch (e) {
      haptic('error');
      toast(errorText(e));
      button.disabled = false;
    } finally {
      state.busy = false;
    }
  }

  async function submitApply(button) {
    const c = state.detail;
    if (!c || state.busy) return;
    state.busy = true;
    button.disabled = true;
    const message = document.getElementById('apply-msg')?.value.trim() || '';
    try {
      await api(`/api/campaigns/${c.id}/apply`, { method: 'POST', body: { message } });
      haptic('success');
      toast(t('applySent'));
      state.detail = { ...c, myStatus: 'pending' };
      const inList = state.data.campaigns?.find((x) => x.id === c.id);
      if (inList) inList.myStatus = 'pending';
      state.data.mine = null;
      render();
    } catch (e) {
      haptic('error');
      toast(errorText(e));
      button.disabled = false;
      if (['already_applied', 'campaign_full', 'campaign_closed'].includes(e.code)) openDetail(c.id);
    } finally {
      state.busy = false;
    }
  }

  async function decideRequest(id, decision, button) {
    if (state.busy) return;
    if (decision === 'reject' && !(await confirmAction(t('rejectConfirm')))) return;
    state.busy = true;
    button.disabled = true;
    try {
      await api(`/api/applications/${id}/decision`, { method: 'POST', body: { decision } });
      haptic('success');
      toast(decision === 'accept' ? t('acceptedToast') : t('rejectedToast'));
      state.data.requests = (await api('/api/requests')).requests;
      state.data.myCampaigns = null;
      render();
    } catch (e) {
      haptic('error');
      toast(errorText(e));
      await loadTab({ silent: true });
    } finally {
      state.busy = false;
    }
  }

  async function changeCampaignStatus(status, button) {
    const c = state.detail;
    if (!c || state.busy) return;
    if (status === 'closed' && !(await confirmAction(t('closeConfirm')))) return;
    state.busy = true;
    button.disabled = true;
    try {
      const data = await api(`/api/campaigns/${c.id}`, { method: 'PATCH', body: { status } });
      state.detail = data.campaign;
      state.data.myCampaigns = null;
      haptic('success');
      toast(status === 'closed' ? t('campaignClosed') : t('campaignReopened'));
      render();
    } catch (e) {
      haptic('error');
      toast(errorText(e));
      button.disabled = false;
    } finally {
      state.busy = false;
    }
  }

  /* ---------- Hodisalar ---------- */
  let searchTimer;

  root.addEventListener('click', (event) => {
    const el = event.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    if (el.tagName === 'A') event.preventDefault();
    const id = Number(el.dataset.id);
    switch (el.dataset.act) {
      case 'tab':
        switchTab(el.dataset.tab);
        break;
      case 'cat':
        state.filters.category = el.dataset.id;
        root.querySelectorAll('#f-cats .chip').forEach((chip) => chip.setAttribute('aria-pressed', String(chip === el)));
        loadCampaigns();
        break;
      case 'open':
        openDetail(id);
        break;
      case 'back':
        goBack();
        break;
      case 'apply':
        submitApply(el);
        break;
      case 'new':
        openNew();
        break;
      case 'toggle-platform': {
        readForm();
        const p = el.dataset.id;
        const list = state.form.platforms;
        state.form.platforms = list.includes(p) ? list.filter((x) => x !== p) : [...list, p];
        el.setAttribute('aria-pressed', String(state.form.platforms.includes(p)));
        break;
      }
      case 'create':
        submitCampaign(el);
        break;
      case 'decide':
        decideRequest(id, el.dataset.decision, el);
        break;
      case 'campaign-status':
        changeCampaignStatus(el.dataset.status, el);
        break;
      case 'req-filter':
        state.requestFilter = el.dataset.id;
        render();
        break;
      case 'image-remove':
        removeImage(el.dataset.target, el);
        break;
      case 'link':
        openLink(el.dataset.url);
        break;
      case 'close-app':
        if (tg?.close) tg.close();
        break;
      case 'retry':
        boot();
        break;
      default:
        break;
    }
  });

  root.addEventListener('input', (event) => {
    if (event.target.id === 'f-q') {
      state.filters.q = event.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadCampaigns, 300);
    }
  });

  root.addEventListener('change', (event) => {
    if (event.target.matches('input[data-image]')) {
      onImagePicked(event.target);
      return;
    }
    if (event.target.id === 'f-platform') {
      state.filters.platform = event.target.value;
      loadCampaigns();
    }
    if (event.target.id === 'nc-value') {
      const n = digits(event.target.value);
      if (Number.isInteger(n)) event.target.value = fmt(n);
    }
  });

  root.addEventListener('submit', (event) => event.preventDefault());

  // Rasm ochilmasa (masalan, o'chirilgan bo'lsa) bo'sh joy qolmasin
  root.addEventListener(
    'error',
    (event) => {
      if (event.target.tagName === 'IMG' && !event.target.src.startsWith('blob:')) event.target.classList.add('img-broken');
    },
    true
  );

  /* ---------- Ishga tushirish ---------- */
  function applyTheme() {
    const dark = tg?.colorScheme ? tg.colorScheme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.scheme = dark ? 'dark' : 'light';
    if (supports('6.1')) {
      try {
        tg.setHeaderColor('secondary_bg_color');
        tg.setBackgroundColor('secondary_bg_color');
      } catch {
        /* e'tiborsiz */
      }
    }
  }

  let started = false;

  async function boot() {
    applyTheme();
    const code = tg?.initDataUnsafe?.user?.language_code || navigator.language || '';
    state.lang = code.toLowerCase().startsWith('ru') ? 'ru' : 'uz';
    document.documentElement.lang = state.lang;

    if (tg && !started) {
      started = true;
      tg.ready();
      tg.expand();
      try {
        if (supports('7.7')) tg.disableVerticalSwipes();
      } catch {
        /* e'tiborsiz */
      }
      tg.onEvent?.('themeChanged', applyTheme);
      if (supports('6.1') && tg.BackButton) tg.BackButton.onClick(goBack);
    }

    if (!tg?.initData) {
      screen('notTelegram');
      return;
    }

    root.innerHTML = '<div class="screen"><div class="spinner"></div></div>';
    try {
      const me = await api('/api/me');
      state.user = me.user;
      state.meta = me.meta;
      state.lang = me.user.lang === 'ru' ? 'ru' : 'uz';
      document.documentElement.lang = state.lang;
      if (!me.registered) {
        screen('unregistered');
        return;
      }
      state.role = me.user.role;
      const tabs = state.role === 'business' ? ['campaigns', 'requests'] : ['browse', 'mine'];
      const wanted = new URLSearchParams(window.location.search).get('tab');
      state.tab = tabs.includes(wanted) ? wanted : tabs[0];
      render();
      await loadTab();
      if (state.role === 'business' && state.tab !== 'requests') loadRequestsBadge();
    } catch (e) {
      screen(e.code === 'unauthorized' ? 'authError' : 'loadError');
    }
  }

  boot();
})();
