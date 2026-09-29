"""Telegram-бот @SoulHomeRuBot — Нейрокот, помощник Soul of Home.

Умеет:
- /start с приветствием и меню (в том числе ссылки вида t.me/SoulHomeRuBot?start=velvet);
- разделы: коллекция шаров, программы обучения, бесплатные уроки;
- заявки на курсы и заказы шаров — пересылает их мастеру (ADMIN_CHAT_ID);
- отвечает на свободные вопросы как ИИ-помощник: DeepSeek или другой OpenAI-совместимый сервис (AI_API_KEY)
  либо Claude (ANTHROPIC_API_KEY); без ключей — по базе частых вопросов и передаёт вопрос мастеру;
- мастер отвечает клиенту прямо из своего чата: ответом (reply) на пересланное ботом сообщение.
"""
import json
import logging
import os
import re
from collections import defaultdict, deque
from pathlib import Path

from dotenv import load_dotenv
from telegram import (BotCommand, InlineKeyboardButton, InlineKeyboardMarkup,
                      ReplyKeyboardMarkup, Update)
from telegram.constants import ChatAction, ChatType
from telegram.ext import (Application, CallbackQueryHandler, CommandHandler,
                          ContextTypes, MessageHandler, filters)

import knowledge as K

load_dotenv()
BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
ADMIN_CHAT_ID = int(os.environ.get("ADMIN_CHAT_ID", "0") or 0)
SITE_URL = os.environ.get("SITE_URL", "")
# ИИ через любой OpenAI-совместимый сервис: DeepSeek, OpenRouter и др.
AI_API_KEY = os.environ.get("AI_API_KEY", "")
AI_BASE_URL = os.environ.get("AI_BASE_URL", "https://openrouter.ai/api/v1")
AI_MODEL = os.environ.get("AI_MODEL", "qwen/qwen3.8-27b:free")
OPENROUTER = "openrouter.ai" in AI_BASE_URL
# или через Anthropic (Claude)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
BASE = Path(__file__).parent
WELCOME_PHOTO = BASE / "neurocat.jpg"
LINKS_FILE = BASE / "reply_links.json"  # какое сообщение у мастера → какому клиенту отвечать

logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("soulhome")

# ---------- ИИ ----------
ai = None
AI_NAME = "выключен (не задан AI_API_KEY или ANTHROPIC_API_KEY)"
if AI_API_KEY:
    from openai import AsyncOpenAI
    ai = AsyncOpenAI(api_key=AI_API_KEY, base_url=AI_BASE_URL, timeout=60,
                     default_headers={"HTTP-Referer": SITE_URL or "https://t.me/SoulHomeRuBot", "X-Title": "Soul of Home bot"} if OPENROUTER else None)
    AI_NAME = f"{AI_MODEL} через {AI_BASE_URL}"
elif ANTHROPIC_API_KEY:
    from anthropic import AsyncAnthropic
    ai = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    AI_NAME = f"{ANTHROPIC_MODEL} (Anthropic)"


async def ai_complete(msgs: list) -> str:
    """Один запрос к выбранному ИИ, возвращает текст ответа."""
    if AI_API_KEY:
        # у OpenRouter отключаем «размышления» (Qwen3 и др.), чтобы они не съедали лимит ответа
        extra = {"reasoning": {"enabled": False}} if OPENROUTER else None
        resp = await ai.chat.completions.create(
            model=AI_MODEL, max_tokens=900, temperature=0.7, extra_body=extra,
            messages=[{"role": "system", "content": K.SYSTEM_PROMPT}] + msgs)
        text = (resp.choices[0].message.content or "") if resp.choices else ""
        return re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    resp = await ai.messages.create(model=ANTHROPIC_MODEL, max_tokens=700, system=K.SYSTEM_PROMPT, messages=msgs)
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()
HISTORY: dict[int, deque] = defaultdict(lambda: deque(maxlen=12))  # последние реплики каждого чата

# ---------- кнопки ----------
B_COLL, B_COURSES, B_LESSONS, B_LEAD, B_ASK, B_SITE = (
    "🎄 Коллекция шаров", "🎓 Обучение", "📚 Бесплатные уроки",
    "✍️ Оставить заявку", "🐱 Спросить Нейрокота", "🌐 Сайт")
MENU = ReplyKeyboardMarkup(
    [[B_COLL, B_COURSES], [B_LESSONS, B_LEAD], [B_ASK] + ([B_SITE] if SITE_URL else [])],
    resize_keyboard=True, input_field_placeholder="Спросите Нейрокота о чём угодно про уют…")
