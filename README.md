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
- **Tariflar**, **Savollar (FAQ)**, **Ro‘yxatdan o‘tish** (Telegram botga havolalar va QR-kod).
- **Ikki til**: o‘zbekcha (asosiy) va ruscha. Tanlangan til brauzerda eslab qolinadi.
- **Telegram bot**: ro‘yxatdan o‘tish va ariza berish [@Ovozauz_bot](https://t.me/Ovozauz_bot) orqali.
- Telefon, planshet va kompyuterga moslashadi; tungi (dark) rejimni qo‘llab-quvvatlaydi.

## Fayllar

```
index.html              sahifa va barcha o‘zbekcha matnlar
assets/css/style.css    dizayn (ranglar fayl boshida)
assets/js/config.js     sozlamalar: bot nomi, asosiy til
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
- **Aloqa ma’lumotlari**: telefon raqami `+998 95 555 45 49`. Telegram `@ovoza_uz` va `info@ovoza.uz` hozircha vaqtinchalik qiymatlar. Ular `index.html` da ikki joyda turadi: ro‘yxatdan o‘tish bo‘limi va footer.
- **Tarif narxlari**: `index.html` dagi "Tariflar" bo‘limi va `i18n.js` dagi `plan…` kalitlari.
- **Ranglar**: `assets/css/style.css` boshidagi `:root` bloki (kunduzgi) va undan keyingi tungi rejim bloklari.

## Ro‘yxatdan o‘tish: Telegram bot

Saytdagi barcha "Ro‘yxatdan o‘tish", "Men biznes egasiman", "Men blogerman" va "Ariza berish" tugmalari Telegram botga ([@Ovozauz_bot](https://t.me/Ovozauz_bot)) olib boradi.

- Havolada rol va sayt tili uzatiladi (`t.me/Ovozauz_bot?start=business-uz`). Shuning uchun bot til va rolni qayta so‘ramay, darhol ismni so‘raydi.
- Kompyuterdan kirganlar uchun ro‘yxatdan o‘tish bo‘limida QR-kod bor.
- Maxfiylik siyosati: `privacy.html` (o‘zbek va rus tilida). Bot ro‘yxatdan o‘tishda shu sahifaga havola beradi. Matn namuna sifatida yozilgan, uni yurist bilan ko‘rib chiqing.
- Bot nomi o‘zgarsa, `assets/js/config.js` dagi `botUsername` ni va `index.html` dagi `t.me/Ovozauz_bot` havolalarini yangilang.

Bot va mini ilova kodi `bot/` papkasida: [bot/README.md](bot/README.md).

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
