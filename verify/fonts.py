"""Build page-specific WenKai WOFF2 subsets from supplied licensed TTFs."""
from pathlib import Path
import argparse
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
runtime = ROOT / 'research' / '.font-runtime'
if runtime.is_dir():
    sys.path.insert(0, str(runtime))
from fontTools import subset
from fontTools.ttLib import TTFont

parser = argparse.ArgumentParser()
parser.add_argument('--regular', required=True)
parser.add_argument('--medium', required=True)
args = parser.parse_args()
source_paths = [ROOT / 'index.html', ROOT / 'demos.js', ROOT / 'style.css']
source_paths.extend(sorted((ROOT / 'assets').glob('*.svg')))
text = ''.join(p.read_text(encoding='utf-8') for p in source_paths)
codepoints = set(map(ord, text)) | set(range(32, 127))
report = {'characters': len(codepoints), 'fonts': []}
for weight in ('regular', 'medium'):
    source = Path(getattr(args, weight))
    font = TTFont(source)
    cmap = font.getBestCmap()
    missing = sorted(cp for cp in codepoints if 0x3400 <= cp <= 0x9FFF and cp not in cmap)
    if missing:
        raise RuntimeError('Missing Chinese glyphs: ' + ''.join(map(chr, missing)))
    options = subset.Options()
    options.flavor = 'woff2'
    options.notdef_glyph = True
    options.notdef_outline = True
    options.layout_features = ['*']
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=codepoints)
    sub.subset(font)
    font.flavor = 'woff2'
    destination = ROOT / 'assets' / f'wenkai-{weight}.woff2'
    font.save(destination)
    report['fonts'].append({'file': destination.name, 'bytes': destination.stat().st_size, 'missingChineseGlyphs': []})
(ROOT / 'verify' / 'fonts.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
