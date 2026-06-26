export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { chatName, category, messages } = req.body || {};
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY is not set in Vercel Environment Variables." });

    const prompt = `You are helping a Singapore JC teacher reply to WhatsApp chats.\nChat: ${chatName}\nCategory: ${category}\nRecent messages:\n${messages}\n\nReturn JSON only with keys: short, polite, friendly, firm, actionNeeded, urgency. Keep replies simple and copy-paste ready.`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        response_format: { type: "json_object" }
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || "OpenAI request failed" });
    return res.status(200).json(JSON.parse(data.choices[0].message.content));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
