// Чат Нейрокота на сайте: принимает историю диалога, отвечает потоком текста.
// Нужна переменная окружения ANTHROPIC_API_KEY в настройках проекта Vercel.
// Без неё отвечает 503, и чат на сайте предлагает написать в Telegram.
const Anthropic = require('@anthropic-ai/sdk');
const SYSTEM = require('./_prompt');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const MAX_TURNS = 12;
const MAX_CHARS = 1500;
const LIMIT_PER_HOUR = 30;

// Простое ограничение частоты по IP. Живёт, пока жив экземпляр функции,
// поэтому это защита от случайных очередей запросов, а не от целенаправленной атаки.
const hits = new Map();
function tooMany(ip) {
  const now = Date.now(), hour = 3600e3;
  const list = (hits.get(ip) || []).filter((t) => now - t < hour);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > LIMIT_PER_HOUR;
}

function cleanTurns(raw) {
  if (!Array.isArray(raw)) return null;
  const turns = raw.slice(-MAX_TURNS).filter((m) =>
    m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim());
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') return null;
  for (let i = 1; i < turns.length; i++) if (turns[i].role === turns[i - 1].role) return null;
  return turns.map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'chat_disabled' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return res.status(429).json({ error: 'rate_limited' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const messages = cleanTurns(body.messages);
  if (!messages) return res.status(400).json({ error: 'bad_request' });

  const client = new Anthropic();
  const controller = new AbortController();
  // Посетитель закрыл чат или нажал «стоп»: прекращаем генерацию.
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });

  let wrote = false;
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      // Короткие ответы в чате: промпт просит 2–6 предложений, лимит ограничивает расход.
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system: SYSTEM,
      cache_control: { type: 'ephemeral' },
      messages,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    }, { signal: controller.signal });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        if (!wrote) {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
          wrote = true;
        }
        res.write(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal' && !wrote) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      wrote = true;
      res.write('На этот вопрос я не отвечу. Давайте поговорим про уют, шары или курсы?');
    }
    if (!wrote) return res.status(502).json({ error: 'empty' });
    return res.end();
  } catch (err) {
    if (controller.signal.aborted) return res.end();
    console.error('chat error', err && err.status, err && err.message);
    if (wrote) return res.end();
    // Неверный ключ или закончился баланс: чат на сайте переключится на Telegram.
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return res.status(503).json({ error: 'chat_disabled' });
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'rate_limited' });
    return res.status(502).json({ error: 'upstream_error' });
  }
};
