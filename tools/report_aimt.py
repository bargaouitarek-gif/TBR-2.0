from pathlib import Path

text = Path('index.html').read_text(encoding='utf-8')
lines = text.splitlines()
for i, line in enumerate(lines, 1):
    if 'aimt' in line.lower() or 'AIMT' in line:
        print(f'--- line {i} ---')
        for j in range(max(1, i-2), min(len(lines), i+2)+1):
            print(f'{j}: {lines[j-1]}')
print('AIMT inspection complete')
