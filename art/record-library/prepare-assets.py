#!/usr/bin/env python3
"""Prepare and inspect local generated art. No network or API credentials are used."""

import argparse
from collections import deque
from hashlib import sha256
from html import escape
import json
from pathlib import Path
import shutil

from PIL import Image, ImageColor, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / 'art/record-library/generation-plan.json'
SOURCE = ROOT / 'output/imagegen/record-library'
REVIEW = ROOT / 'shendu/tmp/imagegen/review'
PUBLIC = ROOT / 'shendu/public/assets/records'
SIZE = 640


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def prepare(source, asset):
    """Remove only pale background connected to the border; preserve enclosed paper."""
    original = Image.open(source).convert('RGB')
    width, height = original.size
    pixels = original.load()
    mask = bytearray(width * height)
    queue = deque()

    def admit(x, y):
        offset = y * width + x
        if mask[offset]:
            return
        r, g, b = pixels[x, y]
        # Warm-white backdrop, deliberately tighter than the ivory subject fill.
        if min(r, g, b) >= 246 and max(r, g, b) - min(r, g, b) <= 11:
            mask[offset] = 1
            queue.append((x, y))

    for x in range(width):
        admit(x, 0)
        admit(x, height - 1)
    for y in range(height):
        admit(0, y)
        admit(width - 1, y)
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                admit(nx, ny)

    # Normalize flat fills/contours to the authoritative category palette.
    colors = [ImageColor.getrgb(asset['palette'][key]) for key in ('dark', 'accent', 'paper')]
    colors.append(ImageColor.getrgb('#FFFAF0'))
    palette = Image.new('P', (1, 1))
    palette.putpalette([channel for color in (colors + [colors[-1]] * (256 - len(colors))) for channel in color])
    art = original.quantize(palette=palette, dither=Image.Dither.NONE).convert('RGBA')
    art.putalpha(Image.frombytes('L', original.size, bytes(0 if value else 255 for value in mask)))
    bounds = art.getbbox()
    if not bounds:
        raise ValueError(f'Empty extracted art: {asset["id"]}')
    art = art.crop(bounds)
    art.thumbnail((SIZE * 7 // 8, SIZE * 7 // 8), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE))
    canvas.alpha_composite(art, ((SIZE - art.width) // 2, (SIZE - art.height) // 2))
    return canvas, original.size, bounds, round(sum(mask) / len(mask), 4)


def contact_sheet(assets, output):
    columns, cell, heading = 5, 224, 52
    rows = (len(assets) + columns - 1) // columns
    sheet = Image.new('RGB', (columns * cell, rows * cell + heading), '#F7F4EE')
    draw = ImageDraw.Draw(sheet)
    font_path = Path('C:/Windows/Fonts/msyh.ttc')
    font = ImageFont.truetype(str(font_path), 13) if font_path.exists() else ImageFont.load_default()
    draw.text((16, 15), f'{assets[0]["type"]} / {len(assets)} independent scenes', fill='#263A43', font=font)
    for index, asset in enumerate(assets):
        left, top = (index % columns) * cell, (index // columns) * cell + heading
        art = Image.open(REVIEW / f'{asset["id"]}.webp').convert('RGBA')
        art.thumbnail((cell - 24, cell - 44), Image.Resampling.LANCZOS)
        sheet.paste(art, (left + (cell - art.width) // 2, top + 3), art)
        draw.text((left + 10, top + cell - 39), asset['id'], fill=asset['palette']['dark'], font=font)
        draw.text((left + 10, top + cell - 20), asset['label'], fill='#4D5355', font=font)
    sheet.save(output, optimize=True)


def gallery(assets, counts):
    names = {'daily': '每日', 'weekly': '每周', 'monthly': '每月', 'quarterly': '每季', 'yearly': '每年', 'decision': '重大决策'}
    groups = []
    for category, count in counts.items():
        items = [asset for asset in assets if asset['type'] == category]
        figures = ''.join(
            f'<figure><a href="{escape(Path(asset["source"]).name)}"><img src="../../../shendu/public{asset["webp"]}" width="640" height="640" alt="{escape(asset["label"])}"></a><figcaption>{escape(asset["label"])}<small>{escape(asset["id"])}</small></figcaption></figure>'
            for asset in items
        )
        groups.append(f'<section style="--ink:{items[0]["palette"]["dark"]};--paper:{items[0]["palette"]["paper"]}"><header><img src="../../../shendu/public/assets/overview/{category}.svg" width="84" height="84" alt="{names[category]}概览参考图标"><div><h2>{names[category]} · {count} 幅</h2><p>独立场景 · 对应概览类别配色</p></div></header><div class="grid">{figures}</div></section>')
    html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>慎独 · 65幅复盘插画</title><style>body{margin:0;background:#f7f4ee;color:#263a43;font:15px/1.6 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:40px 24px}h1{margin:0;font-size:30px}h2{margin:0;color:var(--ink)}p{margin:4px 0 0}section{margin-top:40px}header{display:flex;align-items:center;gap:20px;margin-bottom:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}figure{margin:0;padding:10px;background:var(--paper);border-radius:16px}figure img{width:100%;height:auto;aspect-ratio:1;object-fit:contain}figcaption{padding:8px;color:var(--ink)}small{display:block;font-size:10px;overflow-wrap:anywhere}a:focus-visible{outline:3px solid var(--ink);display:block}</style><main><h1>慎独 · 65幅复盘插画</h1><p>用于历史复盘和行动验证；点击图片可查看原始PNG。各组旁附概览图标，便于核对画风和配色。</p>' + ''.join(groups) + '</main></html>'
    (SOURCE / 'gallery.html').write_text(html + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publish', action='store_true', help='Publish only after visual review is recorded')
    parser.add_argument('--reprocess', action='store_true', help='Rebuild previews after changing processing rules')
    args = parser.parse_args()
    plan = json.loads(PLAN.read_text(encoding='utf-8'))
    REVIEW.mkdir(parents=True, exist_ok=True)
    prior_path = REVIEW / 'manifest.json'
    prior = json.loads(prior_path.read_text(encoding='utf-8')) if prior_path.exists() else {}
    cached = {asset['id']: asset for asset in prior.get('assets', [])}
    assets = []
    for asset in plan['assets']:
        source = SOURCE / asset['output']
        if not source.exists():
            continue
        target = REVIEW / f'{asset["id"]}.webp'
        previous = cached.get(asset['id'])
        if not args.reprocess and previous and target.exists() and previous['source_sha256'] == digest(source) and previous['webp_sha256'] == digest(target) and previous['palette'] == asset['palette']:
            assets.append({**previous, 'terms': asset['terms']})
            continue
        art, source_size, bounds, removed = prepare(source, asset)
        art.save(target, format='WEBP', quality=90, method=6, exact=True)
        assets.append({
            'id': asset['id'], 'type': asset['type'], 'label': asset['label'], 'terms': asset['terms'],
            'palette': asset['palette'], 'source': source.relative_to(ROOT).as_posix(),
            'source_sha256': digest(source), 'source_width': source_size[0], 'source_height': source_size[1],
            'webp': f'/assets/records/{asset["id"]}.webp', 'webp_sha256': digest(target),
            'width': SIZE, 'height': SIZE, 'bytes': target.stat().st_size,
            'source_bounds': list(bounds), 'removed_border_background_fraction': removed,
            'prompt_id': asset['id'],
        })
    for category in plan['counts']:
        group = [asset for asset in assets if asset['type'] == category]
        if group:
            contact_sheet(group, REVIEW / f'contact-{category}.png')
    manifest = {
        'status': 'prepared-for-visual-review', 'generated_on': '2026-11-04',
        'generator': 'bundled imagegen CLI through user-authorized Sub2API',
        'requested_model': 'gpt-image-2', 'requested_size': '1024x1024', 'quality': 'medium',
        'prompts': 'art/record-library/generation-plan.json',
        'processing': 'Border-connected warm-white removal; four-color category palette; transparent padding; 640-square WebP quality 90. Source PNGs unchanged. Alpha is locally extracted, not native model transparency.',
        'counts': {category: sum(asset['type'] == category for asset in assets) for category in plan['counts']},
        'assets': assets,
    }
    (REVIEW / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if args.publish:
        if manifest['counts'] != plan['counts']:
            raise ValueError('All planned assets must exist before publication')
        review_path = ROOT / 'art/record-library/visual-review.json'
        reviewed = json.loads(review_path.read_text(encoding='utf-8'))
        if set(reviewed['approved_ids']) != {asset['id'] for asset in assets}:
            raise ValueError('Visual review must explicitly approve every asset')
        reviewed_hashes = {asset['id']: asset for asset in reviewed['assets']}
        for asset in assets:
            checked = reviewed_hashes[asset['id']]
            if checked['source_sha256'] != asset['source_sha256'] or checked['webp_sha256'] != asset['webp_sha256']:
                raise ValueError(f'Asset changed after visual review: {asset["id"]}')
        if len({asset['source_sha256'] for asset in assets}) != len(assets):
            raise ValueError('Duplicate source content')
        if len({asset['webp_sha256'] for asset in assets}) != len(assets):
            raise ValueError('Duplicate published content')
        PUBLIC.mkdir(parents=True, exist_ok=True)
        for asset in assets:
            shutil.copy2(REVIEW / f'{asset["id"]}.webp', PUBLIC / f'{asset["id"]}.webp')
        for category in plan['counts']:
            shutil.copy2(REVIEW / f'contact-{category}.png', SOURCE / f'contact-{category}.png')
        gallery(assets, plan['counts'])
        manifest['status'] = 'reviewed-and-published'
        (PUBLIC / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'prepared': len(assets), 'counts': manifest['counts'], 'published': args.publish}))


if __name__ == '__main__':
    main()
