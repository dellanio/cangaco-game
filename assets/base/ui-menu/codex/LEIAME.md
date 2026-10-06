# Ícones do menu do Piancó

Gerados com a ferramenta nativa image_gen, uma chamada por ícone, com `transparent_background: true`. Referências abertas: `../referencia-subabas.png` e `../referencia-ferramentas.png`; usadas para orientação visual, sem anexá-las como entradas da geração. Não há integração no manifesto ou no código do jogo.

Reprodução: `node tools/limpar-icones-do-menu.mjs` a partir da raiz (Node e leitor PNG local, sem dependência nova).

O script exige cantos com alfa zero, preserva o fundo transparente gerado, descarta alfa inferior a 8 e componentes menores que 0,1% da maior componente, recorta a caixa da figura e reduz proporcionalmente por filtro de área com alfa premultiplicado. Centraliza em 64×64 com margem mínima de 3 px (maior no eixo curto para preservar proporção). Pictogramas recebem RGB exatamente #3a2416 nos pixels visíveis; o alfa suaviza as bordas. Rua preserva suas cores. Nenhum fundo branco ou xadrez é convertido artificialmente.

## subaba-vila

- Prompt usado (literal):

> Use case: stylized-concept. Asset: single standalone PNG menu icon for Pianco, to downsample to 64x64. Subject: a simple small house seen straight from the front, steep symmetrical gable roof with thick overhanging eaves, solid square walls, one central open doorway cut out as transparent negative space, no windows. Match the bold rustic woodcut pictograms in the provided sub-tabs reference: thick shapes, subtle handmade irregularity, strictly flat one-color dark brown #3a2416, no shading, no light outlines, no decoration. Center the single icon on a square genuinely transparent canvas, filling about 80 percent of the canvas. No text, letters, labels, border, background, checkerboard, shadows outside the figure, mockup or multiple variants. Reference images are for style only; do not reproduce the interface.

- Original sem recorte: `assets/base/ui-menu/codex/subaba-vila-original.png` (1254×1254).
- Final: `assets/sprites/ui/menu/subaba-vila.png` (64×64 PNG RGBA).
- Processamento: limpeza de ilhas pequenas, recorte por alfa, redução proporcional e centralização; cor única #3a2416 e bordas com alfa suave.

## subaba-comer

- Prompt usado (literal):

> Use case: stylized-concept. Asset: single standalone PNG menu icon for Pianco, to downsample to 64x64. Subject: one upright wheat ear with a thick central stem, six pairs of broad pointed grains alternating along both sides, one pointed grain at the top, bold compact silhouette. Match the bold rustic woodcut pictograms in the provided sub-tabs reference: thick shapes, subtle handmade irregularity, strictly flat one-color dark brown #3a2416, no shading, no light outlines, no decoration. Center the single icon on a square genuinely transparent canvas, filling about 80 percent of the canvas. No text, letters, labels, border, background, checkerboard, shadows outside the figure, mockup or multiple variants. Reference images are for style only; do not reproduce the interface.

- Original sem recorte: `assets/base/ui-menu/codex/subaba-comer-original.png` (1254×1254).
- Final: `assets/sprites/ui/menu/subaba-comer.png` (64×64 PNG RGBA).
- Processamento: limpeza de ilhas pequenas, recorte por alfa, redução proporcional e centralização; cor única #3a2416 e bordas com alfa suave.

## subaba-materia

- Prompt usado (literal):

> Use case: stylized-concept. Asset: single standalone PNG menu icon for Pianco, to downsample to 64x64. Subject: exactly two rounded irregular stones, one larger stone behind on the right and a smaller low stone in front on the left, distinguish stones with a narrow transparent gap, solid silhouettes. Match the bold rustic woodcut pictograms in the provided sub-tabs reference: thick shapes, subtle handmade irregularity, strictly flat one-color dark brown #3a2416, no shading, no light outlines, no decoration. Center the single icon on a square genuinely transparent canvas, filling about 80 percent of the canvas. No text, letters, labels, border, background, checkerboard, shadows outside the figure, mockup or multiple variants. Reference images are for style only; do not reproduce the interface.

- Original sem recorte: `assets/base/ui-menu/codex/subaba-materia-original.png` (1254×1254).
- Final: `assets/sprites/ui/menu/subaba-materia.png` (64×64 PNG RGBA).
- Processamento: limpeza de ilhas pequenas, recorte por alfa, redução proporcional e centralização; cor única #3a2416 e bordas com alfa suave.

## subaba-guerra

- Prompt usado (literal):

> Use case: stylized-concept. Asset: single standalone PNG menu icon for Pianco, to downsample to 64x64. Subject: exactly two short medieval swords crossed diagonally in an X, upward pointed wide blades and downward handles, thick crossguards, solid bold shapes. Match the bold rustic woodcut pictograms in the provided sub-tabs reference: thick shapes, subtle handmade irregularity, strictly flat one-color dark brown #3a2416, no shading, no light outlines, no decoration. Center the single icon on a square genuinely transparent canvas, filling about 80 percent of the canvas. No text, letters, labels, border, background, checkerboard, shadows outside the figure, mockup or multiple variants. Reference images are for style only; do not reproduce the interface.

- Original sem recorte: `assets/base/ui-menu/codex/subaba-guerra-original.png` (1254×1254).
- Final: `assets/sprites/ui/menu/subaba-guerra.png` (64×64 PNG RGBA).
- Processamento: limpeza de ilhas pequenas, recorte por alfa, redução proporcional e centralização; cor única #3a2416 e bordas com alfa suave.

## ferramenta-rua

- Prompt usado (literal):

> Use case: stylized-concept. Asset: single standalone PNG menu icon for Pianco, to downsample to 64x64. Subject: a small short vertical strip of cobblestone pavement seen directly from overhead, exactly six large irregular rounded paving stones in two columns and three rows, warm gray and sandy beige stones with dark brown earth joints, slightly hand-painted rustic texture, simple chunky details readable at 64px, isolated pavement strip with natural irregular outer edge, no wooden frame. Match the rustic warm palette of the provided tool-buttons reference, but draw only the pavement itself, in color. No surrounding button. Center the single icon on a square genuinely transparent canvas, filling about 80 percent of the canvas. No text, letters, labels, border, background, checkerboard, shadows outside the figure, mockup or multiple variants. Reference images are for style only; do not reproduce the interface.

- Original sem recorte: `assets/base/ui-menu/codex/ferramenta-rua-original.png` (1254×1254).
- Final: `assets/sprites/ui/menu/ferramenta-rua.png` (64×64 PNG RGBA).
- Processamento: limpeza de ilhas pequenas, recorte por alfa, redução proporcional e centralização; cores preservadas, seis pedras principais com juntas de terra.


