# F-D2 — Navegação: setas, WASD e `Espaço` + arrastar

> Plano de implementação de um item já escolhido. O escopo e o aceite vêm do
> `BUILD_PLAN.md`, intocados (CLAUDE.md §11).

**Meta:** a câmera anda com o teclado, e o `Espaço` segurado vira arrasto que
funciona **com planta na mão**, sem plantar nada.

**Nota de integração (CLAUDE.md §10, escrita no item):** feature de integração —
toca `src/input/` e `src/render/`. **Não toca `src/sim/`**: câmera é render, e
nada disto entra no `GameState`.

---

## A decisão que organiza o resto

A F-D1 acabou de criar o **inventário** (`src/input/atalhos.ts`) e três guardas
que o cercam: toda tecla declarada tem que fazer alguma coisa, todo id tem que
ter rótulo no tema, e a tela de ajuda mostra o inventário inteiro.

Então as teclas novas **não podem** ser um `if` novo escondido. Elas entram no
inventário, e três coisas acontecem de graça:

- a tela de ajuda passa a ensinar seta, `WASD` e `Espaço` sem uma linha de `ui/`;
- o teste da F-D1 exige que elas façam algo de verdade;
- a tabela do GDD §2.2, que a F-D1 proibiu de copiar, é corrigida aqui.

É também o que faz o guarda "o inventário NÃO declara `' '`" precisar mudar: o
`Espaço` passa a existir — **para a câmera**, não para "pular para o último
alerta". Mudar a asserção sem mudar o mundo seria trapaça; aqui o mundo mudou, e
o GDD muda junto, no mesmo commit.

## Onde cada coisa mora

| arquivo | responsabilidade |
|---|---|
| `data/terrain.json` → `camera` | velocidade inicial, aceleração e **teto**. Nenhum número em `.ts`. |
| `tools/data-rules.js` | regra nova: o bloco `camera` tem que existir e ser coerente (teto ≥ inicial, tudo > 0). |
| `src/sim/data/types.ts` + `loader.ts` | `camera` viaja junto de `zoom`: dado de render, nenhum sistema de `sim/` lê. |
| `src/render/mapa.ts` | o funil. `configDoMapa.camera`. |
| `src/input/atalhos.ts` | as entradas `camera-mover` e `camera-arrastar`. |
| `src/input/navegacao.ts` **(novo)** | puro, sem DOM próprio (alvo injetado): quais direções estão seguras, qual a velocidade agora, o `Espaço` está apertado. |
| `src/render/scenes/WorldScene.ts` | consome: `update()` move o scroll; `pointermove` arrasta com `Espaço`; os handlers de clique **desistem** enquanto o `Espaço` está apertado; cursor; `preventDefault` do botão do meio. |
| `data/theme-sertao.json` | rótulos dos dois ids novos. |
| `docs/GDD.md` §2.2 | a tabela corrigida. |

### Por que um módulo próprio e não mais um `if` em `teclado.ts`

`teclado.ts` é *stateless*: recebe tecla, chama método. A navegação tem
**estado contínuo** — o conjunto de direções seguras e a velocidade que cresce
enquanto se segura. Isso é um objeto com ciclo de vida, e o que o torna
testável headless é a velocidade ser calculada por uma função pura de
`(velocidadeAtual, deltaMs, dados)`.

### A unidade da velocidade

`px de mundo por segundo`. A cena divide pelo zoom antes de somar ao scroll:
com o mapa ampliado 2×, o mesmo px de mundo cobre 2 px de tela, e sem a divisão
a câmera pareceria disparar. Em zoom 1 — o de toda captura — os dois coincidem,
e é sobre `scrollX`/`scrollY` que o roteiro afirma.

---

## Tarefa 1 — O dado, a regra do dado e o módulo puro

**Arquivos:** `data/terrain.json`, `tools/data-rules.js`, `src/sim/data/types.ts`,
`src/sim/data/loader.ts`, `src/render/mapa.ts`, `src/input/navegacao.ts` (criar),
`tests/F-D2-navegacao.test.ts` (criar).

