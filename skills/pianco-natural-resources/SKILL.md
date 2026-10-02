---
name: pianco-natural-resources
description: Criar terrenos, fontes exploráveis e recursos do Piancó com autotile ortogonal e estados de esgotamento.
---

# Terrenos e recursos

Não leia `brief-arte.md`, `GDD.md`, `docs/` ou skill arquivada. Carregue `../pianco-render-contract/SKILL.md` e `../pianco-sprite-tools/SKILL.md`. Use o [catálogo](references/catalogo-recursos.md) para os seis terrenos e fontes; confirme ids no dado/manifesto. Para mercadorias com id neutro, leia `data/theme-sertao.json` somente para nomes: `grapes` é **cana** e `wine` é **cachaça**, nunca parreira, uva, vinho ou taça. Não invente estoque ou receita.

Entrada: id, papel (terreno, fonte, item ou mercadoria), footprint, estágio, base/referência aprovada, tamanho, anchor, destino, licença/origem e distinção sem legenda.

## Progressão regional dos terrenos

As dez fases podem variar de caatinga mais verde e gramada a áreas do alto sertão mais secas, além de areia branca e terra roxa marrom escura na região litorânea descrita pelo operador. Não gerar gelo ou neve. Para estudos D, diferencie estrada de barro, areia branca e terra roxa pela cor, grão e cobertura vegetal sem trocar a luz mundial nem a escala do tile. A expressão terra roxa aqui designa marrom escuro avermelhado, não violeta saturado. São direções visuais; antes de integrar qualquer uma, confirme o mapeamento aos ids neutros do dado, ao sistema de estradas e às transições do render. Uma imagem quadrada isolada não prova tile repetível.
## Variante D aplicada ao terreno e aos recursos

Use a referencia D externa indicada pelo diretor somente para paleta, pincelada e material, nunca como molde de arquitetura ou de luz antiga. Se faltar a referencia, pare a geracao e reporte. Nao passe sprites atuais nem imagens historicas descartadas como referencia.

Terreno D deve parecer superfície contínua sob as unidades: detalhe distribuído sem ponto focal, borda ou sombra de contato em cada célula. A prévia isolada de um terreno é apenas estudo de estilo; não a registre como tile final até comprovar encaixe das 16 transições e matriz 3x3 sem costura em 0,5 / 1 / 2. Nos recursos isolados, reserve o anchor real e teste silhueta, oclusão e contraste sobre grama, areia e rocha, sem importar elementos de fachada de prédio.
Use pincel com grão e pressão variável; sulcos e hachuras discretas podem descrever material sem pintar sombra direcional no tile. Evite neon, plástico, linha digital lisa, vinheta e cantos arredondados de UI. Recurso com volume recebe a luz comum; terreno repetível não recebe moldura preta nem sombra projetada por célula.

O pipeline vigente usa 16 transições cardinais ortogonais e composição obrigatória **3×3 sem costura**, com bordas e cantos testados em várias vizinhanças. Para rocha/minério, planeje três estágios de esgotamento derivados da mesma base; toco de árvore fica com vegetação. Um id e até três estágios por lote. Teste contraste de **todo sprite de unidade e prédio** sobre texturas reais de grama, areia e rocha em 0,5 / 1 / 2; objeto deve ser identificável sem legenda. Registre no manifesto sem apagar estados e confira contato/validador/revisão independente antes de aprovação. Não altere regras de exploração.

## Albedo de terreno e transformações

O tile base contém só cor e material. Não pinte nele luz direcional, sombra projetada ou relevo de encosta; oclusão restrita a frestas do próprio material é permitida. Teste rotação de 90° e espelho sem mudar a leitura de luz. Distribua grão, capim baixo e manchas sem orientação luminosa fixa. O render planeja sortear rotações e espelhos de tiles para reduzir repetição; estradas e transições conectáveis não podem perder sua orientação de conexão. Qualquer luz de relevo virá do render. A proposta dual-grid para bordas está em avaliação, não altera as 16 máscaras cardinais vigentes.

## Luz e volume

Para recursos volumétricos, siga os quatro valores, deslocamento de matiz e luz fixa do pianco-render-contract; teste também tint 0,8 nos três zooms. Terreno base é albedo e não recebe essa pintura de luz. Transições suaves dentro do material são permitidas; proíbem-se gradiente de fundo, vinheta e brilho digital/plástico.

## Serra contínua e esgotamento localizado

Para rock, preservar uma formação geológica grande e conectada. Os tiles controlam a extração; não repetir uma pequena serra inteira em cada tile. Planejar cinco patamares de volume e ausência total em zero, com retirada local assimétrica, cristas baixando pelo topo, faces irregulares e apoio próprio. Manter câmera, escala, canvas e pivô; nunca reduzir escala, recentralizar o remanescente ou apagar a base deixando o topo suspenso.

Carregue references/pedra-modular.md para medidas do KaM, decisões do operador e portões de aprovação. As prévias de recortes e de12 mini-serras foram reprovadas para aparência. A prévia da serra contínua ainda é candidata: entulho, faces regulares e duas reprovações de luz permanecem pendentes. Não aplicar imagens da formação inteira ao consumidor rock1x1 nem alterar exploração sem item e aceite próprios. A regra de três estágios dos demais recursos permanece até decisão específica.
