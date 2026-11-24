"""Decode the five deliverable illustrations, check GIF/SVG, and save hashes."""
from pathlib import Path
import hashlib
import json
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
results = []
paths = [ROOT / 'assets' / name for name in ('01-paths.webp', '02-progressive.webp', '03-contract.webp', '04-ticket.webp', '05-inspect.webp')]
sheet = Image.new('RGB', (1200, 1280), '#f7f4ec')
draw = ImageDraw.Draw(sheet)
for i, path in enumerate(paths):
    with Image.open(path) as picture:
        picture.load()
        assert picture.format == 'WEBP', path.name
        assert picture.size == (1536, 1024), (path.name, picture.size)
        row = {'file': path.name, 'format': picture.format, 'width': picture.width, 'height': picture.height,
               'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        preview = ImageOps.contain(picture.convert('RGB'), (570, 380))
        x, y = (i % 2) * 600 + 15, (i // 2) * 425 + 25
        sheet.paste(preview, (x, y))
        draw.text((x, y + 384), path.name, fill='#2c4a7c')
        results.append(row)
for path in sorted((ROOT / 'assets').glob('*.svg')):
    svg = ET.parse(path).getroot()
    assert svg.tag.endswith('svg') and svg.attrib.get('viewBox')
    results.append({'file': path.name, 'format': 'SVG', 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
with Image.open(ROOT / 'assets' / 'loop.gif') as gif:
    assert gif.format == 'GIF' and gif.n_frames >= 10
    assert gif.size == (384, 256)
    results.append({'file': 'loop.gif', 'format': 'GIF', 'frames': gif.n_frames, 'width': gif.width, 'height': gif.height,
                    'bytes': (ROOT / 'assets' / 'loop.gif').stat().st_size})
sheet.save(ROOT / 'shots' / 'illustrations-contact-sheet.jpg', quality=92)
record = {'passed': True, 'assets': results}
(ROOT / 'verify' / 'assets.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(record, ensure_ascii=False))
