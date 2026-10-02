/**
 * Нейрокот — Telegram-бот @SoulHomeRuBot мастерской и школы ручной работы Soul of Home.
 * Версия для нового сайта soul_of_home (Vercel). Cloudflare Workers: без своего сервера, бесплатно.
 * Устроен так же, как боты Salon de Fleur и «Рядом»: консультант + уведомления о заявках с сайта.
 *
 *  • /start с фото Нейрокота и меню; глубокие ссылки t.me/SoulHomeRuBot?start=velvet|order|kursy|uroki|office…
 *  • коллекция шаров, программы обучения (карточка каждого курса), бесплатные уроки;
 *  • заявки на курс / заказ шара / вопрос мастеру — карточка уходит мастеру (ADMIN_CHAT_ID);
 *  • свободные вопросы — ИИ (OpenRouter/DeepSeek или Claude), без ключа — база частых вопросов + вопрос мастеру;
 *  • мастер отвечает клиенту ответом (Reply) на карточку бота;
 *  • фото и файлы клиентов пересылаются мастеру;
 *  • автоворонка «Офис к Новому году» (?start=office): чек-лист и 6 сообщений по будням 10–19 МСК, кнопка «Отправить мой номер»,
 *    /stop, «Напомнить в октябре», статистика /funnel;
 *  • приём заявок с сайта: POST /lead — форма «Обучение» (form: 'apply'), номер заявки связывает её с клиентом в боте;
 *  • заявки из бота сохраняются в ту же таблицу Supabase soul_home_leads, что и с сайта (source = 'telegram').
 *
 * Переменные (Workers → Settings → Variables and Secrets):
 *   BOT_TOKEN        — токен @BotFather (секрет)
 *   ADMIN_CHAT_ID    — чат мастера: напишите боту /myid
 *   WEBHOOK_SECRET   — любая строка из латиницы и цифр, 20+ символов (секрет)
 *   SITE_URL         — адрес сайта, по умолчанию https://soulofhome.ru/
 *   ALLOWED_ORIGIN   — откуда принимать заявки, по умолчанию https://soulofhome.ru и https://www.soulofhome.ru (несколько — через запятую; * — с любого)
 *   SUPABASE_URL, SUPABASE_KEY — необязательно: куда сохранять заявки из бота (по умолчанию — проект сайта, публичный ключ)
 *   AI_API_KEY, AI_BASE_URL, AI_MODEL — ИИ через OpenAI-совместимый сервис (по умолчанию OpenRouter, бесплатная Qwen)
 *   ANTHROPIC_API_KEY, ANTHROPIC_MODEL — или Claude (используется, если AI_API_KEY пуст)
 *   WELCOME_PHOTO_URL — картинка приветствия (по умолчанию neurocat.jpg из репозитория)
 * Привязки:
 *   KV (KV namespace) — память бота: воронка, история диалога для ИИ, выбранный курс. Без неё бот работает,
 *                       но воронка не присылает сообщения по расписанию, а ИИ не помнит предыдущие реплики.
 *   Cron Trigger «*\/5 * * * *» — раз в 5 минут отправляет очередные сообщения воронки.
 *
 * Маршруты: POST /webhook · POST /lead · GET /setup?key=… · GET /test-lead?key=… · GET /status
 */

/* =====================================================================================
   ТЕКСТЫ (knowledge.py) — меняйте здесь
   ===================================================================================== */

const SITE_NAME = 'Soul of Home';
const DEFAULT_SITE = 'https://soulofhome.ru/';
const DEFAULT_ORIGIN = 'https://soulofhome.ru,https://www.soulofhome.ru';
const SUPABASE_DEFAULT = { url: 'https://wuvadreohiphwevprwmk.supabase.co', key: 'sb_publishable_QnCBQILrqr6PhrAE8521NA_edLJSMA-' };
const DEFAULT_PHOTO = 'https://raw.githubusercontent.com/aperevedencev-glitch/soul_of_house/main/soulhome-bot/neurocat.jpg';

const WELCOME = (name) =>
  `Мур, привет, ${name}! Я Нейрокот — помощник мастерской и школы ручной работы Soul of Home 🐾\n\n` +
  'Здесь можно:\n' +
  '— посмотреть коллекцию новогодних шаров ручной работы\n' +
  '— выбрать курс и оставить заявку\n' +
  '— почитать бесплатные уроки об уюте\n' +
  '— или просто задать мне вопрос — пишите как в обычный чат.\n\n' +
  'Выберите раздел в меню ниже 👇';

const HELP =
  'Что я умею:\n' +
  '/start — начать сначала\n' +
  '/raboty — коллекция шаров\n' +
  '/kursy — программы обучения\n' +
  '/uroki — бесплатные уроки\n' +
  '/zayavka — оставить заявку\n' +
  '/help — эта подсказка\n\n' +
  'А ещё можно просто написать вопрос — про уют, рукоделие или курсы.';

const COLLECTION =
  '🎄 Коллекция «Новогодние шары»\n' +
  '12 авторских моделей, каждая 8 см, 100% ручная работа. Бархат, кружево, атлас, жемчуг, стразы, кристаллы.\n\n' +
  'Айвори и белый:\n' +
  '— Шар с камеей и кружевом\n— Шар с белыми цветами и кисточкой\n— Шар с белым бантом и кисточкой\n— Шар с балериной\n— Шар с цветами и жемчугом\n\n' +
  'Изумрудный бархат:\n' +
  '— Шар из бархата и вышивки\n— Шар с изумрудным бантом\n— Бархатный шар с блеском\n— Шар бархатный с бантом\n\n' +
  'Красный:\n' +
  '— Шар с бархатной отделкой\n— Шар из смешанных материалов\n— Винтажный шар\n\n' +
  'Хотите шар под цвет вашей ёлки или интерьера? Нажмите «Заказать шар» — мастер ответит лично.';

// id, название, уровень, объём, описание
const COURSES = [
  ['velvet', 'Бархатный шар', 'Для начинающих', '3 урока',
    'Базовая техника, на которой построена половина коллекции: подготовка основы 8 см и раскрой бархата, обтяжка без морщин и видимых швов, бант, кисточка, подвес и фурнитура. Лучший старт, если вы никогда не шили.'],
  ['embroidery', 'Вышивка, жемчуг и кружево', 'Средний уровень', '5 уроков',
    'Декор, который превращает шар в дизайн-объект: объёмная вышивка металлизированной нитью, жемчуг, стразы и кристаллы, камея, кружево и объёмные цветы из ткани.'],
  ['collection', 'Своя авторская коллекция', 'Продвинутый', '4 урока',
    'Как придумать серию шаров с единым характером: концепция, название и история коллекции, палитра и материалы для 6–12 моделей, фотосъёмка при дневном свете.'],
  ['home', 'Дизайн уютного дома', 'Для всех', '6 уроков',
    'Основы, которые меняют ощущение от квартиры без ремонта: палитра 60/30/10, сценарии света и тёплые лампы, текстиль, фактуры и композиция на полках.'],
  ['holiday', 'Праздничный интерьер', 'Для всех', '4 урока',
    'Ёлка, стол и дом к Новому году в одном стиле: ёлка как композиция, венок и декор двери, сервировка праздничного стола.'],
  ['business', 'От хобби к делу', 'Для мастеров', 'личный разбор, 45 минут',
    'Для тех, кто уже делает изделия и хочет продавать: формула цены (материалы, время, экспертность), портфолио и карточка товара, каналы продаж — ярмарки, маркетплейсы, опт, корпоративные подарки.'],
];

