# Miqyos — Claude uchun loyiha qo‘llanmasi

Miqyos — O‘zbekistondagi bizneslar va blogerlarni barter asosida bog‘laydigan platforma.

Platforma avval **Ovoza** deb atalgan, 2026-11-11 da Miqyos'ga o‘zgartirildi (Ovoza nomli telekanal va boshqa loyihalar bor edi). Foydalanuvchiga ko‘rinadigan joylarda faqat "Miqyos" yozing. Texnik nomlar ataylab eskicha qoldirilgan, ularni o‘zgartirmang: `ovoza-db` (D1), `ovoza-bot` (Worker va uning manzili), `ovoza-webhook:` va `ovoza-sheets:` kalit tuzlari, `ovoza_admin` cookie, `x-ovoza-admin`, `ovoza-lang` / `ovoza-filters-v1` (brauzer xotirasi), `OVOZA_*` / `OvozaXlsx` JS nomlari. Ularni o‘zgartirsangiz bot, webhook, jadval yoki saqlangan sozlamalar buziladi. Domen (ovozagroup.uz) miqyos.uz sotib olingach alohida almashtiriladi.

Bot 2026-11-14 da @Ovozauz_bot dan **@miqyosbot** ga ko‘chdi. Eski bot shu Worker'da yo‘naltiruvchi bo‘lib qoladi (`bot/src/oldbot.js`, tafsiloti `bot/README.md` dagi "Eski botdan ko‘chish" bo‘limida).

Birinchi chatning tarixi (nima so‘ralgan, nima qilingan, raqobatchilar tahlili, keyingi g‘oyalar): `docs/chat-tarixi.md`.

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

- Tokenlar faqat GitHub secretlarida: `MIQYOS_BOT_TOKEN` (asosiy bot), `TELEGRAM_BOT_TOKEN` (eski @Ovozauz_bot), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ADMIN_IDS`. Ularni chatga yozdirmang, chiqarmang, logga yozmang. Foydalanuvchi tokenni chatga yuborsa, uni yangilashni (revoke) maslahat bering.
- Admin panelga kirish havolasi faqat `ADMIN_IDS` dagilarga va faqat inline tugmada yuboriladi, matnda emas.

## Loyiha tuzilishi

- **Sayt** (repo ildizi): `index.html`, `privacy.html`, `assets/`. Manzil: https://ovozagroup.uz/ (GitHub Pages, ildizdagi `CNAME` fayli). `sayt-yangilash.yml` `main` ni `gh-pages` ga ko‘chiradi, shuning uchun `CNAME` `main` da turishi shart.
- **Bot** (`bot/`): Cloudflare Workers + D1. Manzil: https://ovoza-bot.axborotmarkazi-uz.workers.dev, Telegram bot: @miqyosbot (eski @Ovozauz_bot yangisiga yo‘naltiradi).
  - `src/index.js` — marshrutlar. `bot.js` — Telegram xabarlari va ro‘yxatdan o‘tish. `api.js` — mini ilova API (Telegram initData HMAC). `admin.js` — admin panel API va kirish. `services.js` — moderatsiya, bildirishnomalar, umumiy logika. `db.js` — SQL. `i18n.js` — barcha matnlar (uz/ru). `images.js` — rasmlar (Telegram `file_id`, proksi). `constants.js` — hududlar, yo‘nalishlar va boshqalar. `broadcast.js` — yangi e’lon haqida blogerlarga xabar (cron har daqiqada, `index.js` dagi `scheduled`). `sheets.js` — yangi bloger/biznesni agentlar jadvaliga (Google Sheets, Apps Script `SHEETS_URL`) yozish. `oldbot.js` — eski botdan ko‘chish: yo‘naltirish, rasmlarni ko‘chirish, eski foydalanuvchilarga bir martalik xabar.
  - Apps Script yoki boshqa xizmat botning webhook'ini hech qachon o‘zgartirmasin (`setWebhook`): webhook faqat shu Worker'ga qaraydi, aks holda bot ishlamay qoladi.
  - `public/` — mini ilova (`index.html`, `app.js`, `app.css`). `public/admin/` — admin panel (`/admin/`), `xlsx.js` — Excel fayl yasash (brauzerda). `public/_headers` — admin uchun xavfsizlik sarlavhalari.
  - Cloudflare bepul tarifi: bitta so‘rov yoki cron ishga tushishida 50 tagacha tashqi so‘rov (Telegram fetch + D1 so‘rovlari) va qisqa protsessor vaqti. Ko‘p foydalanuvchiga tegadigan ishni bo‘lib-bo‘lib qiling (masalan, `broadcast.js` dagi navbat).
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
- `runCron(env)` cron'ni bir marta ishga tushiradi. `tg.failChat(id, 403 | 429)` — shu chatga xabar xato qaytaradi.
- Kompyuter: Windows, `Desktop\Loyiha\Sarvarbek-` papkasi (Git, Node, `gh` o‘rnatilgan). PowerShell'da PATH eskirgan bo‘lsa, uni registrdan qayta o‘qing. Admin panelni brauzerda ko‘rish uchun Worker'ni Node'da test yordamchilari bilan `http.createServer` orqali ishga tushirish mumkin.
- Soxta Telegram haqiqiysi kabi rasmli xabarda `editMessageText` ni rad etadi.
- `fmtNum` oddiy bo‘shliq o‘rniga NBSP qo‘yadi, shuning uchun test regexlarida `\s` ishlating.
- UI o‘zgarsa, brauzerda tekshiring. Playwright o‘rnatilgan, `require('playwright')` orqali chaqiriladi. Worker'ni Node'da test yordamchilari bilan dev server qilib ishga tushiring. 390px va 1280px kenglikda, yorug‘ va qorong‘i rejimda ko‘ring.
- Sandbox `workers.dev` ga ulana olmaydi. Deploy natijasini GitHub Actions loglaridan tekshiring.
- Bitta buyruqda jarayonni ishga tushirib, keyin uni `pkill -f` bilan to‘xtatmang: shell o‘zini o‘ldirib qo‘yadi. PID ni alohida topib, `kill` qiling.