COURSE_BY_ID = {c[0]: c for c in K.COURSES}


def courses_kb(prefix: str) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(f"{title} · {lvl}", callback_data=f"{prefix}:{cid}")]
            for cid, title, lvl, _, _ in K.COURSES]
    if prefix == "lead":
        rows.append([InlineKeyboardButton("🎄 Заказать шар под свою ёлку", callback_data="lead:order")])
        rows.append([InlineKeyboardButton("💬 Другой вопрос мастеру", callback_data="lead:other")])
    return InlineKeyboardMarkup(rows)


def course_text(cid: str) -> str:
    _, title, lvl, vol, desc = COURSE_BY_ID[cid]
    return f"🎓 «{title}»\n{lvl} · {vol}\n\n{desc}\n\n{K.HOW_IT_WORKS}"


# ---------- связи «сообщение мастеру → клиент» ----------
def load_links() -> dict:
    try:
        return json.loads(LINKS_FILE.read_text())
    except Exception:
        return {}


LINKS = load_links()


def remember_link(admin_msg_id: int, user_chat_id: int) -> None:
    LINKS[str(admin_msg_id)] = user_chat_id
    if len(LINKS) > 5000:  # не даём файлу расти бесконечно
        for k in list(LINKS)[:1000]:
            LINKS.pop(k, None)
    try:
        LINKS_FILE.write_text(json.dumps(LINKS))
    except Exception as e:
        log.warning("Не удалось сохранить reply_links.json: %s", e)


def who(update: Update) -> str:
    u = update.effective_user
    name = " ".join(x for x in [u.first_name, u.last_name] if x) or "Без имени"
    return f"{name}" + (f" (@{u.username})" if u.username else "") + f"\nid: {u.id}"


async def notify_admin(context: ContextTypes.DEFAULT_TYPE, update: Update, title: str, body: str) -> bool:
    """Отправляет мастеру карточку и запоминает, кому отвечать."""
    if not ADMIN_CHAT_ID:
        log.warning("ADMIN_CHAT_ID не задан — сообщение мастеру не отправлено: %s", title)
        return False
    text = f"{title}\n\nОт: {who(update)}\n\n{body}\n\n↩️ Ответьте на это сообщение (reply), и бот перешлёт ответ клиенту."
    msg = await context.bot.send_message(ADMIN_CHAT_ID, text)
    remember_link(msg.message_id, update.effective_chat.id)
    return True


# ---------- команды ----------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.clear()
    name = update.effective_user.first_name or "друг"
    text = K.WELCOME.format(name=name)
    if WELCOME_PHOTO.exists():
        with WELCOME_PHOTO.open("rb") as f:
            await update.message.reply_photo(f, caption=text, reply_markup=MENU)
    else:
        await update.message.reply_text(text, reply_markup=MENU)
    # глубокая ссылка: t.me/SoulHomeRuBot?start=velvet | order | kursy | uroki
    arg = (context.args[0] if context.args else "").lower()
    if arg in COURSE_BY_ID:
        await update.message.reply_text(course_text(arg), reply_markup=InlineKeyboardMarkup(
            [[InlineKeyboardButton("✍️ Записаться на этот курс", callback_data=f"lead:{arg}")]]))
    elif arg == "order":
        await ask_comment(update.message, context, "order")
    elif arg == "kursy":
        await courses(update, context)
    elif arg == "uroki":
        await lessons(update, context)


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(K.HELP, reply_markup=MENU)


