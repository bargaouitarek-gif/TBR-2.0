(()=>{
  'use strict';
  const remove=()=>{
    const button=document.getElementById('tbr-challenge-test-launcher');
    if(button) button.remove();
  };
  remove();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',remove,{once:true});
  const observer=new MutationObserver(remove);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.setTimeout(()=>observer.disconnect(),30000);
})();
