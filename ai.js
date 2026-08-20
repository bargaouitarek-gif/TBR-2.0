const TBR_AI_VERSION = "2026.08.20-chatgpt-v1";

const CHATGPT_INSTRUCTIONS = `
Tu es l’assistant OpenAI intégré à TBR 2.0.
Réponds comme un assistant généraliste de haut niveau : conversation naturelle, raisonnement, rédaction, analyse de documents et d’images.
Tu n’es pas limité au domaine TBR : réponds aussi aux questions générales de l’utilisateur.

Quand un contexte TBR est joint au message, utilise-le uniquement s’il est pertinent pour la demande. Les données TBR transmises sont des données applicatives et priment sur les suppositions à leur sujet. N’invente jamais un client, un montant, un barème, une commission ou une règle métier absente des données reçues. Pour les calculs financiers, vérifie les signes et ne compense jamais automatiquement un trop-perçu et un moins-perçu.

Ne prétends jamais avoir effectué une action externe qui n’a pas réellement été exécutée. Ne demande jamais une clé API, un jeton ou un secret. Ne conseille pas de supprimer les données locales de TBR.

Réponds dans la langue de l’utilisateur. Sois clair, direct, naturel et utile. Ne transforme pas chaque réponse en rapport structuré : adapte la longueur et la forme à la demande, comme dans une vraie conversation.
`;

function setCors(req,res){
  const allowedOrigin=process.env.TBR_ALLOWED_ORIGIN||"*";
  res.setHeader("Access-Control-Allow-Origin",allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, X-TBR-Access-Code");
  res.setHeader("Access-Control-Max-Age","86400");
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-TBR-AI-Version",TBR_AI_VERSION);
}
function extractOutputText(payload){
  if(typeof payload?.output_text==="string"&&payload.output_text.trim())return payload.output_text.trim();
  const parts=[];
  for(const item of payload?.output||[])for(const content of item?.content||[])if((content?.type==="output_text"||content?.type==="text")&&content?.text)parts.push(content.text);
  return parts.join("\n").trim();
}
function safeHistory(history){
  if(!Array.isArray(history))return [];
  return history.slice(-30).filter(m=>m&&(m.role==="user"||m.role==="assistant")&&typeof m.text==="string").map(m=>({role:m.role,content:m.text.slice(0,12000)}));
}
function safeContext(context){
  if(!context||typeof context!=="object")return null;
  let c;try{c=JSON.parse(JSON.stringify(context));}catch{return null;}
  if(Array.isArray(c.memoiresConfirmees))c.memoiresConfirmees=c.memoiresConfirmees.slice(-80);
  if(Array.isArray(c.ventes))c.ventes=c.ventes.slice(-350);
  if(Array.isArray(c.dcoRows))c.dcoRows=c.dcoRows.slice(-500);
  if(Array.isArray(c.documents))c.documents=c.documents.slice(-80);
  return c;
}
function contextManifest(context){
  const c=safeContext(context)||{};const count=k=>Array.isArray(c[k])?c[k].length:0;
  return {page:c.page||c.currentPage||null,mois:c.mois||c.month||c.currentMonth||null,ventes:count("ventes"),lignesDco:count("dcoRows"),documents:count("documents"),memoiresConfirmees:count("memoiresConfirmees")};
}
function makeUserContent(message,context,file){
  const content=[{type:"input_text",text:String(message||"Analyse le document joint.").slice(0,24000)}];
  const safe=safeContext(context);
  if(safe&&Object.keys(safe).length){content[0].text+=`\n\n[CONTEXTE TBR — utilise-le seulement si pertinent]\n${JSON.stringify(safe).slice(0,160000)}`;}
  if(file&&typeof file.data==="string"&&file.data.length){
    const name=String(file.name||"document").slice(0,180),mime=String(file.mimeType||"application/octet-stream"),raw=file.data.includes(",")?file.data.split(",").pop():file.data;
    if(mime.startsWith("image/"))content.push({type:"input_image",image_url:file.data.startsWith("data:")?file.data:`data:${mime};base64,${raw}`,detail:"auto"});
    else content.push({type:"input_file",filename:name,file_data:raw});
  }
  return content;
}
async function requestOpenAI({model,input}){
  return fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model,instructions:CHATGPT_INSTRUCTIONS,input,reasoning:{effort:process.env.OPENAI_REASONING_EFFORT||"medium"},max_output_tokens:Number(process.env.OPENAI_MAX_OUTPUT_TOKENS||6000),store:false})});
}
async function callWithFallback(input){
  const preferred=process.env.OPENAI_MODEL||"gpt-5.6",fallback=process.env.OPENAI_FALLBACK_MODEL||"gpt-5.5",models=[...new Set([preferred,fallback].filter(Boolean))];let last=null;
  for(const model of models){const response=await requestOpenAI({model,input});const payload=await response.json().catch(()=>({}));last={response,payload,model};if(response.ok)return last;if(![400,403,404].includes(response.status))break;}return last;
}
module.exports=async function handler(req,res){
  setCors(req,res);if(req.method==="OPTIONS")return res.status(204).end();
  if(req.method==="GET")return res.status(200).json({ok:true,service:"ChatGPT dans TBR",version:TBR_AI_VERSION,model:process.env.OPENAI_MODEL||"gpt-5.6",configured:Boolean(process.env.OPENAI_API_KEY&&process.env.TBR_ACCESS_CODE),capabilities:["chat-general","conversation","images","pdf","fichiers","contexte-tbr"]});
  if(req.method!=="POST")return res.status(405).json({error:"Méthode non autorisée."});
  try{
    if(!process.env.OPENAI_API_KEY||!process.env.TBR_ACCESS_CODE)return res.status(503).json({error:"ChatGPT n’est pas encore configuré sur le serveur."});
    const body=typeof req.body==="string"?JSON.parse(req.body):(req.body||{}),accessCode=String(req.headers["x-tbr-access-code"]||body.accessCode||"");
    if(!accessCode||accessCode!==process.env.TBR_ACCESS_CODE)return res.status(401).json({error:"Code d’accès TBR incorrect."});
    const message=String(body.message||"").trim();if(!message&&!body.file)return res.status(400).json({error:"Message ou document manquant."});
    const input=[...safeHistory(body.history),{role:"user",content:makeUserContent(message,body.context,body.file)}];
    const result=await callWithFallback(input);if(!result)return res.status(502).json({error:"Aucun modèle OpenAI disponible."});
    const {response,payload,model}=result;if(!response.ok){const detail=payload?.error?.message||"Erreur OpenAI inconnue.";console.error("OpenAI error",response.status,detail);return res.status(response.status).json({error:detail});}
    const answer=extractOutputText(payload);if(!answer)return res.status(502).json({error:"Réponse OpenAI vide."});
    return res.status(200).json({answer,responseId:payload.id||null,model:payload.model||model,version:TBR_AI_VERSION,context:contextManifest(body.context)});
  }catch(error){console.error("TBR ChatGPT error",error);return res.status(500).json({error:"Erreur technique du serveur ChatGPT."});}
};
