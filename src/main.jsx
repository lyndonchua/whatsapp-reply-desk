import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Briefcase, Home, User, Bell, CheckSquare, UploadCloud, Copy, MessageSquare, Sparkles, Calendar, AlertTriangle, Users } from 'lucide-react';
import { db } from './firebase';
import './style.css';

const colours = {
  work: '#1578ff', family: '#4ac052', personal: '#7d4de8', urgent: '#ff3838', action: '#ff912b', none: '#8b949e'
};

const sampleChats = [
  { groupName:'Mr Ali', category:'work', section:'Hockey', urgency:'high', messages:[{ sender:'Mr Ali', time:'08:15', text:'Can you confirm the time for DSA trials on 3 July?' }], replies:null },
  { groupName:'Keith Lee', category:'work', section:'CT Class', urgency:'high', messages:[{ sender:'Keith Lee', time:'07:40', text:'Need you to approve the match schedule.' }], replies:null },
  { groupName:'Aidan', category:'family', section:'Family', urgency:'medium', messages:[{ sender:'Aidan', time:'Yesterday', text:'Dad, I need help with my project today.' }], replies:null },
  { groupName:'Friends', category:'personal', section:'Personal', urgency:'low', messages:[{ sender:'Friends', time:'Yesterday', text:'Weekend plan?' }], replies:null },
  { groupName:'Bank Alert', category:'none', section:'FYI', urgency:'low', messages:[{ sender:'Bank Alert', time:'Yesterday', text:'Transaction successful.' }], replies:null }
];

function guessCategory(name, text){
  const s=(name+' '+text).toLowerCase();
  if(/aidan|megan|dad|mum|family|home/.test(s)) return 'family';
  if(/student|class|econs|hockey|dsa|coach|teacher|mr |mrs |ms |school|admin|parent|pw|ct|ro|hod|dept|cca/.test(s)) return 'work';
  if(/fyi|newsletter|promo|bank alert|transaction|otp|receipt/.test(s)) return 'none';
  return 'personal';
}

function guessUrgency(text){
  const s=text.toLowerCase();
  if(/urgent|today|now|asap|eod|deadline|unwell|submit|approval|confirm.*today|by tonight/.test(s)) return 'high';
  if(/tomorrow|later|confirm|check|follow up|need reply/.test(s)) return 'medium';
  return 'low';
}

function cleanText(text){
  return String(text || '').replace(/\s+/g,' ').trim();
}

function makeMessageKey(groupName, sender, time, text){
  return [cleanText(groupName).toLowerCase(), cleanText(sender).toLowerCase(), cleanText(time).toLowerCase(), cleanText(text).toLowerCase()].join('|');
}

