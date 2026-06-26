export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: 'Missing OPENROUTER_API_KEY in Vercel' });
  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-5';
  const { sender, category, messages } = req.body || {};
  const text = (messages || []).map(m => `${m.time || ''} ${m.text || ''}`).join('\n').slice(-8000);
  const prompt = `You are Mr Chua's WhatsApp reply assistant. Generate concise copy-paste replies.\nSender/group: ${sender}\nCategory: ${category}\nMessages:\n${text}\n\nReturn exactly 4 options:\n1. Short:\n2. Warm:\n3. Professional:\n4. Firm:\nIf no reply is needed, say so clearly.`;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.origin || 'https://whatsapp-reply-dashboard.vercel.app',
        'X-Title': 'WhatsApp Reply Desk'
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'OpenRouter error' });
    return res.status(200).json({ reply: data.choices?.[0]?.message?.content || 'No reply generated.' });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
