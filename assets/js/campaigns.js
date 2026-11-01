/* Ovoza — namuna reklama e'lonlari va toifalar.
   Haqiqiy e'lonlar paydo bo'lganda shu ro'yxatni yangilang (yoki serverdan yuklang). */
window.OVOZA_DATA = {
  categories: [
    { id: 'beauty', uz: 'Go‘zallik', ru: 'Красота' },
    { id: 'food', uz: 'Oziq-ovqat va kafe', ru: 'Еда и кафе' },
    { id: 'clothes', uz: 'Kiyim', ru: 'Одежда' },
    { id: 'kids', uz: 'Bolalar uchun', ru: 'Детям' },
    { id: 'tech', uz: 'Texnika', ru: 'Техника' },
    { id: 'home', uz: 'Uy-ro‘zg‘or', ru: 'Для дома' },
    { id: 'services', uz: 'Xizmatlar', ru: 'Услуги' }
  ],

  // value — mahsulot qiymati (so'm), minFollowers — kerakli obunachilar, days — kontent muddati,
  // slots — jami o'rinlar, taken — band qilingan o'rinlar
  campaigns: [
    {
      id: 'c1', cat: 'beauty',
      title: { uz: 'Tabiiy yuz kremlari to‘plami', ru: 'Набор натуральных кремов для лица' },
      seller: { uz: 'Tabiiy kosmetika do‘koni', ru: 'Магазин натуральной косметики' },
      city: { uz: 'Toshkent', ru: 'Ташкент' },
      value: 180000, platforms: ['Instagram'],
      format: { uz: '1 Reels + 2 Stories', ru: '1 Reels + 2 Stories' },
      minFollowers: 5000, days: 7, slots: 5, taken: 2
    },
    {
      id: 'c2', cat: 'food',
      title: { uz: 'Ikki kishilik kechki ovqat', ru: 'Ужин на двоих' },
      seller: { uz: 'Milliy taomlar kafesi', ru: 'Кафе национальной кухни' },
      city: { uz: 'Samarqand', ru: 'Самарканд' },
      value: 250000, platforms: ['Instagram', 'TikTok'],
      format: { uz: '1 ta video sharh', ru: '1 видеообзор' },
      minFollowers: 3000, days: 5, slots: 3, taken: 1
    },
    {
      id: 'c3', cat: 'clothes',
      title: { uz: 'Qishki kurtka', ru: 'Зимняя куртка' },
      seller: { uz: 'Onlayn kiyim do‘koni', ru: 'Интернет-магазин одежды' },
      city: { uz: 'Toshkent', ru: 'Ташкент' },
      value: 650000, platforms: ['Instagram'],
      format: { uz: '1 post + 3 Stories', ru: '1 пост + 3 Stories' },
      minFollowers: 10000, days: 10, slots: 2, taken: 0
    },
    {
      id: 'c4', cat: 'kids',
      title: { uz: 'Rivojlantiruvchi o‘yinchoqlar', ru: 'Развивающие игрушки' },
      seller: { uz: 'Marketpleysdagi bolalar tovarlari sotuvchisi', ru: 'Продавец детских товаров на маркетплейсе' },
      city: { uz: 'Toshkent', ru: 'Ташкент' },
      value: 220000, platforms: ['Instagram', 'Telegram'],
      format: { uz: 'Unboxing video + marketpleysda sharh', ru: 'Распаковка + отзыв на маркетплейсе' },
      minFollowers: 2000, days: 7, slots: 6, taken: 3
    },
    {
      id: 'c5', cat: 'tech',
      title: { uz: 'Simsiz quloqchinlar', ru: 'Беспроводные наушники' },
      seller: { uz: 'Gadjetlar do‘koni', ru: 'Магазин гаджетов' },
      city: { uz: 'Namangan', ru: 'Наманган' },
      value: 420000, platforms: ['YouTube', 'TikTok'],
      format: { uz: 'Shorts formatida sharh', ru: 'Обзор в формате Shorts' },
      minFollowers: 8000, days: 14, slots: 4, taken: 1
    },
    {
      id: 'c6', cat: 'services',
      title: { uz: 'Soch turmagi va parvarish', ru: 'Стрижка и уход за волосами' },
      seller: { uz: 'Go‘zallik saloni', ru: 'Салон красоты' },
      city: { uz: 'Buxoro', ru: 'Бухара' },
      value: 300000, platforms: ['Instagram'],
      format: { uz: '1 Reels', ru: '1 Reels' },
      minFollowers: 3000, days: 7, slots: 3, taken: 0
    },
    {
      id: 'c7', cat: 'home',
      title: { uz: 'Oshxona idishlari to‘plami', ru: 'Набор кухонной посуды' },
      seller: { uz: 'Uy-ro‘zg‘or buyumlari do‘koni', ru: 'Магазин товаров для дома' },
      city: { uz: 'Farg‘ona', ru: 'Фергана' },
      value: 380000, platforms: ['Telegram', 'Instagram'],
      format: { uz: 'Telegram post + 2 Stories', ru: 'Пост в Telegram + 2 Stories' },
      minFollowers: 4000, days: 10, slots: 4, taken: 2
    },
    {
      id: 'c8', cat: 'services',
      title: { uz: 'Ingliz tili kursi, 1 oy', ru: 'Курс английского, 1 месяц' },
      seller: { uz: 'O‘quv markazi', ru: 'Учебный центр' },
      city: { uz: 'Toshkent', ru: 'Ташкент' },
      value: 500000, platforms: ['Telegram', 'YouTube'],
      format: { uz: 'Kanal posti + 1 video', ru: 'Пост в канале + 1 видео' },
      minFollowers: 5000, days: 30, slots: 5, taken: 1
    },
    {
      id: 'c9', cat: 'food',
      title: { uz: 'Sport ozuqasi to‘plami', ru: 'Набор спортивного питания' },
      seller: { uz: 'Sport ozuqa do‘koni', ru: 'Магазин спортивного питания' },
      city: { uz: 'Andijon', ru: 'Андижан' },
      value: 340000, platforms: ['TikTok', 'Instagram'],
      format: { uz: '2 ta TikTok video', ru: '2 видео в TikTok' },
      minFollowers: 6000, days: 14, slots: 3, taken: 0
    }
  ]
};
