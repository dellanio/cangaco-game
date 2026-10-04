"""G-ARTE-SERF-CARGA-PARADA (pedido do operador, 2026-10-04: "maos paradas, com foco no centro do corpo").
Uso: python tools/arte/tronco-fixo-da-carga.py <tipo> <corte> <quadro-base> [--gravar]
(a sessao usou `serf 0.64 4` e `farmer 0.64 4`; o roceiro e do G-TELA-ROCEIRO-NO-CAMPO).
No atlas do tipo, a `carregando` de cada direcao fica com o tronco do quadro-base (acima do corte, em
fracao da altura do corpo; as maos ja juntas) e as pernas de cada quadro. Sem geracao: o PixelLab, pedido
por descricao, voltava a balancar os bracos. Escreve tira.png (previa) e, com --gravar, o proprio atlas.
Rodar DEPOIS de remontar o atlas do tipo."""
import json, sys
from pathlib import Path
from PIL import Image
TIPO = sys.argv[1]
WT = Path(__file__).resolve().parents[2]; d = WT / 'assets/sprites/units' / TIPO
folha = Image.open(d / f'{TIPO}.png').convert('RGBA'); fr = json.loads((d / f'{TIPO}.json').read_text())['frames']
CORTE = float(sys.argv[2]); BASE = int(sys.argv[3])
def cel(n):
    r = fr[n]['frame']; return folha.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])), r
linhas = []
for dr in ['n', 'ne', 'l', 'se', 's']:
    base, _ = cel(f'{TIPO}/carregando/{dr}/{BASE:04d}')
    bb = base.getchannel('A').getbbox(); corte = bb[1] + int((bb[3] - bb[1]) * CORTE)
    linha = []
    for q in range(8):
        im, r = cel(f'{TIPO}/carregando/{dr}/{q:04d}')
        novo = Image.new('RGBA', im.size, (0, 0, 0, 0))
        novo.alpha_composite(im.crop((0, corte, im.width, im.height)), (0, corte))
        novo.alpha_composite(base.crop((0, 0, im.width, corte)), (0, 0))
        linha.append(novo)
        if '--gravar' in sys.argv:
            folha.paste(Image.new('RGBA', im.size, (0, 0, 0, 0)), (r['x'], r['y'])); folha.alpha_composite(novo, (r['x'], r['y']))
    linhas.append(linha)
if '--gravar' in sys.argv: folha.save(d / f'{TIPO}.png'); print('gravado')
out = Image.new('RGBA', (8 * 64, 5 * 96), (196, 166, 116, 255))
for i, l in enumerate(linhas):
    for j, im in enumerate(l): out.alpha_composite(im, (j * 64, i * 96))
out.resize((out.width * 2, out.height * 2), Image.NEAREST).save('tira.png')
