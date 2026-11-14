# Miqyos Telegram boti va mini ilovasi

Bizneslar va blogerlar botda ro‘yxatdan o‘tadi. Bizneslar botdagi mini ilovaga reklama e’loni joylaydi, blogerlar ko‘rib so‘rov yuboradi, so‘rovlar esa bizneslarga shu bot orqali keladi.

## Qanday ishlaydi

1. **Ro‘yxatdan o‘tish (bot ichida).** `/start` → til (o‘zbekcha / ruscha) → "Biznes egasiman" yoki "Blogerman".
   - **Biznes:** ism, do‘kon yoki kompaniya nomi, toifa, telefon ("Raqamni yuborish" tugmasi).
   - **Bloger:** ism, asosiy tarmoq, profil havolasi ("Instagram profilingiz havolasini yuboring"; @username ham bo‘ladi, bot uni to‘liq havolaga aylantiradi va boshqa saytning havolasini qabul qilmaydi), obunachilar soni, ko‘rishlar (pastga qarang), statistika skrinshoti (ixtiyoriy), yo‘nalish (21 ta variant, oxirgisi "Boshqa"), auditoriyasi joylashgan hudud (14 ta hudud), telefon.
   - **Bloger ko‘rishlari (oraliq tugmalar bilan).** Instagram blogeridan to‘rtta savol, shu tartibda: Reels o‘rtacha ko‘rishlari, Postlar o‘rtacha ko‘rishlari, Istoriya (storis) o‘rtacha ko‘rishlari, Qamrov — oxirgi 30 kunda qamrab olingan akkauntlar (Instagram statistikasidagi "Qamrab olingan akkauntlar" / "Accounts reached"; 5 000 gacha … 1 000 000+). Telegram, TikTok va YouTube blogeridan bitta savol: postlar (Telegram) yoki videolar (TikTok, YouTube) o‘rtacha ko‘rishlari. Hamma joyda (moderatsiya kartasi, admin panel, biznesga keladigan so‘rov, mini ilova) aniq nom bilan ko‘rinadi: "Reels (o‘rtacha)", "Postlar (o‘rtacha)", "Istoriya (o‘rtacha)", "Qamrov (30 kun)"; boshqa platformalarda "Postlar (o‘rtacha)" yoki "Videolar (o‘rtacha)". Bloger Instagramdan boshqa tarmoqqa o‘tsa, Instagram ko‘rsatkichlari o‘chiriladi.
   - **Eski Instagram blogerlari** (bu yangilanishdan oldin ro‘yxatdan o‘tganlar) da reels, postlar va qamrov bo‘sh: moderatsiya kartasi va admin panelda "kiritilmagan" deb chiqadi, avvalgi birlashgan "Reels va postlar" qiymati esa "Reels va postlar (eski)" deb ko‘rsatiladi (yangi reels yoki postlar kiritilgach ko‘rinmaydi). Ularga xabar yuborilmaydi; "✏️ Ma’lumotlarni yangilash" orqali o‘zlari to‘ldirishi mumkin. Bazada: `reach` (Instagramda istoriya), `reels_views`, `posts_views`, `accounts_reached`, eski `reels_reach` (migratsiya `0008`).
2. **Biznes** mini ilovada reklama e’loni joylaydi: rasm (ixtiyoriy), mahsulot, toifa, hudud (yoki butun O‘zbekiston), qiymati, platformalar, format, kerakli obunachilar, muddat, blogerlar soni.
3. **Bloger** mini ilovada reklama e’lonlarini ko‘radi va so‘rov yuboradi. Filtrlar: qidiruv, toifa, hudud (standart holatda blogerning o‘z hududi va butun O‘zbekiston uchun e’lonlar), platforma, saralash (yangilari yoki qimmatroq) va "Faqat menga moslari" (obunachilar talabi, hudud, bo‘sh o‘rin va hali so‘rov yuborilmaganlar). Filtrlar blogerning qurilmasida eslab qolinadi.
4. **Biznesga botda xabar keladi**, xabarda "✅ Qabul qilish" va "❌ Rad etish" tugmalari bor. Xuddi shuni mini ilovadagi "So‘rovlar" bo‘limida ham qilish mumkin. U yerda so‘rovlarni holat (yangi, qabul qilingan, hammasi), e’lon va blogerning hududi bo‘yicha filtrlash, obunachilar soni bo‘yicha saralash mumkin.
5. **Blogerga javob botda keladi.** So‘rov qabul qilinsa, biznesning telefoni va Telegrami yuboriladi. Biznes ham blogerning telefonini ko‘radi.

