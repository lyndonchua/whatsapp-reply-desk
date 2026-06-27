import React, { useMemo, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Upload, Save, Trash2, Search, Lock, Unlock, Bot, Copy, Merge, ArrowUp, ArrowDown, ClipboardPaste } from 'lucide-react';
import './style.css';

const PASSWORD = '344565';
const cats = ['work','family','personal','hockey','classes'];
const catTitle = { work:'Work', family:'Family', personal:'Personal', hockey:'Hockey', classes:'Classes' };
const catSub = { work:'School and admin', family:'Home and kids', personal:'Personal chats', hockey:'CCA and DSA', classes:'Students and lessons' };



function normalise(s){return (s||'').toLowerCase().replace(/\s+/g,' ').trim()}
function guessCategory(sender, text){
  const v = normalise(sender+' '+text);
  if(/hockey|dsa|coach|training|match|pitch|sengkang|exco|trial/.test(v)) return 'hockey';
  if(/26a|26s|25a|25s|class|student|econs|essay|csq|lecture|tutorial|homework|worksheet|consultation|lesson/.test(v)) return 'classes';
  if(/aidan|megan|mum|mom|dad|family|home|parents/.test(v)) return 'family';
  if(/mr |ms |mrs |mdm|teacher|school|admin|dept|parent|sajc|office|ro|principal/.test(v)) return 'work';
  return 'personal';
}
function parseText(raw){
  const lines = raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const grouped = new Map();
  let current = null;
  for(const line of lines){
    let m = line.match(/^\[?(.{1,20}?)\]?\s*[-–—]\s*([^:]{1,80}):\s*(.+)$/) || line.match(/^(.{1,20}?)\s*[-–—]\s*([^:]{1,80}):\s*(.+)$/);
    if(m){
      const time = m[1].replace(/^\[/,'').replace(/\]$/,'');
      const sender = m[2].trim();
      const text = m[3].trim();
      current = sender;
      const key = normalise(sender);
      if(!grouped.has(key)) grouped.set(key,{ id: crypto.randomUUID(), sender, category: guessCategory(sender,text), priority:'MEDIUM', messages:[] });
      grouped.get(key).messages.push({time,text});
    } else if(current){
      const key = normalise(current);
      const g = grouped.get(key); if(g) g.messages[g.messages.length-1].text += ' ' + line;
    }
  }
  return Array.from(grouped.values()).map(removeDupes);
}
function timeRank(t){
  const v = String(t||'').toLowerCase();
  if(v.includes('today')) return 10_000_000;
  if(v.includes('yesterday')) return 9_000_000;
  const hm = v.match(/(\d{1,2}):(\d{2})/);
  if(hm) return Number(hm[1])*60 + Number(hm[2]);
  const d = v.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-]?(\d{2,4})?/);
  if(d) return Number(d[3]||0)*10000 + Number(d[2])*100 + Number(d[1]);
  return 0;
}
function removeDupes(chat){
  const seen = new Set();
  const messages = [];
  for(const m of chat.messages){
    const k = normalise((m.time||'')+'|'+(m.text||''));
    if(!seen.has(k)){ seen.add(k); messages.push(m); }
  }
  return {...chat, messages: messages.sort((a,b)=>timeRank(b.time)-timeRank(a.time))};
}

