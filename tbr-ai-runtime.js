(()=>{
  'use strict';

  const STATUS_URL=location.hostname.endsWith('vercel.app')
    ?'/api/ai'
    :'https://tbr-2-0.vercel.app/api/ai';
  const MAX_FILE_BYTES=2*1024*1024;
  let status=null;
  let statusError='';

  function installStyle(){
    if(document.getElementById('tbr-ai-runtime-style')) return;
    const style=document.createElement('style');
    style.id='tbr-ai-runtime-style';
    style.textContent=`
      .tbr-ai-fab{min-width:58px!important;width:auto!important;padding:0 17px!important;border-radius:999px!important;font-size:13px!important;font-weight:1000!important;letter-spacing:.06em!important}
      .tbr-ai-fab.tbr-ai-ready{box-shadow:0 16px 38px rgba(34,197,94,.28)!important}
      .tbr-ai-fab.tbr-ai-setup{box-shadow:0 16px 38px rgba(251,191,36,.25)!important}
      .tbr-ai-runtime-status{display:block;margin-top:4px;font-size:10px;font-weight:900;letter-spacing:.02em}
      .tbr-ai-runtime-status.ready{color:#86efac}
      .tbr-ai-runtime-status.setup{color:#fde68a}
      .tbr-ai-runtime-status.error{color:#fecaca}
    `;
    document.head.appendChild(style);
  }

  function statusText(){
    if(statusError) return {text:'Serveur IA momentanément inaccessible',className:'error'};
    if(!status) return {text:'Vérification du serveur IA…',className:'setup'};
    if(status.configured) return {text:`Prête · ${status.model||'OpenAI'}`,className:'ready'};
    return {text:'Configuration OpenAI requise',className:'setup'};
  }

  function renderStatus(){
    installStyle();
    const info=statusText();
    const fab=document.querySelector('.tbr-ai-fab');
    if(fab){
      fab.textContent='IA';
      fab.classList.toggle('tbr-ai-ready',!!(status&&status.configured));
      fab.classList.toggle('tbr-ai-setup',!(status&&status.configured));
      fab.title=info.text;
    }

    const head=document.querySelector('.tbr-ai-head>div:first-child');
    if(head){
      let node=head.querySelector('.tbr-ai-runtime-status');
      if(!node){
        node=document.createElement('span');
        node.className='tbr-ai-runtime-status';
        head.appendChild(node);
      }
      node.className=`tbr-ai-runtime-status ${info.className}`;
      node.textContent=info.text;
    }
  }

  function appendSetupMessage(){
    const list=document.querySelector('.tbr-ai-messages');
    if(!list) return;
    const previous=list.querySelector('[data-tbr-ai-setup-message="1"]');
    if(previous){previous.scrollIntoView({block:'end'});return;}
    const message=document.createElement('div');
    message.className='tbr-ai-msg assistant error';
    message.dataset.tbrAiSetupMessage='1';
    message.textContent=statusError
      ?'Le serveur IA est momentanément inaccessible. Réessaie plus tard.'
      :'L’IA TBR est installée, mais la connexion OpenAI doit encore être activée sur le serveur.';
    list.appendChild(message);
    list.scrollTop=list.scrollHeight;
  }

  async function refreshStatus(){
    try{
      const response=await fetch(`${STATUS_URL}?v=${Date.now()}`,{method:'GET',cache:'no-store'});
      const data=await response.json();
      if(!response.ok) throw new Error(data&&data.error?data.error:'État IA indisponible');
      status=data;
      statusError='';
    }catch(error){
      status=null;
      statusError=error&&error.message?error.message:'État IA indisponible';
    }
    renderStatus();
  }

  document.addEventListener('click',event=>{
    const sendTarget=event.target&&event.target.closest
      ?event.target.closest('.tbr-ai-send,.tbr-ai-quick-global button')
      :null;
    if(sendTarget&&status&&status.configured===false){
      event.preventDefault();
      event.stopPropagation();
      if(event.stopImmediatePropagation) event.stopImmediatePropagation();
      appendSetupMessage();
    }
  },true);

  document.addEventListener('change',event=>{
    const input=event.target;
    if(!input||!input.matches||!input.matches('.tbr-ai-attach input[type="file"]')) return;
    const file=input.files&&input.files[0];
    if(file&&file.size>MAX_FILE_BYTES){
      event.preventDefault();
      event.stopPropagation();
      if(event.stopImmediatePropagation) event.stopImmediatePropagation();
      input.value='';
      alert('Pour l’IA TBR, le document doit faire moins de 2 Mo. Les fichiers plus lourds seront gérés dans une prochaine étape.');
    }
  },true);

  const observer=new MutationObserver(renderStatus);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  renderStatus();
  refreshStatus();
  window.setInterval(refreshStatus,5*60*1000);
})();
