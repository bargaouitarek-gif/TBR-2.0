from pathlib import Path

path = Path("index.html")
text = path.read_text(encoding="utf-8")
marker = '<script src="./tbr-pdf-import-test.js?v=6"></script>'

if marker in text:
    print("Direct PDF test already injected")
    raise SystemExit(0)

installation = '''          <SL label="Installation"/>
          <Tog label="Installation incluse" value={form.installation} onChange={v=>set("installation",v)} color="#2E7D32"/>'''

replacement = '''          <SL label="Options détectées dans le document"/>
          <FR label="FI200 Start">
            <button type="button" aria-pressed={form.fi200start} onClick={()=>set("fi200start",!form.fi200start)} style={{width:"100%",border:"1px solid rgba(56,189,248,.35)",borderRadius:13,padding:"10px 12px",background:form.fi200start?"linear-gradient(135deg,#10b981,#0f766e)":"rgba(15,23,42,.72)",color:form.fi200start?"#fff":"#cbd5e1",fontWeight:950,cursor:"pointer"}}>{form.fi200start?"OUI":"NON"}</button>
          </FR>
          <SL label="Installation"/>
          <Tog label="Installation incluse" value={form.installation} onChange={v=>set("installation",v)} color="#2E7D32"/>'''

count = text.count(installation)
if count != 1:
    raise SystemExit(f"Expected one installation block, found {count}")
text = text.replace(installation, replacement, 1)

if text.count("</body>") != 1:
    raise SystemExit("Unexpected body ending")
text = text.replace("</body>", f"{marker}\n</body>", 1)

required = [
    'label="FI200 Start"',
    'aria-pressed={form.fi200start}',
    marker,
    'Ajouter captures du PV',
    'function App()',
]
for token in required:
    if token not in text:
        raise SystemExit(f"Missing required token: {token}")

if 'id="tbr-app"' in text:
    raise SystemExit("Iframe test shell detected unexpectedly")

path.write_text(text, encoding="utf-8")
print("Direct PDF test injected into stable TBR")
