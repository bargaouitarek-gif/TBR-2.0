from pathlib import Path

path = Path("index.html")
text = path.read_text(encoding="utf-8")
original = text

helpers = r'''
const TBR_AI_MEMORY_KEY = "tbr_ai_memory_v1";
const tbrAiNorm = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const tbrAiNewMemory = text => ({
  id: Date.now() + "_" + Math.random().toString(36).slice(2, 8),
  text: String(text || "").trim(),
  confirmed: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

function tbrAiApplyMemoryCommand(question, current){
  const ask = String(question || "").trim();
  const normalized = tbrAiNorm(ask);
  const memories = Array.isArray(current) ? [...current] : [];

  const rememberPrefixes = ["retiens cela :", "retiens ca :", "mémorise cela :", "memorise cela :"];
  const rememberPrefix = rememberPrefixes.find(p => normalized.startsWith(tbrAiNorm(p)));
  if(rememberPrefix){
    const value = ask.slice(ask.indexOf(":") + 1).trim();
    if(!value) return {memories, confirmation:"Écris la règle après « Retiens cela : »."};
    if(memories.some(m => tbrAiNorm(m.text) === tbrAiNorm(value))) return {memories, confirmation:"Cette règle est déjà dans ma mémoire TBR."};
    return {memories:[...memories, tbrAiNewMemory(value)].slice(-60), confirmation:"C’est retenu dans la mémoire TBR : " + value};
  }

  const forgetPrefixes = ["oublie cela :", "oublie ca :", "supprime cette mémoire :", "supprime cette memoire :"];
  const forgetPrefix = forgetPrefixes.find(p => normalized.startsWith(tbrAiNorm(p)));
  if(forgetPrefix){
    const value = ask.slice(ask.indexOf(":") + 1).trim();
    const needle = tbrAiNorm(value);
    const index = memories.findIndex(m => tbrAiNorm(m.text).includes(needle) || needle.includes(tbrAiNorm(m.text)));
    if(index < 0) return {memories, confirmation:"Je n’ai pas trouvé cette règle dans la mémoire TBR."};
    const removed = memories[index];
    memories.splice(index, 1);
    return {memories, confirmation:"Mémoire supprimée : " + removed.text};
  }

  const correctionPrefixes = ["corrige cette règle :", "corrige cette regle :"];
  const correctionPrefix = correctionPrefixes.find(p => normalized.startsWith(tbrAiNorm(p)));
  if(correctionPrefix){
    const value = ask.slice(ask.indexOf(":") + 1).trim();
    const parts = value.split(/=>|→/).map(v => v.trim()).filter(Boolean);
    if(parts.length < 2) return {memories, confirmation:"Utilise : Corrige cette règle : ancienne règle => nouvelle règle."};
    const oldRule = parts[0], newRule = parts.slice(1).join(" => ");
    const index = memories.findIndex(m => tbrAiNorm(m.text).includes(tbrAiNorm(oldRule)) || tbrAiNorm(oldRule).includes(tbrAiNorm(m.text)));
    if(index >= 0){
      memories[index] = {...memories[index], text:newRule, confirmed:true, updatedAt:new Date().toISOString()};
    }else{
      memories.push(tbrAiNewMemory(newRule));
    }
    return {memories:memories.slice(-60), confirmation:"Règle corrigée et enregistrée : " + newRule};
  }
  return null;
}
'''

api_marker = '''const TBR_AI_API_URL = window.location.hostname.endsWith("vercel.app")
  ? "/api/ai"
  : "https://tbr-2-0.vercel.app/api/ai";

function tbrAiFileToDataURL(file){'''
if "const TBR_AI_MEMORY_KEY" not in text:
    if api_marker not in text:
        raise SystemExit("API marker not found")
    text = text.replace(api_marker, api_marker.replace("\nfunction tbrAiFileToDataURL(file){", helpers + "\nfunction tbrAiFileToDataURL(file){"), 1)

