export async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error('متغيرات تيليجرام غير مضبوطة (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)');
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error('خطأ من تيليجرام: ' + JSON.stringify(data));
  }
  return data;
}
