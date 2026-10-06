# Relógio do sol — arte do HUD do Piancó

Gerado com a ferramenta nativa image_generation, duas chamadas, usando as referências de estilo `assets/base/ui-clima/referencia-estilo-topo.png` e `assets/base/ui-menu/operador/proposta-menu.jpg` (a segunda somente no mostrador). Sem integração no manifesto ou no jogo.

## Prompt do mostrador

Create one production raster HUD asset for Piancó, a northeastern Brazilian sertão RTS. The two supplied images are STYLE REFERENCES ONLY: carved rustic wood, brass rivets, aged parchment, earthy hand-painted game UI. Generate ONLY a round season clock dial, strictly front view, perfectly circular centered on a square transparent canvas, generous transparent margin, no perspective. No text, numbers, letters, labels, clock hands or central sun pointer. Thick carved brown wooden circular frame with small brass rivets. Inner parchment disk split by straight radial boundaries at exactly 12, 3, 6 and 9 o'clock into FOUR EQUAL 90-degree QUADRANTS. Clockwise starting at the 12 o'clock boundary: TOP RIGHT rainy winter in sertão, large simple grey-blue cloud with conspicuous falling blue drops, muted green background; BOTTOM RIGHT transition to dry, simple yellow sun between small clouds on yellow parchment; BOTTOM LEFT dry season, strong orange sun above cracked ochre earth and a simple green mandacaru cactus; TOP LEFT transition to rain, approaching large cloud partially covering a golden sun, golden parchment. Bold sparse pictograms legible when the full image is reduced to 96x96 pixels; each pictogram entirely within its quadrant. Crisp dark brown outlines, limited texture, painterly material highlights matching references. Circular outer silhouette, no ornament protruding outside circle, no cast shadow outside frame. Real alpha transparency outside circle. Deliver a single isolated dial, not a mockup or sprite sheet.

## Prompt do ponteiro

Generate ONLY one separate season clock POINTER raster asset for Piancó HUD, on a square truly transparent canvas. Supplied image is STYLE REFERENCE ONLY for rustic brass/wood hand-painted earthy game UI. Strict flat front view. Precisely at image center (50% width,50% height) place a small circular brass pivot hub. From that center a narrow straight brass stem extends vertically UPWARD ending in a small golden sun with bold triangular rays centered at (50% width,22% height). The sun and stem point to 12 o'clock. Entire pointer horizontally symmetric, no tilt. Hub diameter about 7% of canvas width, stem width about 2.5%, sun including rays about 20%. Lowest visible point is bottom of central pivot hub at about 54% image height. Leave LOWER HALF EMPTY TRANSPARENT. No dial, frame, background, panel, shadows outside silhouette, text, numbers, labels or other objects. A single small golden sun on a thin upward brass shaft, restrained ochre highlights and dark brown outlines, readable superimposed over a painted dial at 96px. Preserve generous empty transparent canvas around it; do not crop to object.

## Originais e limpeza

- `relogio-mostrador-original.png`: 1254×1254, original gerado preservado.
- `relogio-ponteiro-original.png`: 1254×1254, original gerado preservado.
- `assets/sprites/ui/clima/relogio-mostrador.png`: 192×192, PNG RGBA.
- `assets/sprites/ui/clima/relogio-ponteiro.png`: 192×192, PNG RGBA.

Execute `node tools/limpar-relogio-do-sol.mjs` a partir do repositório. O script usa exclusivamente o leitor/escritor PNG local, sem dependências adicionais. Reduz por integração de área com alfa premultiplicado, zera RGB e alfa de resíduos abaixo de 4/255 e preserva antialias nas bordas. Centraliza a cruz do mostrador medida em (627,625) do original em (96,96), aplica escala 92/595 e máscara circular de raio 92 px que recorta pequenas saliências das ferragens. Centraliza o pivô do ponteiro medido em (627,669) em (96,96), com escala uniforme 0,15 e direção para cima. O centro geométrico é (96,96) nas coordenadas das bordas do canvas; `transform-origin: 50% 50%`.

Setores iguais, horários desde a divisória das 12h: superior direito inverno/chuvoso, inferior direito transição para seca, inferior esquerdo seca, superior esquerdo transição para chuva. Sem texto. Exterior transparente com alfa 0 real; nenhuma sombra externa adicionada.

Origens da geração: `exec-f8cf3bdb-d13c-4ff2-9147-60b630a855a4.png` e `exec-110b166b-d25d-474f-83d6-8bbf80f90a1a.png`, sessão `01a10fe9-e19e-7b40-bcf1-b6aab000cfe9`. Os parâmetros reproduzem a limpeza dos originais preservados; não prometem reproduzir a geração.



