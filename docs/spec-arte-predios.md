# Especificação da arte dos prédios

> Como gerar os sprites do Piancó. Vale para os 28 prédios do
> `data/buildings.json`, em seis estágios cada.
> Ferramenta em uso: **ludo.ai** (funciona por imagem de referência, não
> treina modelo).

---

## 1. Configuração do ludo.ai — não mudar entre prédios

| Campo | Valor |
|---|---|
| Estilo | **Hand-Painted** |
| Perspectiva | **High Angle** |
| Rotação | **Front** |
| Elevação | **High** |
| Aspect ratio | **Square** |
| Gênero | Strategy (ou Core, se não houver) |

**Por que High Angle e não Isometric:** o jogo tem grid **ortogonal**
(tiles quadrados de 64 px), não isométrico — GDD §9.3. Base em losango
faz o prédio preencher ~39 % do quadrado do footprint, medido no armazém.
A base tem de ser um retângulo com as arestas horizontais.

**Por que Square e não a proporção do footprint:** a convenção é
**largura manda, altura livre** (F17f). O telhado transborda para cima; o
derivador corta e ancora pela borda de baixo. Os 28 prédios têm
footprints diferentes (2×1 a 4×4) — amarrar a proporção da imagem ao
footprint quebraria a consistência entre eles. A proporção do prédio vai
no texto do prompt, não no formato da imagem.

---

## 2. Onde os arquivos ficam

```
assets/base/<id>/<id>_<n>_<estagio>.png     fonte, 1536 px de largura
assets/sprites/<id>/…                        derivado, 192 px × largura em tiles
```

- `<id>` é o id neutro da simulação (`quarry`, não `pedreira`) — o render
  não pode depender do `theme-sertao.json` para achar arquivo.
- Derivação por `tools/derivar-sprites.js`: recorta os seis estágios pela
  **união das bounding boxes**, nunca cada um pelo seu próprio conteúdo,
  senão o prédio pula ao trocar de estágio.
- Base e derivado entram no git (CLAUDE.md §9).

## 3. Os seis estágios

Da F17e. Um arquivo por estágio, **mesmo canvas, mesma posição, mesma
escala** nos seis.

| n | estágio | o que aparece |
|---|---|---|
| 1 | `marcacao` | estacas e corda marcando o retângulo, terreno irregular |
| 2 | `fundacao` | terreno aplainado, alicerce de pedra bruta assentado |
| 3 | `estrutura` | postes e vigas de madeira de pé, sem telhado nem paredes |
| 4 | `paredes` | paredes de taipa subindo até meia altura, sem telhado |
| 5 | `cobertura` | paredes inteiras, madeiramento do telhado, telhas em parte |
| 6 | `completo` | o prédio pronto |

Gere o `completo` primeiro. Os outros cinco saem **dele como imagem de
referência**, trocando só o parágrafo SUBJECT e mantendo CAMERA, STYLE,
PALETTE, LIGHT e BACKGROUND palavra por palavra.

---

## 4. O prompt

Molde. Trocar só o SUBJECT e a proporção em CAMERA.

