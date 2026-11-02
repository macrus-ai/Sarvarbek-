-- Hududlar (src/constants.js dagi REGIONS):
--   users.region     — bloger yashaydigan hudud
--   campaigns.region — reklama e'loni qaysi hudud uchun; 'all' — butun O'zbekiston

ALTER TABLE users ADD COLUMN region TEXT;
ALTER TABLE campaigns ADD COLUMN region TEXT;

-- Eski e'lonlar: shahar yozilmagan bo'lsa, butun O'zbekiston uchun deb hisoblaymiz
UPDATE campaigns SET region = 'all' WHERE city IS NULL OR trim(city) = '';

-- Shahar matni bo'yicha hududni aniqlash. LIKE lotin harflarida katta-kichikni farqlamaydi,
-- kirillda farqlaydi, shuning uchun kirill nomlar ikki ko'rinishda yozilgan.
UPDATE campaigns SET region = 'tashkent' WHERE region IS NULL
  AND (city LIKE '%toshkent%' OR city LIKE '%tashkent%' OR city LIKE '%Ташкент%' OR city LIKE '%ташкент%')
  AND (city LIKE '%viloyat%' OR city LIKE '%region%' OR city LIKE '%област%' OR city LIKE '%Област%' OR city LIKE '%обл.%');
UPDATE campaigns SET region = 'tashkent_city' WHERE region IS NULL
  AND (city LIKE '%toshkent%' OR city LIKE '%tashkent%' OR city LIKE '%Ташкент%' OR city LIKE '%ташкент%');
UPDATE campaigns SET region = 'andijan' WHERE region IS NULL
  AND (city LIKE '%andij%' OR city LIKE '%Андижан%' OR city LIKE '%андижан%');
UPDATE campaigns SET region = 'bukhara' WHERE region IS NULL
  AND (city LIKE '%buxoro%' OR city LIKE '%bukhar%' OR city LIKE '%Бухар%' OR city LIKE '%бухар%');
UPDATE campaigns SET region = 'fergana' WHERE region IS NULL
  AND (city LIKE '%farg%ona%' OR city LIKE '%fergan%' OR city LIKE '%Ферган%' OR city LIKE '%ферган%' OR city LIKE '%qo%qon%' OR city LIKE '%kokand%' OR city LIKE '%Коканд%');
UPDATE campaigns SET region = 'jizzakh' WHERE region IS NULL
  AND (city LIKE '%jizza%' OR city LIKE '%jizak%' OR city LIKE '%Джизак%' OR city LIKE '%джизак%');
UPDATE campaigns SET region = 'namangan' WHERE region IS NULL
  AND (city LIKE '%namangan%' OR city LIKE '%Наманган%' OR city LIKE '%наманган%');
UPDATE campaigns SET region = 'navoi' WHERE region IS NULL
  AND (city LIKE '%navoi%' OR city LIKE '%Навои%' OR city LIKE '%навои%');
UPDATE campaigns SET region = 'kashkadarya' WHERE region IS NULL
  AND (city LIKE '%qashqa%' OR city LIKE '%kashka%' OR city LIKE '%qarshi%' OR city LIKE '%karshi%'
    OR city LIKE '%Кашкадар%' OR city LIKE '%кашкадар%' OR city LIKE '%Карши%' OR city LIKE '%карши%');
UPDATE campaigns SET region = 'karakalpakstan' WHERE region IS NULL
  AND (city LIKE '%qoraqalp%' OR city LIKE '%karakalp%' OR city LIKE '%nukus%'
    OR city LIKE '%Каракалп%' OR city LIKE '%каракалп%' OR city LIKE '%Нукус%' OR city LIKE '%нукус%');
UPDATE campaigns SET region = 'samarkand' WHERE region IS NULL
  AND (city LIKE '%samarq%' OR city LIKE '%samark%' OR city LIKE '%Самарканд%' OR city LIKE '%самарканд%');
UPDATE campaigns SET region = 'syrdarya' WHERE region IS NULL
  AND (city LIKE '%sirdar%' OR city LIKE '%syrdar%' OR city LIKE '%guliston%' OR city LIKE '%gulistan%'
    OR city LIKE '%Сырдар%' OR city LIKE '%сырдар%' OR city LIKE '%Гулистан%' OR city LIKE '%гулистан%');
UPDATE campaigns SET region = 'surkhandarya' WHERE region IS NULL
  AND (city LIKE '%surxon%' OR city LIKE '%surkhan%' OR city LIKE '%termiz%' OR city LIKE '%termez%'
    OR city LIKE '%Сурхандар%' OR city LIKE '%сурхандар%' OR city LIKE '%Термез%' OR city LIKE '%термез%');
UPDATE campaigns SET region = 'khorezm' WHERE region IS NULL
  AND (city LIKE '%xorazm%' OR city LIKE '%khorezm%' OR city LIKE '%urganch%' OR city LIKE '%urgench%'
    OR city LIKE '%Хорезм%' OR city LIKE '%хорезм%' OR city LIKE '%Ургенч%' OR city LIKE '%ургенч%');
-- Aniqlanmagan shaharlar NULL bo'lib qoladi: ular faqat "Barcha hududlar" filtrida ko'rinadi.

CREATE INDEX campaigns_status_region ON campaigns (status, region);