Qo‘shimcha:
- Bo‘sh o‘rinlar soni hisobga olinadi: o‘rin to‘lsa, yangi so‘rov qabul qilinmaydi.
- Auditoriya hududi yo‘q eski blogerlardan mini ilova uni bir marta so‘raydi.
- Blogerning obunachilari e’lon talabidan kam bo‘lsa, so‘rov yuborib bo‘lmaydi.
- Biznesga kelgan so‘rovda blogerning profil havolasi, obunachilari, ko‘rishlari va qamrovi, yo‘nalishi, auditoriya hududi va statistika skrinshoti (rasm bo‘lib) bor. Blogerning Telegram profili va telefon raqami faqat so‘rov qabul qilingandan keyin ko‘rinadi.
- Ro‘yxatdan o‘tishda maxfiylik siyosatiga havola ko‘rsatiladi (saytdagi `privacy.html`, manzil `wrangler.toml` dagi `PRIVACY_URL` da).
- Bloger ma’lumotlarini botdagi "✏️ Ma’lumotlarni yangilash" tugmasi bilan yangilaydi. Biznesda bu tugma yo‘q: o‘rniga "🗑 Biznesni o‘chirish" bor. U tasdiqdan keyin biznesning profili, barcha e’lonlari va ularga kelgan so‘rovlarni o‘chiradi, so‘ng biznes qaytadan ro‘yxatdan o‘tadi va yana moderatsiyadan o‘tadi (eski e’lonlar qolmaydi).
- `/delete` foydalanuvchining profili, e’lonlari va so‘rovlarini tasdiqdan keyin butunlay o‘chiradi. `/privacy` siyosat havolasini yuboradi.

### Yangi e’lon haqida blogerlarga xabar

- E’lon tasdiqlanganda (botdagi tugma yoki admin panel; moderatorlar bo‘lmasa — joylanganda) u navbatga tushadi (`ad_broadcasts` jadvali). Cloudflare cron har daqiqada (`wrangler.toml` dagi `[triggers]`) navbatdagi blogerlarga xabar yuboradi: `src/broadcast.js`.
- **Kimga boradi:** tasdiqlangan, xabarlarni o‘chirmagan bloger; platformasi e’londa bor; auditoriya hududi e’lon hududi bilan bir xil (yoki e’lon butun O‘zbekiston uchun); obunachilari talabga yetadi (`followersOk` bilan bir xil qoida); hali so‘rov yubormagan. Biznesga va moderatsiyadagi blogerga bormaydi.
- **Xabar:** e’lon nomi, toifa, biznes, qiymati, format, muddat, hudud, kerakli obunachilar (rasm bo‘lsa — rasm bilan). Tugmalar: "👀 E’lonni ko‘rish" (mini ilovada e’lonni darhol ochadi: `/?c=ID`) va "🔕 Bunday xabarlarni o‘chirish".
- **Tezlik:** bitta ishga tushishda 15 ta bloger (`LIMITS.adNotifyBatch`): bepul tarifda bitta ishga tushishda 50 tagacha tashqi so‘rov (Telegram + D1) mumkin. Ya’ni soatiga ~900 bloger. Pullik tarifga o‘tilsa, `wrangler.toml` dagi `[vars]` ga `AD_NOTIFY_BATCH = "100"` qo‘shib tezlashtirish mumkin.
- Botni bloklagan blogerga (Telegram 403) boshqa yuborilmaydi (`notify_ads = 0`). Telegram "kuting" desa (429) yoki tarmoq xatosi bo‘lsa, navbat to‘xtaydi va keyingi daqiqada o‘sha blogerdan davom etadi.
- E’lon yopilsa, o‘rinlari to‘lsa yoki o‘chirilsa, xabarlar to‘xtaydi. Bir e’lon haqida bir marta yuboriladi (qayta ochilsa ham takrorlanmaydi).
- `/xabarlar` — bloger xabarlarni yoqadi yoki o‘chiradi. Mini ilova manzili cron uchun `/setup` da `settings.app_origin` ga yoziladi (har deployda).

