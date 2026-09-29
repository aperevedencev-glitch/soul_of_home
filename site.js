// Soul of Home — общие скрипты сайта
(function(){
  // ----- мобильное меню -----
  var btn = document.querySelector('.menu-btn');
  var links = document.querySelector('.nav-links');
  if(btn && links){
    btn.addEventListener('click', function(){
      var open = links.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function(e){
      if(e.target.closest('a')){ links.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }
    });
  }

  // ----- безопасное хранилище (может быть недоступно) -----
  window.SOH_store = {
    get: function(k, def){ try{ var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; }catch(e){ return def; } },
    set: function(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  };

  // ----- копирование текста -----
  window.SOH_copy = function(button, text, label){
    function done(msg){ button.textContent = msg; setTimeout(function(){ button.textContent = label; }, 2200); }
    try{
      navigator.clipboard.writeText(text).then(function(){ done('Скопировано ✓'); }, function(){ done('Выделите текст вручную'); });
    }catch(e){ done('Выделите текст вручную'); }
  };

  // ----- фильтр по чипам -----
  window.SOH_filter = function(bar, items, attr, onChange){
    bar.addEventListener('click', function(e){
      var chip = e.target.closest('.chip'); if(!chip) return;
      bar.querySelectorAll('.chip').forEach(function(c){ c.classList.remove('active'); c.setAttribute('aria-pressed','false'); });
      chip.classList.add('active'); chip.setAttribute('aria-pressed','true');
      var f = chip.dataset.filter, shown = 0;
      items().forEach(function(it){
        var tags = (it.getAttribute(attr) || '').split(' ');
        var match = f === 'all' || tags.indexOf(f) !== -1;
        it.hidden = !match; if(match) shown++;
      });
      if(onChange) onChange(shown);
    });
  };

  // ----- форма записи: выбор курса → Telegram-бот -----
  var form = document.getElementById('applyForm');
  if(form){
    var success = document.getElementById('successState');
    var intro = document.getElementById('formIntro');
    function checkRadio(){
      var wrap = form.querySelector('[data-field="course"]');
      var ok = !!form.querySelector('input[name="course"]:checked');
      wrap.classList.toggle('has-error', !ok); return ok;
    }
    form.addEventListener('change', checkRadio);
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(!checkRadio()) return;
      var r = form.querySelector('input[name="course"]:checked');
      document.getElementById('successCourse').textContent = r.value;
      document.getElementById('successTg').href = 'https://t.me/SoulHomeRuBot?start=' + r.dataset.tg;
      form.hidden = true; intro.hidden = true; success.hidden = false;
    });
  }
})();

