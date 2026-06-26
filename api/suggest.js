export default async function handler(req,res){
if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
try{
const {chatName,category,messages}=req.body||{};
const apiKey=process.env.OPENROUTER_API_KEY;
if(!apiKey) return res.status(500).json({error:"OPENROUTER_API_KEY is not set in Vercel."});
const prompt=`You are helping a Singapore JC teacher reply to WhatsApp chats.
Chat: ${chatName}
Category: ${category}
Recent messages:
${messages}

Return JSON only with keys: short, polite, friendly, firm, actionNeeded, urgency.`;
const r=await fetch("https://openrouter.ai/api/v1/chat/completions",{
method:"POST",
headers:{
"Authorization":`Bearer ${apiKey}`,
"Content-Type":"application/json",
"HTTP-Referer":"https://whatsapp-reply-dashboard.vercel.app",
"X-Title":"WhatsApp Reply Dashboard"
},
body:JSON.stringify({
model:process.env.OPENROUTER_MODEL||"openai/gpt-5",
messages:[{role:"user",content:prompt}],
temperature:0.4,
response_format:{type:"json_object"}
})
});
const data=await r.json();
if(!r.ok) return res.status(r.status).json({error:data.error?.message||"OpenRouter request failed"});
return res.status(200).json(JSON.parse(data.choices[0].message.content));
}catch(err){return res.status(500).json({error:err.message});}
}