### Moderatsiya

Yangi bloger va biznes ro‘yxatdan o‘tgach **moderatsiyada** turadi: ilova ochilmaydi, botda "Profilingiz moderatsiyada" xabari chiqadi. Jamoa tasdiqlagandan keyingina platformadan foydalanadi.

- Har bir yangi profil haqida jamoaga karta keladi: `#Yangi_bloger` yoki `#Yangi_biznes`. Kartada "✅ Tasdiqlash" va "❌ Rad etish" tugmalari, blogerda esa "🔗 Profilni ochish" tugmasi bor.
- Tasdiqlansa, foydalanuvchiga "Profilingiz tasdiqlandi" xabari va ilova tugmasi boradi. Rad etilsa, "Qayta yuborish" tugmasi bilan xabar boradi: ma’lumotlarni to‘g‘rilab, qayta yuborsa, yana moderatsiyaga tushadi.
- Tasdiqlangan foydalanuvchi ma’lumotlarini yangilasa, `#Profil_yangilandi` kartasi "🚫 Bloklash" tugmasi bilan keladi. Bloklangan biznesning faol e’lonlari yopiladi.
- Reklama e’lonlari ham moderatsiyadan o‘tadi: yangi e’lon `#Yangi_elon` kartasi "✅ Tasdiqlash" va "❌ Rad etish" tugmalari bilan keladi va tasdiqlanguncha blogerlarga ko‘rinmaydi. Tasdiqlangach kartada "🚫 E’lonni yopish" tugmasi qoladi. Rad etilgan e’lon yopiladi va qayta ochilmaydi. Biznesga natija botda keladi, mini ilovada e’lon holati ("Moderatsiyada", "Rad etilgan") ko‘rinadi.
- E’longa rasm qo‘shilsa, rasmning o‘zi `#Elon_rasmi` bilan keladi (moderatsiyadagi e’lonniki — tasdiqlash tugmalari bilan).
- `/moderatsiya` — tasdiq kutayotgan profillar va e’lonlar kartalarini qayta yuboradi (har bir guruhga o‘zinikini). `/stats` — foydalanuvchilar, moderatsiyadagi profillar va e’lonlar, faol e’lonlar va so‘rovlar soni.
- Bu yangilanishdan oldin ro‘yxatdan o‘tganlar tasdiqlangan hisoblanadi.

#### Moderatsiya guruhini ulash

1. Telegramda guruh oching (masalan, "Miqyos moderatsiya") va jamoangizni qo‘shing.
2. Guruhga @miqyosbot ni qo‘shing. Qo‘shgan odam `ADMIN_IDS` da bo‘lsa, guruh avtomatik ulanadi va bot "✅ Guruh ulandi" deb yozadi.
3. Agar ulanmagan bo‘lsa, guruhda `/ulash` yozing (yoki ro‘yxatdan `/ulash@miqyosbot` ni tanlang).

Har bir oqim uchun alohida guruh ham mumkin: blogerlar guruhida `/ulash bloger`, bizneslar guruhida `/ulash biznes`, reklama e’lonlari guruhida `/ulash elon`. E’lonlar guruhi ulanmagan bo‘lsa, e’lonlar bizneslar guruhiga keladi. Guruhdagi tugmalarni guruhning istalgan a’zosi bosa oladi, shuning uchun guruhga faqat jamoani qo‘shing.

Guruh ulanmagan bo‘lsa, kartalar `ADMIN_IDS` dagi adminlarga shaxsan keladi. Moderatorlar umuman bo‘lmasa (na guruh, na `ADMIN_IDS`), yangi profillar avtomatik tasdiqlanadi.

O‘z ID'ingizni bilish uchun botga `/id` yuboring.

### Admin panel (sayt)

Hamma jarayonni brauzerdan boshqarish uchun: `https://ovoza-bot.axborotmarkazi-uz.workers.dev/admin/`

**Kirish:** botga `/admin` yuboring (faqat `ADMIN_IDS` dagilar uchun), bot "🔐 Admin panelni ochish" tugmasini beradi. Havola 10 daqiqa ichida bir marta ishlaydi, brauzer 30 kun eslab qoladi. Parol yo‘q. Admin `ADMIN_IDS` dan olib tashlansa, panelga darhol kira olmaydi.

