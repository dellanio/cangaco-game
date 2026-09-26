# Contrato visual do Piancó

## Linguagem comum

- Mundo: pintura 2D detalhada de RTS, top-down 3/4 sobre grid ortogonal.
- Tema: sertão nordestino ficcional, sem pessoa ou episódio histórico real.
- Paleta: terra, ocre, telha, cal, algodão cru, verde seco, madeira e couro do `theme-sertao.json`.
- Luz: superior esquerda; sombra curta para baixo e direita.
- Contorno: marrom-preto sutil, nunca preto puro ou brilho digital.
- Escala: um civil mede aproximadamente uma porta; um objeto de recurso ocupa visualmente um tile, podendo transbordar sem alterar footprint.

## Terreno

- Saída derivada: 64×64 opaca.
- Perspectiva: textura quadrada vista de cima; não inclinar o tile nem desenhar losango.
- Bordas: contínuas nos quatro lados. Sem moldura, guia, vinheta, sombra global ou objeto focal.
- Variação: detalhe de baixa frequência. Unidades, prédios e grid precisam continuar legíveis.
- Água: tile cheio sem margem ou barranco; transições são outro asset.
- Campo arado: sulcos discretos compatíveis com a direção definida pela arte, sem mudar a regra do tile.

## Vegetação e recursos

- Fundo RGBA transparente e sem halo retangular.
- Âncora `[0.5, 1]`; contato com o chão no centro inferior.
- Derivados padrão: 96×128 para árvore, cacto e afloramento; 64×64 para recurso baixo.
- Silhuetas prioritárias: juazeiro, umbuzeiro, mandacaru, xique-xique, facheiro e macambira.
- Pedra: granito quente, faces coerentes com a luz, sem piso quadrado embutido.

## Prédios

- Largura derivada = `footprint.x × 64`.
- Âncora inferior central; fundo transparente; sem cenário, mercadoria ou trabalhador incorporado.
- Taipa, madeira aparente, reboco caiado e telha colonial; função reconhecível pela arquitetura.
- Gere o completo primeiro. Estágios de obra derivam da mesma base e do mesmo recorte.

## Unidades

- Fundo transparente; pés alinhados; escala constante entre ofícios.
- Roupa de algodão cru e couro. Item de ofício visível sem exagerar a silhueta.
- Direções usam a mesma identidade e proporção; oeste pode espelhar leste quando o render permitir.

## Interface

- Componentes vistos de frente: madeira envelhecida, pergaminho cru, tinta escura e rebites.
- Centros devem permanecer livres para texto e ícones vivos.
- Evite sombras macias de interface moderna, neon, plástico e cantos excessivamente arredondados.
- Peça esticável precisa preservar cantos; prefira recorte ou nine-slice a deformação integral.
