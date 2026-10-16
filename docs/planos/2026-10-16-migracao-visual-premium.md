# Migração para o visual premium (branch `cangaco-game-3d`)

Pedido do operador (2026-10-16): subir o jogo ao padrão da imagem de referência (RTS pintado, luz de fim de tarde,
interface escura com retratos e barra de comandos), estruturar a migração e começar um teste dos pontos 1 (interface) e
2 (luz e sombra) para ele ver um exemplo. A branch fica separada da `main` até o operador decidir.

## O que a imagem de referência é, e o que não é

Ela é uma **ilustração pintada**, não um quadro de jogo 3D. O que faz ela parecer premium, medido peça por peça:

| Elemento | Hoje no jogo | Quem faz |
|---|---|---|
| Interface escura embaixo, retratos da tropa, botões de comando, minimapa com moldura | barra lateral de pergaminho | **código** (HTML/CSS) |
| Recursos numa faixa no alto | já existe (`#barra-rapida`), pequena | **código** |
| Objeto "assentado" no chão (sombra de contato) | sprites sem sombra no chão | **código** (render) |
| Cor quente de fim de tarde, vinheta | cor crua dos sprites | **código** (pós-processo do Phaser) |
| Sombras longas laterais | luz de cima, levemente do sul (decisão de 2026-10-01) | **decisão do operador** |
| Muita vegetação e pedra espalhada, chão variado | moderado | código + arte existente |
| Prédios e unidades pintados com muito detalhe, em resolução alta | sprites de 64 px por tile | **arte nova** (ferramenta) |

A simulação (`src/sim/`) não muda em nenhuma fase: o visual é só render e interface (CLAUDE.md §3).

## Fases

### Fase 0 — protótipo atrás de `?premium` (esta branch, agora)
Tudo ligado só com `?premium` na URL; sem ele, o jogo é byte a byte o de hoje e os roteiros existentes não mudam.
- **P1, interface:** a barra de baixo da tropa selecionada, com o retrato de cada soldado (recortado do sprite que já
  existe), a barra de vida e os comandos que o jogo já tem (os mesmos botões do painel do grupo). A faixa de recursos
  do alto maior, com os ícones grandes. Nenhum comando novo.
- **P2, luz:** sombra de contato sob prédios, árvores, recursos e unidades (uma elipse escura e suave no pé, do tamanho
  do objeto); gradação de cor quente e vinheta na câmera.
- **Evidência:** a mesma vista com e sem `?premium`, lado a lado.

### Fase 1 — direção de arte (decisões do operador)
1. **A luz:** a referência tem sol baixo e lateral; o projeto fixou luz de cima, levemente do sul (2026-10-01). Sombras
   longas só fazem sentido se essa decisão mudar, e mudar a luz pede repintar toda a arte.
2. **A resolução:** hoje 64 px por tile. O padrão da referência pede 96 a 128 px por tile para o detalhe aparecer, o que
   pede arte nova em tudo.
3. **A ferramenta de arte:** testar o Scenario (modelo treinado com ~20 artes nossas) contra o Codex atual, com a mesma
   peça (a Bodega e um cangaceiro), e escolher pela consistência entre peças.
4. Um **guia de arte** (paleta, luz, proporção, contorno) que todas as ferramentas seguem, ao lado das skills
   `pianco-*` que já existem.

### Fase 2 — interface premium inteira
- Layout novo: faixa de recursos no alto, mundo no meio, painel embaixo (minimapa, seleção, comandos); a barra lateral
  de construção vira uma gaveta. Responsivo de 1280x720 a 3440x1440.
- Retratos pintados por tipo de unidade (arte nova, um por tipo).
- Todos os roteiros de tela que clicam no painel são revistos (eles medem posição de botão).

### Fase 3 — render
- Sombras de contato em tudo, pós-processo final (cor, vinheta, um bloom leve), vegetação mais densa e variação do chão
  com a arte que já existe.
- Medida de custo do quadro (`custo-do-quadro.ts`) antes e depois: o orçamento é o do mapa de 192x192.

### Fase 4 — arte em alta resolução
- Prédio por prédio, no pipeline de sempre (base canônica em `assets/base/`, derivado em `assets/sprites/`).
- Unidades: o caminho 2,5D (modelo 3D gerado por imagem, Meshy/Tripo/Hunyuan3D, renderizado nas direções e quadros do
  jogo com a luz do projeto) dá animações consistentes; a alternativa é gerar os quadros por IA a partir da base.
- Ordem: o que mais aparece primeiro (casa, armazém, bodega, serf, obreiro, cangaceiro).

### Fase 5 (opcional) — 3D em tempo real
Trocar o Phaser por Three.js ou Babylon só na camada `src/render/`. A sim, a interface HTML e os comandos ficam.
Pede modelos 3D de tudo (prédios, unidades com esqueleto, terreno, vegetação). É a fase mais longa e só faz sentido
se a Fase 4 mostrar que o 2D pintado não chega aonde o operador quer.

## Riscos
- **Desempenho:** sombra por objeto e pós-processo custam GPU; medir no mapa de 192.
- **Consistência:** arte de ferramentas diferentes destoa; por isso a Fase 1 vem antes da 4.
- **Roteiros de tela:** o layout novo da Fase 2 quebra os roteiros que medem posição; a Fase 0 evita isso ficando
  atrás de `?premium`.
