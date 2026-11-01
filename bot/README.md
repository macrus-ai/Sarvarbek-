# Ovoza Telegram boti va mini ilovasi

Bizneslar va blogerlar botda ro‘yxatdan o‘tadi. Bizneslar botdagi mini ilovaga reklama e’loni joylaydi, blogerlar ko‘rib so‘rov yuboradi, so‘rovlar esa bizneslarga shu bot orqali keladi.

## Qanday ishlaydi

1. **Ro‘yxatdan o‘tish (bot ichida).** `/start` → til (o‘zbekcha / ruscha) → "Biznes egasiman" yoki "Blogerman".
   - **Biznes:** ism, do‘kon yoki kompaniya nomi, toifa, telefon ("Raqamni yuborish" tugmasi).
   - **Bloger:** ism, asosiy tarmoq, profil havolasi yoki @username, obunachilar soni, yo‘nalish (21 ta variant, oxirgisi "Boshqa"), telefon.
2. **Biznes** mini ilovada reklama e’loni joylaydi: rasm (ixtiyoriy), mahsulot, qiymati, platformalar, format, kerakli obunachilar, muddat, blogerlar soni.
3. **Bloger** mini ilovada reklama e’lonlarini ko‘radi (toifa, platforma va qidiruv bo‘yicha) va so‘rov yuboradi.
4. **Biznesga botda xabar keladi**, xabarda "✅ Qabul qilish" va "❌ Rad etish" tugmalari bor. Xuddi shuni mini ilovadagi "So‘rovlar" bo‘limida ham qilish mumkin.
5. **Blogerga javob botda keladi.** So‘rov qabul qilinsa, biznesning telefoni va Telegrami yuboriladi. Biznes ham blogerning telefonini ko‘radi.

Qo‘shimcha:
- Bo‘sh o‘rinlar soni hisobga olinadi: o‘rin to‘lsa, yangi so‘rov qabul qilinmaydi.
- Blogerning obunachilari e’lon talabidan kam bo‘lsa, so‘rov yuborib bo‘lmaydi.
- Telefon raqamlar faqat so‘rov qabul qilingandan keyin ko‘rinadi.
- Ro‘yxatdan o‘tishda maxfiylik siyosatiga havola ko‘rsatiladi (saytdagi `privacy.html`, manzil `wrangler.toml` dagi `PRIVACY_URL` da).
- `/delete` foydalanuvchining profili, e’lonlari va so‘rovlarini tasdiqdan keyin butunlay o‘chiradi. `/privacy` siyosat havolasini yuboradi.

### Admin imkoniyatlari

`ADMIN_IDS` secretida ko‘rsatilgan Telegram ID egalari:
- har bir yangi biznes va bloger haqida botda xabar oladi;
- har bir yangi reklama e’loni haqida "🚫 E’lonni yopish" tugmasi bilan xabar oladi. Yopilsa, biznesga moderator yopgani haqida xabar boradi;
- e’longa rasm qo‘shilsa yoki almashtirilsa, rasmning o‘zini xuddi shu tugma bilan oladi;
- `/stats` buyrug‘i bilan foydalanuvchilar, e’lonlar va so‘rovlar sonini ko‘radi.

O‘z ID'ingizni bilish uchun botga `/id` yuboring.

### E’lon rasmlari

- Biznes rasmni e’lon joylashda yoki keyin e’lon sahifasida qo‘shadi, almashtiradi yoki olib tashlaydi.
- Mini ilova rasmni yuklashdan oldin 1280 px gacha kichraytiradi (JPEG). Server JPG, PNG va WEBP ni qabul qiladi, hajmi 5 MB gacha.
- Rasm Telegramga yuklanadi va Telegram serverida saqlanadi (bepul, alohida xizmat kerak emas). Biznesga botda "rasm qo‘shildi" degan tasdiq keladi. Bazada faqat rasmning `file_id` si turadi.
- Mini ilova rasmni `/img/c/<id>-<kalit>.jpg` manzilidan oladi. Worker uni Telegramdan olib beradi, bot tokeni tashqariga chiqmaydi. Kalit tasodifiy va har yangi rasmda o‘zgaradi.

## Texnik tuzilish

| Qism | Qayerda |
| --- | --- |
| Bot va API | Cloudflare Workers (`src/`) |
| Ma’lumotlar bazasi | Cloudflare D1 (SQLite), jadvallar `migrations/` da |
| Mini ilova | `public/` (oddiy HTML, CSS, JS) |
| Joylash | GitHub Actions: `.github/workflows/bot.yml` |

Cloudflare'ning bepul tarifi boshlash uchun yetadi: kuniga 100 000 so‘rov, 5 GB baza.

## Ishga tushirish (bir marta)

### 1. Telegramda bot yaratish

1. Telegramda [@BotFather](https://t.me/BotFather) ni oching va `/newbot` yozing.
2. Bot nomini yozing, masalan `Ovoza`.
3. Username yozing. U `bot` bilan tugashi kerak, masalan `ovoza_uz_bot`.
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
| `TELEGRAM_BOT_TOKEN` | BotFather bergan token |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | *(ixtiyoriy)* Cloudflare Account ID. Kerak emas: workflow uni tokendan o‘zi topadi. Faqat tokeningiz bir nechta akkauntga tegishli bo‘lsa qo‘shing |
| `ADMIN_IDS` | *(ixtiyoriy)* adminlarning Telegram ID'lari, vergul bilan. O‘z ID'ingizni botga `/id` yuborib bilasiz |

### 4. Joylash

**Actions → Bot → Run workflow** ni bosing. Bundan keyin `bot/` papkasidagi har bir o‘zgarish `main` ga kirganda bot o‘zi yangilanadi.

Workflow o‘zi bajaradigan ishlar:
- `workers.dev` manzilini yaratadi (yangi akkauntda bo‘lmasa);
- `ovoza-db` bazasini yaratadi va jadvallarni qo‘shadi;
- botni joylaydi va tokenni xavfsiz saqlaydi;
- webhookni, "Ovoza" menyu tugmasini, buyruqlarni va bot tavsifini sozlaydi.

Tugagach, workflow sahifasidagi **Summary** da bot havolasi va mini ilova manzili chiqadi. Botga `/start` yozib tekshiring.

## Matnlarni o‘zgartirish

- **Bot xabarlari:** `src/i18n.js` (o‘zbekcha va ruscha).
- **Mini ilova matnlari:** `public/app.js` boshidagi `TEXT`.
- **Biznes toifalari (`CATEGORIES`), bloger yo‘nalishlari (`NICHES`, 20 ta + "Boshqa"), platformalar, obunachilar oraliqlari:** `src/constants.js`.
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
