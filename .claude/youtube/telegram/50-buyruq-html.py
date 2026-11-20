import html, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "50-ta-AI-buyrugi.pdf")

CATS = [
 ("💼", "Ish va hujjatlar", [
  "Ish beruvchiga [sababini yozing] sababli [nechta] kunlik ta’til so‘rab rasmiy ariza yoz. Ohang hurmatli va qisqa bo‘lsin.",
  "Mening ma’lumotlarim asosida [lavozim] uchun bir sahifalik rezyume tuz: [tajriba, ta’lim, ko‘nikmalar].",
  "[Kompaniya nomi]ga [lavozim] uchun yuboriladigan qisqa va ishonchli motivatsion xat yoz.",
  "Quyidagi yig‘ilish yozuvlaridan qisqa bayonnoma tuz: qarorlar, mas’ullar va muddatlar alohida bo‘lsin. [matn]",
  "Hamkasbimga [masala] bo‘yicha xushmuomala, lekin aniq eslatma xati yoz.",
  "Ish suhbatida [lavozim] bo‘yicha beriladigan 10 ta savol va ularga namunaviy javoblar yoz.",
  "Ushbu matndagi imlo va uslub xatolarini tuzat, o‘zgartirgan joylaringni alohida ko‘rsat: [matn]",
  "[Mavzu] bo‘yicha 10 slaydli taqdimot rejasi tuz: har slayd uchun sarlavha va 3 ta qisqa punkt.",
 ]),
 ("📚", "O‘qish va o‘rganish", [
  "Sen tajribali o‘qituvchisan. [Mavzu]ni 7-sinf o‘quvchisiga oddiy misollar bilan tushuntir.",
  "[Mavzu] bo‘yicha 10 ta test savoli tuz, to‘g‘ri javoblarni oxirida alohida ber.",
  "Excel’dagi [funksiya nomi] funksiyasini oddiy misol bilan, qadam-baqadam tushuntir.",
  "Menga [til]ni noldan o‘rganish uchun kuniga 30 daqiqalik 4 haftalik reja tuz.",
  "Quyidagi matndagi eng muhim 5 ta fikrni sodda tilda yoz: [matn]",
  "[Kitob nomi] kitobining asosiy g‘oyalarini 10 ta punktda qisqacha yoz.",
  "Men [mavzu]ni tushunmayapman. Menga savollar berib, bosqichma-bosqich tushuntir.",
  "[Imtihon nomi]ga tayyorlanish uchun 30 kunlik reja tuz, har kun uchun aniq vazifa bilan.",
 ]),
 ("🏪", "Biznes va savdo", [
  "[Mahsulot/xizmat] uchun Instagram’da 10 ta post g‘oyasi ber. Har biriga qisqa matn ham yoz.",
  "[Mahsulot] uchun 3 xil reklama matni yoz: qisqa, o‘rtacha va uzun.",
  "Mijozning shu shikoyatiga xushmuomala va muammoni hal qiladigan javob yoz: [shikoyat]",
  "[Biznes turi] ochish uchun 5 bosqichli reja tuz: xarajatlar, joy, xodimlar, reklama.",
  "Mijozlarimizdan fikr so‘rash uchun 7 ta qisqa savoldan iborat so‘rovnoma tuz.",
  "[Do‘kon/kafe] uchun 10 ta esda qoladigan nom variantini taklif qil.",
  "[Mahsulot] narxini oshirishimiz kerak. Mijozlarga buni tushuntiradigan xushmuomala e’lon yoz.",
  "[Biznes turi] uchun raqobatchilardan ajralib turishning 7 ta arzon usulini yoz.",
 ]),
 ("📱", "Ijtimoiy tarmoqlar va bloging", [
  "[Mavzu] haqidagi Reels/Shorts uchun 30 soniyalik ssenariy yoz: birinchi 3 soniyada qiziqtiradigan gap bo‘lsin.",
  "Telegram kanalim uchun [mavzu] bo‘yicha bir haftalik post rejasini tuz.",
  "[Video mavzusi] uchun 10 ta YouTube sarlavha varianti yoz, har biri 60 belgidan qisqa bo‘lsin.",
  "Shu postga mos 15 ta xeshteg taklif qil: [post matni]",
  "Instagram profilim uchun qisqa va esda qoladigan bio yoz. Men haqimda: [ma’lumot].",
  "Obunachilar bilan muloqot uchun [mavzu] bo‘yicha 5 ta qiziqarli so‘rovnoma savoli yoz.",
  "Shu izohga xushmuomala va qisqa javob yoz: [izoh]",
 ]),
 ("🌐", "Tarjima va til", [
  "Quyidagi matnni o‘zbek tiliga tabiiy va ravon tarjima qil: [matn]",
  "Shu xatni rus tiliga rasmiy uslubda tarjima qil: [matn]",
  "Bu inglizcha iboraning ma’nosini tushuntir va o‘zbekcha 3 ta muqobilini ber: [ibora]",
  "Shu matnni lotin yozuvidan kirill yozuviga o‘gir: [matn]",
  "Ingliz tilida [vaziyat]da ishlatiladigan 20 ta foydali iborani o‘zbekcha tarjimasi bilan yoz.",
  "Mening inglizcha matnimdagi xatolarni tuzat va nima uchun xato ekanini o‘zbekcha tushuntir: [matn]",
 ]),
 ("🏠", "Kundalik hayot", [
  "Uyda bor masalliqlardan nima pishirsam bo‘ladi: [masalliqlar]. 3 ta retsept ber.",
  "Oylik daromadim [summa] so‘m. Xarajatlarni rejalashtirib, tejash bo‘yicha jadval tuz.",
  "[Shahar]ga 3 kunlik sayohat rejasi tuz: ko‘rish kerak joylar va taxminiy xarajatlar bilan.",
  "[Yosh]dagi bolam uchun uyda o‘ynash mumkin bo‘lgan 10 ta foydali o‘yin taklif qil.",
  "Ertalab soat [vaqt]da turib, kunimni samarali o‘tkazish uchun kun tartibini tuz.",
  "[Kishi]ning tug‘ilgan kuni uchun samimiy tabrik yoz, uzunligi 4–5 gap bo‘lsin.",
  "Sport bilan endi shug‘ullanmoqchiman. Uyda jihozsiz bajariladigan 4 haftalik reja tuz.",
 ]),
 ("🎨", "Rasm yaratish (ChatGPT, Gemini, Designer)", [
  "Samarqanddagi Registon maydonida o‘tirgan qizil mushuk, kechki quyosh nurida, akvarel uslubida, kvadrat format.",
  "[Mahsulot] uchun reklama rasmi: oq fonda, yorug‘ studiya chirog‘i, minimalistik uslub, keng format.",
  "Bolalar kitobi uchun rasm: [syujet], multfilm uslubida, yorqin ranglar.",
  "[Biznes nomi] uchun oddiy va zamonaviy logotip g‘oyasi, [rang] ranglarda, fon oq.",
  "YouTube muqovasi uchun fon: [mavzu], keng format, chap tomonda matn uchun bo‘sh joy qoldir.",
  "Shu rasmni o‘zgartir: fonni tungi osmonga almashtir va ranglarni yorqinroq qil.",
 ]),
]