state_marker = '''  const [file,setFile]=useState(null);
  const [messages,setMessages]=useState(()=>LD("tbr_ai_history_v1",['''
state_replacement = '''  const [file,setFile]=useState(null);
  const [memories,setMemories]=useState(()=>LD(TBR_AI_MEMORY_KEY,[]));
  const [memoryOpen,setMemoryOpen]=useState(false);
  const [messages,setMessages]=useState(()=>LD("tbr_ai_history_v1",['''
if state_marker in text:
    text = text.replace(state_marker, state_replacement, 1)

save_marker = '''  const saveMessages=next=>{const trimmed=next.slice(-18);setMessages(trimmed);SV("tbr_ai_history_v1",trimmed);};
  const buildContext=()=>({'''
save_replacement = '''  const saveMessages=next=>{const trimmed=next.slice(-18);setMessages(trimmed);SV("tbr_ai_history_v1",trimmed);};
  const saveMemories=next=>{const clean=(Array.isArray(next)?next:[]).slice(-60);setMemories(clean);SV(TBR_AI_MEMORY_KEY,clean);};
  const forgetMemory=id=>saveMemories(memories.filter(m=>m.id!==id));
  const buildContext=()=>({'''
if save_marker in text:
    text = text.replace(save_marker, save_replacement, 1)

context_marker = '''    dco:tbrCompactDco()
  });'''
context_replacement = '''    memoiresConfirmees:(memories||[]).map(m=>({texte:m.text,confirmee:true,creeLe:m.createdAt,modifieeLe:m.updatedAt})),
    dco:tbrCompactDco()
  });'''
if context_marker in text:
    text = text.replace(context_marker, context_replacement, 1)

send_marker = '''  const send=async(forcedQuestion)=>{
    const ask=String(forcedQuestion||question||"").trim()||(file?"Analyse ce document et dis-moi exactement ce qu'il faut intégrer ou contrôler dans TBR.":"");
    if(!ask||loading)return;
    const userMsg={role:"user",text:file?`${ask}\\nDocument joint : ${file.name}`:ask};'''
send_replacement = '''  const send=async(forcedQuestion)=>{
    const ask=String(forcedQuestion||question||"").trim()||(file?"Analyse ce document et dis-moi exactement ce qu'il faut intégrer ou contrôler dans TBR.":"");
    if(!ask||loading)return;
    const memoryAction=tbrAiApplyMemoryCommand(ask,memories);
    if(memoryAction){
      const userMsg={role:"user",text:ask};
      saveMemories(memoryAction.memories);
      saveMessages([...messages,userMsg,{role:"assistant",text:memoryAction.confirmation}]);
      setQuestion("");
      return;
    }
    const userMsg={role:"user",text:file?`${ask}\\nDocument joint : ${file.name}`:ask};'''
if send_marker in text:
    text = text.replace(send_marker, send_replacement, 1)

head_marker = '''      <div className="tbr-ai-head"><div><b>IA TBR · connectée à OpenAI</b><small>Page active : {page} · connaît les données du mois</small></div><button className="tbr-ai-close" onClick={()=>setOpen(false)}>×</button></div>
      <div className="tbr-ai-messages">'''
