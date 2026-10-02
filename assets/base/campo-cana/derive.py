"""Derive four edge-compatible campoCana tiles and an inspection contact sheet."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
DEST = ROOT / "assets/sprites/terrain"
SOURCE = Image.open(HERE / "generation-02-raw.png").convert("RGB")
SIZE = 128


def crop_quadrant(index):
    w, h = SOURCE.size
    side = min(w, h) // 2
    x = (index % 2) * side
    y = (index // 2) * side
    return SOURCE.crop((x, y, x + side, y + side)).resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def make_edges_match(images):
    # A periodic source blends opposite halves of the generated image. Its
    # borders meet without the artificial bright frame caused by edge paint.
    source = SOURCE.resize((SIZE * 2, SIZE * 2), Image.Resampling.LANCZOS)
    p = source.load()
    base = Image.new("RGB", (SIZE, SIZE))
    b = base.load()
    for y in range(SIZE):
        wy = y / (SIZE - 1)
        for x in range(SIZE):
            wx = x / (SIZE - 1)
            samples = (p[x, y], p[x + SIZE, y], p[x, y + SIZE], p[x + SIZE, y + SIZE])
            weights = (wx * wy, (1 - wx) * wy, wx * (1 - wy), (1 - wx) * (1 - wy))
            b[x, y] = tuple(round(sum(samples[i][k] * weights[i] for i in range(4))) for k in range(3))
    # Exact border copy after downsampling; variants change only the center.
    for i, im in enumerate(images):
        q = im.load()
        for y in range(SIZE):
            for x in range(SIZE):
                distance = min(x, y, SIZE - 1 - x, SIZE - 1 - y)
                blend = min(1, max(0, (distance - 2) / 26))
                blend *= 0 if i == 0 else 0.28
                q[x, y] = tuple(round(b[x, y][k] * (1 - blend) + q[x, y][k] * blend) for k in range(3))


masters = [crop_quadrant(i) for i in range(4)]
make_edges_match(masters)
tiles = []
for i, master in enumerate(masters):
    suffix = "" if i == 0 else f"-v{i}"
    master.save(HERE / f"campo-cana-master{suffix}.png")
    tile = master.resize((64, 64), Image.Resampling.LANCZOS).convert("RGBA")
    tile.save(DEST / f"campo-cana{suffix}.png")
    tiles.append(tile)

# Inspect a four-by-four neighborhood and the actual cane sprite at each zoom.
grass = Image.open(DEST / "grama-D-v0.png").convert("RGBA")
plowed = Image.open(DEST / "campo-arado.png").convert("RGBA")
cane = Image.open(ROOT / "assets/sprites/resources/grapes-D.png").convert("RGBA")
rows = []
for zoom in (0.5, 1, 2):
    for tint in (1, 0.8):
        unit = round(64 * zoom)
        row = Image.new("RGB", (unit * 7 + 32, unit * 4 + 30), (226, 211, 184))
        draw = ImageDraw.Draw(row)
        draw.text((4, 3), f"zoom {zoom}  RGB x {tint}", fill=(40, 31, 24))
        def place(im, x, y):
            scaled = im.resize((unit, unit), Image.Resampling.NEAREST if zoom != 1 else Image.Resampling.LANCZOS)
            if tint != 1:
                rgb = scaled.convert("RGB").point(lambda c: round(c * tint)).convert("RGBA")
                rgb.putalpha(scaled.getchannel("A"))
                scaled = rgb
            row.paste(scaled, (x, y), scaled)
        for y in range(4):
            for x in range(4):
                place(tiles[(x + y * 3) % 4], 0 + x * unit, 24 + y * unit)
        place(grass, unit * 4 + 8, 24)
        place(tiles[0], unit * 5 + 8, 24)
        place(plowed, unit * 6 + 8, 24)
        place(tiles[1], unit * 5 + 8, 24 + unit)
        cane_scaled = cane.resize((unit, unit), Image.Resampling.NEAREST)
        row.paste(cane_scaled, (unit * 5 + 8, 24 + unit), cane_scaled)
        rows.append(row)
sheet = Image.new("RGB", (max(r.width for r in rows), sum(r.height for r in rows) + 5 * 8), (226, 211, 184))
y = 0
for row in rows:
    sheet.paste(row, (0, y))
    y += row.height + 8
sheet.save(HERE / "campo-cana-contact.png")
