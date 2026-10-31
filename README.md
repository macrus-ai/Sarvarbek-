# Ovoza

Bizneslar va blogerlarni **barter** asosida bog‘laydigan platformaning sayti.
Biznes mahsulot yoki xizmat beradi, bloger esa u haqida sharh va reklama joylaydi.

Sayt oddiy HTML, CSS va JavaScript bilan yozilgan. Hech qanday o‘rnatish yoki yig‘ish (build) kerak emas.

## Saytda nimalar bor

- **Bosh blok**: platforma g‘oyasi va ikki tugma ("Men biznes egasiman", "Men blogerman").
- **Qanday ishlaydi**: biznes va bloger uchun 4 qadam (tablar bilan almashtiriladi).
- **Nega Ovoza**: ikki tomon uchun foydalar.
- **Kampaniyalar katalogi**: toifa, platforma va qidiruv bo‘yicha filtr, har bir kampaniyaga ariza berish oynasi.
- **Kalkulyator**: barter pullik reklamaga nisbatan qancha tejashini hisoblaydi.
- **Tariflar**, **Savollar (FAQ)**, **Ro‘yxatdan o‘tish** (biznes va bloger formalari).
- **Ikki til**: o‘zbekcha (asosiy) va ruscha. Tanlangan til brauzerda eslab qolinadi.
- Telefon, planshet va kompyuterga moslashadi; tungi (dark) rejimni qo‘llab-quvvatlaydi.

## Fayllar

```
index.html              sahifa va barcha o‘zbekcha matnlar
assets/css/style.css    dizayn (ranglar fayl boshida)
assets/js/config.js     sozlamalar: formalar manzili, asosiy til
assets/js/i18n.js       ruscha tarjimalar va skript matnlari
assets/js/campaigns.js  kampaniyalar ro‘yxati va toifalar
assets/js/main.js       sayt mantiqi
assets/img/favicon.svg  brauzer ikonkasi
```

## Ko‘rish

`index.html` faylini brauzerda oching. Yoki papkada oddiy server ishga tushiring:

```bash
python3 -m http.server 8000
# keyin http://localhost:8000 ni oching
```

## O‘zgartirish

- **Matnlar**: o‘zbekcha matnlar `index.html` ichida. Matnni o‘zgartirsangiz, ruschasini `assets/js/i18n.js` dagi xuddi shu kalit (`data-i18n` qiymati) bo‘yicha yangilang.
- **Kampaniyalar**: `assets/js/campaigns.js`. Hozirgilari namuna, saytda ham "Namuna" deb belgilangan.
- **Aloqa ma’lumotlari**: telefon `+998 00 000 00 00`, Telegram `@ovoza_uz` va `info@ovoza.uz` vaqtinchalik qiymatlar. Ularni `index.html` da (ro‘yxatdan o‘tish bo‘limi va footer) o‘zingiznikiga almashtiring.
- **Tarif narxlari**: `index.html` dagi "Tariflar" bo‘limi va `i18n.js` dagi `plan…` kalitlari.
- **Ranglar**: `assets/css/style.css` boshidagi `:root` bloki (kunduzgi) va undan keyingi tungi rejim bloklari.

## Formalarni ulash

Hozir formalar **demo rejimda**: tekshiruv ishlaydi, lekin ma’lumot hech qayerga yuborilmaydi va bu haqida foydalanuvchiga yozib qo‘yiladi.

Arizalarni qabul qilish uchun `assets/js/config.js` da `formEndpoint` ga manzil yozing. Sayt shu manzilga `POST` so‘rov bilan JSON yuboradi, masalan:

```json
{ "type": "business", "lang": "uz", "name": "Aziz", "phone": "+998 90 123 45 67", "company": "...", "category": "beauty", "message": "..." }
```

`type` qiymatlari: `business`, `blogger` yoki `apply` (kampaniyaga ariza; bunda `campaignId` va `campaign` ham bo‘ladi).

Arizalarni Telegramga yuborish uchun kichik server yoki serverless funksiya (masalan, Cloudflare Workers, Vercel) yozib, u orqali bot API ga yuboring. **Bot tokenini sayt kodiga (brauzerga) qo‘ymang**, aks holda uni har kim ko‘ra oladi.

## Internetga joylash

Sayt GitHub Pages orqali ishlaydi: https://macrus-ai.github.io/Sarvarbek-/

- Pages sayti `gh-pages` branchidan chiqariladi.
- `main` ga har bir o‘zgarish kirganda `.github/workflows/sayt-yangilash.yml` `gh-pages` ni `main` nusxasi bilan almashtiradi, keyin GitHub saytni bir-ikki daqiqada yangilaydi.
- `gh-pages` ni qo‘lda o‘zgartirmang: undagi o‘zgarishlar keyingi yangilanishda o‘chib ketadi. Hamma o‘zgarish `main` orqali kiritilsin.
- Yangilashni qo‘lda ham ishga tushirish mumkin: **Actions → Saytni yangilash → Run workflow**.

Netlify, Vercel yoki istalgan boshqa hosting ham mos keladi: fayllarni shundayligicha yuklash kifoya.

## Keyingi qadamlar

Bu sayt platformaning tashqi ko‘rinishi va landing sahifasi. To‘liq ishlaydigan platforma uchun server qismi kerak bo‘ladi:
foydalanuvchi akkauntlari (biznes va bloger), kampaniyalarni yaratish va boshqarish, arizalar va tasdiqlash,
post havolalarini tekshirish, reyting tizimi va to‘lovlar (tariflar uchun).
