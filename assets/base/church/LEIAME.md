# Igreja — I-ARTE-IGREJA (a igreja do sertão)

## Escopo
Entrega de arte, sem integração no manifesto ou captura em jogo. Homologação do operador pendente. Referência: `referencia-padaria.png`, 192×192; câmera oblíqua top-down 3/4, entrada sul, footprint pretendido 3×3, anchor [0.5, 1]. Sem pessoas, texto ou bandeira. Torre única à direita, sino, volutas, cruz, cal e telha cerâmica.

## Origem e prompts
Ferramenta nativa image_gen, transparência solicitada em ambas as chamadas. Originais preservados sem alteração, 1254×1254 RGBA. Não foi devolvida semente. Registro da geração: 01a11015-883f-7943-ad8a-10de5adcf0f1. Completo: exec-b230dbad-d0d4-4406-94ee-d97c8ab6cd1c.png. Madeira: exec-d4c8c4e1-95ed-4022-9ccb-5b5549b7dffc.png.

### Completo
Referência de estilo e régua: assets/base/church/referencia-padaria.png.

Use case: stylized-concept. Create ONE finished church game sprite using attached bakery as exact STYLE, CAMERA, SCALE reference only. Northeastern Brazilian sertao village chapel, rectangular whitewashed warm ivory plaster body, ONE bell tower on RIGHT of south front facade, bronze bell visible in opening, plaster scroll volutes on pediment, cross atop pediment, ceramic terracotta roof, arched wooden entrance facing SOUTH/down image, short irregular compacted-earth forecourt. No text, people, flags, vegetation or extra props. Painted pixel-art with textured carved brush marks matching bakery, not smooth 3D. Same oblique top-down three-quarter camera as bakery, roof/front/side visible on orthogonal square footprint, no diamond isometric tile. Same 3x3 footprint and occupied width as bakery. Single overhead light slightly from SOUTH, NO lateral east/west light; warm light, midtone, cool shade, crevice occlusion; short contact shadow only. Square canvas intended for 192x192 final. Building centered horizontally, bottom of short forecourt touches bottom edge, entire cross and tower fit. Real transparent alpha outside silhouette, no rectangular ground tile, no backdrop. Output only this complete church, not a sheet. Keep architecture compact to fit same scale as bakery.

### Madeira
Referência de edição: assets/base/church/completo-original.png.

Use case: precise-object-edit. Convert the attached finished church into its WOOD-ONLY construction state for the SAME RTS sprite. LOCK exact canvas, camera, position, scale, every outer architectural extent and ground baseline. Do not rotate, zoom, center differently or redesign. Replace white plaster walls and masonry including scroll pediment, cross, arch and RIGHT bell tower with bare wooden beams and scaffolding that trace their SAME shapes and extents. Replace ceramic roof and tower cap with wooden rafters and battens in their SAME roof geometry. Transparent open gaps between timber members, no plaster, no stone, no roof tiles, no bell, no finished wooden door. Wood skeleton alone, not brown recolored solid building. Keep SAME short earth forecourt pixels and outline at bottom, exactly aligned. Do not expand scaffolding beyond existing silhouette. Same painted pixel-art textured timber brush marks, same single overhead light slightly SOUTH, no lateral light. True transparent background. Output one wood-only church state at exactly same composition as input for bottom-up construction overlay.

## Limpeza determinística
Execute `node tools/limpar-igreja.mjs` a partir do repositório. Usa exclusivamente o codec local `skills/pianco-sprite-tools/scripts/png-rgba.mjs` para ler/escrever PNG, sem dependência nova. Não desenha arquitetura.

1. Mede a união dos retângulos alfa ≥128 dos originais: x=31..1233, y=12..1253.
2. Aplica a mesma escala uniforme (0.15458937198067632) e o mesmo deslocamento aos dois estados. Centraliza o envelope horizontal e encosta a base na borda inferior; não deforma os volumes nem recorta cada estado independentemente.
3. Reduz por média de área com RGB ponderado pelo alfa, preservando os vazios da armação.
4. Limita o alfa da madeira ao alfa do completo, para que a etapa pronta cubra a armação. Copia a faixa inferior do adro (y ≥1190 no original) do completo para madeira, mantendo o chão comum.
5. Zera pixels com alfa final menor que 16 e RGB fora do recorte, removendo franjas quase transparentes.

## Arquivos e dimensões
| Arquivo | Dimensões |
| --- | --- |
| assets/base/church/completo-original.png | 1254×1254 RGBA |
| assets/base/church/madeira-original.png | 1254×1254 RGBA |
| assets/sprites/church/completo.png | 192×192 RGBA |
| assets/sprites/church/madeira.png | 192×192 RGBA |

Ambos os finais compartilham canvas, transformação e base y=191, anchor pretendido [0.5,1]. O envelope comum ocupa aproximadamente 186 px de largura; a referência tem 189 px de largura opaca. Alfa zero: completo 10659 pixels, madeira 13194 pixels. Os finais foram abertos para inspeção visual. O script não garante identidade arquitetônica pixel a pixel de detalhes internos gerados; garante posicionamento comum, adro inferior compartilhado e contenção da armação. Luz e estilo foram avaliados visualmente, sem homologação em jogo. Nenhum teste, verify ou commit foi executado.

