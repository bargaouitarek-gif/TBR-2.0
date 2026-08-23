from pathlib import Path
import json
import re


def sub1(text, pattern, repl, label, flags=re.S):
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 replacement, got {count}")
    return out


index = Path("index.html")
s = index.read_text(encoding="utf-8")

# Remove the embedded global TBR AI stylesheet.
s = sub1(s, r'\n<style id="tbr-global-ai-style">.*?</style>\n', '\n', "AI stylesheet")

# Remove the legacy JUMPER engine and the embedded TBR AI runtime that follows it.
s = sub1(
    s,
    r'\n// ── JUMPERS — Coach proactif animé ──.*?\nconst TBR_AIMT_IMPACT_REASONS=',
    '\nconst TBR_AIMT_IMPACT_REASONS=',
    "JUMPER and embedded TBR AI block",
)

# Remove unused JUMPER React state only. Existing localStorage data is deliberately untouched.
jumper_state = """  const [onboardingDone,setOnboardingDoneR]=useState(()=>LD('jumper_onboarding',false));
  const setOnboardingDone=()=>{SV('jumper_onboarding',true);setOnboardingDoneR(true);};
  const [jumperProfile,setJumperProfileR]=useState(()=>LD('jumper_profile',null));
  const setJumperProfile=(p)=>{SV('jumper_profile',p);setJumperProfileR(p);};
"""
if s.count(jumper_state) != 1:
    raise SystemExit(f"JUMPER app state expected once, found {s.count(jumper_state)}")
s = s.replace(jumper_state, "", 1)

for snippet, label in [
    ('    <JumpersFloat syn={syn} agent={agent} moisActif={moisActif} />\n', "JumpersFloat render"),
    ('    <TbrAiAssistant tab={tab} agent={agent} moisActif={moisActif} ventes={ventes} syn={syn} aimt={aimt} ip={ip}/>\n', "TBR AI render"),
    ('  const plan=getJumperCoachPlan(syn,moisActif,objectifEuros,objV,objVD,rdvVFMois,moisConfig,status);\n', "JUMPER home plan"),
    ('  const warning=!onTrack||projVD<objVD;\n', "JUMPER warning"),
]:
    if s.count(snippet) != 1:
        raise SystemExit(f"{label}: expected once, found {s.count(snippet)}")
    s = s.replace(snippet, "", 1)

# Remove JUMPER simulation/coaching engine used by the old copilot card.
s = sub1(
    s,
    r'\nfunction getMoisProgress\(moisActif\)\{.*?\nfunction SyntheseView\(',
    '\nfunction SyntheseView(',
    "JUMPER coach engine",
)

# Remove the visible JUMPER copilot card, keep the two useful KPI mini-panels.
s = sub1(
    s,
    r'\n\s*<div className="flight-copilot">.*?</div>\s*\n\s*<div className="flight-mini-panel">',
    '\n        <div className="flight-mini-panel">',
    "JUMPER copilot card",
)

# Two remaining KPI panels now use two columns.
s = s.replace('grid-template-columns:1.35fr .8fr .8fr', 'grid-template-columns:repeat(2,minmax(0,1fr))')
s = s.replace('grid-template-columns:1.25fr .75fr .75fr!important', 'grid-template-columns:repeat(2,minmax(0,1fr))!important')

# Remove visible JUMPER wording from screens that remain.
s = s.replace('JUMPER analyse ton PDF et croise avec tes ventes...', 'TBR analyse ton PDF et croise avec tes ventes...')
s = s.replace('et les scénarios JUMPER.', 'et tes projections.')
s = s.replace('dans JUMPER pour suivre ce qu’il reste à aller chercher.', 'dans les projections pour suivre ce qu’il reste à aller chercher.')

old_version = 'const APP_VERSION = "8.30.1-aimt-rules";'
if s.count(old_version) != 1:
    raise SystemExit(f"APP_VERSION expected once, found {s.count(old_version)}")
s = s.replace(old_version, 'const APP_VERSION = "8.30.2-no-jumper-ai";', 1)

forbidden = [
    'function TbrAiAssistant',
    'TBR_AI_API_URL',
    '<TbrAiAssistant',
    'getJumperCoachPlan',
    '<JumpersFloat',
    '<span>JUMPER</span>',
]
remaining = [token for token in forbidden if token in s]
if remaining:
    raise SystemExit("Retired code still present: " + ", ".join(remaining))

index.write_text(s, encoding="utf-8")

# Vercel shell: keep the DCO claim runtime, stop injecting TBR AI.
shell = Path("index-audit.html")
a = shell.read_text(encoding="utf-8")
a, count = re.subn(r'\n\s*const ai=.*?;\n', '\n', a, count=1)
if count != 1:
    raise SystemExit(f"index-audit AI loader expected once, got {count}")
a = a.replace("claim+ai+'</body>'", "claim+'</body>'")
a = a.replace("html+=claim+ai;", "html+=claim;")
if "tbr-ai-ui-v2" in a:
    raise SystemExit("AI loader still present in index-audit.html")
shell.write_text(a, encoding="utf-8")

# Remove TBR AI from Vercel builds/routes while keeping Sentry and DCO runtimes.
vercel = Path("vercel.json")
cfg = json.loads(vercel.read_text(encoding="utf-8"))
cfg["builds"] = [b for b in cfg.get("builds", []) if b.get("src") not in {"tbr-ai-ui-v2.js", "ai.js"}]
cfg["routes"] = [r for r in cfg.get("routes", []) if r.get("src") not in {"/api/ai", "/tbr-ai-ui-v2.js"}]
vercel.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Update permanent architecture notes without changing data-protection rules.
agents = Path("AGENTS.md")
ag = agents.read_text(encoding="utf-8")
old = '- Vercel sert de backend pour les fonctions IA et les routes `/api/*`.'
new = '- Vercel sert les fonctions serveur restantes et les routes techniques `/api/*` ; aucune fonctionnalité TBR IA n’est active.'
if old not in ag:
    raise SystemExit("AGENTS Vercel architecture line not found")
ag = ag.replace(old, new, 1)
old2 = "- Vérifier `index.html`, `ai.js` et `vercel.json` ensemble lorsqu'une modification concerne l'IA ou Vercel."
new2 = '- Vérifier `index.html`, `index-audit.html` et `vercel.json` ensemble lorsqu’une modification concerne Vercel.'
if old2 not in ag:
    raise SystemExit("AGENTS Vercel method line not found")
ag = ag.replace(old2, new2, 1)
agents.write_text(ag, encoding="utf-8")

# Delete retired AI files and the one-shot workflow/tool after this script has run.
for path in [
    "ai.js",
    "tbr-ai-context.js",
    "tbr-ai-ui-v2.js",
    ".github/workflows/apply-ai-memory.yml",
    ".github/workflows/remove-jumper-tbr-ai-main-once.yml",
    "tools/patch_index_ai_memory.py",
]:
    f = Path(path)
    if f.exists():
        f.unlink()

print("JUMPER and TBR AI removed without touching localStorage data.")