```text
Hand-painted 2D game building sprite for a top-down real-time strategy game set in a
fictional, timeless Brazilian sertao (caatinga backcountry), in a hand-painted
Brazilian cordel illustration style.

SUBJECT — [descrição do prédio: o que é, de que é feito, o que tem dentro e em volta
que o identifique de relance]

CAMERA — the roof plane is seen as a wide surface from above; the front wall is
visible below the eaves. Base line, eaves and roof ridge all run horizontally across
the image, parallel to the bottom edge, never diagonally. The building is [N] units
wide by [M] deep, resting on the bottom edge of the frame.

STYLE — painted illustration, not pixel art, not vector, not a 3D render. A solid
dark brown-black hand-drawn contour around every major form, with thinner interior
lines for planks, stone joints and roof tiles. Volumes shaded with a few flat painted
light planes plus a dry, subtle grain. Strong readable silhouette that survives being
reduced to a 192-pixel-wide sprite. Detail density of a late-1990s strategy game
building: rich but organised, no noisy micro-detail.

PALETTE — dry desaturated earth tones only: terracotta roof #B4562F, whitewash
#EDE3D0, raw cotton #D9C9A8, dark timber #5A3F2B, leather #8A5A32, ochre #C9974B,
burnt earth #8C4A25, pale grey-beige cut stone with dark mortar lines.

LIGHT — one fixed light from the upper left. Roof tops and upper-left faces lit,
lower-right faces in shadow. No light from the right, no mirrored lighting.

BACKGROUND — fully transparent RGBA. The sprite is cut to the silhouette of the BUILT
STRUCTURE alone, following the stone base course and the timber posts exactly. No
ground of any kind, not even under the building: no earth, no sand, no grass, no
stone dust, no loose pebbles, no dry-stone wall, no ramp, no vegetation, no ground
disc, no drop shadow, no terrain tile. The game draws the terrain underneath.

No raw, uncut rock: no rock face, no outcrop, no boulders, no hill behind or beside
the structure — natural resources are drawn separately by the game map.

No people, no animals, no text, no numbers, no logo, no watermark, no frame, no
border, no UI.
```

**Negative** — sem nada sobre rotação ou ângulo: isso o painel resolve, e
texto brigando com painel foi o que causou cinco rodadas de vaivém.

```text
pixel art, voxel, 3D render, CGI, photorealistic, photo, anime, chibi, flat vector,
cel-shaded glow, rock face, stone outcrop, boulders, cliff, hill, mountain, cave,
mine shaft, open pit, ground patch, dirt floor, sand, grass, loose stones, retaining
wall, ramp, ground disc, drop shadow, terrain tile, sky, clouds, horizon, landscape
scene, environment background, European medieval castle, battlements, fantasy,
steampunk, industrial machinery, crane, conveyor, modern equipment, wild west,
sombrero, people, workers, animals, text, letters, numbers, logo, watermark,
signature, frame, border, checkerboard, light from the right, purple, magenta, neon,
chrome, saturated blue
```

---

## 5. Critérios para aceitar uma imagem

1. Base retangular, arestas horizontais — **nunca losango**.
2. Telhado visto **de cima** como superfície larga, não de lado. Não é
   elevação frontal.
3. Fundo transparente, recorte na silhueta do prédio. **Nenhum chão**,
   nem sob o prédio.
4. **Nenhuma rocha bruta, morro ou vegetação** — recurso natural é do
   mapa (F-T2a).
5. Luz no alto à esquerda, sombra embaixo à direita.
6. Contorno escuro contínuo, legível reduzido a 192 px de largura.
7. Densidade de detalhe compatível com os prédios já aprovados.

Falhou 1, 2, 3 ou 4 → regerar. Falhou 5, 6 ou 7 → o traço não combina com
o conjunto.

---

## 6. O que NÃO é sprite de prédio

- **Animação de prédio não existe.** O render desenha um sprite estático
  por estágio; não há quadro nem tempo. Animação vale para **unidades**
  (`units.json`: 4 direções para civis, 8 para militares).
- **O trabalhador não faz parte do prédio.** Pela F-T3 o especialista sai
  para colher — pedreiro no lajedo, lenhador na árvore, roceiro no campo.
  Ele é unidade, desenhada por `render/unidades.ts`.
- **A UI é outro estilo.** GDD §9: mundo pintado e colorido, interface em
  xilogravura de cordel (o "Block Print" do ludo.ai). Não misturar.

---

## 7. Estado em 2026-09-24

- Aprovados: armazém e mirante (Codex, **em projeção isométrica** — BUG-F
  aberto, a substituir).
- Em teste: pedreira no ludo.ai, com a configuração da seção 1.
- A primeira imagem boa vira a referência das outras 167. Gerar algumas
  variantes e escolher com calma antes de seguir.