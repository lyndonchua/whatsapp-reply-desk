import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Briefcase, Home, User, UploadCloud, Copy, MessageSquare, Sparkles, Calendar, Search, Trash2, Save, Lock, Unlock, LogOut } from 'lucide-react';
import { db } from './firebase';
import './style.css';

const APP_PASSWORD = '344565';
const CATEGORIES = ['work','family','personal'];
const colours = { work: '#1578ff', family: '#4ac052', personal: '#7d4de8' };

const sampleChats = [
  { id:'sample-1', name:'Mr Ali', category:'work', section:'Hockey', urgency:'high', needsReply:true, messages:[{ text:'Can you confirm the time for DSA trials on 3 July?', time:'08:15' }], replies:null },
  { id:'sample-2', name:'Keith Lee', category:'work', section:'CT Class', urgency:'high', needsReply:true, messages:[{ text:'Need you to approve the match schedule.', time:'07:40' }], replies:null },
  { id:'sample-3', name:'Aidan', category:'family', section:'Family', urgency:'medium', needsReply:true, messages:[{ text:'Dad, I need help with my project today.', time:'Yesterday' }], replies:null },
  { id:'sample-4', name:'Friends', category:'personal', section:'Personal', urgency:'low', needsReply:true, messages:[{ text:'Weekend plan?', time:'Yesterday' }], replies:null },
  { id:'sample-5', name:'Bank Alert', category:'personal', section:'FYI', urgency:'low', needsReply:false, messages:[{ text:'Transaction successful.', time:'Yesterday' }], replies:null }
];

