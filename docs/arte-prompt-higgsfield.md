# Prompt de prédio no HiggsField — o caso da casa do lenhador

> Anotação do operador (2026-09-25), movida da raiz para cá em 2026-09-25.
> **Não substitui** `docs/spec-arte-predios.md`: aquele é o molde canônico e os
> critérios de aceite. Este é o prompt **como foi usado de verdade**, em outra
> ferramenta, com um prédio concreto no lugar do `[descrição do prédio]`.

**O que é diferente do molde da spec, e por quê:**

- **A ferramenta é o HiggsField**, não o ludo.ai da spec §1. O ludo.ai resolve
  ângulo, rotação e elevação no **painel**, e por isso a spec §4 manda deixar o
  texto calado sobre câmera ("texto brigando com painel foi o que causou cinco
  rodadas de vaivém"). O HiggsField não tem esse painel: aqui a câmera **tem** de
  estar no prompt, e é o parágrafo `CAMERA` longo abaixo que faz esse trabalho.
- **`SUBJECT` preenchido** para `woodcutters`, que na spec é só um colchete.
- **Duas negativas que a spec não tem**: folhas caídas / vegetação sob o prédio, e
  árvore ou mata em volta — a mata é do mapa (F-T2a), não do sprite.

Os blocos `STYLE`, `PALETTE` e `LIGHT` são os da spec, palavra por palavra. Se um
deles mudar lá, muda aqui junto.

---

Usado no HiggsField

Hand-painted 2D game building sprite for a top-down real-time strategy game set in a
fictional, timeless Brazilian sertao (caatinga backcountry), in a hand-painted
Brazilian cordel illustration style.

SUBJECT — a woodcutter's hut. A small rustic working hut with whitewashed adobe
walls, exposed dark timber framing and a rough fieldstone base course, under a
shallow roof of weathered terracotta colonial tiles laid over rough wooden boards.
Attached to its left, an open lean-to shelter of dark timber posts under the same
roofline. Under the lean-to, in the foreground and clearly visible from the front: a
generous stack of cut tree logs piled in courses, a chopping block with an axe sunk
into it, and a bow saw leaning against a post. This pile of logs is what identifies
the building at a glance and must read clearly even at small size. A plank door and
one shuttered window on the closed part. It reads as a finished, working installation.

CAMERA — a HIGH-ANGLE view, looking DOWN at the building from roughly 45
degrees above. The camera is well above the roof, not at ground level.
The roof plane is seen as a WIDE SURFACE receding away from the viewer,
occupying a large part of the image — you look down ONTO the roof, not at
its edge. The front wall is visible below the eaves, parallel to the
bottom of the image.

The building is NOT rotated: base line, eaves and roof ridge all run
horizontally across the image. The base is a rectangle seen from above,
never a diamond.

Reference for the angle: a tabletop model photographed from a step ladder.
You see the entire roof from above AND the front wall beneath it. This is
NOT a front elevation, NOT a straight-on view.

STYLE — painted illustration, not pixel art, not vector, not a 3D render. A solid
dark brown-black hand-drawn contour around every major form, with thinner interior
lines for planks, stone joints and roof tiles. Volumes shaded with a few flat painted
light planes plus a dry, subtle grain. Strong readable silhouette that survives being
reduced to a 192-pixel-wide sprite. Detail density of a late-1990s strategy game
building: rich but organised, no noisy micro-detail.

PALETTE — dry desaturated earth tones only: terracotta roof #B4562F, whitewash
#EDE3D0, raw cotton #D9C9A8, dark timber #5A3F2B, leather #8A5A32, ochre #C9974B,
burnt earth #8C4A25, pale grey-beige stone with dark mortar lines.

LIGHT — one fixed light from the upper left. Roof tops and upper-left faces lit,
lower-right faces in shadow. No light from the right, no mirrored lighting.

BACKGROUND — fully transparent. The sprite is cut to the silhouette of the BUILT
STRUCTURE alone, following the stone base course and the timber posts exactly. No
ground of any kind, not even under the building: no earth, no sand, no grass, no
fallen leaves, no loose stones, no vegetation, no ground disc, no drop shadow, no
terrain tile. The game draws the terrain underneath.

No standing trees, no forest, no bushes behind or beside the structure — trees are
drawn separately by the game map. Only the built structure and the cut logs under its
own roof.

No people, no animals, no text, no numbers, no logo, no watermark, no frame, no border.