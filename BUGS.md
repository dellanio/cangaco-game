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
- feature: ? — quebrou com o lote de sprites de prédio (`ec79428`, `59ff42e`), na
  revelação da F17g. O lote não tem chave própria. **Nenhuma chave foi virada.**
- severidade: errado (roteiro de aceite reprovando: F17e; F17f pelo mesmo motivo).
- **conferido 2026-09-28 — o defeito da tela está corrigido:**
  - `WorldScene.atualizarPredios` desenha o lote do placeholder (`desenharLote`) por
    baixo do corpo revelado; o instante do plantio já tinha o paliativo
    (`revelacaoDaObra` devolve `null` com `hp <= 0`).
  - F11c **verde**: o roteiro passou a ler a estrutura de madeira pelo canal da
    revelação (`revelacaoDasObras`, madeira > 0 e pedra = 0), com a pedreira
    afirmada com arte pelo manifesto. A "correção proposta" antiga (contar a obra
    revelada nos seis estágios) **não** foi aplicada: a F17g afirma o contrário
    ("a obra revelada nao pode contar nos seis estagios do fallback").
- **o que continua vermelho, e por quê — premissa de REGRA, não de número:**
  - F17e: "estes estagios nunca apareceram: [estrutura, paredes, cobertura]". Os seis
    estágios do fallback só existem para prédio **sem arte**, e hoje os 28 prédios do
    manifesto têm arte. O roteiro afirma uma regra que a arte nova deixou sem caso.
  - F17f: "'watchtower' ganhou entrada no manifesto: escolha outro predio sem arte".
    Não há outro: o lado do retângulo ("prédio sem arte vira retângulo") ficou sem
    prédio real para exercitar.
  - Decisão do operador (em `PROGRESS.md`, Perguntas em aberto): aposentar os dois
    roteiros, ou exercitar o fallback com um prédio cuja arte é tirada só no
    roteiro (manifesto filtrado na página). Os roteiros não foram mexidos.
- status: aberto (F17e, F17f), esperando a decisão.

---

## Polimento

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
- **conferido 2026-09-28, continua valendo:** `render/mapa.ts` `codigoDoRecurso` ainda
  devolve `codigoEsgotado` para quantidade ≤ 0, e `grapes` segue sem `terreno`.
- correção: é do render, com a sessão do render (instrução do operador, 2026-09-26).
  Dois caminhos, a decidir lá: um código de "em pousio" separado do "esgotado" para
  cultura (tipo com `aradura` em `resources.json`), ou o chão de roça desenhado sob
  tile de cultura.

