"""G-ARTE-TRABALHO-NAS-MINAS-E-CURRAIS — monta os quadros de trabalho de um predio a partir de uma animacao PixelLab.

Uso: python -I tools/trabalho-dentro.py <predio> <laco> <pasta-dos-quadros-brutos> [--quadros N]

Os quadros brutos (PNG, um por quadro, na ordem do nome) sao do personagem do `trabalhador` do predio, no sul. O metodo e o
do G-ARTE-TRABALHADOR-RECORTADO (o de 2026-10-04 ficou fora do repositorio; este o refaz):
- a caixa opaca comum dos quadros e recortada, SEM reducao (escala 1, a da rua);
- na altura, se o boneco cabe na `ancoras.trabalho.area`, entra inteiro com o pe na borda de baixo; se nao cabe, a janela
  comeca no alto da cabeca e o corpo e cortado na borda de baixo (fica atras da parede);
- na largura, se nao cabe, a janela centra nos pixels que mudam entre os quadros (as maos e a ferramenta);
- cada quadro sai com o tamanho exato da area (o render estica o quadro para ela) em
  assets/sprites/trabalho/<predio>/<laco>_<n>.png.
"""
import json
import os
import sys

from PIL import Image, ImageChops

ALFA = 128


def area_em_px(predio):
    m = json.load(open('assets/manifest.json', encoding='utf8'))
    p = next(a for a in m['assets'] if a['id'] == predio and a['tipo'] != 'trabalho')
    x0, y0, x1, y1 = p['ancoras']['trabalho']['area']
    w, h = p['tamanho']
    return round((x1 - x0) * w), round((y1 - y0) * h)


def caixa_opaca(imgs):
    caixas = [i.getchannel('A').point(lambda a: 255 if a >= ALFA else 0).getbbox() for i in imgs]
    caixas = [c for c in caixas if c is not None]
    return (min(c[0] for c in caixas), min(c[1] for c in caixas), max(c[2] for c in caixas), max(c[3] for c in caixas))


def centro_do_movimento(imgs, caixa):
    """O x medio dos pixels que mudam entre quadros consecutivos, dentro da caixa (as maos e a ferramenta)."""
    soma, n = 0, 0
    for a, b in zip(imgs, imgs[1:] + imgs[:1]):
        dif = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 24 else 0).crop(caixa)
        for i, v in enumerate(dif.get_flattened_data()):
            if v:
                soma += i % dif.width
                n += 1
    return caixa[0] + (soma / n if n else (caixa[2] - caixa[0]) / 2)


def montar(predio, laco, pasta, quadros=None):
    arquivos = sorted(f for f in os.listdir(pasta) if f.lower().endswith('.png'))
    if quadros is not None:
        arquivos = arquivos[:quadros]
    imgs = [Image.open(os.path.join(pasta, f)).convert('RGBA') for f in arquivos]
    aw, ah = area_em_px(predio)
    x0, y0, x1, y1 = caixa_opaca(imgs)
    bw, bh = x1 - x0, y1 - y0
    # altura: inteiro com o pe embaixo, ou a cabeca no topo e o corte embaixo
    topo = y0 if bh > ah else y1 - ah
    # largura: inteiro centrado, ou a janela centrada no movimento
    if bw <= aw:
        esq = x0 - (aw - bw) // 2
    else:
        cx = centro_do_movimento(imgs, (x0, y0, x1, y1))
        esq = int(round(min(max(cx - aw / 2, x0), x1 - aw)))
    destino = os.path.join('assets', 'sprites', 'trabalho', predio)
    os.makedirs(destino, exist_ok=True)
    saidas = []
    for n, img in enumerate(imgs, start=1):
        q = Image.new('RGBA', (aw, ah), (0, 0, 0, 0))
        q.alpha_composite(img.crop((esq, topo, esq + aw, topo + ah)))
        caminho = os.path.join(destino, f'{laco}_{n}.png')
        q.save(caminho)
        saidas.append(caminho.replace(os.sep, '/'))
    print(json.dumps({'predio': predio, 'laco': laco, 'area': [aw, ah], 'boneco': [bw, bh],
                      'cortado': bh > ah, 'quadros': saidas}))


if __name__ == '__main__':
    args = sys.argv[1:]
    n = None
    if '--quadros' in args:
        i = args.index('--quadros')
        n = int(args[i + 1])
        del args[i:i + 2]
    montar(args[0], args[1], args[2], n)
