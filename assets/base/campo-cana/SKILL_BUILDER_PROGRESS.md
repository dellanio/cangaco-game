# D-ARTE-CHAO-DE-ROCA — campoCana

Gerações gastas: **2 de 4**. Produção escolhida: geração 02, id `imagegen:exec-78f1200e-09ce-4115-ab13-fd11554eae50`. A geração 01 (`imagegen:exec-14bdc364-15ba-406f-8b6f-a9eaab5664d6`) foi descartada porque os sulcos eram pouco legíveis na escala 64×64.

Referências de comparação: `assets/sprites/terrain/grama-D-v0.png`, `assets/sprites/terrain/campo-arado.png` e `assets/sprites/resources/grapes-D.png`. Não foi usada referência do jogo de 1998. Luz conforme `cdcfec5`: material de terreno sem luz direcional nem sombra projetada; relevo e oclusão só nas frestas do solo.

Prompt 01: “Square, top down view of bare prepared sugarcane field soil, as a seamless material study: warm medium brown and ochre broken earth, subtly curving widely spaced planting furrows and shallow dark fissures, a few dry straw bits, irregular low organic grain. Terrain albedo only, no object, no cane plants, no grass tufts, no shadows cast by objects, no directional lighting, no vignette, no border, no text, no game UI. Hand painted pixel art texture with crisp irregular clusters, matching a muted earthy palette. The furrows must remain visually distinct from tightly repeated straight horizontal furrows of a plowed corn field.”

Prompt 02: “Overhead orthogonal square view, muted tawny brown prepared sugarcane soil. Three or four broad, irregular planting furrows cross the earth diagonally in gentle bends, broken by small clods, ochre highlights and umber cracks. Organic hand painted pixel clusters. Entire square filled edge to edge by just soil, designed for seamless tiling. Distinct from a corn field's tight straight horizontal parallel lines and distinct from grass. No plants, no blades, no objects, no cast shadow, no directional illumination, no border, no vignette, no letters, no interface. Earth material albedo.”

Base e derivados: `generation-02-raw.png` → `derive.py` → quatro masters 128×128 e quatro PNG 64×64 em `assets/sprites/terrain/`. A derivação constrói bordas periódicas comuns e varia discretamente o interior. A folha `campo-cana-contact.png` mostra grade 4×4, cana e vizinhos em zooms 0,5/1/2, normal e RGB×0,8. O validador da `pianco-sprite-tools` retornou `success: true`, `errors: []` para as quatro variantes em modo `trial`; a calibração cromática por folha aprovada ainda não está disponível.

| PNG | SHA-256 |
| --- | --- |
| generation-01-raw.png | E9DA84C85E83E921C34B38CBB5F7303CEB74CE05A94D0A456089B0E79CE32EC6 |
| generation-02-raw.png | E2914A1FEB6B010F39DB52E408BC040D1424332AFFB6EAB03C62AC2C13085DDD |
| campo-cana.png | 8CE9F3DB6F1CD21D262F84A67BED58E453425CE06F0C3D482035B34CC6A5163F |
| campo-cana-v1.png | F035A20061952FB41A400557A862F648021668BC7DC550C045F770906BA550D2 |
| campo-cana-v2.png | 37487DDF28C70DE696F6514B9A5ED88789B45BDB8065BCC5EA9B6F6D3E1907FD |
| campo-cana-v3.png | 0B920CAB73E6043539FC7CC042051BD36CFB5F16E41682E5DCCCBD2471FBCE7D |