const HOW_IT_WORKS =
  'Как проходит обучение:\n' +
  '1. Заявка — я помогаю выбрать программу под ваш опыт.\n' +
  '2. Список материалов с размерами (для «Бархатного шара» можно заказать набор).\n' +
  '3. Видеоуроки в своём темпе, доступ остаётся у вас.\n' +
  '4. Фото готовой работы и личная обратная связь.\n\n' +
  'Опыт не обязателен. Стоимость и даты старта мастер пришлёт в ответ на заявку.';

const LESSONS = [
  ['Палитра по правилу 60 · 30 · 10',
    '60% — основной цвет (стены, хвоя и крупные шары), 30% — поддерживающий (шторы, лента, средние игрушки), 10% — акцент (золото, стразы, 2–3 красных шара). Акцент удобно взять из любимой вещи.'],
  ['Тёплый свет: 2700 K и три уровня',
    'Для жилых комнат — лампы 2700–3000 K. Три уровня: общий (люстра), локальный (торшер, настольная лампа), акцентный (гирлянда, свечи, подсветка). Вечером выключите верхний свет. Индекс цветопередачи CRI 90+ сохраняет цвета тканей.'],
  ['Правило трёх текстур',
    'В одной композиции сочетайте гладкое (атлас, стекло, металл), мягкое (бархат, шерсть, букле) и рельефное (кружево, вышивка, вязка, плетёная корзина). Даже в одном цвете это выглядит дорого.'],
  ['Как сделать первый бархатный шар',
    'Мастер-класс в 6 шагов. 1) Материалы: пенопластовая основа 8 см, бархат ~30×30 см (лучше стрейч), прозрачный клей для ткани, декор, шапочка с петлёй, лента. 2) Круг бархата ⌀ 26–28 см, клей тонким слоем, натягивайте ткань от низа вверх по кругу, излишки соберите наверху. 3) Декор: вышивка металлизированной нитью, бусины, жемчуг, стразы — свой узор. 4) Шапочка на каплю клея, лента и бант. 5) Проверьте крепления и дайте высохнуть. 6) Готово! Советы: качественный бархат не осыпается, пенопласт даёт ровную поверхность, экспериментируйте с цветом.'],
  ['Как нарядить ёлку объёмно',
    'Расправить ветки → гирлянда от ствола к краю (ориентир ~100 лампочек на 30 см высоты) → крупные простые шары вглубь → средние треугольниками → авторские шары снаружи на уровне глаз → лента и верхушка. Отойдите на три шага и прищурьтесь.'],
  ['Подушки и пледы',
    'Нечётное число подушек, сзади крупнее (50×50), впереди мельче (40×40). Одна с узором, остальные однотонные разных фактур. Плед — небрежно через подлокотник.'],
  ['Хранение игрушек',
    'Проверить стразы и бусины, почистить бархат мягкой щёткой, завернуть каждый шар в папиросную бумагу, коробка с ячейками, сухое место и пакетик силикагеля. Не мочить вышивку и не хранить на балконе.'],
  ['Упаковка подарка ручной работы',
    'Жёсткая коробка с наполнителем, сдержанная обёртка (крафт, бархатная лента, веточка хвои) и карточка с историей: название, материалы, уход, для кого делали, год.'],
];

const FAQ = [
  [['цен', 'стоим', 'сколько стоит', 'прайс', 'оплат'],
    'Стоимость зависит от программы и формата. Оставьте заявку — мастер пришлёт цены и ближайшие даты старта лично. Нажмите «✍️ Оставить заявку».'],
  [['новичк', 'начать', 'с чего', 'никогда не', 'первый раз'],
    'Лучший старт — курс «Бархатный шар»: 3 урока, опыт не нужен, в конце у вас готовая игрушка. Если хочется про интерьер — «Дизайн уютного дома».'],
  [['заказ', 'купить', 'под цвет', 'на заказ'],
    'Шар можно заказать под цвет вашей ёлки или интерьера. Нажмите «Заказать шар» в разделе коллекции или просто опишите, что хотите, — я передам мастеру.'],
  [['достав', 'отправ', 'почт'],
    'Про доставку и сроки ответит мастер лично — я уже передаю ему ваш вопрос.'],
  [['материал', 'набор'],
    'Список материалов с размерами выдаётся на курсе, а для «Бархатного шара» можно заказать готовый набор. Базовое: пенопластовый шар 8 см, бархат, клей для ткани, булавки, шнур, колпачок с петлёй.'],
  [['свет', 'ламп', 'освещ'],
    'Для уюта берите лампы 2700–3000 K и используйте три уровня света: общий, локальный и акцентный. Подробнее — в разделе «📚 Бесплатные уроки».'],
  [['цвет', 'палитр'],
    'Правило 60 · 30 · 10: основной цвет, поддерживающий и акцент. Работает и для ёлки, и для комнаты. Подробнее — в «📚 Бесплатные уроки».'],
];

const SYSTEM_PROMPT = `Ты — Нейрокот, пушистый ИИ-помощник и талисман мастерской и школы ручной работы ${SITE_NAME}. Ты отвечаешь людям в Telegram-боте @SoulHomeRuBot.

Задача: помогать с вопросами о дизайне уютного дома, о создании новогодних шаров и декора ручной работы, о коллекции и программах обучения, подсказывать, с чего начать, и мягко вести к заявке на курс или заказу.

Стиль: тёплый, дружелюбный, спокойный, чуть-чуть кошачьего обаяния (изредка «мур» или 🐾), но по делу. Пиши по-русски, коротко: 2–6 предложений или короткий список с «—». Без Markdown: никаких звёздочек, решёток и таблиц. Эмодзи — не больше одного-двух.

Правила:
- Не выдумывай цены, даты стартов, сроки доставки и наличие. На такие вопросы отвечай, что мастер пришлёт это лично, и предлагай нажать «✍️ Оставить заявку».
- Если человек хочет купить, заказать или записаться — предложи кнопку «✍️ Оставить заявку».
- Если вопрос не про дом, уют, рукоделие или ${SITE_NAME} — мягко верни разговор к этим темам.
- Не проси и не принимай платёжные данные.

КОЛЛЕКЦИЯ:
${COLLECTION}

ПРОГРАММЫ ОБУЧЕНИЯ:
${COURSES.map(([, t, lvl, vol, d]) => `— «${t}» (${lvl}, ${vol}): ${d}`).join('\n')}

${HOW_IT_WORKS}

БЕСПЛАТНЫЕ УРОКИ:
${LESSONS.map(([t, d]) => `— ${t}: ${d}`).join('\n')}`;

/* ---------- воронка «Офис к Новому году» (funnel.py) ---------- */

const WORK_FROM = 10, WORK_TO = 19;         // окно отправки, часы по Москве
const WORKDAYS = [0, 1, 2, 3, 4];           // пн–пт
const ENTRY_ARGS = ['office', 'checklist']; // глубокие ссылки, которые запускают воронку