// ===== Нейрокот: ИИ-помощник Soul of Home =====
(function(){
  var TG = 'https://t.me/SoulHomeRuBot';
  var RULES = [
    'Ты — Нейрокот, пушистый ИИ-помощник и талисман мастерской и школы ручной работы Soul of Home.',
    'Ты помогаешь посетителям сайта: отвечаешь на вопросы о дизайне уютного дома, о создании новогодних шаров и декора ручной работы, о коллекции и программах обучения, подсказываешь, с чего начать.',
    'Стиль: тёплый, дружелюбный, спокойный, чуть-чуть кошачьего обаяния (можно изредка «мур»), но по делу. Пиши по-русски, коротко: 2–6 предложений или короткий список с «—». Без Markdown-разметки, без заголовков и звёздочек.',
    'Не выдумывай цены, даты стартов, сроки доставки и наличие: для этого предлагай оставить заявку на странице «Обучение» или написать в Telegram-бот @SoulHomeRuBot. Если вопрос не про дом, уют, рукоделие или Soul of Home — мягко верни разговор к этим темам.',
    '',
    'ЧТО ЕСТЬ НА САЙТЕ.',
    'Страницы: Главная; «Мои работы» (коллекция шаров); «Обучение» (программы и форма заявки); «Уроки» (бесплатные материалы).',
    'Коллекция «Новогодние шары»: 12 авторских моделей, все 8 см в диаметре, 100% ручная работа. Шар с камеей и кружевом (айвори, золото); с белыми цветами и кисточкой; с белым бантом и кисточкой; с балериной (полимерная глина, жемчуг); с цветами и жемчугом; из бархата и вышивки (изумруд, красный); с бархатной отделкой (красный); с изумрудным бантом; бархатный с блеском (изумруд, глиттер); бархатный с бантом (изумруд); из смешанных материалов (красный, шнур); винтажный (красный бархат, золотая вышивка). Материалы: бархат, кружево, атлас, жемчуг, стразы, кристаллы, металлическая фурнитура. Заказ шара под цвет ёлки или интерьера — через @SoulHomeRuBot.',
    'Программы обучения: 1) «Бархатный шар» — для начинающих, 3 урока: основа 8 см, раскрой, обтяжка без морщин, бант, кисточка, фурнитура. Лучший старт для новичка. 2) «Вышивка, жемчуг и кружево» — средний уровень, 5 уроков: объёмная вышивка металлизированной нитью, жемчуг и стразы, камея, объёмные цветы. 3) «Своя авторская коллекция» — продвинутый, 4 урока: концепция, палитра серии, фотосъёмка. 4) «Дизайн уютного дома» — для всех, 6 уроков: палитра 60/30/10, сценарии света, текстиль и композиция. 5) «Праздничный интерьер» — 4 урока: ёлка как композиция, венок, сервировка. 6) «От хобби к делу» — личный разбор 45 минут для мастеров: формула цены, портфолио, каналы продаж (ярмарки, маркетплейсы, опт, корпоративные подарки).',
    'Как проходит обучение: заявка → список материалов (для «Бархатного шара» можно заказать набор) → видеоуроки в своём темпе, доступ остаётся → фото готовой работы и личная обратная связь. Опыт не обязателен. Стоимость и даты мастер присылает в ответ на заявку.',
    'Бесплатные уроки: палитра 60/30/10; тёплый свет 2700–3000 K и три уровня освещения (общий, локальный, акцентный), CRI 90+; правило трёх текстур (гладкое, мягкое, рельефное); первый бархатный шар (мастер-класс в 6 шагов: материалы — пенопластовая основа 8 см, бархат ~30×30 см, прозрачный клей для ткани, декор, шапочка с петлёй и лента; обтяжка: круг бархата ⌀ 26–28 см, клей тонким слоем, натягивать от низа вверх по кругу, излишки собрать наверху под шапочку; декор — вышивка металлизированной нитью, бусины, жемчуг, стразы; шапочка на каплю клея, лента и бант; проверить крепление и дать высохнуть; советы: качественный бархат, пенопластовая основа, экспериментировать с цветом); как нарядить ёлку (расправить ветки, гирлянда от ствола, ~100 лампочек на 30 см высоты, крупные шары вглубь, авторские снаружи на уровне глаз); подушки и пледы (нечётное число, разные размеры, один узор); хранение игрушек (папиросная бумага, коробка с ячейками, сухое место, силикагель, не мочить вышивку); упаковка подарка ручной работы с карточкой-историей.',
    'Когда уместно, ссылайся на страницы сайта по названию и предлагай следующий шаг.'
  ].join('\n');
  var SUGS = ['С какого курса начать новичку?', 'Как сделать первый бархатный шар?', 'Как подобрать палитру для ёлки?', 'Как сделать комнату уютнее без ремонта?'];
  var CAT_SVG_SEND = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CAT_SVG_STOP = '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor"/></svg>';

  var sample = null, sampleChecked = false, disabled = false;
  var turns = [], ctl = null, busy = false, panel, log, input, sendBtn, sugs, fab;

  function getSample(){
    if(sampleChecked) return Promise.resolve(sample);
    if(!window.claude || !window.claude.use){ sampleChecked = true; return Promise.resolve(null); }
    return window.claude.use('sample').then(function(s){ sample = s; sampleChecked = true; return s; }, function(){ sampleChecked = true; return null; });
  }

  function el(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; }
  function add(cls, text){ var m = el('div', 'nc-msg ' + cls, text); log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }
  function noteTelegram(msg){
    var m = add('note', msg + ' ');
    var a = el('a', '', 'Написать в Telegram @SoulHomeRuBot'); a.href = TG; a.target = '_blank'; a.rel = 'noopener';
    m.appendChild(a); log.scrollTop = log.scrollHeight;
  }

  function build(){
    panel = el('div', 'nc-panel'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Чат с Нейрокотом'); panel.hidden = true;
    panel.innerHTML =
      '<div class="nc-head"><img src="img/neurocat-face.jpg" alt=""><div><div class="nc-title">Нейрокот</div><div class="nc-status"><span class="dot"></span>ИИ-помощник Soul of Home</div></div>' +
      '<button class="nc-x" type="button" aria-label="Закрыть чат"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button></div>' +
      '<div class="nc-log" aria-live="polite"></div><div class="nc-sugs"></div>' +
      '<form class="nc-form"><label for="ncInput" class="sr-only" style="position:absolute;left:-9999px;">Ваш вопрос</label><textarea id="ncInput" rows="1" placeholder="Спросите про уют, шары или курсы…"></textarea><button class="nc-send" type="submit" aria-label="Отправить">' + CAT_SVG_SEND + '</button></form>' +
      '<div class="nc-tg">Ответы генерирует ИИ. Заказы и оплата — в <a href="' + TG + '" target="_blank" rel="noopener">@SoulHomeRuBot</a></div>';
    document.body.appendChild(panel);
    log = panel.querySelector('.nc-log'); input = panel.querySelector('textarea'); sendBtn = panel.querySelector('.nc-send'); sugs = panel.querySelector('.nc-sugs');
    add('bot', 'Мур, привет! Я Нейрокот, помощник мастерской Soul of Home. Спросите меня про новогодние шары, уют в доме или о том, какой курс вам подойдёт.');
    SUGS.forEach(function(q){ var b = el('button', '', q); b.type = 'button'; b.addEventListener('click', function(){ ask(q); }); sugs.appendChild(b); });
    panel.querySelector('.nc-x').addEventListener('click', close);
    panel.querySelector('form').addEventListener('submit', function(e){ e.preventDefault(); if(busy){ if(ctl) ctl.abort(); return; } ask(input.value); });
    input.addEventListener('keydown', function(e){ if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); if(!busy) ask(input.value); } });
    input.addEventListener('input', function(){ input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && !panel.hidden) close(); });

    fab = el('button', 'nc-fab'); fab.type = 'button'; fab.setAttribute('aria-label', 'Открыть чат с Нейрокотом');
    fab.innerHTML = '<img src="img/neurocat-face.jpg" alt=""><span>Спросить Нейрокота</span>';
    fab.addEventListener('click', open);
    document.body.appendChild(fab);
  }

  function setBusy(v){
    busy = v; sendBtn.classList.toggle('stop', v);
    sendBtn.innerHTML = v ? CAT_SVG_STOP : CAT_SVG_SEND;
    sendBtn.setAttribute('aria-label', v ? 'Остановить ответ' : 'Отправить');
  }

  function ask(q){
    q = (q || '').trim(); if(!q || busy) return;
    input.value = ''; input.style.height = 'auto'; sugs.hidden = true;
    add('me', q);
    if(disabled){ noteTelegram('Сейчас я не могу ответить здесь.'); return; }
    var bubble = add('bot wait', 'Нейрокот думает…');
    setBusy(true);
    getSample().then(function(s){
      if(!s){ disabled = true; bubble.remove(); noteTelegram('В этом окне ИИ-чат недоступен, но я отвечу в Telegram.'); setBusy(false); return; }
      turns.push({ role: 'user', content: q });
      if(turns.length > 12) turns = turns.slice(-12);
      while(turns.length && turns[0].role !== 'user') turns.shift();
      ctl = new AbortController();
      return s([{ role: 'user', content: RULES }].concat(turns), {
        cache: false, modelTier: 'quick', signal: ctl.signal,
        onText: function(u){ bubble.classList.remove('wait'); bubble.textContent = u.text; log.scrollTop = log.scrollHeight; }
      }).then(function(r){
        turns.push({ role: 'assistant', content: r.text });
      }, function(e){
        var code = e && e.code;
        if(e && e.text){ bubble.classList.remove('wait'); bubble.textContent = e.text; } else bubble.remove();
        turns.pop();
        if(code === 'cancelled') return;
        if(['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].indexOf(code) !== -1){ disabled = true; noteTelegram('Без разрешения на ИИ я не смогу ответить здесь, но с радостью отвечу в Telegram.'); }
        else if(code === 'rate_limited') add('note', 'Слишком много вопросов подряд. Передохнём минутку и попробуем снова.');
        else if(code === 'session_expired') add('note', 'Нужно заново войти в аккаунт Claude, чтобы продолжить.');
        else if(code === 'refused') add('note', 'На этот вопрос я не отвечу. Давайте поговорим про уют, шары или курсы?');
        else add('note', 'Связь прервалась. Попробуйте отправить вопрос ещё раз.');
      });
    }).then(function(){ setBusy(false); input.focus(); });
  }

  function open(){ if(!panel) build(); panel.hidden = false; fab.hidden = true; setTimeout(function(){ input.focus(); }, 60); }
  function close(){ panel.hidden = true; fab.hidden = false; }

  function init(){
    build(); getSample();
    var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    document.querySelectorAll('[data-neurocat]').forEach(function(t){
      t.addEventListener('click', open);
      if(canHover){
        var timer;
        t.addEventListener('mouseenter', function(){ timer = setTimeout(open, 450); });
        t.addEventListener('mouseleave', function(){ clearTimeout(timer); });
      }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
