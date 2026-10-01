---
name: pianco-vegetation
description: Criar vegetação da caatinga do Piancó com espécie legível, escala controlada e anchor nos pés.
---

# Vegetação

Não leia `brief-arte.md`, `GDD.md`, `docs/` ou skill arquivada. Carregue `../pianco-render-contract/SKILL.md` e `../pianco-sprite-tools/SKILL.md` para paleta, dimensões, caminhos e validação.

Entrada: id, espécie, porte, footprint, estágio, base/referência aprovada, anchor, destino, origem/licença e critério de leitura. Prioridades: **juazeiro, umbuzeiro, mandacaru, xique-xique, facheiro e macambira**. Juazeiro e umbuzeiro são árvores; macambira é bromélia. Confirme mapeamento dos ids no dado/manifesto antes de nomear um asset.

## Variante D aplicada à vegetação

Use a referencia D externa indicada pelo diretor somente para pincelada, paleta e volume, nunca para direcao antiga da luz ou geometria arquitetonica. Se faltar a referencia, pare a geracao e reporte. Nao use sprites atuais nem imagens historicas descartadas como referencia. A arvore precisa continuar reconhecivel pela especie e silhueta, sem telhas, contorno arquitetonico ou objetos de edificios.

A variante D pede pintura manual rica e relativamente realista: casca com fissuras, galhos e folhas em massas de tamanho legível, poeira e irregularidade própria da caatinga. Detalhe fino só entra onde sobreviver à redução 2x para 1x e ao zoom 0,5; simplifique miudeza que vire ruído ou moiré. Use arestas seletivas mais escuras que o material, sem contorno preto uniforme nem campo denso de hachuras xilográficas. Cada material tem luz, meio-tom, sombra própria e oclusão; no mínimo três níveis devem ser legíveis em 0,5. Permita transições suaves pintadas dentro do material, com sombra levemente deslocada de matiz, e mantenha a luz mundial de cima, levemente do sul, sem componente leste-oeste. Projete sombra interna da copa sobre tronco/galhos e marque profundidade nos encontros de ramos, preservando vazios e o pé central inferior para ordenação. Sombra de contato curta; nenhuma base de chão em losango nem grama permanente fundida ao sprite da árvore. Valide a leitura da copa e a visibilidade do lenhador na cena de mata prevista no contrato.
Use pincel de grão variável; sulcos e hachuras apenas como marcas discretas do material nas sombras, sem campo xilográfico dominante. Evite linha digital lisa, neumorfismo, neon, plástico, vinheta e cantos arredondados de UI. Luz de cima levemente do sul, sem eixo leste-oeste, e sombra de contato até ~4 px no derivado 1×. Grid ortogonal, base quadrada e anchor nos pés.

A arvore adulta grande `tree` usa 192x256 no derivado e 384x512 no master apos decisao do operador em 2026-10-01, com pivo nos pes. Os outros estados do mesmo id mantem porte visivel e ganham somente margem transparente no quadro compartilhado. Mandacaru ~110 px, facheiro ~96 px, xique-xique ~80 px, macambira e arbusto ~44 px seguem hipoteses para conferir no jogo. Faca piloto de mata com lenhador em 0,5 e 1 para conferir profundidade e copa sobre unidades.

Um id e até três variações/estágios por lote; árvore explorada deriva em toco da mesma base. Registre as variações no manifesto sem perder estados existentes. Inspecione 0,5 / 1 / 2 sobre grama, areia e rocha, passe no validador e revisão independente. Não altere colisão ou gameplay para adaptar o desenho.

## Variação por instância e decalques

Árvores, cactos, arbustos e pequenos decalques precisam manter coerência após escala de 0,9 a 1,1, espelho horizontal e variação moderada de tom aplicadas pelo render por instância. Não pinte luz lateral ou assimetria de sombra que se inverta ao espelhar. Preserve anchor no pé para profundidade; confira o sprite transformado e também sob tint 0,8 em 0,5 / 1 / 2.

Planeje uma biblioteca de aproximadamente 10–20 decalques pequenos da caatinga para posicionamento fora do grid: tufo seco, seixo, rachadura, gravetos e folha de mandacaru caída, com variações úteis de silhueta e cor. Cada PNG isolado tem fundo transparente, anchor no pé e pouco peso visual; não embuta um quadrado de terreno. O planejamento não autoriza gerar a biblioteca nesta rodada.

## Luz e volume

Siga os quatro valores, deslocamento de matiz e luz fixa descritos em ../pianco-render-contract/SKILL.md. Transições suaves de luz e sombra são permitidas dentro de cada material; proíbem-se apenas gradiente de fundo, vinheta e brilho digital/plástico. Mantenha pelo menos três níveis legíveis no zoom 0,5 e sombra interna projetada quando houver elemento que a cause.
