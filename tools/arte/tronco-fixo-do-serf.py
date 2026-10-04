"""G-ARTE-SERF-CARGA-PARADA (pedido do operador, 2026-10-04: "maos paradas, com foco no centro do corpo").
Uso: python tools/arte/tronco-fixo-do-serf.py <corte> [<quadro-base>] [--gravar]  (a sessao usou 0.64 e 4).
No atlas do serf, a `carregando` de cada direcao fica com o tronco do quadro-base (acima do corte, em
fracao da altura do corpo; as maos ja juntas) e as pernas de cada quadro. Sem geracao: o PixelLab, pedido
por descricao, voltava a balancar os bracos. Escreve tira.png (previa) e, com --gravar, o proprio atlas.
Rodar DEPOIS de remontar o atlas do serf."""
import json, sys
from pathlib import Path
from PIL import Image
WT = Path(__file__).resolve().parents[2]; d = WT / 'assets/sprites/units/serf'
folha = Image.open(d / 'serf.png').convert('RGBA'); fr = json.loads((d / 'serf.json').read_text())['frames']
CORTE = float(sys.argv[1]); BASE = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 4
def cel(n):
    r = fr[n]['frame']; return folha.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])), r
linhas = []
for dr in ['n', 'ne', 'l', 'se', 's']:
    base, _ = cel(f'serf/carregando/{dr}/{BASE:04d}')
    bb = base.getchannel('A').getbbox(); corte = bb[1] + int((bb[3] - bb[1]) * CORTE)
    linha = []
    for q in range(8):
        im, r = cel(f'serf/carregando/{dr}/{q:04d}')
        novo = Image.new('RGBA', im.size, (0, 0, 0, 0))
        novo.alpha_composite(im.crop((0, corte, im.width, im.height)), (0, corte))
        novo.alpha_composite(base.crop((0, 0, im.width, corte)), (0, 0))
        linha.append(novo)
        if '--gravar' in sys.argv:
            folha.paste(Image.new('RGBA', im.size, (0, 0, 0, 0)), (r['x'], r['y'])); folha.alpha_composite(novo, (r['x'], r['y']))
    linhas.append(linha)
if '--gravar' in sys.argv: folha.save(d / 'serf.png'); print('gravado')
out = Image.new('RGBA', (8 * 64, 5 * 96), (196, 166, 116, 255))
for i, l in enumerate(linhas):
    for j, im in enumerate(l): out.alpha_composite(im, (j * 64, i * 96))
out.resize((out.width * 2, out.height * 2), Image.NEAREST).save('tira.png')
