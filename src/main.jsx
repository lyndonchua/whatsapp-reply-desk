import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Briefcase, Home, User, Bell, CheckSquare, UploadCloud, Copy, MessageSquare, Sparkles, Calendar, AlertTriangle, Search, Trash2, Save } from 'lucide-react';
import { db } from './firebase';
import './style.css';

const colours = {
  work: '#1578ff', family: '#4ac052', personal: '#7d4de8', urgent: '#ff3838', action: '#ff912b', none: '#8b949e'
};

const sampleChats = [
  { id:'sample-1', name:'Mr Ali', category:'work', section:'Hockey', urgency:'high', messages:[{ text:'Can you confirm the time for DSA trials on 3 July?', time:'08:15' }], replies:null },
  { id:'sample-2', name:'Keith Lee', category:'work', section:'CT Class', urgency:'high', messages:[{ text:'Need you to approve the match schedule.', time:'07:40' }], replies:null },
  { id:'sample-3', name:'Aidan', category:'family', section:'Family', urgency:'medium', messages:[{ text:'Dad, I need help with my project today.', time:'Yesterday' }], replies:null },
  { id:'sample-4', name:'Friends', category:'personal', section:'Personal', urgency:'low', messages:[{ text:'Weekend plan?', time:'Yesterday' }], replies:null },
  { id:'sample-5', name:'Bank Alert', category:'none', section:'FYI', urgency:'low', messages:[{ text:'Transaction successful.', time:'Yesterday' }], replies:null }
];