const PACKAGES =
  '📄 Пакеты оформления «под ключ»\n\n' +
  'Базовый — концепция, ёлка с гирляндой, входная зона или ресепшн, монтаж, демонтаж и вывоз.\n\n' +
  'Оптимальный — 80 000 ₽. Всё из «Базового» + фотозона и авторские бархатные шары ручной работы. Выбирают чаще всего.\n\n' +
  'Расширенный — всё из «Оптимального» + оформление столов и зала корпоратива и шары с логотипом в подарок сотрудникам.\n\n' +
  'Точная стоимость зависит от площади, высоты ёлки и числа зон — её пришлём после фото помещения или 30-минутного выезда дизайнера.';

const CHECKLIST = (name) =>
  `Мур, ${name}! Вот чек-лист «Офис к новогоднему корпоративу за 7 шагов» 🎄\n\n` +
  '1. За 8 недель — бюджет и кто утверждает концепцию. Средний проект под ключ — около 80 000 ₽.\n' +
  '2. За 7 недель — палитра под фирменный стиль по правилу 60 · 30 · 10.\n' +
  '3. За 6 недель — список зон: вход, ёлка, фотозона, столы. Замерьте высоту потолков.\n' +
  '4. За 5 недель — дата монтажа. Вторая половина декабря расписывается первой.\n' +
  '5. За 4 недели — концепция и смета. Проверьте, что в неё входят монтаж, демонтаж и вывоз.\n' +
  '6. За 1–2 дня — монтаж вечером или в выходной. Тёплый свет 2700–3000 K.\n' +
  '7. После праздников — демонтаж и хранение. Шары с логотипом можно подарить сотрудникам.\n\n' +
  '🎁 Хотите бесплатную концепцию оформления вашего офиса? Пришлите сюда 3–4 фото помещения — ' +
  'дизайнер подготовит палитру под ваш бренд и план зон за 2 рабочих дня.';

const HOW_PHOTO = '📷 Просто отправьте фото сюда, в чат — одним или несколькими сообщениями: вход, место под ёлку и зону, ' +
  'где будет праздник. В подписи можно указать дату корпоратива и что оформить.';

const BTN_START = [['📷 Как прислать фото', 'photo'], ['📞 Оставить телефон', 'phone'], ['📄 Пакеты и цены', 'packages']];

const STEPS = [
  { after_h: 2, text: 'Кстати, концепция — бесплатно и ни к чему не обязывает 🐾\n\n' +
      'Достаточно 3–4 фото: вход, место под ёлку и зона, где будет праздник. ' +
      'Через 2 рабочих дня пришлём палитру под ваш фирменный стиль и план зон.',
    buttons: [['📷 Как прислать фото', 'photo']] },
  { after_h: 24, text: 'Урок дня: почему одни офисы на фото выглядят дорого, а другие — пёстро.\n\n' +
      'Секрет — правило 60 · 30 · 10:\n' +
      '— 60% основной цвет: хвоя, крупные шары, текстиль;\n' +
      '— 30% поддерживающий: ленты, средние шары, свечи;\n' +
      '— 10% акцент: золото или фирменный цвет компании.\n\n' +
      'Не больше трёх цветов — и пространство выглядит собранным. Подобрать палитру под ваш бренд?',
    buttons: [['🎨 Подобрать палитру под наш бренд', 'lead:palette']] },
  { after_h: 72, text: '4 ошибки, из-за которых новогодний офис выглядит «как у всех»:\n\n' +
      '1. Сотрудники наряжают сами, после работы — выходит наспех.\n' +
      '2. Декор из разных магазинов — цвета спорят, ёлка плоская.\n' +
      '3. Нет фотозоны — на снимках с праздника не видно стиля компании.\n' +
      '4. Никто не подумал про демонтаж — коробки стоят до весны.\n\n' +
      'Мы берём всё на себя: концепция, монтаж за одну смену вечером или в выходной, демонтаж и вывоз.',
    buttons: [['📄 Пакеты и цены', 'packages']] },
  { after_h: 120, text: PACKAGES, buttons: [['✍️ Рассчитать смету', 'lead:estimate']] },
  { after_h: 168, text: 'Про даты 📅\n\n' +
      'Монтаж мы делаем за одну смену, но смен в декабре ограниченное число, и вторая половина месяца уходит первой. ' +
      'Давайте закрепим за вами дату сейчас — концепцию можно доработать позже.',
    buttons: [['📌 Закрепить дату', 'lead:date']] },
  { after_h: 288, text: 'Это последнее сообщение из серии 🐾\n\n' +
      'Если с оформлением в этом году уже всё решено — напомнить о нас в следующем сезоне?',
    buttons: [['🔔 Напомнить в октябре', 'remind'], ['✍️ Обсудить сейчас', 'lead:talk'], ['🚫 Больше не писать', 'stop']] },
];

const REMIND_TEXT = 'Мур! Новогодний сезон начинается 🎄 Самое время подумать об оформлении офиса к корпоративу — ' +
  'лучшие даты монтажа в декабре разбирают первыми. Напомню, как всё устроено:';

const LEAD_TITLES = {
  photo: 'фото помещения', phone: 'номер телефона', estimate: 'хочет рассчитать смету',
  palette: 'хочет палитру под бренд', date: 'хочет закрепить дату монтажа', talk: 'хочет обсудить сейчас',
};
const BTN_SHARE = '📱 Отправить мой номер';
const BTN_CANCEL = 'Отмена';

/* ---------- меню ---------- */

const B = { coll: '🎄 Коллекция шаров', courses: '🎓 Обучение', lessons: '📚 Бесплатные уроки', lead: '✍️ Оставить заявку', ask: '🐱 Спросить Нейрокота', site: '🌐 Сайт' };
const COURSE_BY_ID = Object.fromEntries(COURSES.map((c) => [c[0], c]));

/* =====================================================================================
   ИНФРАСТРУКТУРА
   ===================================================================================== */

const tokenOf = (env) => env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
const siteOf = (env) => (env.SITE_URL ?? DEFAULT_SITE).trim().replace(/\/?$/, '/').replace(/^\/$/, '');
const isAdmin = (env, chatId) => env.ADMIN_CHAT_ID && String(chatId) === String(env.ADMIN_CHAT_ID);

async function tg(env, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${tokenOf(env)}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) console.log('telegram error', method, JSON.stringify(data).slice(0, 300));
  return data;
}

function menuKb(env) {
  return {
    keyboard: [[B.coll, B.courses], [B.lessons, B.lead], [B.ask, B.site]],
    resize_keyboard: true, input_field_placeholder: 'Спросите Нейрокота о чём угодно про уют…',
  };
}
const inline = (rows) => ({ inline_keyboard: rows });
const say = (env, chat_id, text, reply_markup) =>
  tg(env, 'sendMessage', { chat_id, text, disable_web_page_preview: true, ...(reply_markup ? { reply_markup } : {}) });

/* ---------- память: Cloudflare KV (необязательно) ---------- */

const kvGet = async (env, key) => (env.KV ? env.KV.get(key, 'json').catch(() => null) : null);
const kvPut = async (env, key, val, opts) => (env.KV ? env.KV.put(key, JSON.stringify(val), opts).catch((e) => console.log('kv put', e)) : null);
const kvDel = async (env, key) => (env.KV ? env.KV.delete(key).catch(() => null) : null);

