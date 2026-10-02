# Soul of Home — сайт мастерской

Сайт мастерской и школы ручной работы: коллекция новогодних шаров, обучение, бесплатные уроки и ИИ-помощник Нейрокот.

## Страницы
| Адрес | Файл | Что там |
|---|---|---|
| `/` | index.html | Главная |
| `/raboty` | raboty.html | Коллекция шаров |
| `/obuchenie` | obuchenie.html | Программы и форма заявки |
| `/uroki` | uroki.html | Бесплатные уроки |
| `/privacy` | privacy.html | Политика обработки персональных данных |
| любой другой | 404.html | Страница «не найдено» |

Общее: `styles.css`, `site.js` (меню, форма, чат), `fonts.css` + `fonts/` (шрифты хранятся на сайте), `img/`.

## Что заполнить владелице — `content.js`
Имя и фото автора, цены «от …» на курсах, отзывы, реквизиты. Пустые поля на сайте не показываются: блок появится, как только вы впишете значение.

## Заявки
Форма на странице «Обучение» сохраняет заявку в Supabase (проект `wuvadreohiphwevprwmk`, таблица `soul_home_leads`).
Смотреть заявки: Supabase → Table Editor → `soul_home_leads`. С сайта заявки можно только добавить, прочитать их нельзя.

## Деплой на Vercel
Framework Preset — Other, Root Directory — корень, Build Command и Output Directory пустые.
Папка `archive/` в деплой не попадает (`.vercelignore`).

## Чат Нейрокота
- Внутри claude.ai отвечает через ИИ claude.ai.
- На Vercel отвечает функция `api/chat.js`. Добавьте в Vercel → Settings → Environment Variables ключ `ANTHROPIC_API_KEY` (из console.anthropic.com) и сделайте Redeploy. Модель можно сменить переменной `ANTHROPIC_MODEL`.
- Без ключа чат предлагает написать в Telegram-бот @SoulHomeRuBot.

## Telegram-бот Нейрокот (@SoulHomeRuBot)
Папка `bot/`: консультант, заявки, воронка для компаний и уведомления о заявках с сайта. Работает на Cloudflare Workers.
Инструкция по запуску — `bot/README.md`, тесты — `node bot/test.mjs`. Чтобы заявки с сайта приходили мастеру в Telegram, впишите адрес бота в `LEAD_URL` в `site.js`.
- Знания Нейрокота записаны в двух местах: `RULES` в `site.js` и `api/_prompt.js`. Меняйте оба.

## Архив
В `archive/` лежат прежние файлы репозитория: сайт дизайна интерьеров, лендинги и код Telegram-бота (`archive/soulhome-bot`).
