# Receitas de prompt

Use estas bases com referências canônicas do projeto e adapte somente sujeito, quantidade e função.

## Tile de terreno

```text
Use case: stylized-concept
Asset type: seamless 64x64 orthogonal terrain tile for the Piancó RTS
Subject: <tipo de terreno>, texture only
Style: richly painted 2D RTS art, muted Brazilian sertão palette, subtle dark-brown linework
View: straight square texture view; not an isometric diamond
Lighting: restrained upper-left light, no global gradient
Constraints: seamless on all four edges; no border, gutter, focal object, tree, building, text or watermark
```

## Sprite de mundo

```text
Use case: stylized-concept
Asset type: isolated production sprite for the Piancó RTS
Subject: <sujeito e função>
Style: richly painted 2D top-down 3/4 RTS sprite with subtle cordel linework
Lighting: upper-left, short shadow down-right
Composition: full silhouette, rooted at bottom center, readable at <dimensão>
Constraints: genuinely transparent background; no terrain square, halo, text, watermark or cropped edge
```

## Prédio

```text
Use case: stylized-concept
Asset type: isolated building sprite for the Piancó RTS, footprint <L>x<A> orthogonal tiles
Subject: <função>, taipa, exposed timber, lime plaster, colonial roof tile
View: elevated top-down 3/4, square-ground projection, front door toward south
Lighting: upper-left; shadow down-right
Composition: entire building visible, bottom-center anchor, functional silhouette
Constraints: transparent background; no people, goods, landscape, text, watermark or isometric diamond base
```

## Folha de UI

```text
Use case: ui-mockup
Asset type: isolated production UI pieces for the Piancó sidebar
Style: aged wood, raw parchment, brass rivets and Brazilian cordel engraving
View: straight-on, no perspective tilt
Composition: each component isolated in a regular grid cell; empty centers for live text
Constraints: transparent background; no readable text, logo, people, map, watermark or overlapping cells
```