Bo‘limlar:
- **Bosh sahifa:** blogerlar, bizneslar, moderatsiyadagilar, faol e’lonlar, so‘rovlar, so‘nggi 7 kun.
- **Moderatsiya:** tasdiq kutayotgan profillar (statistika skrinshoti bilan) va e’lonlar. Tasdiqlash yoki rad etish botdagi tugmalar bilan bir xil ishlaydi: foydalanuvchiga xabar boradi.
- **Foydalanuvchilar:** qidiruv (ism, kompaniya, @username, telefon, Telegram ID), rol va holat filtri. Batafsil oynada: tasdiqlash, rad etish, bloklash, o‘chirish; biznesning e’lonlari, blogerning so‘rovlari.
- **Reklama e’lonlari:** qidiruv, moderatsiya va holat filtri; e’lonni tasdiqlash, rad etish yoki yopish, unga kelgan so‘rovlar.
- **So‘rovlar:** blogerlarning barcha so‘rovlari holati bilan.
- **Sozlamalar:** ulangan moderatsiya guruhlari (uzish mumkin), chiqish.

**Excel’ga yuklab olish** (bosh sahifa va "Foydalanuvchilar" bo‘limidagi tugma): `miqyos-YYYY-MM-DD.xlsx` fayl, to‘rt varaq — Blogerlar (barcha ko‘rsatkichlari bilan), Bizneslar, E’lonlar, So‘rovlar. Faqat ro‘yxatdan o‘tishni tugatganlar kiradi. Panel ma’lumotni `/api/admin/export/{users|campaigns|applications}?page=N` dan 500 tadan oladi, faylni esa brauzerning o‘zi yasaydi (`public/admin/xlsx.js`, tashqi kutubxonasiz): bepul tarifda serverning bitta so‘rovga protsessor vaqti qisqa. Fayl zaxira nusxa sifatida ham saqlab qo‘yish uchun qulay.

Xavfsizlik: sessiya `HttpOnly` cookie'da, bazada faqat tokenlarning xeshi saqlanadi, panel boshqa saytdan so‘rov yuborishga va ramkaga qo‘yishga yo‘l qo‘ymaydi.

### Agentlar jadvali (Google Sheets)

Botda birinchi marta ro‘yxatdan o‘tgan bloger "Ovoza kunlik agent jadvali" ning **Blogerlar** varag‘iga, biznes esa **Brendlar** varag‘iga "Yangi" holatida yoziladi (`src/sheets.js`). Manba ustunida "Telegram bot", izohda Telegram ID turadi. Profilni qayta tahrirlash yangi qator qo‘shmaydi.

