# Ovoza — Claude uchun loyiha qo‘llanmasi

Ovoza — O‘zbekistondagi bizneslar va blogerlarni barter asosida bog‘laydigan platforma.

## Foydalanuvchi bilan ishlash

- Javoblar **o‘zbekcha**, qisqa, telefonda o‘qishga qulay: natija birinchi, keyin tafsilot. Foydalanuvchi dasturchi emas, texnik so‘zlarni kam ishlating.
- **Ish oqimi (foydalanuvchi oldindan ruxsat bergan, har safar so‘ramang):**
  1. `claude/...` branchda ishlash, testlar, commit, push.
  2. PR ochish va CI ("Testlar") yashil bo‘lishini kutish.
  3. PR ni **o‘zingiz merge qiling** (merge commit). Foydalanuvchi "doim avtomatik bo‘lsin" degan.
  4. `main` dagi "Bot" workflow'ini tekshiring: migratsiya qo‘llandi, "Cloudflare'ga joylash" va "Telegramga ulash" muvaffaqiyatli.
  5. Foydalanuvchiga o‘zbekcha qisqa hisobot: nima o‘zgardi, botda qanday sinab ko‘rish mumkin.
- Merge qilingan PR branchini qayta ishlatmang. Yangi ish uchun branchni `origin/main` dan qayta boshlang.
- Talab noaniq bo‘lsa, aqlli standart tanlang va javobda ayting. Faqat chindan muhim qarorlarda savol bering.

## Xavfsizlik

- Tokenlar faqat GitHub secretlarida: `TELEGRAM_BOT_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ADMIN_IDS`. Ularni chatga yozdirmang, chiqarmang, logga yozmang. Foydalanuvchi tokenni chatga yuborsa, uni yangilashni (revoke) maslahat bering.
- Admin panelga kirish havolasi faqat `ADMIN_IDS` dagilarga va faqat inline tugmada yuboriladi, matnda emas.

## Loyiha tuzilishi

- **Sayt** (repo ildizi): `index.html`, `privacy.html`, `assets/`. GitHub Pages: https://macrus-ai.github.io/Sarvarbek-/. `sayt-yangilash.yml` `main` ni `gh-pages` ga ko‘chiradi.
- **Bot** (`bot/`): Cloudflare Workers + D1. Manzil: https://ovoza-bot.axborotmarkazi-uz.workers.dev, Telegram bot: @Ovozauz_bot.
  - `src/index.js` — marshrutlar. `bot.js` — Telegram xabarlari va ro‘yxatdan o‘tish. `api.js` — mini ilova API (Telegram initData HMAC). `admin.js` — admin panel API va kirish. `services.js` — moderatsiya, bildirishnomalar, umumiy logika. `db.js` — SQL. `i18n.js` — barcha matnlar (uz/ru). `images.js` — rasmlar (Telegram `file_id`, proksi). `constants.js` — hududlar, yo‘nalishlar va boshqalar.
  - `public/` — mini ilova (`index.html`, `app.js`, `app.css`). `public/admin/` — admin panel (`/admin/`). `public/_headers` — admin uchun xavfsizlik sarlavhalari.
  - `migrations/000N_*.sql` — sxema o‘zgarsa, yangi fayl qo‘shiladi. Deploy uni o‘zi qo‘llaydi.
  - `bot/README.md` — mahsulotning to‘liq tavsifi. Funksiya o‘zgarsa, README ham yangilanadi.
- `.github/workflows/bot.yml` — testlar, `wrangler deploy --dry-run`, `main` da esa migratsiya, deploy va `/setup`.

## Asosiy qoidalar (mahsulot)

- Yangi bloger, biznes va reklama e’loni **moderatsiyadan** o‘tadi (`moderation`: `pending` / `approved` / `rejected`). E’lon tasdiqlanmaguncha blogerlarga ko‘rinmaydi. Rad etilgan e’lon yopiladi.
- Moderatsiya kartalari Telegram guruhlariga keladi. Guruhlar `/ulash`, `/ulash bloger`, `/ulash biznes`, `/ulash elon` bilan ulanadi. Guruh bo‘lmasa, kartalar `ADMIN_IDS` ga shaxsan keladi.
- Blogerning Telegrami va telefoni biznesga faqat so‘rov qabul qilingandan keyin ko‘rinadi. Undan oldin profil havolasi va statistika ko‘rinadi.
- Biznesda "Ma’lumotlarni yangilash" yo‘q, o‘rniga "🗑 Biznesni o‘chirish" bor: hamma narsa o‘chadi, keyin qayta ro‘yxatdan o‘tiladi.
- Admin panel: botga `/admin` yuboriladi. Bir martalik havola 10 daqiqa amal qiladi, sessiya 30 kun.

## Test va tekshiruv

- `cd bot && npm install && npm test`. Node 22 yoki yangisi kerak. Testlar `node:test` da, D1 o‘rniga `node:sqlite`, Telegram esa `test/helpers.js` dagi soxta Telegram.
- `registerBlogger`, `registerBusiness` va `createCampaign` yordamchilari avtomatik tasdiqlaydi. Moderatsiyada qoldirish uchun `{ approve: false }` bering.
- Soxta Telegram haqiqiysi kabi rasmli xabarda `editMessageText` ni rad etadi.
- `fmtNum` oddiy bo‘shliq o‘rniga NBSP qo‘yadi, shuning uchun test regexlarida `\s` ishlating.
- UI o‘zgarsa, brauzerda tekshiring. Playwright o‘rnatilgan, `require('playwright')` orqali chaqiriladi. Worker'ni Node'da test yordamchilari bilan dev server qilib ishga tushiring. 390px va 1280px kenglikda, yorug‘ va qorong‘i rejimda ko‘ring.
- Sandbox `workers.dev` ga ulana olmaydi. Deploy natijasini GitHub Actions loglaridan tekshiring.
- Bitta buyruqda jarayonni ishga tushirib, keyin uni `pkill -f` bilan to‘xtatmang: shell o‘zini o‘ldirib qo‘yadi. PID ni alohida topib, `kill` qiling.
