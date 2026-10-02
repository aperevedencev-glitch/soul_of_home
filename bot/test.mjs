// Тесты бота без интернета: Telegram, ИИ, Supabase и KV подменены. Запуск: node bot/test.mjs
import assert from 'node:assert/strict';
const mod = await import(new URL('./worker.js', import.meta.url));
const worker = mod.default;

class MemKV { constructor(){ this.m=new Map(); }
  async get(k,t){ const v=this.m.get(k); if(!v) return null; return t==='json'?JSON.parse(v.value):v.value; }
  async put(k,v,o={}){ this.m.set(k,{value:v,metadata:o.metadata}); }
  async delete(k){ this.m.delete(k); }
  async list({prefix='',cursor}={}){ return { keys:[...this.m].filter(([k])=>k.startsWith(prefix)).map(([name,v])=>({name,metadata:v.metadata})), list_complete:true }; } }

let calls=[], aiReply='Мур! Начните с «Бархатного шара» 🐾', aiFail=false, blocked=new Set();
globalThis.fetch = async (url, opts={}) => {
  const u=String(url), body=opts.body?JSON.parse(opts.body):null; calls.push({u,body,headers:opts.headers});
  if (u.includes('/chat/completions')) return aiFail ? new Response('{"error":"x"}',{status:429}) : new Response(JSON.stringify({choices:[{message:{content:'<think>x</think>**'+aiReply+'**'}}]}));
  if (u.includes('supabase.co')) return new Response('',{status:201});
  if (u.includes('api.anthropic.com')) return new Response(JSON.stringify({content:[{type:'text',text:'Claude: '+aiReply}]}));
  const m=u.split('/').pop();
  if (blocked.has(String(body?.chat_id))) return new Response(JSON.stringify({ok:false,description:'Forbidden: bot was blocked by the user'}));
  const result = m==='getMe'?{username:'SoulHomeRuBot'}:m==='getWebhookInfo'?{url:'https://w.dev/webhook'}:{message_id:7};
  return new Response(JSON.stringify({ok:true,result}));
};
const baseEnv = () => ({ BOT_TOKEN:'T', ADMIN_CHAT_ID:'100', WEBHOOK_SECRET:'x'.repeat(24), KV:new MemKV(), SITE_URL:'https://soul-of-home.vercel.app', ALLOWED_ORIGIN:'https://soul-of-home.vercel.app' });
let env = baseEnv();
const ctx = { w:[], waitUntil(p){this.w.push(p);} };
const tgc = () => calls.filter(c=>c.u.includes('api.telegram.org')).map(c=>({m:c.u.split('/').pop(),...c.body}));
async function hook(update){ calls=[]; ctx.w=[]; const r=await worker.fetch(new Request('https://w.dev/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':env.WEBHOOK_SECRET},body:JSON.stringify(update)}),env,ctx); await Promise.all(ctx.w); return r; }
const U={id:555,first_name:'Анна',username:'anna'};
const msg=(text,extra={})=>({message:{message_id:9,chat:{id:555,type:'private'},from:U,...(text!=null?{text}:{}),...extra}});
const cb=(data)=>({callback_query:{id:'q',from:U,data,message:{chat:{id:555}}}});
const adm=(text,extra={})=>({message:{message_id:50,chat:{id:100,type:'private'},from:{id:100},text,...extra}});
let ok=0; const t=async(n,f)=>{ try{ await f(); ok++; console.log('✓',n);}catch(e){ console.log('✗',n,'\n   ',e.message); process.exitCode=1; } };