def li(t):
    t = html.escape(t)
    import re
    return re.sub(r"\[([^\]]+)\]", r'<span class="ph">[\1]</span>', t)

n = 0
sections = []
for icon, title, items in CATS:
    rows = []
    for t in items:
        n += 1
        rows.append(f'<div class="p"><div class="n">{n}</div><div class="t">{li(t)}</div></div>')
    sections.append(f'<section><h2><span>{icon}</span>{html.escape(title)}</h2>{"".join(rows)}</section>')
assert n == 50, n

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 16mm 15mm 16mm 15mm; }}
body {{ font-family: Inter, 'DejaVu Sans', sans-serif; color:#1d1d1f; font-size:10.5pt; line-height:1.45; margin:0; }}
.cover {{ height: 255mm; display:flex; flex-direction:column; justify-content:center; page-break-after: always; }}
.cover .k {{ font-size:12pt; font-weight:700; color:#d01e2a; letter-spacing:.08em; text-transform:uppercase; }}
.cover h1 {{ font-size:44pt; line-height:1.05; margin:10px 0 18px; font-weight:900; }}
.cover h1 b {{ color:#d01e2a; }}
.cover p {{ font-size:13pt; color:#444; max-width:150mm; }}
.rules {{ margin-top:22px; border:2px solid #1d1d1f; border-radius:12px; padding:14px 18px; max-width:160mm; }}
.rules h3 {{ margin:0 0 8px; font-size:13pt; }}
.rules ol {{ margin:0; padding-left:20px; }} .rules li {{ margin:4px 0; }}
.warn {{ margin-top:14px; background:#fff4d6; border-radius:12px; padding:12px 18px; max-width:160mm; font-size:10.5pt; }}
h2 {{ font-size:15pt; margin:18px 0 8px; padding-bottom:6px; border-bottom:3px solid #d01e2a; break-after:avoid; }}
h2 span {{ margin-right:8px; }}
.p {{ display:flex; gap:10px; padding:7px 0; border-bottom:1px solid #e6e6e6; break-inside:avoid; }}
.n {{ flex:0 0 26px; height:26px; border-radius:50%; background:#1d1d1f; color:#fff; font-weight:700; font-size:9.5pt; display:flex; align-items:center; justify-content:center; }}
.t {{ flex:1; padding-top:3px; }}
.ph {{ background:#ffe8a3; border-radius:4px; padding:0 3px; font-weight:600; }}
.end {{ margin-top:22px; padding:14px 18px; border-radius:12px; background:#f2f2f2; break-inside:avoid; }}
</style></head><body>
<div class="cover">
  <div class="k">Bepul qo‘llanma</div>
  <h1><b>50</b> ta tayyor<br>o‘zbekcha AI buyrug‘i</h1>
  <p>ChatGPT, Gemini va Claude uchun. Nusxalang, <span class="ph">[qavs ichidagi]</span> joyni o‘zingizga moslang va yuboring.</p>
  <div class="rules"><h3>Yaxshi javob olishning 3 qoidasi</h3><ol>
   <li><b>Aniq bo‘ling.</b> “Reja yoz” emas, “Telefon do‘koni ochish uchun 5 qadamli reja yoz”.</li>
   <li><b>Rol bering.</b> “Sen tajribali o‘qituvchisan…”, “Sen marketing mutaxassisisan…”.</li>
   <li><b>Formatni ayting.</b> “Jadval ko‘rinishida”, “3 ta punktda”, “100 so‘zdan oshmasin”.</li></ol></div>
  <div class="warn"><b>Ehtiyot bo‘ling:</b> AI’ga parol, karta raqami va shaxsiy hujjatlarni yozmang. Raqam, sana va faktlarni
  doim boshqa manbadan tekshiring. Tibbiyot, huquq va moliya masalalarida AI mutaxassis o‘rnini bosmaydi.</div>
</div>
{''.join(sections)}
<div class="end"><b>Maslahat:</b> javob yoqmasa, boshidan boshlamang. Shu suhbatda davom eting: “qisqaroq qil”, “rasmiyroq yoz”,
“misol qo‘sh”. AI oldingi javobni hisobga oladi.</div>
</body></html>"""

open(OUT.replace('.pdf','.html'),'w').write(HTML)
print('html ok')
