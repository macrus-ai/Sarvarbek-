import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  api, createCampaign, createEnv, fakeTelegram, press, registerBlogger, registerBusiness, say, shareContact, tgUser
} from './helpers.js';

// createEnv() da ADMIN_IDS = '999'
const ADMIN = 999;
let tg;
let env;
beforeEach(() => {
  tg = fakeTelegram();
  env = createEnv();
});
afterEach(() => tg.restore());

const lastText = (chatId) => tg.sent(chatId).at(-1)?.body.text ?? '';

test('biznesni o‘chirish: e’lon va so‘rovlar o‘chadi, qaytadan ro‘yxatdan o‘tib yana moderatsiyaga tushadi', async () => {
  const business = tgUser(900);
  const blogger = tgUser(901);
  await registerBusiness(env, business);
  await registerBlogger(env, blogger);
  const { data } = await createCampaign(env, business, { title: 'Eski e’lon', minFollowers: 0 });
  await api(env, blogger, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: {} });

  // Tasdiqlash so'raladi; "Bekor qilish" hech narsani o'zgartirmaydi
  await press(env, business, 'biz:delete');
  const confirm = tg.sent(900).at(-1).body;
  assert.match(confirm.text, /barcha reklama e’lonlaringiz va ularga kelgan so‘rovlar butunlay o‘chiriladi/);
  assert.deepEqual(confirm.reply_markup.inline_keyboard[0].map((b) => b.callback_data), ['biz:yes', 'biz:no']);
  await press(env, business, 'biz:no');
  assert.match(tg.last('editMessageText').body.text, /Bekor qilindi/);
  assert.equal((await api(env, business, '/api/me')).data.registered, true);

  // Bloger "biz:yes" ni bosa olmaydi
  await press(env, blogger, 'biz:yes');
  assert.match(tg.last('answerCallbackQuery').body.text, /eskirgan/);

  await press(env, business, 'biz:delete');
  await press(env, business, 'biz:yes');
  assert.match(tg.last('editMessageText').body.text, /barcha ma’lumotlari o‘chirildi/);
  assert.match(lastText(900), /Siz kimsiz\?/); // rol savolidan boshlanadi
  const me = await api(env, business, '/api/me');
  assert.equal(me.data.registered, false);
  assert.equal(me.data.user.company, null);
  assert.equal(me.data.user.lang, 'uz');
  assert.equal((await api(env, blogger, '/api/campaigns')).data.campaigns.length, 0);
  assert.equal((await api(env, blogger, '/api/my/applications')).data.applications.length, 0);

  // Qaytadan ro'yxatdan o'tadi — yangi profil sifatida moderatsiyaga tushadi
  tg.clear();
  await press(env, business, 'role:business');
  await say(env, business, 'Aziz');
  await say(env, business, 'Yangi do‘kon');
  await press(env, business, 'cat:food');
  await shareContact(env, business, '998901112233');
  assert.match(lastText(900), /moderatsiyada/);
  const card = tg.sent(ADMIN).at(-1).body.text;
  assert.match(card, /#Yangi_biznes/);
  assert.match(card, /Yangi do‘kon/);
  assert.doesNotMatch(card, /qayta yuborildi/);
  assert.equal((await api(env, business, '/api/me')).data.user.moderation, 'pending');
});

test('so‘rovga qaror: ro‘yxatdan o‘tish yarim qolgan yoki profil tasdiqlanmagan bo‘lsa — sababi aytiladi', async () => {
  const business = tgUser(910);
  const blogger = tgUser(911);
  await registerBusiness(env, business);
  await registerBlogger(env, blogger);
  const { data } = await createCampaign(env, business, { minFollowers: 0 });
  const { data: applied } = await api(env, blogger, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: {} });
  const appId = applied.application.id;

  // Eski holat: biznes "Ma'lumotlarni yangilash" ni bosgan va savollar yarim qolgan
  await env.DB.prepare("UPDATE users SET reg_step = 'name' WHERE tg_id = ?1").bind(910).run();
  await press(env, business, `ap:a:${appId}`);
  assert.match(tg.last('answerCallbackQuery').body.text, /ro‘yxatdan o‘tishni yakunlang/);

  await env.DB.prepare("UPDATE users SET reg_step = 'done', moderation = 'pending' WHERE tg_id = ?1").bind(910).run();
  await press(env, business, `ap:a:${appId}`);
  assert.match(tg.last('answerCallbackQuery').body.text, /tasdiqlanmagan/);

  await env.DB.prepare("UPDATE users SET moderation = 'approved' WHERE tg_id = ?1").bind(910).run();
  await press(env, business, `ap:a:${appId}`);
  assert.match(tg.last('answerCallbackQuery').body.text, /Qabul qilindi/);
});

test('Instagram blogerining to‘rtta ko‘rsatkichi biznesga keladi', async () => {
  const business = tgUser(920);
  const blogger = tgUser(921);
  await registerBusiness(env, business);
  await registerBlogger(env, blogger, {
    reels: '100000-500000', posts: '10000-50000', reach: '1000-3000', accounts: '500000-1000000'
  });
  const { data } = await createCampaign(env, business, { minFollowers: 0 });
  tg.clear();
  await api(env, blogger, `/api/campaigns/${data.campaign.id}/apply`, { method: 'POST', body: {} });
  const note = lastText(920);
  assert.match(
    note,
    /Reels \(o‘rtacha\): 100\s000 – 500\s000\n.*Postlar \(o‘rtacha\): 10\s000 – 50\s000\n.*Istoriya \(o‘rtacha\): 1\s000 – 3\s000\n.*Qamrov \(30 kun\): 500\s000 – 1\s000\s000/
  );
  assert.doesNotMatch(note, /eski|kiritilmagan/);
  const [request] = (await api(env, business, '/api/requests')).data.requests;
  assert.equal(request.blogger.reelsViews, '100000-500000');
  assert.equal(request.blogger.postsViews, '10000-50000');
  assert.equal(request.blogger.reach, '1000-3000');
  assert.equal(request.blogger.accountsReached, '500000-1000000');
  assert.equal(request.blogger.reelsReach, null);
});