head_replacement = '''      <div className="tbr-ai-head"><div><b>IA TBR · connectée à OpenAI</b><small>Page active : {page} · connaît les données du mois</small></div><div className="tbr-ai-head-actions"><button className="tbr-ai-memory-btn" onClick={()=>setMemoryOpen(v=>!v)}>Mémoire {memories.length}</button><button className="tbr-ai-close" onClick={()=>setOpen(false)}>×</button></div></div>
      {memoryOpen&&<div className="tbr-ai-memory-panel">
        <div className="tbr-ai-memory-title"><div><b>Ce que l’IA a appris</b><small>Uniquement les règles que tu as confirmées.</small></div><button onClick={()=>setMemoryOpen(false)}>×</button></div>
        <div className="tbr-ai-memory-help">Pour apprendre : <b>Retiens cela : ...</b><br/>Pour corriger : <b>Corrige cette règle : ancienne =&gt; nouvelle</b></div>
        {memories.length===0?<div className="tbr-ai-memory-empty">Aucune règle mémorisée pour le moment.</div>:<div className="tbr-ai-memory-list">{memories.map(m=><div className="tbr-ai-memory-item" key={m.id}><div><span>Confirmé</span><p>{m.text}</p><small>{new Date(m.updatedAt||m.createdAt).toLocaleDateString("fr-FR")}</small></div><button onClick={()=>forgetMemory(m.id)}>Oublier</button></div>)}</div>}
      </div>}
      <div className="tbr-ai-messages">'''
if head_marker in text:
    text = text.replace(head_marker, head_replacement, 1)

css = r'''
<style id="tbr-ai-memory-v1">
.tbr-ai-head-actions{display:flex;align-items:center;gap:7px}.tbr-ai-memory-btn{border:1px solid rgba(56,189,248,.30);background:rgba(56,189,248,.12);color:#bae6fd;border-radius:999px;padding:7px 10px;font-size:11px!important;font-weight:950;white-space:nowrap}.tbr-ai-memory-panel{position:absolute;z-index:30;left:10px;right:10px;top:72px;bottom:88px;overflow:auto;border-radius:20px;padding:14px;background:#07111f;border:1px solid rgba(56,189,248,.28);box-shadow:0 24px 70px rgba(0,0,0,.5);color:#f8fafc}.tbr-ai-memory-title{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.tbr-ai-memory-title b{font-size:17px}.tbr-ai-memory-title small{display:block;margin-top:3px;color:#94a3b8;font-size:11px;font-weight:750}.tbr-ai-memory-title button{border:0;background:rgba(255,255,255,.08);color:#fff;border-radius:11px;width:32px;height:32px;font-weight:950}.tbr-ai-memory-help{margin:12px 0;padding:10px 12px;border-radius:14px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.16);font-size:11px;line-height:1.55;color:#cbd5e1}.tbr-ai-memory-list{display:flex;flex-direction:column;gap:8px}.tbr-ai-memory-item{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:11px;border-radius:15px;background:rgba(15,23,42,.75);border:1px solid rgba(148,163,184,.14)}.tbr-ai-memory-item>div{min-width:0}.tbr-ai-memory-item span{display:inline-block;color:#86efac;font-size:9px;font-weight:1000;text-transform:uppercase;letter-spacing:.08em}.tbr-ai-memory-item p{margin:5px 0;color:#f8fafc;font-size:12px;line-height:1.4;font-weight:800;overflow-wrap:anywhere}.tbr-ai-memory-item small{color:#64748b;font-size:9px}.tbr-ai-memory-item button{border:1px solid rgba(248,113,113,.24);background:rgba(239,68,68,.10);color:#fecaca;border-radius:10px;padding:7px 8px;font-size:10px!important;font-weight:900}.tbr-ai-memory-empty{padding:22px;text-align:center;color:#94a3b8;font-size:12px;font-weight:800}
</style>
'''
if 'id="tbr-ai-memory-v1"' not in text:
    text = text.replace("</head>", css + "\n</head>", 1)

text = text.replace("pwa=2.1-ai-20260717", "pwa=2.1-ai-memory-20260719")
text = text.replace("tbr-2-1-ai-20260717", "tbr-2-1-ai-memory-20260719")

required = ["TBR_AI_MEMORY_KEY", "memoiresConfirmees", "Ce que l’IA a appris", "tbr-ai-memory-v1"]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit("Patch incomplete: " + ", ".join(missing))

if text == original:
    print("index.html already patched")
else:
    path.write_text(text, encoding="utf-8")
    print("index.html patched successfully")
