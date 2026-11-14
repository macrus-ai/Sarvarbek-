/**
 * Ovoza kunlik agent jadvali <-> Telegram (@miqyosbot)
 *
 * Bu fayl jadvalga bog'langan Apps Script loyihasidagi Code.gs ning nusxasi (Extensions > Apps Script).
 * O'zgartirsangiz, Apps Script'ga ham qo'ying va Deploy > Manage deployments > New version qiling.
 *
 * 1) Agentlar Blogerlar / Brendlar varag'iga qator qo'shsa -> egasiga Telegram xabar (checkNewRows, har 5 daqiqada).
 * 2) Botda yangi bloger/biznes ro'yxatdan o'tsa -> Worker (bot/src/sheets.js) shu web app'ga yuboradi,
 *    qator "Yangi" holatida qo'shiladi va egasiga xabar boradi (doPost).
 *
 * Script properties: BOT_TOKEN (asosiy bot @miqyosbot tokeni, Worker'dagi bilan bir xil), OWNER_CHAT_ID.
 * DIQQAT: bu skript botning webhook'ini o'zgartirmasligi kerak (setWebhook). Webhook Worker'ga qaraydi.
 */

var SHEETS = {
  'Blogerlar': { lines: ['Nomi (@handle)', 'Platforma', 'Soha', 'Shahar', 'Obunachilar', 'Engagement', 'Havola', 'Nega Ovoza\'ga mos', 'Ochiq aloqa', 'Manba'] },
  'Brendlar':  { lines: ['Nomi', 'Soha', 'Shahar', 'Havola', 'Blogerlarga nima bera oladi', 'Aloqa', 'Manba'] }
};
var MAIN_WEBHOOK = 'https://ovoza-bot.axborotmarkazi-uz.workers.dev/telegram/webhook';

function props_() { return PropertiesService.getScriptProperties(); }
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

/* ---------- Telegram ---------- */
function tg_(method, payload) {
  var url = 'https://api.telegram.org/bot' + props_().getProperty('BOT_TOKEN') + '/' + method;
  return UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
}
function notifyOwner_(text) {
  var id = props_().getProperty('OWNER_CHAT_ID');
  if (id) tg_('sendMessage', { chat_id: id, text: text, disable_web_page_preview: true });
}
function sha256Hex_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); }).join('');
}

/* ---------- Jadval -> Telegram (vaqt triggeri) ---------- */
function checkNewRows() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    Object.keys(SHEETS).forEach(function (name) {
      var sh = ss_().getSheetByName(name);
      if (!sh) return;
      var key = 'last_' + name;
      var last = sh.getLastRow();
      var seen = props_().getProperty(key);
      if (seen === null) { props_().setProperty(key, String(last)); return; } // birinchi ishga tushishda eski qatorlarni yubormaymiz
      seen = Number(seen);
      if (last <= seen) return;
      var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      var rows = sh.getRange(seen + 1, 1, last - seen, headers.length).getValues();
      rows.slice(0, 15).forEach(function (r) {
        var o = {}; headers.forEach(function (h, i) { o[h] = r[i]; });
        if (!o[SHEETS[name].lines[0]]) return;
        if (String(o['Manba'] || '').indexOf('Telegram bot') === 0) return; // botdan kelganini doPost allaqachon yuborgan
        notifyOwner_(format_(name, o));
      });
      if (rows.length > 15) notifyOwner_('Yana ' + (rows.length - 15) + ' ta yangi qator qo\'shildi (' + name + ').');
      props_().setProperty(key, String(last));
    });
  } finally { lock.releaseLock(); }
}

function format_(sheetName, o) {
  var title = sheetName === 'Blogerlar' ? '🆕 Yangi bloger' : '🆕 Yangi biznes';
  var out = [title];
  SHEETS[sheetName].lines.forEach(function (h) {
    if (o[h]) out.push(h + ': ' + o[h]);
  });
  return out.join('\n');
}

/* ---------- Bot (Worker) -> Jadval ---------- */
// Worker { key, sheet, row } yuboradi. Kalit: sha256("ovoza-sheets:" + BOT_TOKEN) ning boshidagi 48 belgisi
// (bot/src/sheets.js dagi sheetsKey bilan bir xil).
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var key = sha256Hex_('ovoza-sheets:' + props_().getProperty('BOT_TOKEN')).slice(0, 48);
    if (!body || body.key !== key || !SHEETS[body.sheet]) return ContentService.createTextOutput('no');
    var row = body.row || {};
    appendRow_(body.sheet, row);
    notifyOwner_(format_(body.sheet, row) + '\n\n📋 Jadvalga "Yangi" holatida yozildi');
  } catch (err) {
    notifyOwner_('Jadvalga yozishda xato: ' + err);
  }
  return ContentService.createTextOutput('ok');
}

function appendRow_(sheetName, data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = ss_().getSheetByName(sheetName);
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var row = headers.map(function (h) {
      if (h === 'Sana') return Utilities.formatDate(new Date(), 'Asia/Tashkent', 'yyyy-MM-dd');
      if (h === 'Holat') return 'Yangi';
      if (h === 'Manba') return data['Manba'] || 'Telegram bot';
      return data[h] !== undefined ? data[h] : '';
    });
    sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  } finally { lock.releaseLock(); }
}

/* ---------- Bir martalik sozlash va tekshiruv ---------- */
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'checkNewRows') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkNewRows').timeBased().everyMinutes(5).create();
}
function testOwner() { notifyOwner_('Ovoza bot ulandi ✅'); }

// Webhook qaerga qarashini ko'rsatadi (Worker'ga qarashi kerak)
function webhookInfo() {
  var r = JSON.parse(tg_('getWebhookInfo', {}).getContentText()).result;
  Logger.log(JSON.stringify({ url: String(r.url || '').split('?')[0], pending: r.pending_update_count, last_error: r.last_error_message || '' }));
}
// Favqulodda: webhook kimdir tomonidan o'zgartirilgan bo'lsa, uni Worker'ga qaytaradi
// (secret_token Worker'dagi webhookSecret bilan bir xil).
function restoreMainBot() {
  var secret = sha256Hex_('ovoza-webhook:' + props_().getProperty('BOT_TOKEN')).slice(0, 48);
  var res = tg_('setWebhook', { url: MAIN_WEBHOOK, secret_token: secret, allowed_updates: ['message', 'callback_query'] });
  Logger.log(res.getContentText());
}