- Jadval tomonida Apps Script web app ishlaydi, uning manzili `wrangler.toml` dagi `SHEETS_URL`. U qatorni qo‘shadi va egasiga Telegramda xabar beradi. `SHEETS_URL` bo‘sh bo‘lsa, hech narsa yuborilmaydi. Skript kodining nusxasi: `apps-script/Code.gs` (o‘zgartirilsa, Apps Script'ga qo‘yilib, yangi versiya deploy qilinadi, manzil o‘zgarmaydi).
- Kalit bot tokenidan hosil qilinadi (`sha256("ovoza-sheets:" + token)` ning boshidagi 48 belgi). Apps Script ham tokenni biladi, shuning uchun alohida maxfiy kalit kerak emas.
- Jadval ishlamasa ham ro‘yxatdan o‘tish to‘xtamaydi: xato faqat logga yoziladi. Cloudflare'da so‘rov javobdan keyin fonda (`waitUntil`) yuboriladi.
- Agentlar jadvalga qo‘lda qo‘shgan qatorlar haqida egasiga xabarni Apps Script o‘zi har 5 daqiqada yuboradi.
- ⚠️ Apps Script botning webhook'ini o‘zgartirmasligi kerak: Telegram'da botga faqat bitta webhook bo‘ladi va u shu Worker'ga qarashi shart.

### E’lon rasmlari

- Biznes rasmni e’lon joylashda yoki keyin e’lon sahifasida qo‘shadi, almashtiradi yoki olib tashlaydi.
- Mini ilova rasmni yuklashdan oldin 1280 px gacha kichraytiradi (JPEG). Server JPG, PNG va WEBP ni qabul qiladi, hajmi 5 MB gacha.
- Rasm Telegramga yuklanadi va Telegram serverida saqlanadi (bepul, alohida xizmat kerak emas). Biznesga botda "rasm qo‘shildi" degan tasdiq keladi. Bazada faqat rasmning `file_id` si turadi.
- Mini ilova rasmni `/img/c/<id>-<kalit>.jpg` manzilidan oladi. Worker uni Telegramdan olib beradi, bot tokeni tashqariga chiqmaydi. Kalit tasodifiy va har yangi rasmda o‘zgaradi.

### Eski botdan ko‘chish (@Ovozauz_bot → @miqyosbot)

2026-11-14 da platforma yangi botga ko‘chdi. Telegram foydalanuvchilarni bir botdan boshqasiga o‘tkazmaydi va bot foydalanuvchiga birinchi bo‘lib yoza olmaydi. Shuning uchun eski bot (`OLD_BOT_TOKEN`, GitHub'da `TELEGRAM_BOT_TOKEN`) shu Worker'da yo‘naltiruvchi bo‘lib qoladi (`src/oldbot.js`):

- Eski botga shaxsiy chatda nima yozilsa ham, "bot @miqyosbot ga ko‘chdi" degan xabar va yangi botga tugma keladi (uz/ru). Saytdagi havola parametri (`/start business-uz`) yangi botga uzatiladi. Guruhlarda eski bot jim turadi, eski tugmalarga ogohlantirish chiqaradi.
- `/setup` eski botning webhook'ini `/telegram/old-webhook` ga qo‘yadi, mini ilova tugmasi va buyruqlarini olib tashlaydi, tavsifi va nomini ("Miqyos (eski)") o‘zgartiradi.
- Ma’lumotlar saqlanadi: foydalanuvchi Telegram ID bo‘yicha taniladi, yangi botda qayta ro‘yxatdan o‘tmaydi.
- `users.bot_id`: foydalanuvchi qaysi botga yozgan. Yangi botga hali yozmaganlarga e’lon xabarlari yuborilmaydi (yuborib bo‘lmaydi) va ularning xabarlari "bloklagan" deb o‘chirilmaydi.
- Rasmlar (statistika skrinshotlari, e’lon rasmlari) eski botning `file_id` si bilan saqlangan, yangi bot ularni o‘qiy olmaydi. Cron har daqiqada bittadan rasmni eski botdan olib, yangi bot orqali birinchi adminning (`ADMIN_IDS`) chatiga ovozsiz yuklaydi, darhol o‘chiradi va bazadagi `file_id` ni almashtiradi. Buning uchun admin @miqyosbot da `/start` bosgan bo‘lishi kerak. Ko‘chguncha rasm eski bot orqali ko‘rsatiladi. Holat: `settings.old_files_moved` (`done` — tugadi).
- Eski foydalanuvchilarga bir martalik xabar ("yangi botga o‘ting") faqat egasi ruxsat berganda yuboriladi: `settings` jadvalida `old_bot_notice = 'go'`. Cron har daqiqada 5 tadan yuboradi, tugagach `done` bo‘ladi.
- Moderatsiya guruhlariga @miqyosbot ni qo‘shish kerak (guruhlar o‘sha ID bilan ulangan qoladi). Qo‘shilmaguncha kartalar adminlarga shaxsan keladi.
- Agentlar jadvali: Apps Script'dagi `BOT_TOKEN` xususiyatini yangi bot tokeniga almashtirish kerak (kalit tokendan hosil qilinadi).

## Texnik tuzilish

| Qism | Qayerda |
| --- | --- |
| Bot va API | Cloudflare Workers (`src/`) |
| Ma’lumotlar bazasi | Cloudflare D1 (SQLite), jadvallar `migrations/` da |
| Mini ilova | `public/` (oddiy HTML, CSS, JS) |
| Joylash | GitHub Actions: `.github/workflows/bot.yml` |
| Agentlar jadvali | Google Sheets + Apps Script web app (`src/sheets.js`, `SHEETS_URL`) |

Cloudflare'ning bepul tarifi boshlash uchun yetadi: kuniga 100 000 so‘rov, 5 GB baza.

## Ishga tushirish (bir marta)

### 1. Telegramda bot yaratish

1. Telegramda [@BotFather](https://t.me/BotFather) ni oching va `/newbot` yozing.
2. Bot nomini yozing, masalan `Miqyos`.
3. Username yozing. U `bot` bilan tugashi kerak, masalan `miqyos_bot`.
4. BotFather **token** beradi (`123456789:AA...` ko‘rinishida). Uni nusxalab oling.

Tokenni hech kimga yubormang va chatlarga yozmang: u bilan botingizni boshqarish mumkin.

### 2. Cloudflare API token

1. [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) da bepul ro‘yxatdan o‘ting.
2. [API Tokens](https://dash.cloudflare.com/profile/api-tokens) sahifasini oching → **Create Token**.
   - **Edit Cloudflare Workers** qatoridagi **Use template** ni bosing.
   - Ruxsatlar ro‘yxatida **Account → D1 → Edit** bo‘lmasa, **+ Add more** orqali qo‘shing.
   - **Account Resources:** o‘z akkauntingizni tanlang.
   - **Continue to summary** → **Create Token** → tokenni nusxalab oling.

### 3. GitHubga secretlarni qo‘shish

[New repository secret](https://github.com/macrus-ai/Sarvarbek-/settings/secrets/actions/new) sahifasida (**Settings → Secrets and variables → Actions**) quyidagilarni bittadan qo‘shing:

| Nomi | Qiymati |
| --- | --- |
| `MIQYOS_BOT_TOKEN` | BotFather bergan token (asosiy bot, @miqyosbot) |
| `TELEGRAM_BOT_TOKEN` | *(ixtiyoriy)* eski bot (@Ovozauz_bot) tokeni: u foydalanuvchilarni yangi botga yo‘naltiradi ("Eski botdan ko‘chish" bo‘limi) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | *(ixtiyoriy)* Cloudflare Account ID. Kerak emas: workflow uni tokendan o‘zi topadi. Faqat tokeningiz bir nechta akkauntga tegishli bo‘lsa qo‘shing |
| `ADMIN_IDS` | *(ixtiyoriy)* adminlarning Telegram ID'lari, vergul bilan. O‘z ID'ingizni botga `/id` yuborib bilasiz |

### 4. Joylash

**Actions → Bot → Run workflow** ni bosing. Bundan keyin `bot/` papkasidagi har bir o‘zgarish `main` ga kirganda bot o‘zi yangilanadi.

Workflow o‘zi bajaradigan ishlar:
- `workers.dev` manzilini yaratadi (yangi akkauntda bo‘lmasa);
- `ovoza-db` bazasini yaratadi va jadvallarni qo‘shadi;
- botni joylaydi va tokenni xavfsiz saqlaydi;
- webhookni, botning "Miqyos" ismini, menyu tugmasini, buyruqlarni va bot tavsifini sozlaydi.

Tugagach, workflow sahifasidagi **Summary** da bot havolasi va mini ilova manzili chiqadi. Botga `/start` yozib tekshiring.

## Matnlarni o‘zgartirish

- **Bot xabarlari:** `src/i18n.js` (o‘zbekcha va ruscha).
- **Mini ilova matnlari:** `public/app.js` boshidagi `TEXT`.
- **Biznes toifalari (`CATEGORIES`), bloger yo‘nalishlari (`NICHES`, 20 ta + "Boshqa"), hududlar (`REGIONS`), platformalar, obunachilar oraliqlari:** `src/constants.js`.
- **Cheklovlar** (faol e’lonlar soni, matn uzunligi, rasm hajmi va boshqalar): `src/constants.js` dagi `LIMITS`.

## Kompyuterda ishlatish (dasturchilar uchun)

```bash
cd bot
npm install
npm test                                       # testlar (Node.js 22+)
printf 'BOT_TOKEN=123:abc\n' > .dev.vars       # sinov tokeni
npm run db:local                               # mahalliy bazaga jadvallar
npm run dev                                    # http://localhost:8787
```

Mini ilova faqat Telegram ichida to‘liq ishlaydi: brauzerda ochilsa, "Ilovani Telegramda oching" degan sahifa chiqadi.

## Keyingi qadamlar uchun g‘oyalar

- Bloger post havolasini yuklashi va biznes uni tasdiqlashi.
- Blogerlar reytingi va sharhlar.
- Tariflar uchun to‘lov (Click, Payme).