function App(){
  const [unlocked,setUnlocked] = useState(sessionStorage.getItem('wrd_unlocked')==='1');
  const [pass,setPass] = useState('');
  const [err,setErr] = useState('');
  const [chats,setChats] = useState([]);
  const [loading,setLoading] = useState(false);
  const [firebaseError,setFirebaseError] = useState('');
  const [loadedFromFirebase,setLoadedFromFirebase] = useState(false);
  const [q,setQ] = useState('');
  const [selected,setSelected] = useState(new Set());
  const [ai,setAi] = useState({});
  const [saving,setSaving] = useState(false);
  const [pasteText,setPasteText] = useState('');

  async function loadFirebase(){
    setLoading(true);
    setFirebaseError('');
    try{
      const snap = await getDocs(collection(db,'chats'));
      const arr = snap.docs.map(d=>({id:d.id,...d.data()}));
      setChats(arr.map(removeDupes));
      setLoadedFromFirebase(true);
    }catch(error){
      console.error('Firebase read failed:', error);
      setFirebaseError(error?.message || 'Firebase read failed. Check Firestore rules and collection name.');
    }finally{
      setLoading(false);
    }
  }
  useEffect(()=>{ if(unlocked) loadFirebase(); },[unlocked]);
  function login(e){ e?.preventDefault(); if(pass===PASSWORD){sessionStorage.setItem('wrd_unlocked','1'); setUnlocked(true)} else setErr('Incorrect password.'); }
  if(!unlocked) return <div className="lockPage"><form onSubmit={login} className="lockBox"><Lock size={36}/><h1>WhatsApp Reply Desk</h1><p>Password Required</p><input autoFocus type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password"/><button>Unlock</button>{err&&<b>{err}</b>}</form></div>

  const filtered = chats.filter(c=>normalise(c.sender).includes(normalise(q)));
  const byCat = Object.fromEntries(cats.map(cat=>[cat, filtered.filter(c=>c.category===cat)]));
  function updateChat(id, patch){ setChats(cs=>cs.map(c=>c.id===id?{...c,...patch}:c)); }
  function move(id, dir){ setChats(cs=>{ const i=cs.findIndex(c=>c.id===id); if(i<0) return cs; const j=i+dir; if(j<0||j>=cs.length) return cs; const a=[...cs]; [a[i],a[j]]=[a[j],a[i]]; return a; }); }
  async function saveAll(){
    setSaving(true);
    setFirebaseError('');
    try{
      for(const c of chats){
        await setDoc(doc(db,'chats',c.id), {...removeDupes(c), updatedAt:serverTimestamp()});
      }
      setLoadedFromFirebase(true);
      alert('Saved to Firebase');
    }catch(error){
      console.error('Firebase save failed:', error);
      setFirebaseError(error?.message || 'Firebase save failed. Check Firestore rules.');
      alert(error?.message || 'Firebase save failed. Check Firestore rules.');
    }finally{
      setSaving(false);
    }
  }
  async function del(id){
    setChats(cs=>cs.filter(c=>c.id!==id));
    setFirebaseError('');
    try{
      await deleteDoc(doc(db,'chats',id));
    }catch(error){
      console.error('Firebase delete failed:', error);
      setFirebaseError(error?.message || 'Firebase delete failed. Check Firestore rules.');
    }
  }
  function importFile(e){ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ const parsed=parseText(String(r.result||'')); setChats(cs=>mergeChats([...cs,...parsed]));}; r.readAsText(f); }
  function importPastedText(){
    const raw = pasteText.trim();
    if(!raw){ alert('Paste WhatsApp messages first.'); return; }
    const parsed = parseText(raw);
    if(parsed.length===0){ alert('No WhatsApp messages detected. Check the pasted format.'); return; }
    setChats(cs=>mergeChats([...cs,...parsed]));
    setPasteText('');
  }
  function mergeChats(list){ const map = new Map(); for(const c of list){ const key=normalise(c.sender); if(!map.has(key)) map.set(key,{...c,messages:[]}); const old=map.get(key); old.messages.push(...(c.messages||[])); old.category=old.category||c.category; old.priority=old.priority||c.priority; } return Array.from(map.values()).map(removeDupes); }
  function combineSelected(){ const ids=[...selected]; if(ids.length<2) return; const chosen=chats.filter(c=>selected.has(c.id)); const base={...chosen[0], sender: 'Combined: ' + chosen.map(c=>c.sender).join(' + '), messages: chosen.flatMap(c=>(c.messages||[]).map(m=>({...m, text:`[${c.sender}] ${m.text}`})))}; setChats(cs=>[...cs.filter(c=>!selected.has(c.id)), removeDupes(base)]); setSelected(new Set()); }
  async function askAI(c){ setAi(a=>({...a,[c.id]:'Generating...'})); const r=await fetch('/api/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)}); const data=await r.json(); setAi(a=>({...a,[c.id]:data.reply||data.error||'No reply.'})); }

  return <div className="app">
    <aside className="side">
      <h1>💬 WhatsApp<br/>Reply Desk</h1><p>OpenRouter AI replies</p>
      <label className="upload"><Upload size={20}/> Upload Daily Briefing<input type="file" accept=".txt,.csv,.json" onChange={importFile}/></label>
      <div className="pasteBox">
        <label>Paste WhatsApp messages</label>
        <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} placeholder={"Paste messages here, e.g.\n27 Jun, 10:05 — Name: Message"}></textarea>
        <button className="wide pasteBtn" onClick={importPastedText}><ClipboardPaste size={18}/> Import pasted text</button>
      </div>
      <button className="wide" onClick={combineSelected}><Merge size={18}/> Combine selected ({selected.size})</button>
      <button className="wide dark" onClick={saveAll} disabled={saving}><Save size={18}/> {saving?'Saving...':'Save to Firebase'}</button>
      <button className="wide" onClick={loadFirebase} disabled={loading}><Save size={18}/> {loading?'Loading Firebase...':'Refresh from Firebase'}</button>
      {firebaseError&&<div className="errorBox">Firebase error: {firebaseError}</div>}
      {!firebaseError&&loadedFromFirebase&&<div className="okBox">Loaded from Firebase</div>}
      <div className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search sender / group"/></div>
      <div className="legend"><span className="dot work"/>Work <span className="dot family"/>Family <span className="dot personal"/>Personal <span className="dot hockey"/>Hockey <span className="dot classes"/>Classes</div>
      <div className="summary"><b>Daily Summary</b><span>Total chats: {chats.length}</span><span>Displayed: {filtered.length}</span></div>
      <button className="wide" onClick={()=>{sessionStorage.removeItem('wrd_unlocked'); location.reload()}}><Unlock size={18}/> Lock App</button>
    </aside>
    <main className="board">
      {loading&&<div className="statusBanner">Loading chats from Firebase...</div>}
      {!loading&&loadedFromFirebase&&chats.length===0&&<div className="statusBanner">No chats found in Firebase. Upload a daily briefing or paste WhatsApp messages, then Save to Firebase.</div>}
      {cats.map(cat=><section className={`col ${cat}`} key={cat}><h2>{catTitle[cat]}</h2><p className="colSub">{catSub[cat]}</p><div className="cards">
        {byCat[cat].map(c=><article className="card" key={c.id}>
          <div className="top"><input type="checkbox" checked={selected.has(c.id)} onChange={e=>{const n=new Set(selected); e.target.checked?n.add(c.id):n.delete(c.id); setSelected(n)}}/><b>{c.sender}</b><span className={`pill ${c.priority?.toLowerCase()}`}>{c.priority}</span></div>
          <div className="row"><select value={c.category} onChange={e=>updateChat(c.id,{category:e.target.value})}>{cats.map(x=><option value={x} key={x}>{catTitle[x]}</option>)}</select><button onClick={()=>move(c.id,-1)}><ArrowUp size={14}/></button><button onClick={()=>move(c.id,1)}><ArrowDown size={14}/></button></div>
          <div className="msgs">{(c.messages||[]).map((m,i)=><div className="msg" key={i}><b>{m.time}</b><br/>{m.text}</div>)}</div>
          {ai[c.id]&&<pre className="ai">{ai[c.id]}</pre>}
          <div className="actions"><button onClick={()=>askAI(c)}><Bot size={16}/> AI replies</button>{ai[c.id]&&<button onClick={()=>navigator.clipboard.writeText(ai[c.id])}><Copy size={16}/> Copy</button>}<button className="danger" onClick={()=>del(c.id)}><Trash2 size={16}/> Delete chat</button></div>
        </article>)}
      </div></section>)}
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App/>);
