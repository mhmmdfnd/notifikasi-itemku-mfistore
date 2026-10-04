const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signItemku(payload) {
  const apiKey = process.env.ITEMKU_API_KEY;
  const apiSecret = process.env.ITEMKU_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error('ITEMKU_API_KEY / ITEMKU_API_SECRET belum diisi');

  const nonce = Math.floor(Date.now() / 1000).toString();
  const header = JSON.stringify({ 'X-Api-Key': apiKey, Nonce: nonce, alg: 'HS256' });
  const payloadJson = JSON.stringify(payload);
  const unsigned = `${base64url(header)}.${base64url(payloadJson)}`;
  const signature = crypto.createHmac('sha256', apiSecret).update(unsigned).digest('base64url');
  return { authorization: `${unsigned}.${signature}`, apiKey, nonce };
}

async function itemkuOrderExists(orderId) {
  const body = { order_id: Number(orderId), date_start_at: new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10), limit: 30 };
  const auth = signItemku(body);
  const r = await fetch('https://tokoku-gateway.itemku.com/api/order/list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': auth.apiKey,
      'Nonce': auth.nonce,
      'Authorization': `Bearer ${auth.authorization}`
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) return false;
  const json = await r.json();
  return Array.isArray(json.data) && json.data.some(o => String(o.order_id) === String(orderId) && o.status === 'REQUIRE_PROCESS');
}

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendTelegram(order) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diisi');

  const message = [
    '🛒 <b>ORDER BARU ITEMKU</b>',
    '',
    `🆔 <b>Order:</b> <code>${escapeHtml(order.order_number || order.order_id)}</code>`,
    `🎮 <b>Game:</b> ${escapeHtml(order.game_name)}`,
    `📦 <b>Produk:</b> ${escapeHtml(order.product_name)}`,
    `🔢 <b>Qty:</b> ${escapeHtml(order.quantity)}`,
    `💰 <b>Harga:</b> ${formatRupiah(order.price)}`,
    `💵 <b>Income:</b> ${formatRupiah(order.order_income)}`,
    `📅 <b>Waktu:</b> ${escapeHtml(order.order_created_at)}`,
    `🌍 <b>Country:</b> ${escapeHtml(order.country)}`,
    '',
    '⚡ <b>Status:</b> MENUNGGU DIPROSES'
  ].join('\n');

  const r = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: true })
  });
  const json = await r.json();
  if (!r.ok || !json.ok) throw new Error(json.description || 'Telegram sendMessage gagal');
  return json;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method Not Allowed' });

  try {
    const expectedShop = process.env.ITEMKU_SHOP_ID;
    const receivedShop = req.headers['x-itemku'];
    if (expectedShop && String(receivedShop) !== String(expectedShop)) {
      return res.status(401).json({ ok: false, error: 'Invalid Itemku shop header' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const orders = Array.isArray(body?.data) ? body.data : [];
    if (!orders.length) return res.status(200).json({ ok: true, message: 'No orders in callback' });

    // In-memory short-lived dedupe. For multi-instance production, use Redis/KV.
    globalThis.__itemkuSeen ||= new Map();
    const now = Date.now();
    for (const [k, t] of globalThis.__itemkuSeen) if (now - t > 24 * 60 * 60 * 1000) globalThis.__itemkuSeen.delete(k);

    const results = [];
    for (const order of orders) {
      const key = String(order.order_id);
      if (!key || globalThis.__itemkuSeen.has(key)) {
        results.push({ order_id: key, skipped: true });
        continue;
      }

      // Default: fast callback. Set VERIFY_ITEMKU=true to confirm the order through Itemku API before notifying.
      if (process.env.VERIFY_ITEMKU === 'true') {
        const valid = await itemkuOrderExists(order.order_id);
        if (!valid) return res.status(401).json({ ok: false, error: 'Order could not be verified via Itemku API', order_id: key });
      }

      await sendTelegram(order);
      globalThis.__itemkuSeen.set(key, now);
      results.push({ order_id: key, notified: true });
    }

    return res.status(200).json({ ok: true, results });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