// состояние воронки хранится и в значении, и в metadata — так cron видит очередь одним list(), без чтения каждого ключа
const fnKey = (chat) => `fn:${chat}`;
const fnGet = (env, chat) => kvGet(env, fnKey(chat));
const fnPut = (env, chat, s) => kvPut(env, fnKey(chat), s, { metadata: s });

/* ---------- кто пишет, карточки мастеру ---------- */

function who(from = {}) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Без имени';
  return name + (from.username ? ` (@${from.username})` : '') + `\nid: ${from.id}`;
}
// Метка #id<число> в карточке: по ней бот понимает, кому переслать ответ мастера. Базы данных не нужно.
const TAG_RE = /#id(-?\d+)/;
const replyHint = (chatId) => `\n\n↩️ Ответьте на это сообщение (reply), и бот перешлёт ответ клиенту.\n#id${chatId}`;

async function notifyAdmin(env, from, chatId, title, body) {
  if (!env.ADMIN_CHAT_ID) { console.log('ADMIN_CHAT_ID не задан:', title); return false; }
  const r = await say(env, env.ADMIN_CHAT_ID, `${title}\n\nОт: ${who(from)}\n\n${body}`.slice(0, 3900) + replyHint(chatId));
  return !!r?.ok;
}

/* =====================================================================================
   ИИ (ai_complete / ai_answer)
   ===================================================================================== */

function aiName(env) {
  if (env.AI_API_KEY) return `${env.AI_MODEL || 'qwen/qwen3.8-27b:free'} через ${env.AI_BASE_URL || 'https://openrouter.ai/api/v1'}`;
  if (env.ANTHROPIC_API_KEY) return `${env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'} (Anthropic)`;
  return 'выключен (не задан AI_API_KEY или ANTHROPIC_API_KEY)';
}

async function aiComplete(env, msgs) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
  try {
    if (env.AI_API_KEY) {
      const base = (env.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
      const openrouter = base.includes('openrouter.ai');
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST', signal: ctl.signal,
        headers: {
          'content-type': 'application/json', authorization: `Bearer ${env.AI_API_KEY}`,
          ...(openrouter ? { 'HTTP-Referer': siteOf(env) || 'https://t.me/SoulHomeRuBot', 'X-Title': 'Soul of Home bot' } : {}),
        },
        body: JSON.stringify({
          model: env.AI_MODEL || 'qwen/qwen3.8-27b:free', max_tokens: 900, temperature: 0.7,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...msgs],
          ...(openrouter ? { reasoning: { enabled: false } } : {}),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`AI ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
      const text = j.choices?.[0]?.message?.content || '';
      return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    }
    if (env.ANTHROPIC_API_KEY) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 700, system: SYSTEM_PROMPT, messages: msgs }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
      return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    }
    return '';
  } finally { clearTimeout(t); }
}

async function aiAnswer(env, chatId, text) {
  if (!env.AI_API_KEY && !env.ANTHROPIC_API_KEY) return null;
  const key = `h:${chatId}`;
  const hist = (await kvGet(env, key)) || [];
  hist.push({ role: 'user', content: text });
  const msgs = hist.slice(-12);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  let answer;
  try { answer = await aiComplete(env, msgs); } catch (e) { console.log('Ошибка ИИ:', e?.message || e); return null; }
  if (!answer) return null;
  answer = answer.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{2,3} /gm, '');
  hist.push({ role: 'assistant', content: answer });
  await kvPut(env, key, hist.slice(-12), { expirationTtl: 3 * 86400 }); // бот помнит последние 12 реплик 3 дня
  return answer;
}

function faqAnswer(text) {
  const t = text.toLowerCase();
  for (const [keys, answer] of FAQ) if (keys.some((k) => t.includes(k))) return answer;
  return null;
}

/* =====================================================================================
   РАЗДЕЛЫ
   ===================================================================================== */

function coursesKb(prefix) {
  const rows = COURSES.map(([cid, title, lvl]) => [{ text: `${title} · ${lvl}`, callback_data: `${prefix}:${cid}` }]);
  if (prefix === 'lead') {
    rows.push([{ text: '🎄 Заказать шар под свою ёлку', callback_data: 'lead:order' }]);
    rows.push([{ text: '💬 Другой вопрос мастеру', callback_data: 'lead:other' }]);
  }
  return inline(rows);
}
function courseText(cid) {
  const [, title, lvl, vol, desc] = COURSE_BY_ID[cid];
  return `🎓 «${title}»\n${lvl} · ${vol}\n\n${desc}\n\n${HOW_IT_WORKS}`;
}

const showCollection = (env, chat) => say(env, chat, COLLECTION, inline([
  [{ text: '🎄 Заказать шар', callback_data: 'lead:order' }],
  ...(siteOf(env) ? [[{ text: 'Смотреть фото на сайте', url: siteOf(env) + 'raboty' }]] : []),
]));
const showCourses = (env, chat) => say(env, chat,
  '🎓 Программы школы Soul of Home. Если сомневаетесь — начните с «Бархатного шара».\nВыберите программу, чтобы узнать подробнее:',
  coursesKb('course'));
const showLessons = (env, chat) => say(env, chat, '📚 Бесплатные уроки. Выберите тему:',
  inline(LESSONS.map(([t], i) => [{ text: t, callback_data: `lesson:${i}` }])));
const leadStart = (env, chat) => say(env, chat, '✍️ Что вас интересует? Выберите вариант:', coursesKb('lead'));

/* ---------- заявки (ask_comment / finish_lead) ---------- */

// Тема заявки запоминается в KV и дублируется меткой в подсказке: ответ на подсказку работает и без KV.
const LT_RE = /#заявка:([a-z]+)/;

async function askComment(env, chat, topic) {
  let intro, hint;
  if (COURSE_BY_ID[topic]) {
    intro = `Отлично, курс «${COURSE_BY_ID[topic][1]}» 🎓`;
    hint = 'Расскажите в двух словах о своём опыте или задайте вопрос — я передам мастеру вместе с заявкой.';
  } else if (topic === 'order') {
    intro = 'Шар под вашу ёлку или интерьер 🎄';
    hint = 'Опишите, что хотите: цвета ёлки или комнаты, понравившиеся модели из коллекции, сколько шаров и к какой дате.';
  } else {
    topic = 'other';
    intro = 'Конечно 💬';
    hint = 'Напишите ваш вопрос — я передам его мастеру.';
  }
  await kvPut(env, `lt:${chat}`, topic, { expirationTtl: 86400 });
  const kb = topic !== 'other' ? inline([[{ text: 'Отправить без комментария', callback_data: `send:${topic}` }]]) : null;
  return say(env, chat, `${intro}\n\n${hint}\n\n#заявка:${topic}`, kb);
}

/* ---------- Supabase: заявки из бота в ту же таблицу, что и с сайта ---------- */

function topicCourse(topic) {
  if (COURSE_BY_ID[topic]) return COURSE_BY_ID[topic][1];
  return { order: 'Заказ шара', office: 'Оформление офиса' }[topic] || 'Вопрос мастеру';
}
async function saveLead(env, from, course, message) {
  const url = env.SUPABASE_URL || SUPABASE_DEFAULT.url, key = env.SUPABASE_KEY || SUPABASE_DEFAULT.key;
  const name = ([from.first_name, from.last_name].filter(Boolean).join(' ') || 'Клиент из Telegram').slice(0, 80);
  const contact = (from.username ? `@${from.username}` : `tg://user?id=${from.id}`).slice(0, 120);
  try {
    const r = await fetch(`${url}/rest/v1/soul_home_leads`, {
      method: 'POST', headers: { apikey: key, 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify({ course: course.slice(0, 100), name, contact, message: message ? message.slice(0, 1000) : null, source: 'telegram', consent: true }),
    });
    if (r.status !== 201) console.log('supabase', r.status, (await r.text().catch(() => '')).slice(0, 200));
    return r.status === 201;
  } catch (e) { console.log('supabase', e?.message || e); return false; }
}

function topicTitle(topic) {
  if (COURSE_BY_ID[topic]) return `🎓 Заявка на курс «${COURSE_BY_ID[topic][1]}»`;
  return topic === 'order' ? '🎄 Заказ шара' : '💬 Вопрос мастеру';
}

async function finishLead(env, chat, from, topic, comment) {
  await kvDel(env, `lt:${chat}`);
  if (topic !== 'other') await saveLead(env, from, topicCourse(topic), comment);
  const sent = await notifyAdmin(env, from, chat, topicTitle(topic), comment || '(без комментария)');
  return say(env, chat, sent
    ? 'Готово! Заявка у мастера — он напишет вам здесь, обычно в течение дня. А пока можете спрашивать меня о чём угодно 🐾'
    : 'Заявку записал, но связь с мастером ещё не настроена. Попробуйте чуть позже 🙏', menuKb(env));
}

/* =====================================================================================
   ВОРОНКА
   ===================================================================================== */

// Москва — UTC+3 без перехода на летнее время
const MSK_OFFSET = 3 * 3600 * 1000;
function inWindow(ts) {
  // сдвигает момент отправки в ближайшее рабочее окно: будни 10–19 по Москве
  let d = new Date(ts + MSK_OFFSET);
  for (let i = 0; i < 8; i++) {
    const wd = (d.getUTCDay() + 6) % 7, h = d.getUTCHours();
    if (WORKDAYS.includes(wd) && h >= WORK_FROM && h < WORK_TO) return d.getTime() - MSK_OFFSET;
    if (WORKDAYS.includes(wd) && h < WORK_FROM) d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), WORK_FROM));
    else d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, WORK_FROM));
  }
  return d.getTime() - MSK_OFFSET;
}
function schedule(s) {
  if (s.step >= STEPS.length) { s.status = 'finished'; s.next_at = null; return; }
  s.next_at = inWindow(s.started + STEPS[s.step].after_h * 3600 * 1000);
}
const fnKb = (buttons) => inline(buttons.map(([t, a]) => [{ text: t, callback_data: `fn:${a}` }]));

