# D-ARTE-SOLO-CAATINGA — solo de caatinga e decalques de capim

Contrato: BUILD_PLAN.md, aceite e emenda 5 de 6c9c710. Orçamento conjunto: 4 gerações nativas. Referências de geração: somente candidatas D limpas da PR #1; nunca contatos com arte atual ou assets de 1998. Luz cdcfec5: albedo no solo; luz vertical levemente sul nos volumes.

## Geração 1/4 — solo

- PNG: `D:\projetos-pessoal\cangaco-game-candidatos\arte\D\solo-caatinga\generation-01-raw.png`.
- SHA-256: `29cf98404a8936bb1193544c0227d7ddf97527397b87c74d1c2113c5a39822f9`.
- Referência: `D:\projetos-pessoal\cangaco-game-candidatos\arte\D\storehouse\generation-02-raw.png`, somente material e pincelada, sem herdar luz.
- Prompt: textura quadrada grande seamless de albedo, caatinga no começo da seca, terra clara bege quente de grão fino, pouquíssimas manchas discretas mais escuras e fragmentos miúdos de folha seca. Sem capim, pedra, rachadura, elemento marcante, luz direcional, sombra projetada, vinheta ou gradiente. Material pintado à mão, contraste baixo e uniforme, girável e espelhável. Nenhum objeto da referência nem asset de 1998.
- Resultado: imagem preservada; inspeção inicial compatível com direção. Ainda não aprovada: falta corte, conta de emenda/neutralidade e contato.
- Medição: melhor busca encontrada, razão de emenda 1,332479 > 1,3; desvio 17,56–17,97 > 16,289071. Reprovado, não integrado. Relatório externo `solo-caatinga/metrics.json`.

## Geração 2/4 — folha de capim

- PNG: `D:\projetos-pessoal\cangaco-game-candidatos\arte\D\capim\generation-02-raw.png`.
- Referência: `D:\projetos-pessoal\cangaco-game-candidatos\arte\D\serf\generation-02-raw.png`, somente pincelada/material.
- Prompt: exatamente dez tufos baixos de capim em folha transparente RGBA 5×2, cinco palha em cima e cinco verde-oliva embaixo. Camera top-down 3/4, pé central inferior, silhuetas pequenas de folhas curtas e curvadas, largura final 16–32 px. Luz de cima levemente sul sem eixo leste-oeste, sombra de contato curta, sem chão, pedra, flor, legenda ou grade. Pintura manual relativamente realista e legível após redução. Nenhum asset de 1998.
- Resultado: folha preservada, pendente de recorte e validação técnica independente.
- SHA-256: `41b02f9589e700c6755ae270f6527f19c05db488e263870eb57302bcddaacf95`.
- Validador: reprovou os dez estados por luz sul invertida (delta -17,7 a -44,8). Não integrado; relatório em `capim/validation/report.json`.
- Próximo passo: solo mais homogêneo de grão fino, sem manchas grandes. Restam 2 gerações conjuntas.

## Geração 3/4 — solo de grão fino homogêneo

- PNG: `D:\projetos-pessoal\cangaco-game-candidatos\arte\D\solo-caatinga\generation-03-raw.png`.
- Referência: mesma candidata D limpa de storehouse da geração 1.
- Prompt: albedo quadrado seamless de terra clara bege da caatinga, microgrão homogêneo pintado à mão e contraste extremamente baixo (~6%). Sem manchas nebulosas grandes, pedras, capim, rachaduras, focos, luz direcional ou sombras; somente raríssimos fragmentos miúdos de folha seca na mesma faixa de cor. Referência só de material, sem objeto copiado, sem asset de 1998.
- Resultado: preservado, pendente da conta de emenda e luminância. Próximo passo: corrigir folha de capim na última geração conjunta.
- SHA-256: `6882028f00279bcd36a0a249262f26af414ad19ad974373a2e6ded566dc6194b`.
- Conta dos quatro recortes: emenda máxima 1,229414 (teto 1,3); desvios de luminância 15,533530 / 15,559655 / 15,698455 / 15,622839 (areia 10,859381 × 1,5 = 16,289071). Passa na conta; ainda falta prova visual. Corte após redução NEAREST para 768×768, sem pintar ou corrigir bordas.

## Geração 4/4 — capim com luz sul corrigida

- PNG: `D:\projetos-pessoal\cangaco-game-candidatos\arte\D\capim\generation-04-raw.png`.
- SHA-256: `06bea9bae72150e18b49c3f84a0cdc032ae24e3123fb7d67e7e4383826951c60`.
- Referência: mesma candidata D limpa de serf da geração 2, somente pincelada/material.
- Prompt: folha RGBA transparente com dez tufos baixos isolados em 5×2, cinco palha e cinco oliva, folhas curtas finas curvadas, câmera top-down 3/4. Luz única de cima levemente sul, sem eixo leste-oeste: planos inferiores/frontais claros, traseiros superiores mais escuros e oclusão mínima no pé. Nenhum chão, objeto, legenda, grade ou asset de 1998. Largura final 24–32 px.
- Recorte: 10 PNGs 32×24, masters 64×48. Alfa original preservado, margem transparente de 1 px; pé na última linha útil inferior. Bleed técnico altera somente RGB dos pixels de alfa zero, sem pintar arte.
- Validador pianco-sprite-tools: exit 0, dez estados sem erro em `mode: trial`. Isso prova técnica; não equivale a calibração cromática homologada pelo operador.
- Contato: `D:\projetos-pessoal\cangaco-game-candidatos\arte\D\solo-caatinga\contact-6x6-capim-zooms.png`, grade 6×6 com 11/36 tiles ocupados (30% arredondado), zooms 0,5 / 1 / 2, ao lado de areia e água atuais. Contato nunca é referência de geração.
- Orçamento encerrado: 4/4 chamadas. Nenhuma geração adicional autorizada.

## Prova final da arte

- Revisão independente pelo agente `revisao_arte`: solo, folha final e contato composto abertos. Direção, luz, escala e repetição passam; sem emenda ou halo perceptível no contato. Não equivale a homologação cromática do operador.
- O revisor detectou margem inferior variável; corrigida por deslocamento inteiro do RGBA. Agora todos os dez PNGs terminam em y22 (alfa ≥128), com y23 e as demais bordas em alfa0. Validador executado novamente: success=true, errors=[].
- Integrados somente solo da geração 3 e capim da geração 4. Gerações 1 e 2 permanecem candidatas reprovadas fora do repositório. Base, masters, derivados, contato e conta preservados nos caminhos do contrato.
- Prompts completos e scripts de recorte/medição/contato preservados ao lado das candidatas externas. Nenhum processamento pinta arte raster.