await t('вебхук с чужим секретом — 403', async()=>{ const r=await worker.fetch(new Request('https://w.dev/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'bad'},body:'{}'}),env,ctx); assert.equal(r.status,403); });
await t('/start: фото Нейрокота и меню', async()=>{ await hook(msg('/start')); const c=tgc(); assert.equal(c[0].m,'sendPhoto'); assert.match(c[0].caption,/Мур, привет, Анна/); assert.ok(c[0].reply_markup.keyboard); });
await t('если фото не загрузилось — приветствие текстом', async()=>{ const o=globalThis.fetch; globalThis.fetch=async(u,op)=>String(u).endsWith('sendPhoto')?new Response('{"ok":false}'):o(u,op); await hook(msg('/start')); globalThis.fetch=o; assert.ok(tgc().some(x=>x.m==='sendMessage'&&/Нейрокот/.test(x.text))); });
await t('?start=velvet открывает курс', async()=>{ await hook(msg('/start velvet')); const c=tgc(); assert.match(c[1].text,/Бархатный шар/); assert.equal(c[1].reply_markup.inline_keyboard[0][0].callback_data,'lead:velvet'); });
await t('?start=velvet-k7f3q: мастеру «клиент по заявке №K7F3Q открыл бота» с меткой', async()=>{ await hook(msg('/start velvet-k7f3q')); const a=tgc().find(x=>x.chat_id==='100'); assert.match(a.text,/заявке №K7F3Q/); assert.match(a.text,/#id555/); });
await t('кнопки меню: коллекция, обучение, уроки, заявка, сайт', async()=>{
  await hook(msg('🎄 Коллекция шаров')); assert.match(tgc()[0].text,/12 авторских моделей/);
  await hook(msg('🎓 Обучение')); assert.equal(tgc()[0].reply_markup.inline_keyboard.length,6);
  await hook(msg('📚 Бесплатные уроки')); assert.equal(tgc()[0].reply_markup.inline_keyboard.length,8);
  await hook(msg('✍️ Оставить заявку')); assert.equal(tgc()[0].reply_markup.inline_keyboard.length,8);
  await hook(msg('🌐 Сайт')); assert.match(tgc()[0].text,/soul-of-home\.vercel\.app\/obuchenie/); });
await t('карточка курса и урока', async()=>{ await hook(cb('course:embroidery')); assert.match(tgc()[1].text,/Вышивка, жемчуг/); await hook(cb('lesson:3')); assert.match(tgc()[1].text,/первый бархатный шар/); });
await t('заявка на курс: подсказка → комментарий → мастеру и клиенту', async()=>{
  await hook(cb('lead:velvet')); assert.match(tgc()[1].text,/#заявка:velvet/);
  await hook(msg('Никогда не шила, хочу попробовать')); const c=tgc(); const a=c.find(x=>x.chat_id==='100');
  assert.match(a.text,/Заявка на курс «Бархатный шар»/); assert.match(a.text,/Никогда не шила/); assert.match(a.text,/#id555/);
  assert.match(c.at(-1).text,/Заявка у мастера/); assert.equal(env.KV.m.has('lt:555'),false); });
await t('заявка работает и без KV — по ответу на подсказку', async()=>{ const e=env; env={...baseEnv(),KV:undefined};
  await hook(msg('Хочу 5 шаров к 20 декабря, изумруд',{reply_to_message:{from:{is_bot:true},text:'Шар под вашу ёлку… #заявка:order'}}));
  assert.match(tgc().find(x=>x.chat_id==='100').text,/Заказ шара/); env=e; });
await t('«Отправить без комментария»', async()=>{ await hook(cb('send:order')); const a=tgc().find(x=>x.chat_id==='100'); assert.match(a.text,/Заказ шара[\s\S]*без комментария/); });
await t('вопрос → ИИ (OpenRouter): без <think> и звёздочек, история в KV', async()=>{ env.AI_API_KEY='sk-or-1';
  await hook(msg('С чего начать новичку?')); const ai=calls.find(c=>c.u.includes('/chat/completions'));
  assert.equal(ai.body.messages[0].role,'system'); assert.match(ai.body.messages[0].content,/Нейрокот/); assert.equal(ai.body.model,'qwen/qwen3.8-27b:free'); assert.deepEqual(ai.body.reasoning,{enabled:false});
  const ans=tgc().find(x=>x.m==='sendMessage'); assert.equal(ans.text,aiReply); assert.equal(JSON.parse(env.KV.m.get('h:555').value).length,2);
  await hook(msg('А сколько уроков?')); const ai2=calls.find(c=>c.u.includes('/chat/completions')); assert.equal(ai2.body.messages.length,4); });
await t('ИИ недоступен → база вопросов + вопрос мастеру', async()=>{ aiFail=true; await hook(msg('сколько стоит курс?')); aiFail=false; const c=tgc(); assert.match(c.find(x=>x.chat_id==='100').text,/Вопрос из бота/); assert.match(c.at(-1).text,/Стоимость зависит[\s\S]*передал вопрос мастеру/); });
await t('Claude, если задан только ANTHROPIC_API_KEY', async()=>{ delete env.AI_API_KEY; env.ANTHROPIC_API_KEY='sk-ant'; await hook(msg('как выбрать лампу?')); const a=calls.find(c=>c.u.includes('anthropic')); assert.equal(a.headers['anthropic-version'],'2023-06-01'); assert.equal(a.body.model,'claude-haiku-4-5-20251001'); assert.match(tgc().at(-1).text,/^Claude:/); delete env.ANTHROPIC_API_KEY; });
await t('без ИИ: ответ по базе', async()=>{ await hook(msg('какой свет выбрать')); assert.match(tgc().at(-1).text,/2700–3000 K/); });
await t('фото от клиента → мастеру копией с меткой', async()=>{ await hook(msg(null,{photo:[{file_id:'p'}],caption:'моя работа'})); const c=tgc(); assert.equal(c[0].m,'copyMessage'); assert.match(c[0].caption,/Вложение от клиента[\s\S]*моя работа[\s\S]*#id555/); });
await t('ответ мастера текстом → клиенту с подписью', async()=>{ await hook(adm('Здравствуйте! Набор есть',{reply_to_message:{text:'… #id555'}})); const c=tgc(); assert.equal(c[0].chat_id,'555'); assert.match(c[0].text,/Ответ мастера Soul of Home:\n\nЗдравствуйте/); assert.match(c[1].text,/Отправлено/); });
await t('ответ мастера фото → копия клиенту', async()=>{ await hook({message:{message_id:51,chat:{id:100,type:'private'},from:{id:100},photo:[{file_id:'z'}],reply_to_message:{caption:'… #id555'}}}); assert.equal(tgc()[0].m,'copyMessage'); assert.equal(tgc()[0].chat_id,'555'); });
await t('мастер без reply — подсказка; /funnel — статистика', async()=>{ await hook(adm('привет')); assert.match(tgc()[0].text,/reply/); await hook(adm('/funnel')); assert.match(tgc()[0].text,/Воронка «Офис к Новому году»/); });
await t('группа мастера: /myid работает в любой группе', async()=>{ await hook({message:{message_id:1,chat:{id:-200,type:'supergroup'},from:U,text:'/myid'}}); assert.match(tgc()[0].text,/-200/); await hook({message:{message_id:1,chat:{id:-200,type:'supergroup'},from:U,text:'привет'}}); assert.equal(tgc().length,0); });

// ---- воронка ----
await t('?start=office: чек-лист и вход в воронку', async()=>{ env=baseEnv(); await hook(msg('/start office')); const c=tgc(); assert.match(c.find(x=>x.text)?.text||c[1].text,/чек-лист/); const s=JSON.parse(env.KV.m.get('fn:555').value); assert.equal(s.status,'active'); assert.equal(s.step,0); assert.ok(s.next_at>Date.now()); assert.deepEqual(env.KV.m.get('fn:555').metadata,s); });
await t('окно отправки: будни 10–19 МСК', async()=>{
  const msk=(y,mo,d,h,mi=0)=>Date.UTC(y,mo-1,d,h-3,mi);
  assert.equal(mod.inWindow(msk(2026,10,7,12)), msk(2026,10,7,12));   // ср 12:00 — сразу
  assert.equal(mod.inWindow(msk(2026,10,7,8)), msk(2026,10,7,10));    // ср 8:00 → 10:00
  assert.equal(mod.inWindow(msk(2026,10,7,20)), msk(2026,10,8,10));   // ср 20:00 → чт 10:00
  assert.equal(mod.inWindow(msk(2026,10,3,12)), msk(2026,10,5,10));   // сб → пн 10:00
});
await t('Cron: шаги приходят по очереди, затем «finished»', async()=>{
  const st=JSON.parse(env.KV.m.get('fn:555').value);
  for (let i=0;i<mod.STEPS.length;i++){ st.next_at=Date.now()-1000; await env.KV.put('fn:555',JSON.stringify(st),{metadata:st}); calls=[];
    const r=await mod.funnelTick(env); assert.equal(r.sent,1,'шаг '+i); Object.assign(st,JSON.parse(env.KV.m.get('fn:555').value));
    assert.equal(tgc()[0].text, mod.STEPS[i].text); }
  assert.equal(st.status,'finished'); calls=[]; assert.equal((await mod.funnelTick(env)).sent,0); });
await t('не время — ничего не отправляет', async()=>{ env=baseEnv(); await hook(msg('/start office')); calls=[]; assert.equal((await mod.funnelTick(env)).sent,0); });
await t('кнопка «Оставить телефон» → контакт → заявка, воронка останавливается', async()=>{
  await hook(cb('fn:phone')); assert.equal(tgc()[1].reply_markup.keyboard[0][0].request_contact,true);
  await hook(msg(null,{contact:{phone_number:'+79161234567'}})); const a=tgc().find(x=>x.chat_id==='100'); assert.match(a.text,/Заявка: оформление офиса[\s\S]*номер телефона[\s\S]*\+79161234567/);
  const s=JSON.parse(env.KV.m.get('fn:555').value); assert.equal(s.status,'lead'); assert.equal(s.next_at,null); });
await t('фото помещения в воронке = заявка', async()=>{ env=baseEnv(); await hook(msg('/start checklist')); await hook(msg(null,{photo:[{file_id:'r'}],caption:'офис 120 м²'}));
  const c=tgc(); assert.ok(c.some(x=>x.chat_id==='100'&&/фото помещения/.test(x.text||''))); assert.match(c.at(-1).text,/фото у дизайнера/); assert.equal(JSON.parse(env.KV.m.get('fn:555').value).status,'lead'); });
await t('lead-кнопки воронки, «Напомнить в октябре», /stop', async()=>{ env=baseEnv(); await hook(msg('/start office'));
  await hook(cb('fn:lead:palette')); assert.match(tgc().find(x=>x.chat_id==='100').text,/палитру под бренд/);
  await hook(cb('fn:remind')); let s=JSON.parse(env.KV.m.get('fn:555').value); assert.equal(s.status,'remind'); assert.equal(new Date(s.next_at+3*3600e3).getUTCMonth(),9);
  s.next_at=Date.now()-1; await env.KV.put('fn:555',JSON.stringify(s),{metadata:s}); calls=[]; await mod.funnelTick(env); assert.match(tgc()[0].text,/сезон начинается/); assert.equal(JSON.parse(env.KV.m.get('fn:555').value).status,'active');
  await hook(msg('/stop')); assert.equal(JSON.parse(env.KV.m.get('fn:555').value).status,'stopped'); });
await t('заблокировавший бота клиент помечается и больше не получает', async()=>{ env=baseEnv(); await hook(msg('/start office')); const s=JSON.parse(env.KV.m.get('fn:555').value); s.next_at=Date.now()-1; await env.KV.put('fn:555',JSON.stringify(s),{metadata:s});
  blocked.add('555'); await mod.funnelTick(env); blocked.clear(); assert.equal(JSON.parse(env.KV.m.get('fn:555').value).status,'blocked'); });
await t('/funnel считает статусы', async()=>{ await hook(adm('/funnel')); assert.match(tgc()[0].text,/Вошли: 1/); });

// ---- заявки с сайта ----
const site='https://soul-of-home.vercel.app';
async function lead(body,origin=site,ip='1.1.1.1'){ calls=[]; return worker.fetch(new Request('https://w.dev/lead',{method:'POST',headers:{origin,'cf-connecting-ip':ip},body:JSON.stringify(body)}),env,ctx); }
await t('заявка «Офис»: номер, поля, ответ {ok,id}', async()=>{ env=baseEnv(); const r=await lead({form:'office',name:'Ольга',company:'ООО Ромашка',phone:'+7 (916) 123-45-67',email:'o@r.ru',date:'20.12',zone:'ресепшн',page:'/kompanii'});
  assert.equal(r.status,200); const j=await r.json(); assert.match(j.id,/^[A-Z0-9]{5}$/); assert.equal(r.headers.get('access-control-allow-origin'),site);
  const a=tgc()[0]; assert.equal(a.chat_id,'100'); assert.match(a.text,new RegExp('№'+j.id)); assert.match(a.text,/Компания: ООО Ромашка/); });
await t('заявка на курс', async()=>{ const r=await lead({form:'course',course:'Бархатный шар'},site,'2.2.2.2'); assert.equal(r.status,200); assert.match(tgc()[0].text,/Программа: Бархатный шар/); });
await t('проверки: чужой сайт 403, мало цифр 422, неверная форма 400, ловушка', async()=>{
  assert.equal((await lead({form:'course',course:'x'},'https://evil.ru')).status,403);
  assert.equal((await lead({form:'office',name:'a',phone:'123'},site,'3.3.3.3')).status,422);
  assert.equal((await lead({form:'zzz'},site,'4.4.4.4')).status,400);
  const r=await lead({form:'course',course:'x',website:'spam'},site,'5.5.5.5'); assert.equal(r.status,200); assert.equal(tgc().length,0); });
await t('не больше 5 заявок с IP за 10 минут', async()=>{ for(let i=0;i<5;i++) assert.equal((await lead({form:'course',course:'Бархатный шар'},site,'9.9.9.9')).status,200); assert.equal((await lead({form:'course',course:'x'},site,'9.9.9.9')).status,429); });
await t('HTML-теги из формы вырезаются', async()=>{ await lead({form:'course',course:'<script>x</script>Шар'},site,'6.6.6.6'); assert.doesNotMatch(tgc()[0].text,/<script>/); });
await t('/setup, /status, /tick', async()=>{ calls=[]; let r=await worker.fetch(new Request('https://w.dev/setup?key='+env.WEBHOOK_SECRET),env,ctx); const j=await r.json(); assert.equal(j.bot,'SoulHomeRuBot'); assert.equal(j.kv,true);
  assert.ok(tgc().some(c=>c.m==='setWebhook'&&c.url==='https://w.dev/webhook'&&c.secret_token===env.WEBHOOK_SECRET));
  assert.equal((await worker.fetch(new Request('https://w.dev/setup?key=no'),env,ctx)).status,403);
  r=await worker.fetch(new Request('https://w.dev/status'),env,ctx); const s=await r.json(); assert.equal(s.webhook_points_here,true); assert.equal(s.kv,'подключено'); assert.doesNotMatch(JSON.stringify(s),/"T"/);
  r=await worker.fetch(new Request('https://w.dev/tick?key='+env.WEBHOOK_SECRET),env,ctx); assert.equal(r.status,200); });
await t('scheduled() вызывает рассылку', async()=>{ const c={w:[],waitUntil(p){this.w.push(p);}}; await worker.scheduled({},env,c); await Promise.all(c.w); });
// ---- новое для сайта soul_of_home ----
const sb = () => calls.filter(c=>c.u.includes('supabase.co/rest/v1/soul_home_leads')).map(c=>c.body);
await t('форма «Обучение» (apply): копия мастеру с программой, контактом и комментарием', async()=>{ env=baseEnv();
  const r=await lead({form:'apply',course:'Бархатный шар',name:'Ольга',contact:'+7 916 000-00-00',message:'Никогда не шила',page:'/obuchenie'},site,'7.7.7.7');
  assert.equal(r.status,200); const j=await r.json(); const a=tgc()[0].text;
  assert.match(a,new RegExp('Заявка на обучение с сайта · №'+j.id)); assert.match(a,/Программа: Бархатный шар/); assert.match(a,/Контакт: \+7 916/); assert.match(a,/Комментарий: Никогда не шила/); assert.match(a,/soul_home_leads/); });
await t('apply без контакта — 422', async()=>{ assert.equal((await lead({form:'apply',course:'Бархатный шар',name:'x',contact:'1'},site,'8.8.8.8')).status,422); });
await t('длинный комментарий не обрезается до 200 символов', async()=>{ const long='а'.repeat(600); await lead({form:'apply',course:'Бархатный шар',name:'x',contact:'@olga',message:long},site,'8.8.8.1'); assert.ok(tgc()[0].text.includes(long)); });
await t('заявка из бота сохраняется в Supabase (source=telegram)', async()=>{ env=baseEnv();
  await hook(cb('lead:embroidery')); await hook(msg('Хочу научиться вышивке'));
  const row=sb()[0]; assert.ok(row,'нет записи'); assert.equal(row.course,'Вышивка, жемчуг и кружево'); assert.equal(row.contact,'@anna'); assert.equal(row.source,'telegram'); assert.equal(row.message,'Хочу научиться вышивке'); assert.equal(row.consent,true); });
await t('заказ шара и заявка воронки тоже сохраняются; вопрос мастеру — нет', async()=>{
  await hook(cb('send:order')); assert.equal(sb()[0].course,'Заказ шара');
  await hook(cb('lead:other')); await hook(msg('Есть доставка в Казань?')); assert.equal(sb().length,0);
  env=baseEnv(); await hook(msg('/start office')); await hook(cb('fn:lead:estimate')); assert.equal(sb()[0].course,'Оформление офиса'); });
await t('без SITE_URL: кнопки на сайт скрыты, «Сайт» отвечает мягко', async()=>{ env={...baseEnv(),SITE_URL:''};
  await hook(msg('🎄 Коллекция шаров')); assert.equal(tgc()[0].reply_markup.inline_keyboard.length,1);
  await hook(msg('🌐 Сайт')); assert.match(tgc()[0].text,/скоро откроется/); });
await t('ALLOWED_ORIGIN не задан — заявки принимаются с любого сайта', async()=>{ env={...baseEnv(),ALLOWED_ORIGIN:''}; const r=await lead({form:'apply',course:'x',name:'y',contact:'@zz'},'https://any.site','1.2.3.4'); assert.equal(r.status,200); });

console.log(`\n${ok} тестов пройдено`);
