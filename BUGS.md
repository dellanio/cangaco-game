# Bugs abertos

Só o que está aberto. Bug corrigido **sai deste arquivo no mesmo commit que o
corrige** — o histórico do git é o arquivo morto. Isso mantém o arquivo curto e
barato de carregar em toda sessão.

Registre com `/bug` ou edite à mão. Se não souber a feature, escreva `?`.

**Severidades e o que cada uma provoca:**
- `trava` — interrompe a fila do BUILD_PLAN; é a próxima coisa a ser feita.
- `errado` — vira a chave da feature para `false` em `test-results.json`.
- `feio` — vai para `## Polimento` e não bloqueia nada.

---

## Modelo

```markdown
## BUG-000 — resumo em uma linha
- feature: F##-nome
- severidade: trava | errado | feio
- repro: repro/AAAA-MM-DD-x.json (semente, tick)
- esperado: o que a regra diz que deveria acontecer
- observado: o que aconteceu
- evidência: screenshots/bug-000.png
- status: aberto
```

---

## Abertos

## BUG-M — a obra de prédio com sprite não desenha nada ao ser plantada
- feature: ? — quebrou com o lote de sprites de prédio (`ec79428`, `59ff42e`, na `main`
  pelo merge `f83f8a4`), na revelação da F17g. O lote não tem chave própria.
- severidade: errado (aceite escrito de roteiro reprovando: F11c e F17e). **Nenhuma
  chave foi virada:** qual feature responde é decisão do operador.
- repro: `npm run shot -- F11c` ou `-- F17e`, na `main`. Os dois plantam uma Pedreira.
- **medido (2026-09-26, noite 17), é o RENDER, e o roteiro só o acusa:**
  - a Pedreira (e o armazém, a escola, a taverna, o lenhador, a serraria) tem o par
    `madeira`/`completo` no manifesto, e `atualizarPredios` a desenha pela revelação
    da F17g, não pelo estágio (`WorldScene.ts`, `par === null || revelacao === null`);
  - com `hp = 0`, `revelacaoDaObra` devolve `{ madeira: [0,1], pedra: [0,1] }`
    (`estagio-obra.ts:108`), e `desenharRevelado` com numerador 0 devolve `[]`;
  - o canteiro com `tilesProntos: 0` e `oitavos: 0` também devolve `[]`;
  - o que sobra na tela é **só o medidor de material** — cinco quadradinhos de 8 px.
    Sem o contorno do lote e sem o nome, que o placeholder (`desenharPlaceholder`)
    desenha sempre, inclusive na marcação.
  - sonda (apagada): `obrasRenderizadas: 1`, `revelacao.p9 = {madeira:[0,1],pedra:[0,1]}`,
    `sprites.p9 = 'predio:quarry:madeira'`, `estagiosDeObraRenderizados` todo zero fora
    `completo: 2`. Screenshot aberto com Read: a obra é um borrão de quadradinhos no
    gramado, sem lote.
  - por que o roteiro reprova: obra revelada não entra em `estagiosDeObraRenderizados`
    (só em `revelacaoDasObras`), e F11c/F17e afirmam por estágio. O canal envelhecido
    do roteiro é consequência; o defeito que o jogador vê é o lote que sumiu.
- correção proposta (não aplicada — `src/render/` está com a outra sessão): a obra
  revelada desenha o lote do placeholder (contorno + nome/estágio) por baixo do corpo
  enquanto a revelação não cobre o chão, e continua publicando o estágio em
  `estagiosDeObraRenderizados`. Com isso F11c e F17e voltam a valer sem mudar asserção.
- F17f: **corrigido** no roteiro (premissa morta: a escola ganhou arte). O lado do
  retângulo passou para a obra de uma torre de vigia, o primeiro prédio sem arte que o
  jogador planta; o roteiro afirma pelo manifesto quem não tem arte.
- status: aberto (F11c, F17e). Espera o render livre e a decisão de quem responde.

---

## Polimento

## BUG-H — o sprite do armazém é isométrico e não preenche o footprint 3×3
- feature: F17f (o primeiro sprite real)
- severidade: feio
- repro: `npm run shot -- F17`, captura `screenshots/F17-5-final.png`; a base é
  `assets/base/storehouse/armazem_0{1,2,3}_*.png`
- esperado: top-down 3/4 sobre grid ortogonal (CLAUDE.md §4, GDD §9.3) — a base do
  prédio é um retângulo de arestas horizontais, como em `assets/base/woodcutters/`,
  e o prédio completo ocupa o footprint.
- observado: o chão do sprite é um losango ~2:1 (isométrico). Derivado a 192 px de
  largura, o completo cobre ~39 % do quadrado de chão; o resto do 3×3 fica vazio. A
  medida e a causa estão na nota de `origem` do armazém em `assets/manifest.json`:
  nenhuma escala concilia losango com footprint quadrado.
- correção: arte, não código. Refazer os seis estágios do armazém no ângulo da
  referência aprovada, pelo `docs/BRIEF-ARTE.md`. Nenhum teste reprova por isso
  desde `828a3d4`: trocar o armazém por seis estágios passou no `npm run verify`
  (teste de fumaça, 2026-09-26).
- nome: o operador chamava este defeito de "BUG-F"; esse id já é de outro bug,
  corrigido em 2026-09-24 (obra e estrada recusam recurso que bloqueia). Este é o H.
- evidência: a nota de medida em `assets/manifest.json` (entrada `storehouse`); e a
  captura `F17-5-final.png` aberta em 2026-09-26 num worktree descartável em
  `4a1b65d`, já apagado — rode o repro para ter a sua.
- status: aberto

Os três bugs de oscilação de tempo que moravam aqui (BUG-D na F-T1, BUG-E na F-T2b e,
antes deles, o BUG-001 na F09) saíram em 2026-09-24 com a regra que os dissolveu:
**medida de relógio é evidência da sessão, nunca asserção** — `CLAUDE.md` §8, decisão
do operador. A regra antiga daqui ("alargar o teto com o número medido") está **revogada**:
ela consertava a asserção em vez de perguntar se aquele eixo podia ser asserção.

## BUG-N — cana em pousio parece mato cortado
- feature: F-CANA-b (a mancha de cana da vila); o desenho é de `src/render/mapa.ts`
- severidade: feio
- repro: `npm run shot -- F-CANA-b`, captura `screenshots/F-CANA-b-1-abertura-com-a-cana.png`
- esperado: a mancha de cana nova se lê como roça esperando plantio, como o roçado do milho.
- observado: a cana nasce em pousio (`quantidadeInicial: 0`) e o render a pinta com o
  código único de ESGOTADO (`render/mapa.ts`, `codigoEsgotado`: "havia recurso") — o
  mesmo losango escuro da árvore cortada, sobre grama.
- causa: falta o chão arado que o milho tem. O milho em pousio fica sobre o terreno
  `campoArado` (marrom), derivado do mapa; a cana não tem terreno (`grapes` sem `terreno`
  em `resources.json`) e fica sobre `grama`, e aí o esgotado não tem contexto.
- correção: é do render, com a sessão do render (instrução do operador, 2026-09-26).
  Dois caminhos, a decidir lá: um código de "em pousio" separado do "esgotado" para
  cultura (tipo com `aradura` em `resources.json`), ou o chão de roça desenhado sob
  tile de cultura.

