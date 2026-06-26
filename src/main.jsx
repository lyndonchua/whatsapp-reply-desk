import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Briefcase, Home, User, Bell, CheckSquare, UploadCloud, Copy, MessageSquare, Sparkles, Calendar, AlertTriangle } from 'lucide-react';
import { db } from './firebase';
import './style.css';

const colours = {
  work: '#1578ff', family: '#4ac052', personal: '#7d4de8', urgent: '#ff3838', action: '#ff912b', none: '#8b949e'
};

const sampleChats = [
  { name:'Mr Ali', category:'work', section:'Hockey', urgency:'high', text:'Can you confirm the time for DSA trials on 3 July?', replies:null },
  { name:'Keith Lee', category:'work', section:'CT Class', urgency:'high', text:'Need you to approve the match schedule.', replies:null },
  { name:'Aidan', category:'family', section:'Family', urgency:'medium', text:'Dad, I need help with my project today.', replies:null },
  { name:'Friends', category:'personal', section:'Personal', urgency:'low', text:'Weekend plan?', replies:null },
  { name:'Bank Alert', category:'none', section:'FYI', urgency:'low', text:'Transaction successful.', replies:null }
];

function guessCategory(name, text){
  const s=(name+' '+text).toLowerCase();
  if(/aidan|megan|dad|mum|family|home/.test(s)) return 'family';
  if(/student|class|econs|hockey|dsa|coach|teacher|mr |mrs |ms |school|admin|parent|pw|ct/.test(s)) return 'work';
  if(/fyi|newsletter|promo|bank alert|transaction/.test(s)) return 'none';
  return 'personal';
}
function guessUrgency(text){
  const s=text.toLowerCase();
  if(/urgent|today|now|asap|eod|deadline|unwell|submit/.test(s)) return 'high';
  if(/tomorrow|later|confirm|check/.test(s)) return 'medium';
  return 'low';
}
function parseUpload(raw){
  try {
    const json = JSON.parse(raw);
    const arr = Array.isArray(json) ? json : json.chats || json.items || [];
    return arr.map((x,i)=>({
      name:x.name || x.chat || x.sender || `Chat ${i+1}`,
      text:x.summary || x.text || x.message || x.messages || '',
      category:(x.category || guessCategory(x.name||'', x.summary||x.text||x.message||'')).toLowerCase(),
      section:x.section || x.group || 'Uploaded',
      urgency:x.urgency || guessUrgency(x.summary||x.text||x.message||''),
      replies:x.replies || null
    }));
  } catch {
    const blocks = raw.split(/\n(?=\d{1,2}\s\w+|\[?\d{1,2}[:/]|[A-Za-z].{1,40}:)/).filter(Boolean);
    return blocks.map((b,i)=>{
      const first = b.split('\n')[0];
      const name = (first.match(/—\s*([^:]+):/) || first.match(/^([^:]{2,40}):/) || [,'Unknown Chat'])[1].trim();
      return { name, text:b.slice(0,700), category:guessCategory(name,b), section:'Uploaded', urgency:guessUrgency(b), replies:null };
    }).slice(0,80);
  }
}

function Tile({type, title, count, subtitle, icon}){
  return <div className={`tile ${type}`}><div className="tileIcon">{icon}</div><div><b>{title}</b><div className="big">{count}</div><span>{subtitle}</span></div></div>
}
function ChatCard({chat,onSuggest}){
  return <div className={`chatCard ${chat.category}`}>
    <div className="chatTop"><b>{chat.name}</b><span className={`pill ${chat.urgency}`}>{chat.urgency}</span></div>
    <p>{chat.text}</p>
    <button onClick={()=>onSuggest(chat)}><Sparkles size={15}/> AI suggest replies</button>
    {chat.replies && <div className="replies">{['short','polite','friendly','firm'].map(k=> chat.replies[k] && <div className="reply" key={k}><small>{k}</small><span>{chat.replies[k]}</span><CopyButton text={chat.replies[k]}/></div>)}</div>}
  </div>
}
function CopyButton({text}){return <button className="copy" onClick={()=>navigator.clipboard.writeText(text)}><Copy size={14}/></button>}

function App(){
  const [chats,setChats]=useState(sampleChats);
  const [busy,setBusy]=useState('');
  const stats=useMemo(()=>({
    work:chats.filter(c=>c.category==='work').length,
    family:chats.filter(c=>c.category==='family').length,
    personal:chats.filter(c=>c.category==='personal').length,
    urgent:chats.filter(c=>c.urgency==='high').length,
    action:chats.filter(c=>c.urgency!=='low' && c.category!=='none').length,
    none:chats.filter(c=>c.category==='none').length
  }),[chats]);
  async function upload(e){
    const file=e.target.files[0]; if(!file) return;
    const text=await file.text(); const parsed=parseUpload(text); setChats(parsed);
    await addDoc(collection(db,'dailyBriefings'),{createdAt:serverTimestamp(),fileName:file.name,totalChats:parsed.length,chats:parsed});
  }
  async function suggest(chat){
    setBusy(chat.name);
    try{
      const r=await fetch('/api/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatName:chat.name,category:chat.category,messages:chat.text})});
      const data=await r.json(); if(!r.ok) throw new Error(data.error || 'AI failed');
      setChats(cs=>cs.map(c=>c===chat?{...c,replies:data}:c));
      await addDoc(collection(db,'replySuggestions'),{createdAt:serverTimestamp(),chatName:chat.name,category:chat.category,messages:chat.text,suggestions:data});
    }catch(err){alert(err.message)} finally{setBusy('')}
  }
  const grouped=['work','family','personal','urgent','action','none'];
  return <main>
    <aside><div className="brand"><MessageSquare size={38}/><h1>WhatsApp<br/>Reply Desk</h1></div><p>AI suggestions for smarter replies</p><label className="upload"><UploadCloud/> Upload Daily Briefing<input type="file" accept=".txt,.json,.csv" onChange={upload}/></label><nav>{grouped.map(g=><a key={g}><span style={{background:colours[g]}}/> {g==='none'?'No Reply Needed':g[0].toUpperCase()+g.slice(1)}</a>)}</nav><div className="summary"><b>Daily Summary</b><p>Total chats: {chats.length}</p><p>Need replies: {chats.length-stats.none}</p><p>Action items: {stats.action}</p></div></aside>
    <section className="dash"><div className="topbar"><h2>Bento Reply Dashboard</h2><span><Calendar size={16}/> {new Date().toLocaleDateString('en-SG')}</span></div>
      <div className="grid">
        <Tile type="work" title="WORK" count={stats.work} subtitle="School, admin, classes" icon={<Briefcase/>}/>
        <Tile type="family" title="FAMILY" count={stats.family} subtitle="Home and kids" icon={<Home/>}/>
        <Tile type="personal" title="PERSONAL" count={stats.personal} subtitle="Friends and personal" icon={<User/>}/>
        <Tile type="urgent" title="URGENT REPLIES" count={stats.urgent} subtitle="Need attention" icon={<Bell/>}/>
        <Tile type="action" title="ACTION NEEDED" count={stats.action} subtitle="Tasks and follow-up" icon={<CheckSquare/>}/>
        <Tile type="none" title="NO REPLY NEEDED" count={stats.none} subtitle="FYI only" icon={<AlertTriangle/>}/>
      </div>
      <div className="sections">{grouped.map(g=><section className="section" key={g}><h3 style={{color:colours[g]}}>{g==='none'?'No Reply Needed':g[0].toUpperCase()+g.slice(1)}</h3><div className="cards">{chats.filter(c=>g==='urgent'?c.urgency==='high':g==='action'?(c.urgency!=='low'&&c.category!=='none'):c.category===g).map((c,i)=><ChatCard chat={c} onSuggest={suggest} key={c.name+i}/>)}</div></section>)}</div>
      {busy && <div className="busy">Generating replies for {busy}...</div>}
    </section>
  </main>
}

createRoot(document.getElementById('root')).render(<App/>);