async function funnelEnter(env, chat, from, source) {
  const prev = (await fnGet(env, chat)) || {};
  const s = { name: (from.first_name || '').slice(0, 60), username: (from.username || '').slice(0, 40), source,
    started: Date.now(), step: 0, status: 'active', entered: (prev.entered || 0) + 1 };
  schedule(s);
  await fnPut(env, chat, s);
  return say(env, chat, CHECKLIST(from.first_name || 'друг'), fnKb(BTN_START));
}

async function funnelConvert(env, chat, from, topic, extra = '') {
  const s = (await fnGet(env, chat)) || { started: Date.now(), step: 0 };
  Object.assign(s, { status: 'lead', next_at: null, lead_topic: topic, lead_at: Date.now() });
  await fnPut(env, chat, s);
  let body = `Воронка «Офис к Новому году», шаг ${s.step || 0} из ${STEPS.length}.\nКлиент: ${LEAD_TITLES[topic] || topic}.`;
  if (extra) body += `\n${extra}`;
  await saveLead(env, from, 'Оформление офиса', `${LEAD_TITLES[topic] || topic}${extra ? '. ' + extra : ''}`);
  return notifyAdmin(env, from, chat, '🏢 Заявка: оформление офиса', body);
}

async function funnelStop(env, chat) {
  const s = (await fnGet(env, chat)) || {};
  Object.assign(s, { status: 'stopped', next_at: null });
  await fnPut(env, chat, s);
  return say(env, chat, 'Хорошо, больше не буду писать первым. Если понадоблюсь — я здесь 🐾', menuKb(env));
}

async function funnelButton(env, chat, from, action) {
  if (action === 'photo') return say(env, chat, HOW_PHOTO);
  if (action === 'phone') {
    return say(env, chat, 'Нажмите кнопку ниже — номер придёт мастеру, и он перезвонит в рабочее время.', {
      keyboard: [[{ text: BTN_SHARE, request_contact: true }], [BTN_CANCEL]], resize_keyboard: true, one_time_keyboard: true,
    });
  }
  if (action === 'packages') return say(env, chat, PACKAGES, fnKb([['✍️ Рассчитать смету', 'lead:estimate']]));
  if (action.startsWith('lead:')) {
    const sent = await funnelConvert(env, chat, from, action.slice(5));
    return say(env, chat, (sent ? 'Готово! Передал мастеру — он напишет вам здесь в рабочее время. ' : 'Записал! Мастер скоро свяжется с вами. ') +
      'Чтобы ускорить расчёт, пришлите 3–4 фото помещения 🐾', menuKb(env));
  }
  if (action === 'remind') {
    const s = (await fnGet(env, chat)) || {};
    const now = new Date(Date.now() + MSK_OFFSET);
    const year = now.getUTCFullYear() + (now.getUTCMonth() >= 8 ? 1 : 0); // сезон уже идёт — напоминаем в следующем
    Object.assign(s, { status: 'remind', next_at: Date.UTC(year, 9, 1, 11) - MSK_OFFSET });
    await fnPut(env, chat, s);
    return say(env, chat, 'Договорились! Напишу 1 октября 🔔 Если понадобится раньше — просто напишите сюда.');
  }
  if (action === 'stop') return funnelStop(env, chat);
}

