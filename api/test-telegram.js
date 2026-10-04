module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diisi');
    const r = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ chat_id: chatId, text:'✅ Test berhasil — Itemku Telegram Notifier terhubung.' })
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.description || 'Telegram error');
    res.status(200).json({ok:true});
  } catch(e) { res.status(500).json({ok:false,error:e.message}); }
};
