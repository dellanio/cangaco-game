---
name: pianco-units
description: Criar unidades do Piancó em oito direções com escala, pivô, máscara de facção e estados consistentes.
---

# Unidades

Não leia `brief-arte.md`, `GDD.md`, `docs/` nem a skill arquivada. Carregue `../pianco-render-contract/SKILL.md` e `../pianco-sprite-tools/SKILL.md`. Use o [catálogo](references/catalogo-unidades.md) para os 14 civis, 9 militares e 5 mercenários; confira o id no dado e manifesto. Cores, dimensões, caminhos e zooms vivem só no contrato.

Entrada: id, classe, função, silhueta, equipamento, estado, oito direções, tamanho, anchor, master/referência aprovada, destino, orçamento, licença/origem e leitura esperada a 0,5. `serf` é régua humana H=73 px e primeiro piloto. Arte pintada manualmente com grão, sulcos de formão, hachuras seguindo tecido/couro, volume conforme variante aprovada; sem linha digital lisa, neumorfismo, neon, plástico, gradiente de fundo, vinheta ou brilho digital/plástico. Luz do mundo de cima, levemente do sul, sem eixo leste-oeste; sombra curta separada. Evite pessoa real ou episódio histórico.

Direções lógicas N, NE, E, SE, S, SW, W, NW. Autorize cinco direções canônicas N, NE, E, SE, S; W é espelho de E, NW de NE e SW de SE no render, como já permite o fallback atual. Espelhe quadros, máscara de facção, equipamento e efeitos presos ao corpo juntos. Verifique identidade e legibilidade dos detalhes assimétricos. Idle tem 4 quadros, walk 8, attack 6, work 6 apenas civis e die 6, a 10–12 fps. Corpo caído, se consumido, deriva da mesma unidade. Lote: uma unidade, um estado e oito direções lógicas, com orçamento explícito antes de gerar. Preserve roupa, rosto, equipamento, linha dos pés e proporção. A luz relativa aos planos do corpo muda com a orientação norte/sul, mas não cria diferença lateral entre pares espelhados. Facções compartilham base; máscara em cinza de lenço grande + faixa na cintura ou chapéu segue os mínimos do contrato e deve continuar visível a 0,5.

Após a etapa 0, compare no `serf`: (A) 2D nativo com folha aprovada; (B) conceito 2D aprovado → Meshy/Tripo img→3D → auto-rig → Blender só para câmera ortográfica 3/4, luz fixa e render 2× das cinco direções canônicas e espelho das três direções oeste; redução 1× e revisão das oito direções lógicas. Não modele geometria por código. Após atualizar o validador para esta luz e o espelho, julgue primeiro pelo validador; depois faça comparação cega a zoom 1 junto de prédio aprovado. Reporte ambos e pare para decisão do operador. O 3D não se aplica a prédios, vegetação nem recursos. Inspecione ainda 0,5 e 2 sobre três terrenos, nas versões normal e escurecida por tint 0,8. Nenhum estado aprovado sem validador e revisão independente. Não altere IA ou gameplay.

## Luz e volume

Siga os quatro valores, deslocamento de matiz e luz fixa descritos em ../pianco-render-contract/SKILL.md. Transições suaves de luz e sombra são permitidas dentro de cada material; proíbem-se apenas gradiente de fundo, vinheta e brilho digital/plástico. Mantenha pelo menos três níveis legíveis no zoom 0,5 e sombra interna projetada quando houver elemento que a cause.