async def myid(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(f"ID этого чата: {update.effective_chat.id}\nВпишите его в ADMIN_CHAT_ID, чтобы получать заявки сюда.")


async def collection(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    kb = [[InlineKeyboardButton("🎄 Заказать шар", callback_data="lead:order")]]
    if SITE_URL:
        kb.append([InlineKeyboardButton("Смотреть фото на сайте", url=SITE_URL)])
    await update.message.reply_text(K.COLLECTION, reply_markup=InlineKeyboardMarkup(kb))


async def courses(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.effective_message.reply_text(
        "🎓 Программы школы Soul of Home. Если сомневаетесь — начните с «Бархатного шара».\nВыберите программу, чтобы узнать подробнее:",
        reply_markup=courses_kb("course"))


async def lessons(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    kb = [[InlineKeyboardButton(t, callback_data=f"lesson:{i}")] for i, (t, _) in enumerate(K.LESSONS)]
    await update.effective_message.reply_text("📚 Бесплатные уроки. Выберите тему:", reply_markup=InlineKeyboardMarkup(kb))


async def lead_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.effective_message.reply_text("✍️ Что вас интересует? Выберите вариант:", reply_markup=courses_kb("lead"))


async def ask_mode(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Мур! Спрашивайте что угодно: как сделать первый бархатный шар, какую лампу выбрать, какой курс подойдёт. Просто напишите вопрос 🐾")


# ---------- инлайн-кнопки ----------
async def on_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    q = update.callback_query
    await q.answer()
    kind, _, val = (q.data or "").partition(":")
    if kind == "course" and val in COURSE_BY_ID:
        await q.message.reply_text(course_text(val), reply_markup=InlineKeyboardMarkup(
            [[InlineKeyboardButton("✍️ Записаться на этот курс", callback_data=f"lead:{val}")],
             [InlineKeyboardButton("← Все программы", callback_data="menu:courses")]]))
    elif kind == "lesson" and val.isdigit() and int(val) < len(K.LESSONS):
        t, d = K.LESSONS[int(val)]
        await q.message.reply_text(f"📚 {t}\n\n{d}\n\nХотите разобрать это подробно и с обратной связью? Загляните в «🎓 Обучение».")
    elif kind == "menu" and val == "courses":
        await courses(update, context)
    elif kind == "lead":
        await ask_comment(q.message, context, val)
    elif kind == "send":
        await finish_lead(update, context, comment="")


async def ask_comment(message, context: ContextTypes.DEFAULT_TYPE, topic: str) -> None:
    context.user_data["lead_topic"] = topic
    if topic in COURSE_BY_ID:
        intro = f"Отлично, курс «{COURSE_BY_ID[topic][1]}» 🎓"
        hint = "Расскажите в двух словах о своём опыте или задайте вопрос — я передам мастеру вместе с заявкой."
    elif topic == "order":
        intro = "Шар под вашу ёлку или интерьер 🎄"
        hint = "Опишите, что хотите: цвета ёлки или комнаты, понравившиеся модели из коллекции, сколько шаров и к какой дате."
    else:
        intro = "Конечно 💬"
        hint = "Напишите ваш вопрос — я передам его мастеру."
    kb = InlineKeyboardMarkup([[InlineKeyboardButton("Отправить без комментария", callback_data="send:")]]) if topic != "other" else None
    await message.reply_text(f"{intro}\n\n{hint}", reply_markup=kb)


def topic_title(topic: str) -> str:
    if topic in COURSE_BY_ID:
        return f"🎓 Заявка на курс «{COURSE_BY_ID[topic][1]}»"
    return "🎄 Заказ шара" if topic == "order" else "💬 Вопрос мастеру"


async def finish_lead(update: Update, context: ContextTypes.DEFAULT_TYPE, comment: str) -> None:
    topic = context.user_data.pop("lead_topic", "other")
    sent = await notify_admin(context, update, topic_title(topic), comment or "(без комментария)")
    msg = update.effective_message
    if sent:
        await msg.reply_text("Готово! Заявка у мастера — он напишет вам здесь, обычно в течение дня. А пока можете спрашивать меня о чём угодно 🐾", reply_markup=MENU)
    else:
        await msg.reply_text("Заявку записал, но связь с мастером ещё не настроена. Попробуйте чуть позже 🙏", reply_markup=MENU)


# ---------- свободный текст ----------
def faq_answer(text: str) -> str | None:
    t = text.lower()
    for keys, answer in K.FAQ:
        if any(k in t for k in keys):
            return answer
    return None


async def ai_answer(chat_id: int, text: str) -> str | None:
    if not ai:
        return None
    hist = HISTORY[chat_id]
    hist.append({"role": "user", "content": text})
    msgs = list(hist)
    while msgs and msgs[0]["role"] != "user":
        msgs.pop(0)
    try:
        answer = await ai_complete(msgs)
    except Exception as e:
        log.error("Ошибка ИИ: %s", e)
        hist.pop()
        return None
    if not answer:
        hist.pop()
        return None
    answer = re.sub(r"\*\*(.+?)\*\*", r"\1", answer).replace("### ", "").replace("## ", "")
    hist.append({"role": "assistant", "content": answer})
    return answer


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    msg = update.message
    text = (msg.text or "").strip()

    # 1) Мастер отвечает клиенту: reply на пересланное ботом сообщение в чате мастера
    if ADMIN_CHAT_ID and update.effective_chat.id == ADMIN_CHAT_ID:
        if msg.reply_to_message and str(msg.reply_to_message.message_id) in LINKS:
            user_chat = LINKS[str(msg.reply_to_message.message_id)]
            try:
                await context.bot.send_message(user_chat, f"💌 Ответ мастера Soul of Home:\n\n{text}")
                await msg.reply_text("✅ Отправлено клиенту")
            except Exception as e:
                await msg.reply_text(f"Не удалось отправить: {e}")
        elif update.effective_chat.type == ChatType.PRIVATE:
            await msg.reply_text("Чтобы ответить клиенту, сделайте reply на его сообщение от бота.")
        return

    # 2) Кнопки главного меню
    routes = {B_COLL: collection, B_COURSES: courses, B_LESSONS: lessons, B_LEAD: lead_start, B_ASK: ask_mode}
    if text in routes:
        context.user_data.pop("lead_topic", None)
        await routes[text](update, context)
        return
    if text == B_SITE and SITE_URL:
        await msg.reply_text(f"Сайт Soul of Home: {SITE_URL}")
        return

    # 3) Идёт оформление заявки — это комментарий к ней
    if "lead_topic" in context.user_data:
        await finish_lead(update, context, comment=text)
        return

    # 4) Вопрос Нейрокоту
    await context.bot.send_chat_action(update.effective_chat.id, ChatAction.TYPING)
    answer = await ai_answer(update.effective_chat.id, text)
    if answer:
        await msg.reply_text(answer, reply_markup=MENU)
        return
    faq = faq_answer(text)
    forwarded = await notify_admin(context, update, "❓ Вопрос из бота", text)
    tail = "\n\nЯ также передал вопрос мастеру — он ответит здесь." if forwarded else ""
    await msg.reply_text((faq or "Мур, хороший вопрос! Точно ответит мастер.") + tail, reply_markup=MENU)


async def on_other(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Фото, голосовые и прочее: передаём мастеру (например, фото готовой работы на разбор)."""
    if ADMIN_CHAT_ID and update.effective_chat.id == ADMIN_CHAT_ID:
        return
    if ADMIN_CHAT_ID:
        card = await notify_admin(context, update, "📎 Вложение от клиента", update.message.caption or "(без подписи)")
        if card:
            fwd = await update.message.forward(ADMIN_CHAT_ID)
            remember_link(fwd.message_id, update.effective_chat.id)
        await update.message.reply_text("Получил и передал мастеру 🐾 Он ответит здесь.")
    else:
        await update.message.reply_text("Мур! Пока я понимаю только текст — напишите, пожалуйста, словами 🐾")


async def on_error(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    log.exception("Ошибка при обработке обновления", exc_info=context.error)


async def post_init(app: Application) -> None:
    await app.bot.set_my_commands([
        BotCommand("start", "Начать сначала"),
        BotCommand("raboty", "Коллекция новогодних шаров"),
        BotCommand("kursy", "Программы обучения"),
        BotCommand("uroki", "Бесплатные уроки"),
        BotCommand("zayavka", "Оставить заявку"),
        BotCommand("help", "Что умеет бот"),
    ])
    await app.bot.set_my_short_description("Нейрокот — помощник мастерской Soul of Home: шары ручной работы, курсы и уроки об уюте")
    log.info("Бот запущен. ИИ: %s. Мастер: %s", AI_NAME,
             ADMIN_CHAT_ID or "не задан (узнайте id командой /myid)")


def build_app() -> Application:
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CommandHandler("myid", myid))
    app.add_handler(CommandHandler("raboty", collection))
    app.add_handler(CommandHandler("kursy", courses))
    app.add_handler(CommandHandler("uroki", lessons))
    app.add_handler(CommandHandler("zayavka", lead_start))
    app.add_handler(CallbackQueryHandler(on_button))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))
    app.add_handler(MessageHandler(~filters.TEXT & ~filters.COMMAND & ~filters.StatusUpdate.ALL, on_other))
    app.add_error_handler(on_error)
    return app


if __name__ == "__main__":
    if not BOT_TOKEN:
        raise SystemExit("Не задан BOT_TOKEN. Скопируйте .env.example в .env и впишите токен от @BotFather.")
    build_app().run_polling(allowed_updates=Update.ALL_TYPES)
