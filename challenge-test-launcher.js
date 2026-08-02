(()=>{
  'use strict';
  if(location.pathname==='/challenge'||/challenge-juillet-test/.test(location.pathname)) return;

  const ID='tbr-challenge-test-launcher';
  const mount=()=>{
    if(!document.body||document.getElementById(ID)) return;
    const button=document.createElement('button');
    button.id=ID;
    button.type='button';
    button.textContent='Challenge juillet';
    button.setAttribute('aria-label','Tester le challenge exceptionnel de juillet 2026');
    button.style.cssText=[
      'position:fixed','right:14px','bottom:88px','z-index:2147483647',
      'border:1px solid rgba(134,239,172,.70)','border-radius:999px',
      'padding:12px 16px','background:linear-gradient(135deg,#16a34a,#0891b2)',
      'color:#fff','font:900 12px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
      'letter-spacing:.01em','box-shadow:0 14px 36px rgba(0,0,0,.40)',
      'cursor:pointer','touch-action:manipulation'
    ].join(';');
    button.addEventListener('click',()=>{
      try{sessionStorage.setItem('tbr.challenge.opened.from.app','1');}catch(error){}
      location.assign('/challenge?from=tbr-app&v='+Date.now());
    });
    document.body.appendChild(button);
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();

  const observer=new MutationObserver(mount);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.setTimeout(()=>observer.disconnect(),120000);
})();