1. Bloco `camera` em `data/terrain.json`: `velocidadeInicialPxPorSegundo`,
   `aceleracaoPxPorSegundo2`, `tetoPxPorSegundo`, com `_doc`.
2. `validarCameraDoTerreno` em `tools/data-rules.js`, ao lado da do zoom:
   existe, os três são números > 0, e `teto >= inicial` (teto abaixo do início
   faria "segurar" **frear**, que é o contrário do que o item pede).
3. `navegacao.ts`: `ligarNavegacao(alvo, dados)` devolve
   `{ avancar(deltaMs), espacoApertado, direcoesSeguras, desligar() }`.
   `avancar` devolve `{ dx, dy }` em px de mundo e é onde a velocidade cresce.
4. Testes: seta sozinha, duas setas (diagonal), `WASD` idêntico a seta, soltar
   zera a velocidade, segurar acelera **até o teto e para lá** (afirmação de
   igualdade com o dado importado, nunca com número digitado), Ctrl+seta não
   move, e `preventDefault` em seta e `Espaço`.

**Pronto quando:** `npx vitest run tests/F-D2-navegacao.test.ts` verde e
`npm run validate:data` verde.

## Tarefa 2 — O inventário, o tema, o GDD e a cena

**Arquivos:** `src/input/atalhos.ts`, `data/theme-sertao.json`,
`tests/F-D1-ajuda.test.ts`, `docs/GDD.md`, `src/render/scenes/WorldScene.ts`,
`src/render/debug.ts`, `src/main.ts`.

1. Duas entradas novas no inventário, grupo `camera`: `camera-mover`
   (setas + `WASD`) e `camera-arrastar` (`Espaço`).
2. Rótulos no tema. A tela de ajuda **não muda**: ela já monta do inventário —
   e o roteiro da F-D1, rodado de novo, é quem prova que passou a ensiná-las.
3. `tests/F-D1-ajuda.test.ts`: a bancada passa a ligar o terceiro ouvinte, a
   tabela do "coisa dele" ganha as duas linhas, e `' '` sai da lista de teclas
   prometidas-e-inexistentes **com o comentário do porquê**.
4. GDD §2.2 reescrito: o que existe, marcado como existente; o que é proposta,
   marcado como proposta; `Espaço` é da câmera e "pular para o último alerta"
   fica sem tecla (decisão do operador, turno H).
5. `WorldScene`: `update(_, deltaMs)` soma `avancar()` ao scroll dividido pelo
   zoom; `pointermove` arrasta se `Espaço` **ou** botão do meio; os três
   handlers de clique desistem com `Espaço` apertado; cursor `grab`/`grabbing`;
   `preventDefault` no `mousedown` do botão do meio.
6. `debug.ts`: `navegacao: { espacoApertado, velocidade }` para o roteiro
   afirmar sem olhar pixel.

**Pronto quando:** `npm run typecheck`, `npm run lint` e `npm run test` verdes.

## Tarefa 3 — O roteiro, as sondas e o aceite

**Arquivos:** `tools/shots/F-D2.js` (criar).

Um passo por perna do aceite:

1. seta move na direção certa (afirma `scrollX`/`scrollY` publicados);
   segurar por N ms anda mais do que N toques — e a velocidade publicada nunca
   passa do teto do dado;
2. as quatro bordas continuam com o clamp da F04 (vai até o canto e o scroll
   não passa de `larguraPx - largura da vista`);
3. **`Espaço` + arrastar com a pedreira na mão: a câmera anda e nenhum prédio
   nasce** (conta os prédios antes e depois);
4. `Espaço` com um botão do menu focado: não planta, não rola a página, e o
   botão não dispara (`aria-pressed` intacto);
5. o passo do arrasto roda **despausado** (CLAUDE.md §8): é interação com o
   canvas e com o menu, e o `mousedown`/`mouseup` separados são o ponto.

Depois: sonda de que o roteiro acusa (inverter o sinal de uma direção na cena e
ver o passo 1 reprovar, restaurar por checksum), `npm run verify`,
não-regressão por código de saída em `F04`, `F18a`, `F06`, `F-D1` (`F22` falha
no BUG-C conhecido), chave em `test-results.json`, `PROGRESS.md`, commit.
