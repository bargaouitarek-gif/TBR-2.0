(() => {
  "use strict";

  const iframe = document.getElementById("tbr-app");
  const originalIncludes = String.prototype.includes;

  // Le kit Start contient déjà un contact. Cette protection empêche de le confondre
  // avec un vrai pack P4 ; un P4 explicitement écrit dans le PDF reste détecté.
  String.prototype.includes = function(search, ...args) {
    if (search === "1 DETECTEUR DE CHOC" && originalIncludes.call(this, "SECURITE START PRO")) return false;
    return originalIncludes.call(this, search, ...args);
  };

  const installationBlock = `          <SL label="Installation"/>
          <Tog label="Installation incluse" value={form.installation} onChange={v=>set("installation",v)} color="#2E7D32"/>`;

  const testBlock = `          <SL label="Options détectées dans le document"/>
          <FR label="FI200 Start">
            <button type="button" aria-pressed={form.fi200start} onClick={()=>set("fi200start",!form.fi200start)} style={{width:"100%",border:"1px solid rgba(56,189,248,.35)",borderRadius:13,padding:"10px 12px",background:form.fi200start?"linear-gradient(135deg,#10b981,#0f766e)":"rgba(15,23,42,.72)",color:form.fi200start?"#fff":"#cbd5e1",fontWeight:950,cursor:"pointer"}}>{form.fi200start?"OUI":"NON"}</button>
          </FR>
          <SL label="Installation"/>
          <Tog label="Installation incluse" value={form.installation} onChange={v=>set("installation",v)} color="#2E7D32"/>`;

  fetch("./app-base-v830.html?test-copy=2", {cache: "no-store"})
    .then((response) => {
      if (!response.ok) throw new Error("La copie stable de TBR est indisponible.");
      return response.text();
    })
    .then((html) => {
      if (!html.includes(installationBlock)) throw new Error("Le formulaire de test n'a pas été reconnu.");
      iframe.srcdoc = html.replace(installationBlock, testBlock);
    })
    .catch((error) => {
      console.error(error);
      document.getElementById("tbr-test-badge").textContent = "COPIE TEST INDISPONIBLE";
      document.body.insertAdjacentHTML("beforeend", `<div style="position:fixed;inset:70px 18px auto;z-index:100005;padding:16px;border-radius:16px;background:#3f0d17;color:#fecaca;font:800 14px/1.45 Arial">${String(error.message || error)}</div>`);
    });
})();