function cleanText(v){ return String(v || '').replace(/\s+/g,' ').trim(); }
function chatText(chat){ return (chat.messages || []).map(m => `${m.time ? m.time + ' - ' : ''}${m.text}`).join('\n'); }
function makeId(name){ return `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function safeCategory(value){ return CATEGORIES.includes(String(value||'').toLowerCase()) ? String(value).toLowerCase() : 'personal'; }

function guessCategory(name, text){
  const s=(name+' '+text).toLowerCase();
  if(/aidan|megan|dad|mum|family|home|parents|relative/.test(s)) return 'family';
  if(/student|class|econs|economics|hockey|dsa|coach|teacher|mr |mrs |ms |school|admin|parent|pw|ct|department|league|match|trial|schedule|saJC/i.test(s)) return 'work';
  return 'personal';
}
function guessUrgency(text){
  const s=text.toLowerCase();
  if(/urgent|today|now|asap|eod|deadline|unwell|submit|approve/.test(s)) return 'high';
  if(/tomorrow|later|confirm|check|help|need/.test(s)) return 'medium';
  return 'low';
}
function guessNeedsReply(text){
  const s=text.toLowerCase();
  if(/transaction successful|newsletter|promo|privacy update|fyi only|no reply|receipt/.test(s)) return false;
  return /\?|please|can you|need|help|confirm|send|submit|approve|call|check|reply|ask|tell/.test(s);
}
function normaliseMessage(x){
  if (typeof x === 'string') return { text: x, time: '' };
  return { text: x.text || x.message || x.body || x.summary || '', time: x.time || x.date || x.timestamp || '' };
}
function dedupeMessages(messages){
  const seen = new Set();
  const out = [];
  messages.map(normaliseMessage).forEach(m => {
    const text = cleanText(m.text);
    if (!text) return;
    const key = `${cleanText(m.time).toLowerCase()}|${text.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...m, text, time: cleanText(m.time) });
  });
  return out;
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
        id: item.id || makeId(name),
        name,
        category: safeCategory(item.category || guessCategory(name, text)),
        section: item.section || item.group || 'Uploaded',
        urgency: item.urgency || guessUrgency(text),
        needsReply: item.needsReply ?? guessNeedsReply(text),
        messages: [],
        replies: item.replies || null
      });
    }
    const chat = map.get(name);
    chat.messages.push(...messages);
    const u = guessUrgency(text);
    chat.urgency = chat.urgency === 'high' || u === 'high' ? 'high' : (chat.urgency === 'medium' || u === 'medium' ? 'medium' : 'low');
    chat.needsReply = Boolean(chat.needsReply || guessNeedsReply(text));
    chat.category = safeCategory(chat.category);
  });
  return [...map.values()].map(c => ({ ...c, messages: dedupeMessages(c.messages), category: safeCategory(c.category) }));
}
function parseUpload(raw){
  try {
    const json = JSON.parse(raw);
    const arr = Array.isArray(json) ? json : json.chats || json.items || json.groups || [];
    return groupAndDedupe(arr);
  } catch {
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const items = [];
    lines.forEach((line) => {
      const m = line.match(/(?:—|-|–)\s*([^:]{1,80}):\s*(.+)$/) || line.match(/^([^:]{2,80}):\s*(.+)$/);
      if (m) items.push({ name:m[1].trim(), text:m[2].trim() });
      else items.push({ name:'Unknown Chat', text:line.trim() });
    });
    return groupAndDedupe(items).slice(0,120);
  }
}
function Tile({type, title, count, subtitle, icon}){
  return <div className={`tile ${type}`}><div className="tileIcon">{icon}</div><div><b>{title}</b><div className="big">{count}</div><span>{subtitle}</span></div></div>;
}
function CopyButton({text}){return <button className="copy" onClick={()=>navigator.clipboard.writeText(text)}><Copy size={13}/></button>;}
function ChatCard({chat,onSuggest,onDelete,onCategory,onMove,onToggleSelect,selected}){
  return <div className={`chatCard ${chat.category}`}>
    <div className="chatTop"><label className="pick"><input type="checkbox" checked={selected} onChange={()=>onToggleSelect(chat.id)}/><b>{chat.name}</b></label><span className={`pill ${chat.urgency}`}>{chat.urgency}</span></div>
    <div className="miniControls"><select value={chat.category} onChange={e=>onCategory(chat.id,e.target.value)}>{CATEGORIES.map(k=><option value={k} key={k}>{k}</option>)}</select><button title="Move up" onClick={()=>onMove(chat.id,-1)}>↑</button><button title="Move down" onClick={()=>onMove(chat.id,1)}>↓</button></div>
    <div className="metaLine"><span>{chat.needsReply ? 'Needs reply' : 'No reply needed'}</span><span>{chat.messages.length} msg</span></div>
    <div className="messageScroll">{(chat.messages || []).map((m,i)=><p key={i}><small>{m.time}</small>{m.text}</p>)}</div>
    <div className="cardActions"><button onClick={()=>onSuggest(chat)}><Sparkles size={13}/>AI replies</button><button className="danger" onClick={()=>onDelete(chat.id)}><Trash2 size={13}/>Delete</button></div>
    {chat.replies && <div className="replies">{['short','polite','friendly','firm'].map(k=> chat.replies[k] && <div className="reply" key={k}><small>{k}</small><span>{chat.replies[k]}</span><CopyButton text={chat.replies[k]}/></div>)}</div>}
  </div>;
}
function PasswordLock({onUnlock}){
  const [pw,setPw]=useState(''); const [err,setErr]=useState('');
  function submit(e){ e.preventDefault(); if(pw===APP_PASSWORD){ sessionStorage.setItem('wrd_unlocked','yes'); onUnlock(); } else { setErr('Incorrect password.'); setPw(''); } }
  return <div className="lockScreen"><form className="lockBox" onSubmit={submit}><Lock size={38}/><h1>WhatsApp Reply Desk</h1><p>Password required</p><input autoFocus type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Enter password"/><button><Unlock size={16}/>Unlock</button>{err && <div className="lockError">{err}</div>}</form></div>;
}
function App(){
  const [unlocked,setUnlocked]=useState(sessionStorage.getItem('wrd_unlocked')==='yes');
  const [chats,setChats]=useState(groupAndDedupe(sampleChats));
  const [busy,setBusy]=useState('');
  const [search,setSearch]=useState('');
  const [saved,setSaved]=useState('');
  const [selected,setSelected]=useState([]);
  const visibleChats = useMemo(() => {
    const q = search.toLowerCase().trim();
    const clean = groupAndDedupe(chats);
    if (!q) return clean;
    return clean.filter(c => c.name.toLowerCase().includes(q) || (c.section || '').toLowerCase().includes(q) || chatText(c).toLowerCase().includes(q));
  }, [chats, search]);
  const stats=useMemo(()=>({
    work:visibleChats.filter(c=>c.category==='work').length,
    family:visibleChats.filter(c=>c.category==='family').length,
    personal:visibleChats.filter(c=>c.category==='personal').length,
    urgent:visibleChats.filter(c=>c.urgency==='high').length,
    needReply:visibleChats.filter(c=>c.needsReply).length
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
      setChats(cs=>cs.map(c=>c.id===chat.id?{...c,replies:data,needsReply:data.actionNeeded !== false}:c));
      await addDoc(collection(db,'replySuggestions'),{createdAt:serverTimestamp(),chatName:chat.name,category:chat.category,messages,suggestions:data});
    }catch(err){alert(err.message)} finally{setBusy('');}
  }
  function deleteChat(id){
    if (!confirm('Delete this entire sender/group chat from the dashboard?')) return;
    setChats(cs => cs.filter(c => c.id !== id));
    setSelected(s => s.filter(x => x !== id));
  }
  function changeCategory(id, category){ setChats(cs => cs.map(c => c.id === id ? {...c, category:safeCategory(category)} : c)); }
  function moveChat(id, dir){
    setChats(cs => { const arr=[...cs]; const i=arr.findIndex(c=>c.id===id); const j=i+dir; if(i<0 || j<0 || j>=arr.length) return cs; [arr[i],arr[j]]=[arr[j],arr[i]]; return arr; });
  }
  function toggleSelect(id){ setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]); }
  function combineSelected(){
    if(selected.length < 2) return alert('Select at least 2 sender/group boxes to combine.');
    const chosen = chats.filter(c => selected.includes(c.id));
    const name = prompt('Name for combined chat:', chosen.map(c=>c.name).join(' + ')); if(!name) return;
    const combined = { id: makeId(name), name, category: chosen[0].category, section: 'Combined', urgency: chosen.some(c=>c.urgency==='high') ? 'high' : (chosen.some(c=>c.urgency==='medium') ? 'medium' : 'low'), needsReply: chosen.some(c=>c.needsReply), messages: dedupeMessages(chosen.flatMap(c => (c.messages||[]).map(m => ({...m, text:`[${c.name}] ${m.text}`})))), replies: null };
    setChats(cs => [combined, ...cs.filter(c => !selected.includes(c.id))]); setSelected([]);
  }
  function lock(){ sessionStorage.removeItem('wrd_unlocked'); setUnlocked(false); }
  if(!unlocked) return <PasswordLock onUnlock={()=>setUnlocked(true)}/>;
  return <main>
    <aside><div className="brand"><MessageSquare size={34}/><h1>WhatsApp<br/>Reply Desk</h1></div><p>AI suggestions for smarter replies</p><label className="upload"><UploadCloud/> Upload Daily Briefing<input type="file" accept=".txt,.json,.csv" onChange={upload}/></label><button className="combineBtn" onClick={combineSelected}>Combine selected ({selected.length})</button><button className="saveBtn" onClick={()=>saveToFirebase()}><Save size={16}/> Save to Firebase</button><button className="lockBtn" onClick={lock}><LogOut size={16}/> Lock App</button><nav>{CATEGORIES.map(g=><a key={g}><span style={{background:colours[g]}}/> {g[0].toUpperCase()+g.slice(1)}</a>)}</nav><div className="summary"><b>Daily Summary</b><p>Total chats: {visibleChats.length}</p><p>Need replies: {stats.needReply}</p><p>High priority: {stats.urgent}</p></div></aside>
    <section className="dash"><div className="topbar"><h2>Bento Reply Dashboard</h2><span><Calendar size={15}/> {new Date().toLocaleDateString('en-SG')}</span></div>
      <div className="searchbar"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sender, group or message..." />{search && <button onClick={()=>setSearch('')}>Clear</button>}</div>
      <div className="grid">
        <Tile type="work" title="WORK" count={stats.work} subtitle="School, admin, classes" icon={<Briefcase/>}/>
        <Tile type="family" title="FAMILY" count={stats.family} subtitle="Home and kids" icon={<Home/>}/>
        <Tile type="personal" title="PERSONAL" count={stats.personal} subtitle="Friends and personal" icon={<User/>}/>
      </div>
      <div className="sections threeOnly">{CATEGORIES.map(g=><section className="section" key={g}><h3 style={{color:colours[g]}}>{g[0].toUpperCase()+g.slice(1)}</h3><div className="cards">{visibleChats.filter(c=>c.category===g).map((c)=><ChatCard chat={c} onSuggest={suggest} onDelete={deleteChat} onCategory={changeCategory} onMove={moveChat} onToggleSelect={toggleSelect} selected={selected.includes(c.id)} key={c.id}/>)}</div></section>)}</div>
      {busy && <div className="busy">Generating replies for {busy}...</div>}{saved && <div className="saved">{saved}</div>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<App/>);