function dedupeMessages(messages, groupName){
  const seen = new Set();
  return messages.filter(m => {
    const key = makeMessageKey(groupName, m.sender, m.time, m.text);
    if(!m.text || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normaliseGroupName(value, fallback='Unknown Chat'){
  return cleanText(value).replace(/^WhatsApp:\s*/i,'').replace(/\s+/g,' ') || fallback;
}

function groupFlatMessages(rows){
  const grouped = new Map();
  for(const row of rows){
    const groupName = normaliseGroupName(row.groupName || row.group || row.chat || row.name || row.sender);
    const sender = cleanText(row.sender || row.author || groupName);
    const time = cleanText(row.time || row.date || row.timestamp || '');
    const text = cleanText(row.text || row.message || row.summary || row.body || row.messages || '');
    if(!text) continue;
    if(!grouped.has(groupName)) grouped.set(groupName, { groupName, messages: [], section: row.section || row.group || 'Uploaded' });
    grouped.get(groupName).messages.push({ sender, time, text });
  }
  return Array.from(grouped.values()).map(g => {
    const messages = dedupeMessages(g.messages, g.groupName);
    const allText = messages.map(m=>m.text).join('\n');
    return { ...g, messages, category: guessCategory(g.groupName, allText), urgency: guessUrgency(allText), replies: null };
  }).filter(g=>g.messages.length);
}

function parseJsonUpload(raw){
  const json = JSON.parse(raw);
  const arr = Array.isArray(json) ? json : json.chats || json.items || json.groups || json.messages || [];
  if(!Array.isArray(arr)) return [];

  const groups = [];
  const flat = [];
  arr.forEach((x,i)=>{
    const groupName = normaliseGroupName(x.groupName || x.group || x.chat || x.name || x.sender || `Chat ${i+1}`);
    if(Array.isArray(x.messages)){
      const messages = dedupeMessages(x.messages.map(m=>({
        sender: cleanText(m.sender || m.author || groupName),
        time: cleanText(m.time || m.date || m.timestamp || ''),
        text: cleanText(m.text || m.message || m.body || m.summary || '')
      })), groupName);
      const allText = messages.map(m=>m.text).join('\n');
      if(messages.length) groups.push({
        groupName,
        messages,
        section: x.section || x.group || 'Uploaded',
        category: (x.category || guessCategory(groupName, allText)).toLowerCase(),
        urgency: x.urgency || guessUrgency(allText),
        replies: x.replies || null
      });
    } else {
      flat.push({ ...x, groupName, text: x.summary || x.text || x.message || x.body || x.messages || '' });
    }
  });
  return [...groups, ...groupFlatMessages(flat)];
}

function parseTextUpload(raw){
  const rows = [];
  const lines = raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  let currentGroup = '';

  for(const line of lines){
    if(/^={3,}|^-{3,}|^chat\s*:/i.test(line)){
      const possible = line.replace(/^chat\s*:/i,'').replace(/[=\-]/g,'').trim();
      if(possible) currentGroup = possible;
      continue;
    }

    let m = line.match(/^(.+?)\s*[—-]\s*([^:]{1,80}):\s*(.+)$/); // WhatsApp export style: date — sender: msg
    if(m){
      const left = m[1].trim();
      const sender = m[2].trim();
      const text = m[3].trim();
      const groupName = currentGroup || sender;
      rows.push({ groupName, sender, time:left, text });
      continue;
    }

    m = line.match(/^\[?([^\]]{5,30})\]?\s+([^:]{1,80}):\s*(.+)$/); // [date] sender: msg
    if(m){
      const sender = m[2].trim();
      rows.push({ groupName: currentGroup || sender, sender, time:m[1].trim(), text:m[3].trim() });
      continue;
    }

    m = line.match(/^([^:]{2,80}):\s*(.+)$/); // sender: msg
    if(m){
      const sender = m[1].trim();
      rows.push({ groupName: currentGroup || sender, sender, time:'', text:m[2].trim() });
      continue;
    }

    if(rows.length){
      rows[rows.length-1].text += ' ' + line;
    } else {
      rows.push({ groupName:'Uploaded Briefing', sender:'Uploaded Briefing', time:'', text:line });
    }
  }
  return groupFlatMessages(rows);
}

function parseUpload(raw){
  try { return parseJsonUpload(raw); }
  catch { return parseTextUpload(raw); }
}

function Tile({type, title, count, subtitle, icon}){
  return <div className={`tile ${type}`}><div className="tileIcon">{icon}</div><div><b>{title}</b><div className="big">{count}</div><span>{subtitle}</span></div></div>;
}

function messageText(group){
  return group.messages.map(m=>`${m.time ? m.time + ' — ' : ''}${m.sender}: ${m.text}`).join('\n');
}

function ChatGroupCard({group,onSuggest}){
  return <div className={`chatCard ${group.category}`}>
    <div className="chatTop"><b><Users size={15}/> {group.groupName}</b><span className={`pill ${group.urgency}`}>{group.urgency}</span></div>
    <div className="messageScroll">
      {group.messages.map((m,i)=><div className="messageLine" key={`${m.sender}-${m.time}-${i}`}>
        <div><b>{m.sender}</b>{m.time && <small>{m.time}</small>}</div>
        <p>{m.text}</p>
      </div>)}
    </div>
    <button onClick={()=>onSuggest(group)}><Sparkles size={15}/> AI suggest replies</button>
    {group.replies && <div className="replies">{['short','polite','friendly','firm'].map(k=> group.replies[k] && <div className="reply" key={k}><small>{k}</small><span>{group.replies[k]}</span><CopyButton text={group.replies[k]}/></div>)}</div>}
  </div>;
}
function CopyButton({text}){return <button className="copy" onClick={()=>navigator.clipboard.writeText(text)}><Copy size={14}/></button>;}

function App(){
  const [groups,setGroups]=useState(sampleChats);
  const [busy,setBusy]=useState('');
  const stats=useMemo(()=>({
    work:groups.filter(c=>c.category==='work').length,
    family:groups.filter(c=>c.category==='family').length,
    personal:groups.filter(c=>c.category==='personal').length,
    urgent:groups.filter(c=>c.urgency==='high').length,
    action:groups.filter(c=>c.urgency!=='low' && c.category!=='none').length,
    none:groups.filter(c=>c.category==='none').length,
    messages:groups.reduce((sum,g)=>sum+g.messages.length,0)
  }),[groups]);

  async function upload(e){
    const file=e.target.files[0]; if(!file) return;
    const text=await file.text();
    const parsed=parseUpload(text);
    setGroups(parsed);
    await addDoc(collection(db,'dailyBriefings'),{
      createdAt:serverTimestamp(),
      fileName:file.name,
      totalGroups:parsed.length,
      totalMessages:parsed.reduce((sum,g)=>sum+g.messages.length,0),
      groups:parsed
    });
  }

  async function suggest(group){
    setBusy(group.groupName);
    try{
      const r=await fetch('/api/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chatName:group.groupName,category:group.category,messages:messageText(group)})});
      const data=await r.json(); if(!r.ok) throw new Error(data.error || 'AI failed');
      setGroups(cs=>cs.map(c=>c===group?{...c,replies:data}:c));
      await addDoc(collection(db,'replySuggestions'),{createdAt:serverTimestamp(),chatName:group.groupName,category:group.category,messages:messageText(group),suggestions:data});
    }catch(err){alert(err.message)} finally{setBusy('');}
  }

  const sections=['work','family','personal','urgent','action','none'];
  return <main>
    <aside><div className="brand"><MessageSquare size={38}/><h1>WhatsApp<br/>Reply Desk</h1></div><p>Grouped by sender or WhatsApp group</p><label className="upload"><UploadCloud/> Upload Daily Briefing<input type="file" accept=".txt,.json,.csv" onChange={upload}/></label><nav>{sections.map(g=><a key={g}><span style={{background:colours[g]}}/> {g==='none'?'No Reply Needed':g[0].toUpperCase()+g.slice(1)}</a>)}</nav><div className="summary"><b>Daily Summary</b><p>Total groups: {groups.length}</p><p>Total messages: {stats.messages}</p><p>Need replies: {groups.length-stats.none}</p><p>Action items: {stats.action}</p></div></aside>
    <section className="dash"><div className="topbar"><h2>Bento Reply Dashboard</h2><span><Calendar size={16}/> {new Date().toLocaleDateString('en-SG')}</span></div>
      <div className="grid">
        <Tile type="work" title="WORK" count={stats.work} subtitle="School, admin, classes" icon={<Briefcase/>}/>
        <Tile type="family" title="FAMILY" count={stats.family} subtitle="Home and kids" icon={<Home/>}/>
        <Tile type="personal" title="PERSONAL" count={stats.personal} subtitle="Friends and personal" icon={<User/>}/>
        <Tile type="urgent" title="URGENT REPLIES" count={stats.urgent} subtitle="Need attention" icon={<Bell/>}/>
        <Tile type="action" title="ACTION NEEDED" count={stats.action} subtitle="Tasks and follow-up" icon={<CheckSquare/>}/>
        <Tile type="none" title="NO REPLY NEEDED" count={stats.none} subtitle="FYI only" icon={<AlertTriangle/>}/>
      </div>
      <div className="sections">{sections.map(g=><section className="section" key={g}><h3 style={{color:colours[g]}}>{g==='none'?'No Reply Needed':g[0].toUpperCase()+g.slice(1)}</h3><div className="cards">{groups.filter(c=>g==='urgent'?c.urgency==='high':g==='action'?(c.urgency!=='low'&&c.category!=='none'):c.category===g).map((c,i)=><ChatGroupCard group={c} onSuggest={suggest} key={c.groupName+i}/>)}</div></section>)}</div>
      {busy && <div className="busy">Generating replies for {busy}...</div>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<App/>);
