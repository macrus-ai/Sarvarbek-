# Oq doska (whiteboard) videolari

Qo'l marker bilan chizayotgandek ko'rinadigan YouTube videolari uchun vositalar.

## Uslub (foydalanuvchi bilan kelishilgan, 2026-11-19)

- Oq fon, qalin qora chiziqli oddiy multfilm rasmlar, ichi tekis rangli.
- Haqiqiy qo'l (`assets/hand.png`): ruchka chapga qaragan, bilak uzun, kadr pastidan chiqadi.
- Avval odam to'liq chiziladi va bo'yaladi, keyin orqa fon.
- Ro'yxat bandlarida o'ng tomonda katta qizil 3D raqam, sahna boshidanoq turadi.
- Qahramon: `assets/qahramon.png` (ko'k ko'ylakli yigit). Yangi holatlar shu rasmni reference qilib yaratiladi.
- Ovoz: Higgsfield `elevenlabs_v4`, preset ovoz "Vlad" (`e5666b9c-99a2-4fac-8b4e-abee078b186d`). Foydalanuvchi tanlagan.
  Har jumla alohida yaratiladi. Server bir vaqtda 2 ta ovoz va 4 ta rasm so'rovini qabul qiladi.

## Rasmlar (Higgsfield, `gpt_image_2_6`)

- Sahna: 16:9. Prompt boshi: "Whiteboard explainer illustration. Simple cartoon line art with thick uniform black
  marker outlines on a pure white background, flat colors only inside the outlines, no shading, no gradients,
  no shadows, no text, no letters, no logos."
- Qahramonli sahnada fon promptiga: "Keep the left third of the image completely empty white".
- Raqamli sahnada: "the right quarter must stay completely empty white" (dastur ham rasmni chapga suradi).
- Qahramon holati: 3:4, `image_references` = qahramon rasmi, "upper body from head to waist ... Isolated on a pure white background".

## Ishga tushirish

```
pip install opencv-python-headless scikit-image numpy pillow   # + ffmpeg
python3 wb2.py sahna.png assets/hand.png chiqish.mp4 --seconds 12 --number 1 \
    [--person qahramon_holati.png --person-x 0.19 --person-h 0.86 --start 0.19,0.2] --hand-height 1560
python3 build_video1.py ISH_PAPKASI          # 1-video: img/, vo/ ichidagi fayllardan to'liq video
```

`video1_matn.json` — 1-video ("Sun'iy intellektdan o'zbek tilida foydalanish") ovoz matni, 32 jumla.