async function funnelStats(env, chat) {
  if (!env.KV) return say(env, chat, 'Статистика воронки работает, когда подключено хранилище KV (см. README).');
  const rows = [];
  let cursor;
  do {
    const page = await env.KV.list({ prefix: 'fn:', cursor });
    for (const k of page.keys) if (k.metadata) rows.push(k.metadata);
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  const by = (st) => rows.filter((r) => r.status === st).length;
  const steps = STEPS.map((_, i) => rows.filter((r) => (r.step || 0) > i).length);
  const topics = {};
  for (const r of rows) if (r.status === 'lead') { const t = LEAD_TITLES[r.lead_topic] || r.lead_topic; topics[t] = (topics[t] || 0) + 1; }
  const total = rows.length, leads = by('lead');
  const text = `📊 Воронка «Офис к Новому году»\n\nВошли: ${total}\nЗаявки: ${leads}` + (total ? ` (${Math.floor(leads * 100 / total)}%)` : '') +
    `\nВ прогреве сейчас: ${by('active')}\nОтписались: ${by('stopped')}\nНапомнить в сезоне: ${by('remind')}\n` +
    `Дошли до конца без заявки: ${by('finished')}\n\nПолучили сообщение прогрева:\n` +
    steps.map((n, i) => `${i + 1}) через ${STEPS[i].after_h} ч — ${n}`).join('\n') +
    (Object.keys(topics).length ? '\n\nЗаявки по типу:\n' + Object.entries(topics).map(([k, v]) => `— ${k}: ${v}`).join('\n') : '');
  return say(env, chat, text);
}

// Cron: раз в несколько минут отправляет очередные сообщения воронки
async function funnelTick(env) {
  if (!env.KV) return { sent: 0, note: 'KV не подключено' };
  const now = Date.now();
  let cursor, sent = 0;
  do {
    const page = await env.KV.list({ prefix: 'fn:', cursor });
    for (const k of page.keys) {
      const m = k.metadata;
      if (!m || !['active', 'remind'].includes(m.status) || !m.next_at || m.next_at > now) continue;
      const chat = k.name.slice(3);
      const s = (await fnGet(env, chat)) || m;
      if (!['active', 'remind'].includes(s.status) || !s.next_at || s.next_at > now) continue; // уже изменилось
      let r;
      if (s.status === 'remind') {
        await say(env, chat, REMIND_TEXT);
        r = await say(env, chat, CHECKLIST(s.name || 'друг'), fnKb(BTN_START));
        if (r?.ok) Object.assign(s, { status: 'active', started: now, step: 0 });
      } else {
        const step = STEPS[s.step];
        r = await say(env, chat, step.text, fnKb(step.buttons));
        if (r?.ok) s.step += 1;
      }
      if (r?.ok) { schedule(s); sent++; } else Object.assign(s, { status: 'blocked', next_at: null }); // бот заблокирован и т. п.
      await fnPut(env, chat, s);
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return { sent };
}

/* =====================================================================================
   ОБРАБОТКА СООБЩЕНИЙ
   ===================================================================================== */

async function sendWelcome(env, chat, caption) {
  const r = await tg(env, 'sendPhoto', { chat_id: chat, photo: env.WELCOME_PHOTO_URL || DEFAULT_PHOTO, caption, reply_markup: menuKb(env) });
  if (!r?.ok) return say(env, chat, caption, menuKb(env));
  return r;
}

async function onStart(env, msg, argRaw) {
  const chat = msg.chat.id, from = msg.from || {};
  await kvDel(env, `lt:${chat}`);
  // заявка с сайта: t.me/SoulHomeRuBot?start=velvet-K7F3Q — номер заявки после дефиса
  const [argPart, leadPart = ''] = (argRaw || '').toLowerCase().split('-');
  const arg = argPart || '';
  const leadId = leadPart.replace(/[^a-z0-9]/g, '').slice(0, 8).toUpperCase();
  if (leadId) await notifyAdmin(env, from, chat, `🔗 Клиент по заявке №${leadId} с сайта открыл бота`, 'Теперь ему можно ответить прямо здесь.');

  if (ENTRY_ARGS.includes(arg)) {
    await sendWelcome(env, chat, 'Мур! Я Нейрокот, помощник студии Soul of Home 🐾 Оформляем офисы к новогодним корпоративам под ключ.');
    return funnelEnter(env, chat, from, arg);
  }
  await sendWelcome(env, chat, WELCOME(from.first_name || 'друг'));
  if (COURSE_BY_ID[arg]) {
    return say(env, chat, courseText(arg), inline([[{ text: '✍️ Записаться на этот курс', callback_data: `lead:${arg}` }]]));
  }
  if (arg === 'order') return askComment(env, chat, 'order');
  if (arg === 'kursy') return showCourses(env, chat);
  if (arg === 'uroki') return showLessons(env, chat);
}

async function onAdminMessage(env, msg) {
  const chat = msg.chat.id, text = (msg.text || '').trim();
  const cmd = text.startsWith('/') ? text.split(/[\s@]/)[0].toLowerCase() : null;
  if (cmd === '/myid' || cmd === '/id') return say(env, chat, `ID этого чата: ${chat}\nВпишите его в ADMIN_CHAT_ID, чтобы получать заявки сюда.`);
  if (cmd === '/funnel') return funnelStats(env, chat);
  if (cmd === '/start' || cmd === '/help') {
    return say(env, chat, 'Вы мастер этого бота 🐾\n\n— Заявки с сайта, заявки и вопросы из бота приходят сюда.\n' +
      '— Чтобы ответить клиенту, сделайте reply на его карточку — можно текстом, фото или голосовым.\n' +
      '— /funnel — статистика воронки «Офис к Новому году».\n' +
      `— ИИ: ${aiName(env)}.\n\nЧтобы посмотреть бота глазами клиента, напишите ему с другого аккаунта.`);
  }
  const replied = msg.reply_to_message;
  const m = replied && (replied.text || replied.caption || '').match(TAG_RE);
  if (!m) {
    if (msg.chat.type === 'private') return say(env, chat, 'Чтобы ответить клиенту, сделайте reply на его сообщение от бота.');
    return;
  }
  const client = m[1];
  const r = msg.text
    ? await say(env, client, `💌 Ответ мастера Soul of Home:\n\n${msg.text}`)
    : await tg(env, 'copyMessage', { chat_id: client, from_chat_id: chat, message_id: msg.message_id });
  return say(env, chat, r?.ok ? '✅ Отправлено клиенту' : `Не удалось отправить: ${r?.description || 'клиент мог заблокировать бота'}`);
}

async function onClientMessage(env, msg) {
  const chat = msg.chat.id, from = msg.from || {};
  const text = (msg.text || '').trim();

  // контакт из воронки (кнопка «Отправить мой номер»)
  if (msg.contact) {
    const sent = await funnelConvert(env, chat, from, 'phone', `Телефон: ${msg.contact.phone_number || ''}`);
    return say(env, chat, sent ? 'Спасибо! Номер у мастера — он позвонит в рабочее время. ' : 'Спасибо, номер записал! ', menuKb(env));
  }

  if (text.startsWith('/')) {
    const [cmdRaw, ...rest] = text.split(/\s+/);
    const cmd = cmdRaw.split('@')[0].toLowerCase();
    if (cmd === '/start') return onStart(env, msg, rest[0]);
    if (cmd === '/help') return say(env, chat, HELP, menuKb(env));
    if (cmd === '/myid' || cmd === '/id') return say(env, chat, `ID этого чата: ${chat}\nВпишите его в ADMIN_CHAT_ID, чтобы получать заявки сюда.`);
    if (cmd === '/raboty') return showCollection(env, chat);
    if (cmd === '/kursy') return showCourses(env, chat);
    if (cmd === '/uroki') return showLessons(env, chat);
    if (cmd === '/zayavka') return leadStart(env, chat);
    if (cmd === '/stop') return funnelStop(env, chat);
    return say(env, chat, HELP, menuKb(env));
  }

  if (msg.text) {
    // кнопки главного меню
    const routes = { [B.coll]: showCollection, [B.courses]: showCourses, [B.lessons]: showLessons, [B.lead]: leadStart };
    if (routes[text]) { await kvDel(env, `lt:${chat}`); return routes[text](env, chat); }
    if (text === B.ask) {
      return say(env, chat, 'Мур! Спрашивайте что угодно: как сделать первый бархатный шар, какую лампу выбрать, какой курс подойдёт. Просто напишите вопрос 🐾');
    }
    if (text === B.site) {
      const site = siteOf(env);
      return say(env, chat, site
        ? `Сайт Soul of Home: ${site}\n\nКоллекция: ${site}raboty\nОбучение и заявка: ${site}obuchenie\nБесплатные уроки: ${site}uroki`
        : 'Сайт скоро откроется 🐾 А пока всё можно узнать здесь: коллекция, курсы и уроки — в меню ниже.', menuKb(env));
    }
    if (text === BTN_CANCEL) return say(env, chat, 'Хорошо 🐾 Можно просто прислать фото помещения или написать вопрос.', menuKb(env));

    // идёт оформление заявки — это комментарий к ней
    const replied = msg.reply_to_message;
    const tagged = replied?.from?.is_bot && (replied.text || '').match(LT_RE);
    const topic = tagged ? tagged[1] : await kvGet(env, `lt:${chat}`);
    if (topic) return finishLead(env, chat, from, topic, text);

    // вопрос Нейрокоту
    await tg(env, 'sendChatAction', { chat_id: chat, action: 'typing' });
    const answer = await aiAnswer(env, chat, text);
    if (answer) return say(env, chat, answer, menuKb(env));
    const faq = faqAnswer(text);
    const forwarded = await notifyAdmin(env, from, chat, '❓ Вопрос из бота', text);
    const tail = forwarded ? '\n\nЯ также передал вопрос мастеру — он ответит здесь.' : '';
    return say(env, chat, (faq || 'Мур, хороший вопрос! Точно ответит мастер.') + tail, menuKb(env));
  }

  // фото, голосовые, файлы — мастеру (например, фото готовой работы на разбор)
  if (!env.ADMIN_CHAT_ID) return say(env, chat, 'Мур! Пока я понимаю только текст — напишите, пожалуйста, словами 🐾');
  const fs = await fnGet(env, chat);
  const funnelPhoto = fs?.status === 'active' && msg.photo;
  if (funnelPhoto) await funnelConvert(env, chat, from, 'photo', `Подпись: ${msg.caption || '—'}`);
  const title = funnelPhoto ? '🏢 Фото помещения' : '📎 Вложение от клиента';
  const caption = `${title}\n\nОт: ${who(from)}\n\n${msg.caption || '(без подписи)'}`.slice(0, 900) + replyHint(chat);
  const canCaption = msg.photo || msg.video || msg.document || msg.voice || msg.audio || msg.animation;
  if (canCaption) {
    await tg(env, 'copyMessage', { chat_id: env.ADMIN_CHAT_ID, from_chat_id: chat, message_id: msg.message_id, caption });
  } else {
    await tg(env, 'copyMessage', { chat_id: env.ADMIN_CHAT_ID, from_chat_id: chat, message_id: msg.message_id });
    await say(env, env.ADMIN_CHAT_ID, caption);
  }
  if (funnelPhoto) {
    return say(env, chat, 'Спасибо, фото у дизайнера! Концепцию и ориентир по смете пришлём сюда за 2 рабочих дня. Если есть ещё фото — присылайте 🐾', menuKb(env));
  }
  return say(env, chat, 'Получил и передал мастеру 🐾 Он ответит здесь.');
}

async function onCallback(env, q) {
  await tg(env, 'answerCallbackQuery', { callback_query_id: q.id });
  const chat = q.message?.chat?.id, from = q.from || {};
  if (!chat) return;
  const [kind, val = ''] = (q.data || '').split(/:(.*)/s);
  if (kind === 'fn') return funnelButton(env, chat, from, val);
  if (kind === 'course' && COURSE_BY_ID[val]) {
    return say(env, chat, courseText(val), inline([
      [{ text: '✍️ Записаться на этот курс', callback_data: `lead:${val}` }],
      [{ text: '← Все программы', callback_data: 'menu:courses' }],
    ]));
  }
  if (kind === 'lesson' && /^\d+$/.test(val) && +val < LESSONS.length) {
    const [t, d] = LESSONS[+val];
    return say(env, chat, `📚 ${t}\n\n${d}\n\nХотите разобрать это подробно и с обратной связью? Загляните в «🎓 Обучение».`);
  }
  if (kind === 'menu' && val === 'courses') return showCourses(env, chat);
  if (kind === 'lead') return askComment(env, chat, val);
  if (kind === 'send') return finishLead(env, chat, from, val || (await kvGet(env, `lt:${chat}`)) || 'other', '');
}

async function handleUpdate(env, update) {
  if (update.callback_query) return onCallback(env, update.callback_query);
  const msg = update.message;
  if (!msg?.chat) return;
  if (isAdmin(env, msg.chat.id)) return onAdminMessage(env, msg);
  if (msg.chat.type !== 'private') {
    // в чужих группах отвечаем только на /myid — чтобы можно было сделать чатом мастера группу
    if (/^\/(myid|id)\b/.test(msg.text || '')) return say(env, msg.chat.id, `ID этого чата: ${msg.chat.id}\nВпишите его в ADMIN_CHAT_ID, чтобы получать заявки сюда.`);
    return;
  }
  return onClientMessage(env, msg);
}

/* =====================================================================================
   ЗАЯВКИ С САЙТА (замена api/lead.php)
   ===================================================================================== */

const FORMS = {
  office: ['Заявка «Офис к Новому году» (чек-лист)', { name: 'Имя', company: 'Компания', phone: 'Телефон', email: 'E-mail', date: 'Дата корпоратива', zone: 'Что оформить' }],
  course: ['Заявка на обучение', { course: 'Программа' }],
  // форма на странице «Обучение» нового сайта: заявка уже сохранена в Supabase, сюда приходит копия для мастера
  apply: ['Заявка на обучение с сайта', { course: 'Программа', name: 'Имя', contact: 'Контакт', message: 'Комментарий' }],
};
const clean = (v, n = 200) => String(v ?? '').replace(/\s+/g, ' ').replace(/<[^>]*>/g, '').trim().slice(0, n);
const newLeadId = () => {
  // 5 символов A–Z0–9, как в lead.php: например K7F3Q
  const a = new Uint32Array(1); crypto.getRandomValues(a);
  return (1679616 + (a[0] % (60466175 - 1679616))).toString(36).toUpperCase().slice(0, 5);
};

function cors(env, request) {
  const origin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).split(',').map((s) => s.trim()).filter(Boolean)
    .map((s) => (s === '*' ? s : s.replace(/^(https?:\/\/[^/]+).*$/i, '$1').toLowerCase()));
  const ok = allowed.includes('*') || allowed.includes(origin.toLowerCase());
  return {
    'access-control-allow-origin': ok ? (allowed.includes('*') ? '*' : origin) : 'null',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };
}
const json = (obj, status, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

async function handleLead(request, env) {
  const h = cors(env, request);
  if (h['access-control-allow-origin'] === 'null') {
    console.log('lead rejected: origin', request.headers.get('origin'));
    return json({ ok: false, error: 'origin' }, 403, { ...h, 'access-control-allow-origin': request.headers.get('origin') || '*' });
  }
  const raw = (await request.text()).slice(0, 8192);
  let d; try { d = JSON.parse(raw); } catch { return json({ ok: false, error: 'json' }, 400, h); }
  if (!d || typeof d !== 'object') return json({ ok: false, error: 'json' }, 400, h);
  if (d.website) return json({ ok: true, id: 'X' }, 200, h); // ловушка для спам-ботов

  // не больше 5 заявок с одного IP за 10 минут (если подключено KV)
  const ip = request.headers.get('cf-connecting-ip') || '0';
  if (env.KV) {
    const rk = `rl:${ip}`, hits = ((await kvGet(env, rk)) || []).filter((t) => t > Date.now() - 600000);
    if (hits.length >= 5) return json({ ok: false, error: 'rate' }, 429, h);
    hits.push(Date.now()); await kvPut(env, rk, hits, { expirationTtl: 660 });
  }

  const form = FORMS[d.form];
  if (!form) return json({ ok: false, error: 'form' }, 400, h);
  const [title, fields] = form;
  const f = Object.fromEntries(Object.keys(fields).map((k) => [k, clean(d[k], k === 'message' ? 1000 : 200)]));
  if (d.form === 'office') {
    if (!f.name || f.phone.replace(/\D/g, '').length < 10) return json({ ok: false, error: 'fields' }, 422, h);
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return json({ ok: false, error: 'email' }, 422, h);
  }
  if (d.form === 'course' && !f.course) return json({ ok: false, error: 'fields' }, 422, h);
  if (d.form === 'apply' && (!f.course || f.contact.length < 3)) return json({ ok: false, error: 'fields' }, 422, h);
  if (!env.ADMIN_CHAT_ID) return json({ ok: false, error: 'not_configured' }, 503, h);

  const id = newLeadId();
  const lines = [`📝 ${title} · №${id}`, ''];
  for (const [k, label] of Object.entries(fields)) if (f[k]) lines.push(`${label}: ${f[k]}`);
  if (d.form === 'apply') lines.push('', 'Заявка сохранена в Supabase → soul_home_leads.');
  lines.push('', 'Страница: ' + (clean(d.page, 120) || siteOf(env)));
  lines.push(`Если клиент нажмёт кнопку Telegram на сайте, бот пришлёт «Клиент по заявке №${id} открыл бота» — отвечайте ему ответом на то сообщение.`);
  const r = await say(env, env.ADMIN_CHAT_ID, lines.join('\n'));
  return r?.ok ? json({ ok: true, id }, 200, h) : json({ ok: false, error: 'telegram' }, 502, h);
}

/* =====================================================================================
   МАРШРУТЫ
   ===================================================================================== */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if ((url.pathname === '/webhook' || url.pathname === '/telegram') && request.method === 'POST') {
      if (!env.WEBHOOK_SECRET || request.headers.get('x-telegram-bot-api-secret-token') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      const update = await request.json().catch(() => null);
      if (update) ctx.waitUntil(handleUpdate(env, update).catch((e) => console.log('update error', e?.stack || e)));
      return new Response('ok');
    }

    if (url.pathname === '/lead' || url.pathname === '/api/lead.php') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, request) });
      if (request.method === 'POST') return handleLead(request, env);
    }

    const keyOk = env.WEBHOOK_SECRET && url.searchParams.get('key') === env.WEBHOOK_SECRET;

    if (url.pathname === '/setup') {
      if (!keyOk) return new Response('Нужен параметр ?key=WEBHOOK_SECRET', { status: 403 });
      const hook = await tg(env, 'setWebhook', {
        url: `${url.origin}/webhook`, secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ['message', 'callback_query'], drop_pending_updates: false,
      });
      const cmds = await tg(env, 'setMyCommands', { commands: [
        { command: 'start', description: 'Начать сначала' },
        { command: 'raboty', description: 'Коллекция новогодних шаров' },
        { command: 'kursy', description: 'Программы обучения' },
        { command: 'uroki', description: 'Бесплатные уроки' },
        { command: 'zayavka', description: 'Оставить заявку' },
        { command: 'help', description: 'Что умеет бот' },
        { command: 'stop', description: 'Не присылать мне рассылку' },
      ] });
      const short = await tg(env, 'setMyShortDescription', { short_description: 'Нейрокот — помощник мастерской Soul of Home: шары ручной работы, курсы и уроки об уюте' });
      const me = await tg(env, 'getMe', {});
      return json({ webhook: hook, commands: cmds?.ok, description: short?.ok, bot: me.result?.username,
        admin_chat_id: env.ADMIN_CHAT_ID || 'не задан — напишите боту /myid', ai: aiName(env), kv: !!env.KV }, 200);
    }

    if (url.pathname === '/test-lead') {
      if (!keyOk) return new Response('Нужен параметр ?key=WEBHOOK_SECRET', { status: 403 });
      if (!env.ADMIN_CHAT_ID) return json({ ok: false, error: 'ADMIN_CHAT_ID не задан' }, 500);
      const r = await say(env, env.ADMIN_CHAT_ID, '📝 Тестовая заявка · №TEST1\n\nПрограмма: Проверка связи сайта и бота');
      return json({ ok: !!r?.ok, telegram: r?.ok ? 'отправлено' : (r?.description || 'нет ответа') }, r?.ok ? 200 : 502);
    }

    if (url.pathname === '/tick') {
      // ручной запуск рассылки воронки (то же, что делает Cron)
      if (!keyOk) return new Response('Нужен параметр ?key=WEBHOOK_SECRET', { status: 403 });
      return json(await funnelTick(env), 200);
    }

    if (url.pathname === '/status') {
      const info = tokenOf(env) ? await tg(env, 'getWebhookInfo', {}) : null;
      const me = tokenOf(env) ? await tg(env, 'getMe', {}) : null;
      return json({
        token: tokenOf(env) ? 'задан' : 'НЕ ЗАДАН',
        bot: me?.result?.username || null,
        webhook_url: info?.result?.url || 'не подключён',
        webhook_points_here: info?.result?.url === `${url.origin}/webhook`,
        pending_updates: info?.result?.pending_update_count ?? null,
        last_error: info?.result?.last_error_message || null,
        admin_chat_id: env.ADMIN_CHAT_ID ? 'задан' : 'НЕ ЗАДАН',
        webhook_secret: env.WEBHOOK_SECRET ? 'задан' : 'НЕ ЗАДАН',
        kv: env.KV ? 'подключено' : 'НЕ ПОДКЛЮЧЕНО (воронка не будет присылать сообщения)',
        ai: aiName(env),
        site: siteOf(env),
        allowed_origin: env.ALLOWED_ORIGIN || DEFAULT_ORIGIN,
        version: 'soulhome-worker-2 (soul_of_home)',
      }, 200);
    }

    return new Response('Soul of Home — Нейрокот: бот работает', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(funnelTick(env).then((r) => console.log('funnel tick', JSON.stringify(r))));
  },
};

// для тестов
export { handleUpdate, funnelTick, inWindow, STEPS, faqAnswer, SYSTEM_PROMPT, siteOf };
