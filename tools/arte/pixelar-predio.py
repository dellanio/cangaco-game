"""Converte a pedreira pintada em pixel art SEM redesenhar: reduz a resolucao (cada pixel novo = um bloco
NxN), quantiza numa paleta curta comum aos dois estados, endurece a borda do alfa e amplia por vizinho."""
import sys
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance
WT = Path(__file__).resolve().parents[2]
FONTES = {'completo': WT / 'assets/base/quarry/quarry-D-master-2x.png',
          'madeira': WT / 'assets/sprites/quarry/quarry_madeira-D-preview.png'}
W, H = 192, 176

def pixelar(im, bloco, cores, paleta=None):
    im = im.convert('RGBA').resize((W, H), Image.LANCZOS)
    alfa = im.getchannel('A')
    im = ImageEnhance.Contrast(im.convert('RGB').filter(ImageFilter.UnsharpMask(2, 160, 2))).enhance(1.12).convert('RGBA')
    im.putalpha(alfa)
    p = im.resize((W // bloco, H // bloco), Image.BOX)
    a = p.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
    rgb = Image.new('RGB', p.size, (0, 0, 0)); rgb.paste(p.convert('RGB'), mask=a)
    q = rgb.quantize(colors=cores, method=Image.MEDIANCUT, dither=Image.NONE) if paleta is None \
        else rgb.quantize(palette=paleta, dither=Image.NONE)
    out = q.convert('RGBA'); out.putalpha(a)
    # contorno de 1 pixel escuro na silhueta, como a arte das unidades (selective outline)
    px = out.load(); w, h = out.size
    borda = [(x, y) for y in range(h) for x in range(w) if px[x, y][3]
             and any(not (0 <= x + dx < w and 0 <= y + dy < h) or px[x + dx, y + dy][3] == 0
                     for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in borda:
        r, g, b, _ = px[x, y]; px[x, y] = (int(r * .35), int(g * .3), int(b * .28), 255)
    return out.resize((W, H), Image.NEAREST), q

bloco, cores = int(sys.argv[1]), int(sys.argv[2])
res = {}
c, pal = pixelar(Image.open(FONTES['completo']), bloco, cores)
res['completo'] = c
res['madeira'], _ = pixelar(Image.open(FONTES['madeira']), bloco, cores, pal)
for k, v in res.items(): v.save(f'pedreira-{k}-b{bloco}-c{cores}.png')
