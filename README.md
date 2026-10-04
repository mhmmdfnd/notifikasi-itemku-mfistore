# Itemku Telegram Notifier — Vercel Ready

Serverless webhook: Itemku Order Callback → Telegram.

## Deploy
1. Import repository/folder ini ke Vercel.
2. Settings → Environment Variables.
3. Isi variable berikut:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `ITEMKU_SHOP_ID`
   - `ITEMKU_API_KEY`
   - `ITEMKU_API_SECRET`
   - `VERIFY_ITEMKU=false`
4. Deploy/redeploy.
5. Buka URL project dan tekan **Kirim Test**.
6. Gunakan `https://DOMAIN/api/webhook` sebagai Itemku Order Callback URL.

## Fast mode
`VERIFY_ITEMKU=false` adalah mode tercepat: setelah callback Itemku lolos validasi shop header, order langsung diteruskan ke Telegram.

## Verified mode
`VERIFY_ITEMKU=true` membuat server mengecek order melalui `https://tokoku-gateway.itemku.com/api/order/list` dan memastikan status `REQUIRE_PROCESS` sebelum mengirim Telegram.

## Telegram
Buat bot melalui BotFather, masukkan bot ke chat/grup tujuan bila diperlukan, lalu isi token dan chat ID di Vercel.

## Itemku callback
Handler menerima POST dengan bentuk `data: [{...order...}]`, memeriksa `X-itemku`, dan menggunakan `order_id` untuk mencegah notifikasi ganda. Itemku dapat melakukan retry callback jika request gagal.

## DNS verification
Jika konfigurasi callback Itemku meminta DNS TXT verification, gunakan domain yang DNS-nya dapat Anda kelola. Domain bawaan `*.vercel.app` bukan tempat untuk menambahkan record DNS sendiri; gunakan custom domain pada Vercel/DNS provider Anda jika verifikasi tersebut diperlukan.

## Security
Jangan memasukkan API Secret Itemku atau Telegram Bot Token ke HTML/JavaScript frontend. Semua credential dibaca dari Vercel Environment Variables.
