from pathlib import Path

path=Path('index.html')
text=path.read_text(encoding='utf-8')
old='''      const rows=parseClientRows(allPageLines);
      const installs=parseInstallRows(allText);'''
new='''      const rows=parseClientRows(allPageLines);
      const installationPages=allPageLines.filter(lines=>/COMMISSION SUR INSTALLATIONS|ANNEXE[^.]{0,80}INSTALLATION|DETAILS? SUR LES INSTALLATIONS/i.test(lines.join(" ")));
      const installText=(installationPages.length?installationPages:(pdf.numPages>=3?[allPageLines[2]]:[])).map(lines=>lines.join(" ")).join(" ");
      const installs=parseInstallRows(installText);'''
if old not in text:
    raise SystemExit('installation parser target not found')
text=text.replace(old,new,1)
if 'const installs=parseInstallRows(allText);' in text:
    raise SystemExit('unsafe installation scan remains')
path.write_text(text,encoding='utf-8')
print('DCO installation scope fixed')