function cleanText(v){ return String(v || '').replace(/\s+/g,' ').trim(); }
function chatText(chat){ return (chat.messages || []).map(m => m.text).join('\n'); }
function makeId(name){ return `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

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

function normaliseMessage(x){
  if (typeof x === 'string') return { text: x, time: '' };
  return { text: x.text || x.message || x.body || x.summary || '', time: x.time || x.date || x.timestamp || '' };
}

function dedupeMessages(messages){
  const seen = new Set();
  return messages.map(normaliseMessage).filter(m => {
    const text = cleanText(m.text);
    if (!text) return false;
    const key = text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return { ...m, text };
  }).map(m => ({ ...m, text: cleanText(m.text) }));
}

function groupAndDedupe(items){
  const map = new Map();
  items.forEach((item, i) => {
    const name = cleanText(item.name || item.chat || item.group || item.sender || `Chat ${i+1}`) || 'Unknown Chat';
    const messages = dedupeMessages(item.messages || [item.text || item.summary || item.message || '']);
    if (!messages.length) return;
    const text = messages.map(m => m.text).join('\n');
    if (!map.has(name)) {
      map.set(name, {
        id: makeId(name),
        name,
        category: (item.category || guessCategory(name, text)).toLowerCase(),
        section: item.section || item.group || 'Uploaded',
        urgency: item.urgency || guessUrgency(text),
        messages: [],
        replies: item.replies || null
      });
    }
    const chat = map.get(name);
    chat.messages.push(...messages);
    chat.urgency = chat.urgency === 'high' || guessUrgency(text) === 'high' ? 'high' : (chat.urgency === 'medium' || guessUrgency(text) === 'medium' ? 'medium' : 'low');
    if (chat.category === 'personal') chat.category = (item.category || guessCategory(name, text)).toLowerCase();
  });
  return [...map.values()].map(c => ({ ...c, messages: dedupeMessages(c.messages) }));
}

function parseUpload(raw){
  try {
    const json = JSON.parse(raw);
    const arr = Array.isArray(json) ? json : json.chats || json.items || json.groups || [];
    return groupAndDedupe(arr);
  } catch {
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const items = [];
    lines.forEach((line, i) => {
      const m = line.match(/(?:—|-|–)\s*([^:]{1,80}):\s*(.+)$/) || line.match(/^([^:]{2,80}):\s*(.+)$/);
      if (m) items.push({ name:m[1].trim(), text:m[2].trim() });
      else items.push({ name:'Unknown Chat', text:line.trim() });
    });
    if (!items.length) return [];
    return groupAndDedupe(items).slice(0,120);
  }
}

function Tile({type, title, count, subtitle, icon}){
  return <div className={`tile ${type}`}><div className="tileIcon">{icon}</div><div><b>{title}</b><div className="big">{count}</div><span>{subtitle}</span></div></div>
}
function ChatCard({chat,onSuggest,onDelete,onCategory,onMove,onToggleSelect,selected}){
  return <div className={`chatCard ${chat.category}`}>
    <div className="chatTop"><label className="pick"><input type="checkbox" checked={selected} onChange={()=>onToggleSelect(chat.id)}/><b>{chat.name}</b></label><span className={`pill ${chat.urgency}`}>{chat.urgency}</span></div>
    <div className="miniControls"><select value={chat.category} onChange={e=>onCategory(chat.id,e.target.value)}>{Object.keys(colours).map(k=><option value={k} key={k}>{k==='none'?'No reply':k}</option>)}</select><button onClick={()=>onMove(chat.id,-1)}>↑</button><button onClick={()=>onMove(chat.id,1)}>↓</button></div>
    <div className="messageScroll">{(chat.messages || []).map((m,i)=><p key={i}><small>{m.time}</small>{m.text}</p>)}</div>
    <div className="cardActions"><button onClick={()=>onSuggest(chat)}><Sparkles size={14}/>AI replies</button><button className="danger" onClick={()=>onDelete(chat.id)}><Trash2 size={14}/>Delete</button></div>
    {chat.replies && <div className="replies">{['short','polite','friendly','firm'].map(k=> chat.replies[k] && <div className="reply" key={k}><small>{k}</small><span>{chat.replies[k]}</span><CopyButton text={chat.replies[k]}/></div>)}</div>}
  </div>
}
function CopyButton({text}){return <button className="copy" onClick={()=>navigator.clipboard.writeText(text)}><Copy size={14}/></button>}

function App(){
  const [chats,setChats]=useState(sampleChats);
  const [busy,setBusy]=useState('');
  const [search,setSearch]=useState('');
  const [saved,setSaved]=useState('');
  const [selected,setSelected]=useState([]);
  const visibleChats = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return chats;
    return chats.filter(c => c.name.toLowerCase().includes(q) || (c.section || '').toLowerCase().includes(q));
  }, [chats, search]);
  const stats=useMemo(()=>({
    work:visibleChats.filter(c=>c.category==='work').length,
    family:visibleChats.filter(c=>c.category==='family').length,
    personal:visibleChats.filter(c=>c.category==='personal').length,
    urgent:visibleChats.filter(c=>c.urgency==='high').length,
    action:visibleChats.filter(c=>c.urgency!=='low' && c.category!=='none').length,
    none:visibleChats.filter(c=>c.category==='none').length
  }),[visibleChats]);
  async function saveToFirebase(data = chats, source = 'manual-save'){
    const cleaned = groupAndDedupe(data);
    await addDoc(collection(db,'dailyBriefings'),{createdAt:serverTimestamp(),source,totalChats:cleaned.length,chats:cleaned});
    setSaved(`Saved ${cleaned.length} chats to Firebase`);
    setTimeout(()=>setSaved(''),2500);
  }
  async function upload(e){
    const file=e.target.files[0]; if(!file) return;
    const text=await file.text(); const parsed=parseUpload(text); setChats(parsed);
    await saveToFirebase(parsed, file.name);
  }
  async function suggest(chat){
    setBusy(chat.name);
    try{
      const messages = chatText(chat);
      const r=await fetch('/api/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatName:chat.name,category:chat.category,messages})});
      const data=await r.json(); if(!r.ok) throw new Error(data.error || 'AI failed');
      setChats(cs=>cs.map(c=>c.id===chat.id?{...c,replies:data}:c));
      await addDoc(collection(db,'replySuggestions'),{createdAt:serverTimestamp(),chatName:chat.name,category:chat.category,messages,suggestions:data});
    }catch(err){alert(err.message)} finally{setBusy('')}
  }
  function deleteChat(id){
    if (!confirm('Delete this entire sender/group chat from the dashboard?')) return;
    setChats(cs => cs.filter(c => c.id !== id));
    setSelected(s => s.filter(x => x !== id));
  }
  function changeCategory(id, category){
    setChats(cs => cs.map(c => c.id === id ? {...c, category} : c));
  }
  function moveChat(id, dir){
    setChats(cs => {
      const arr=[...cs]; const i=arr.findIndex(c=>c.id===id); const j=i+dir;
      if(i<0 || j<0 || j>=arr.length) return cs;
      [arr[i],arr[j]]=[arr[j],arr[i]];
      return arr;
    });
  }
  function toggleSelect(id){
    setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]);
  }
  function combineSelected(){
    if(selected.length < 2) return alert('Select at least 2 sender/group boxes to combine.');
    const chosen = chats.filter(c => selected.includes(c.id));
    const name = prompt('Name for combined chat:', chosen.map(c=>c.name).join(' + '));
    if(!name) return;
    const combined = {
      id: makeId(name),
      name,
      category: chosen[0].category,
      section: 'Combined',
      urgency: chosen.some(c=>c.urgency==='high') ? 'high' : (chosen.some(c=>c.urgency==='medium') ? 'medium' : 'low'),
      messages: dedupeMessages(chosen.flatMap(c => (c.messages||[]).map(m => ({...m, text:`[${c.name}] ${m.text}`})))),
      replies: null
    };
    setChats(cs => [combined, ...cs.filter(c => !selected.includes(c.id))]);
    setSelected([]);
  }
  const grouped=['work','family','personal','urgent','action','none'];
  return <main>
    <aside><div className="brand"><MessageSquare size={38}/><h1>WhatsApp<br/>Reply Desk</h1></div><p>AI suggestions for smarter replies</p><label className="upload"><UploadCloud/> Upload Daily Briefing<input type="file" accept=".txt,.json,.csv" onChange={upload}/></label><button className="combineBtn" onClick={combineSelected}>Combine selected ({selected.length})</button><button className="saveBtn" onClick={()=>saveToFirebase()}><Save size={17}/> Save to Firebase</button><nav>{grouped.map(g=><a key={g}><span style={{background:colours[g]}}/> {g==='none'?'No Reply Needed':g[0].toUpperCase()+g.slice(1)}</a>)}</nav><div className="summary"><b>Daily Summary</b><p>Total chats: {visibleChats.length}</p><p>Need replies: {visibleChats.length-stats.none}</p><p>Action items: {stats.action}</p></div></aside>
    <section className="dash"><div className="topbar"><h2>Bento Reply Dashboard</h2><span><Calendar size={16}/> {new Date().toLocaleDateString('en-SG')}</span></div>
      <div className="searchbar"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sender or group..." />{search && <button onClick={()=>setSearch('')}>Clear</button>}</div>
      <div className="grid">
        <Tile type="work" title="WORK" count={stats.work} subtitle="School, admin, classes" icon={<Briefcase/>}/>
        <Tile type="family" title="FAMILY" count={stats.family} subtitle="Home and kids" icon={<Home/>}/>
        <Tile type="personal" title="PERSONAL" count={stats.personal} subtitle="Friends and personal" icon={<User/>}/>
        <Tile type="urgent" title="URGENT REPLIES" count={stats.urgent} subtitle="Need attention" icon={<Bell/>}/>
        <Tile type="action" title="ACTION NEEDED" count={stats.action} subtitle="Tasks and follow-up" icon={<CheckSquare/>}/>
        <Tile type="none" title="NO REPLY NEEDED" count={stats.none} subtitle="FYI only" icon={<AlertTriangle/>}/>
      </div>
      <div className="sections">{grouped.map(g=><section className="section" key={g}><h3 style={{color:colours[g]}}>{g==='none'?'No Reply Needed':g[0].toUpperCase()+g.slice(1)}</h3><div className="cards">{visibleChats.filter(c=>g==='urgent'?c.urgency==='high':g==='action'?(c.urgency!=='low'&&c.category!=='none'):c.category===g).map((c)=><ChatCard chat={c} onSuggest={suggest} onDelete={deleteChat} onCategory={changeCategory} onMove={moveChat} onToggleSelect={toggleSelect} selected={selected.includes(c.id)} key={c.id}/>)}</div></section>)}</div>
      {busy && <div className="busy">Generating replies for {busy}...</div>}{saved && <div className="saved">{saved}</div>}
    </section>
  </main>
}

createRoot(document.getElementById('root')).render(<App/>);
