# F-T3 — O especialista sai do prédio (plano de implementação)

> Plano pedido pelo operador **antes da execução** (BUILD_PLAN.md, item F-T3,
> 2026-09-24). Nenhuma linha de código de F-T3 foi escrita. As três perguntas que
> ele mandou responder estão respondidas abaixo, com o arquivo e a linha que
> sustentam cada resposta.

**Objetivo:** o pedreiro sai da pedreira, anda pelo A* até uma aproximação do
tile de rocha reservado, lavra lá o ciclo inteiro, volta à porta e só então a
pedra entra na gaveta — e todo predicado que lê `ocupante` continua dizendo que
a pedreira tem trabalhador.

**Arquitetura:** três estados novos na FSM que já existe (`indo_colher`,
`colhendo`, `voltando`), nenhum campo novo em `GameState`, nenhum evento novo,
nenhum número novo em `data/`. A posse continua morando só em
`PredioCompleto.ocupante`; o relógio do ciclo continua morando só em
`predio.producao.progresso` — o que muda é **onde** a unidade está enquanto ele
anda. O tile continua sendo uma `TarefaColher` do JobBoard, e a colheita continua
acontecendo no `depositar`.

**Stack:** TypeScript estrito em `src/sim/` (zero phaser), Vitest, Playwright
para a captura.

**Spec:** `BUILD_PLAN.md:1924-1978` (item F-T3, com a nota herdada da F18, o
resíduo do milho medido no BUG-F e a nota de integração §10).

## Restrições globais (valem para toda tarefa)

- `src/sim/` não importa `phaser`, não usa `Math.random()` nem `Date.now()`.
- Toda duração em ticks; nenhum número de balanceamento em `.ts`.
- `GameState` serializável: `fsmData` só com string, número e array de tiles.
- Uma tarefa reclamada sempre tem ramo de `release` — inclusive nos ramos de erro
  novos (sem caminho de ida, sem caminho de volta, prédio demolido no meio).
- Não desativar teste, regra de lint ou verificação para passar. Teste que quebra
  por mudança de comportamento se **reescreve mais estrito**, no passo da tarefa
  que mudou o comportamento.
- `npm run verify` verde antes de qualquer escrita em `test-results.json`.

---

## As três perguntas que a FSM obriga

### 1. O especialista fora conta como ocupante para o alerta da F22?

**Sim, e sem código novo.** Medido: `src/sim/selectors.ts:614` deriva a causa
como `ehPredioOcupavel(predio, dados) && predio.ocupante === null`, e a posse mora
**só** em `PredioCompleto.ocupante` (cabeçalho de `src/sim/systems/especialistas.ts`).
A FSM nova **não devolve a posse ao sair**: o prédio segue apontando para o
pedreiro enquanto ele anda, então `sem-trabalhador` continua calado. Semântica
certa — o prédio não está vago, o trabalhador está fora; "não há quem trabalhe
aqui" mandaria o jogador treinar um pedreiro que não falta.

O que a feature acrescenta aqui não é regra, é **guarda**: hoje nada impede uma
implementação futura de largar a posse ao sair, e o teste da Tarefa 5 fixa isso.

Contraparte, já coberta e que continua valendo: ocupante que **morre** em campo
(F20) é desfeito por `sanearOcupacao` no mesmo tick, do lado do prédio — aí o
alerta acende, que é a resposta certa, porque aí o trabalhador realmente falta.

### 2. Para o painel?

**Mesmo campo, mesma resposta.** `painelDoPredio` lê `predio.ocupante` e resolve
a unidade (`src/sim/selectors.ts:511-517`); ele **não lê `unidade.fsm`**, então
`indo_colher` não vaza para a tela e o painel continua dizendo quem trabalha ali.
A linha nova da F-TA também não muda: ela conta tiles ao alcance, não ocupante.

**Decisão conservadora:** não acrescento "está no campo" ao painel nesta feature.
Seria dado de tela novo sem aceite escrito, e o aceite 2 pede justamente o
contrário — que "ocupado, mas fora" **não** apareça como problema. Fica na seção
Perguntas, para o operador decidir.

### 3. E se o prédio for demolido com ele em campo?

**Ele fica onde está, fica `ocioso`, e nada se perde.** Três razões estruturais,
nenhuma inventada aqui:

- `aplicarDemolishBuilding` (`src/sim/systems/demolicao.ts`) deliberadamente não
  cancela tarefa nem libera ocupante — quem trata "o prédio sumiu" é o saneamento
  do mesmo tick.
- O prólogo de `passoProduzindo` já é esse tratamento: `predioDoOcupante` devolve
  `null`, a tarefa de colheita que a unidade segurava é liberada com
  `liberar(state, minha.id, 'pedido-da-unidade')` (REABRE: o tile continua sendo
  do prédio) e a unidade vai para `ficarOcioso`. **Os três estados novos usam esse
  mesmo prólogo** — é a Tarefa 4, passo 1.
- A colheita continua acontecendo **só no `depositar`**: o tile perde unidades no
  instante em que a mercadoria entra na gaveta (contrato da F-T2a, "o que saiu da
  gaveta saiu do mapa"). Logo não existe pedra "na mão" para sumir, e o tile volta
  intacto para o próximo ocupante.

Onde ele fica: no tile em que estava. `ficarOcioso` não teleporta, e unidade
ociosa no campo é o estado normal de civil recém-nascido (`systems/escolas.ts`).

---

## Decisões de projeto

- **D1 — O relógio do ciclo corre no tile, e `ticksDoCiclo` não muda.** O ciclo
  passa a custar `ida + ticksDoCiclo + volta`. Isso **baixa a vazão** da pedreira,
  e é o efeito que o operador pediu ("o jogo esconde o trabalho"). Número de
  `data/` intocado: a queda vai **medida** para `BALANCE_LOG.md` (Tarefa 8), e
  balanceamento se ajusta em lote, nunca item a item.
- **D2 — O alvo do caminho não é o tile do recurso.** Rocha bloqueia passo
  (`recursoBloqueiaPasso`), então ninguém pisa no lajedo. O alvo é o conjunto
  `[o próprio tile, ...8 vizinhos]` filtrado por `tileAndavel(…, 'livre')`, e o A*
  escolhe o mais barato. Sem `if` por recurso: para o milho, que não bloqueia
  passo, o próprio tile entra no conjunto e ganha por custo, então o roceiro pisa
  no pé de milho e o pedreiro fica ao lado do lajedo — pela mesma regra.
- **D3 — A colheita continua no depósito.** Não existe carga na mão do
  especialista nesta feature. É o que torna a resposta 3 trivial e o que impede
  mercadoria órfã. (Pedra visível no braço na volta é ideia, não aceite: vai para
  `IDEIAS.md`.)
- **D4 — Elegibilidade do tile é o MESMO predicado nos dois lados.** Quem escolhe
  o tile e quem reclama a tarefa perguntam a mesma coisa. Sem isso o quadro cria
  uma tarefa que o claim recusa para sempre, e a pedreira espera o que nunca vem.
- **D5 — Tile debaixo de prédio sai da escolha.** É a nota herdada da F18, e o
  BUG-F fechou rocha e árvore mas **deixou o milho de propósito** (215 âncoras de
  `farm` que `canPlace` aceita cobrem tile de milho). A correção é na escolha do
  tile, não em `canPlace`.
- **D6 — Prédio pausado congela o especialista onde ele está.** Pausa é "este
  prédio para de trabalhar" (F16c). Ele não anda, não colhe, não volta; despausar
  retoma do mesmo tile. "Volta para casa ao pausar" seria movimento que o jogador
  não pediu.
- **D7 — Sem caminho de volta desfaz a posse pelos dois lados.** Prédio cercado
  enquanto ele estava fora: a tarefa é liberada, `ocupante` vira `null` e ele fica
  `ocioso` em campo. Aí `sem-trabalhador` acende — com razão, porque a pedreira de
  fato ficou sem quem trabalhe. A alternativa (prédio apontando para quem nunca
  volta) é espera indefinida, que é travamento de regra, não balanceamento.
- **D8 — Nenhum evento novo.** `goods-produced` e `vein-exhausted` continuam
  saindo do `depositar`, no mesmo instante de hoje. Evento de "saiu"/"chegou" não
  tem consumidor, e evento sem consumidor não nasce.
- **D9 — Render: nenhum código novo esperado, e isso é medido, não suposto.**
  `src/render/unidades.ts` desenha **toda** unidade de `state.unidades`, e
  `posicaoDaUnidade` (`src/sim/selectors.ts`) interpola por
  `fsmData.caminho`/`progresso` sem olhar `fsm`. Então o pedreiro andando aparece
  andando por construção. A nota de integração §10 se cumpre com o roteiro da
  Tarefa 7, que **prova na tela** que o retângulo dele sai do footprint. Se a
  captura mostrar o pedreiro parado na porta, o conserto é desta feature — a
  exceção já está escrita no item, antes do código.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/sim/aproximacao.ts` (**novo**) | Por onde se chega a um tile de colheita: `alvosDeAproximacao` e `tileAlcancavelParaColheita`. Arquivo próprio para essa pergunta, e é ele que evita ciclo de import (`recursos.ts` não passa a conhecer `pathfinding.ts`). |
| `src/sim/pathfinding.ts` | Ganha `tileCobertoPorPredio` (o índice de footprints já está em cache aqui; o chamador não vai varrer `predios.ordem` por tile). |
| `src/sim/recursos.ts` | `melhorTileDeColheita` e `melhorTileParaPlantio` ganham o parâmetro `elegivel`, sem saber o que ele pergunta. |
| `src/sim/jobs.ts` | `caminhoAteAproximacaoDoTile` (irmão de `caminhoAteOTile`) e o claim de `'colher'` passando a exigir caminho. |
| `src/sim/systems/especialistas.ts` | Os três estados novos, a saída no início do ciclo, o depósito na chegada. |
| `tests/helpers/especialista-invariantes.ts` | A invariante da FSM passa a conhecer os estados em campo. |
| `tests/F-T3-caminho.test.ts`, `tests/F-T3-ciclo-em-campo.test.ts`, `tests/F-T3-ocupado-mas-fora.test.ts`, `tests/F-T3-determinismo.test.ts` (**novos**) | Um arquivo por perna: por onde se chega, o ciclo inteiro, "ocupado mas fora", determinismo. |
| `tools/shots/F-T3.js` (**novo**) | A captura, com passo despausado (§8). |

`src/sim/state.ts` **não muda**: estado de FSM é string e `fsmData` já tem
`tarefa`, `caminho` e `progresso`.

---

## Tarefa 1 — Sonda: o tile debaixo do prédio é alcançável hoje?

A nota herdada diz que o roceiro andaria até um tile debaixo da própria fazenda.
Antes de construir em cima disso, provar que o caso existe **pelo comando que o
jogador já tem** — e se não existir, o resto da Tarefa 2 encolhe.

**Arquivos:** criar `tests/zz-probe-F-T3.test.ts` (sonda de sessão, molde do
`zz-probe-F19.test.ts`).

- [ ] **Passo 1: escrever a sonda**

```ts
/**
 * Sonda de sessão da F-T3 (CLAUDE.md §8: vale como evidência desta sessão, NÃO
 * como cobertura contínua — a proteção permanente é o teste da Tarefa 2).
 *
 * Pergunta: plantando uma `farm` por comando, sobre a mancha de milho que o
 * cenário tem, `melhorTileDeColheita` escolhe um tile debaixo do próprio
 * footprint? E `melhorTileParaPlantio`?
 */
import { describe, expect, it } from 'vitest';
import { cenarioDeFazenda } from './helpers/producao-cenario';
import { melhorTileDeColheita, melhorTileParaPlantio, tilesReservadosParaColheita } from '../src/sim/recursos';
import { receitaDoTipo } from '../src/sim/producao';
import { caixaDoPredio } from '../src/sim/footprint';
import { tileDeChave } from '../src/sim/estradas';
import { gameData } from '../src/sim/data';
import { gravarEvidencia } from './helpers/evidence';

describe('sonda F-T3', () => {
  it('mede se a escolha do tile cai debaixo do proprio predio', () => {
    const estado = cenarioDeFazenda();
    const predio = estado.predios.porId.f1;
    if (predio === undefined || predio.estado !== 'completo') throw new Error('sonda: f1 nao esta completo');
    const colheita = receitaDoTipo(predio.tipo, gameData)?.colheita;
    if (colheita == null) throw new Error('sonda: farm perdeu a colheita');
    const caixa = caixaDoPredio(predio, gameData);
    if (caixa === null) throw new Error('sonda: farm sem caixa');
    const dentro = (chave: string | null): boolean => {
      if (chave === null) return false;
      const t = tileDeChave(chave);
      return t.gx >= caixa.x0 && t.gx < caixa.x1 && t.gy >= caixa.y0 && t.gy < caixa.y1;
    };
    const escolhidoParaColher = melhorTileDeColheita(
      estado, predio, colheita, 1, tilesReservadosParaColheita(estado), gameData,
    );
    const escolhidoParaPlantar = melhorTileParaPlantio(
      estado, predio, colheita, tilesReservadosParaColheita(estado), gameData,
    );
    gravarEvidencia('zz-probe-F-T3', {
      caixa,
      escolhidoParaColher,
      escolhidoParaPlantar,
      colherCaiDebaixoDoPredio: dentro(escolhidoParaColher),
      plantarCaiDebaixoDoPredio: dentro(escolhidoParaPlantar),
    });
    expect(escolhidoParaColher ?? escolhidoParaPlantar).not.toBeNull();
  });
});
```

- [ ] **Passo 2: rodar e LER o número**

```bash
npx vitest run tests/zz-probe-F-T3.test.ts
```

Abrir `test-output/zz-probe-F-T3.json` com Read. Anotar no PROGRESS.md (Tarefa 8)
qual das duas escolhas cai debaixo do prédio. **Se nenhuma cair**, o cenário de
teste evita o caso por posicionamento: então a Tarefa 2 continua valendo (o caso
é alcançável pelo jogador, medido no BUG-F: 215 âncoras), mas o teste permanente
dela precisa **construir** o caso, e não herdá-lo do cenário.

- [ ] **Passo 3: commit**

```bash
git add tests/zz-probe-F-T3.test.ts test-output/zz-probe-F-T3.json
git commit -m "test(F-T3): sonda mede se a escolha do tile cai debaixo do proprio predio"
```

---

## Tarefa 2 — Onde se pode pisar, e o que sai da escolha

**Arquivos:**
- Criar: `src/sim/aproximacao.ts`
- Modificar: `src/sim/pathfinding.ts` (exportar `tileCobertoPorPredio`),
  `src/sim/recursos.ts` (`melhorTileDeColheita`, `melhorTileParaPlantio`)
- Teste: `tests/F-T3-caminho.test.ts` (primeira metade)

**Interfaces:**
- Consome: `tileAndavel`, `chaveDeTile`/`tileDeChave`, `GameState`, `GameData`.
- Produz: `alvosDeAproximacao(state, tile, dados) => readonly TileDeGrid[]`,
  `tileAlcancavelParaColheita(state, chaveDoTile, dados) => boolean`,
  `tileCobertoPorPredio(state, tile, dados) => boolean`, e o parâmetro
  `elegivel?: (chaveDoTile: string) => boolean` nas duas funções de escolha.

- [ ] **Passo 1: escrever os testes que falham**

```ts
describe('F-T3 — por onde se chega ao tile', () => {
  it('o tile de rocha nao e alvo de si mesmo, e os vizinhos andaveis sao', () => {
    const estado = cenarioDePedreira(DADOS);
    const alvos = alvosDeAproximacao(estado, { gx: 26, gy: 30 }, DADOS);
    expect(alvos).not.toContainEqual({ gx: 26, gy: 30 });   // rocha bloqueia passo
    expect(alvos.length).toBeGreaterThan(0);
    for (const a of alvos) expect(tileAndavel(estado, a, 'livre', DADOS)).toBe(true);
  });

  it('o tile de milho E alvo de si mesmo: o roceiro pisa no pe de milho', () => {
    const estado = cenarioDeFazenda();
    const tile = tileDeChave(primeiroTileDeMilho(estado));
    expect(alvosDeAproximacao(estado, tile, gameData)).toContainEqual(tile);
  });

  it('tile debaixo de um predio nao e alcancavel para colheita', () => {
    const estado = comMilhoDebaixoDaFazenda(cenarioDeFazenda());   // fixture do teste
    const debaixo = chaveDeTile({ gx: 20, gy: 30 });               // dentro do footprint de f1
    expect(tileCobertoPorPredio(estado, tileDeChave(debaixo), gameData)).toBe(true);
    expect(tileAlcancavelParaColheita(estado, debaixo, gameData)).toBe(false);
  });

  it('a escolha do tile pula o que nao se alcanca, e nao devolve null por isso', () => {
    const estado = comMilhoDebaixoDaFazenda(cenarioDeFazenda());
    const predio = predioDe(estado, 'f1');
    const colheita = colheitaDe('farm', gameData);
    const escolhido = melhorTileDeColheita(
      estado, predio, colheita, 1, undefined, gameData,
      (k) => tileAlcancavelParaColheita(estado, k, gameData),
    );
    expect(escolhido).not.toBeNull();
    expect(tileCobertoPorPredio(estado, tileDeChave(escolhido as string), gameData)).toBe(false);
  });

  it('o mesmo vale para o plantio: ninguem semeia debaixo do proprio celeiro', () => {
    const estado = comMilhoDebaixoDaFazenda(cenarioDeFazenda());
    const escolhido = melhorTileParaPlantio(
      estado, predioDe(estado, 'f1'), colheitaDe('farm', gameData), undefined, gameData,
      (k) => tileAlcancavelParaColheita(estado, k, gameData),
    );
    if (escolhido !== null) {
      expect(tileCobertoPorPredio(estado, tileDeChave(escolhido), gameData)).toBe(false);
    }
  });
});
```

`comMilhoDebaixoDaFazenda` é fixture local do teste: acrescenta entradas em
`state.recursos` nos tiles do footprint de `f1`, que é exatamente o que o jogador
produz ao plantar a fazenda sobre milho (medido no BUG-F). Construir o caso no
teste, e não depender do cenário, é o que o passo 2 da Tarefa 1 decide.

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run tests/F-T3-caminho.test.ts
```

Esperado: falha em `alvosDeAproximacao is not a function` e, nos dois últimos,
erro de aridade (o parâmetro `elegivel` ainda não existe).

- [ ] **Passo 3: `src/sim/aproximacao.ts`**

```ts
/**
 * F-T3 — POR ONDE se chega a um tile de colheita.
 *
 * O especialista nao pisa no lajedo (rocha bloqueia passo, F-T2b): ele fica ao
 * LADO e lavra. O milho nao bloqueia, e nesse caso o proprio tile e o melhor
 * alvo. Uma regra so para os dois: o alvo e o tile mais os oito vizinhos,
 * filtrados por `tileAndavel`, e quem decide entre eles e o custo do A*.
 *
 * Arquivo proprio, e nao um par de funcoes em `recursos.ts`, por causa do ciclo:
 * `pathfinding.ts` importa `recursos.ts` (camada de bloqueio), entao `recursos.ts`
 * nao pode importar `pathfinding.ts`. Aqui em cima dos dois nao ha ciclo.
 */
import { tileDeChave } from './estradas';
import type { TileDeGrid } from './estradas';
import { tileAndavel, tileCobertoPorPredio } from './pathfinding';
import { gameData } from './data';
import type { GameData } from './data/types';
import type { GameState } from './state';

type MundoDePasso = Pick<GameState, 'predios' | 'estradas' | 'recursos'>;

/** Ordem FIXA (varredura em linha, noroeste para sudeste): o A* recebe os alvos
 *  sempre na mesma ordem, e o desempate dele deixa de depender de quem chamou. */
const VIZINHOS: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

export function alvosDeAproximacao(
  state: MundoDePasso, tile: TileDeGrid, dados: GameData = gameData,
): readonly TileDeGrid[] {
  const alvos: TileDeGrid[] = [];
  if (tileAndavel(state, tile, 'livre', dados)) alvos.push(tile);
  for (const [dx, dy] of VIZINHOS) {
    const vizinho = { gx: tile.gx + dx, gy: tile.gy + dy };
    if (tileAndavel(state, vizinho, 'livre', dados)) alvos.push(vizinho);
  }
  return alvos;
}

/**
 * Da para TRABALHAR neste tile? Duas recusas, e as duas sao de posicao, nao de
 * quantidade:
 *
 * - tile debaixo do footprint de um predio (a nota herdada da F18): o roceiro
 *   andaria ate um tile que esta debaixo da propria fazenda. O BUG-F fechou o
 *   caso da rocha e da arvore recusando a construcao, e deixou o milho de
 *   proposito — milho e tile que o jogador plantou. Ele morre aqui.
 * - tile sem nenhuma aproximacao andavel: cercado por prediso, rocha ou agua.
 *
 * Local de proposito (9 tiles, sem A*): a pergunta do CAMINHO e do claim
 * (`reclamar`), que roda uma vez por tile escolhido.
 */
export function tileAlcancavelParaColheita(
  state: MundoDePasso, chaveDoTile: string, dados: GameData = gameData,
): boolean {
  const tile = tileDeChave(chaveDoTile);
  if (tileCobertoPorPredio(state, tile, dados)) return false;
  return alvosDeAproximacao(state, tile, dados).length > 0;
}
```

- [ ] **Passo 4: `tileCobertoPorPredio` em `src/sim/pathfinding.ts`**

Ao lado de `tileAndavel`, reusando o índice que já está em cache:

```ts
/** F-T3 — o tile esta debaixo do footprint de ALGUM predio? Sai daqui porque o
 *  indice ja e cache deste arquivo (`footprintsDe`); a alternativa era o chamador
 *  varrer `predios.ordem` a cada tile do alcance. Nao e a negacao de
 *  `tileAndavel`: agua e rocha tambem reprovam la, e aqui nao. */
export function tileCobertoPorPredio(
  state: Pick<GameState, 'predios'>, tile: TileDeGrid, dados: GameData = gameData,
): boolean {
  const { largura, altura } = dados.terreno.mapaPadrao;
  const emMapa = Number.isInteger(tile.gx) && Number.isInteger(tile.gy)
    && tile.gx >= 0 && tile.gy >= 0 && tile.gx < largura && tile.gy < altura;
  if (!emMapa) return false;
  return footprintsDe(state, dados).bloqueado[tile.gy * largura + tile.gx] === 1;
}
```

- [ ] **Passo 5: o parâmetro `elegivel` nas duas escolhas (`src/sim/recursos.ts`)**

```ts
/** F-T3 — o predicado de POSICAO entra por parametro, como `reservados`: quem
 *  escolhe o tile nao conhece pathfinding (isso seria ciclo de import), e quem
 *  conhece passa a pergunta. `SEMPRE` mantem o comportamento de antes para o
 *  chamador que nao se importa com posicao (a previa da planta fantasma). */
type TileElegivel = (chaveDoTile: string) => boolean;
const SEMPRE: TileElegivel = () => true;

export function melhorTileDeColheita(
  state: GameState, predio: PredioCompleto, colheita: ColheitaDeRecurso, minimo: number,
  reservados: ReadonlySet<string> = SEM_RESERVA, dados: GameData = gameData,
  elegivel: TileElegivel = SEMPRE,
): string | null {
  for (const chaveDoTile of tilesDeColheita(predio, colheita, dados)) {
    if (reservados.has(chaveDoTile)) continue;
    if (!elegivel(chaveDoTile)) continue;
    if (tileColhivelAgora(state, chaveDoTile, colheita, minimo)) return chaveDoTile;
  }
  return null;
}
```

O mesmo parâmetro, com o mesmo default, em `melhorTileParaPlantio`.
**`tilesDeColheita` e `tileTrabalhavel` não mudam** — se mudassem, a contagem do
painel (F-TA) e a prévia da planta fantasma (F-TP) mudariam de significado sem
aceite escrito. Está na seção Perguntas.

- [ ] **Passo 6: rodar até verde e rodar a suíte inteira**

```bash
npx vitest run tests/F-T3-caminho.test.ts
npm run test
```

A suíte inteira aqui ainda deve estar verde: nenhum chamador passa `elegivel`
nesta tarefa.

- [ ] **Passo 7: commit**

```bash
git add src/sim/aproximacao.ts src/sim/pathfinding.ts src/sim/recursos.ts tests/F-T3-caminho.test.ts
git commit -m "feat(F-T3): onde se pode pisar para colher, e o tile debaixo do predio fora da escolha"
```

---

## Tarefa 3 — O claim de colheita exige caminho

Hoje o claim de `'colher'` tem escrito: *"Sem caminho a conferir: o especialista já
está DENTRO do prédio."* A partir desta feature ele não está — e a linha tem de
mudar junto com o fato, senão fica um comentário que descreve o jogo anterior.

**Arquivos:**
- Modificar: `src/sim/jobs.ts` (`caminhoAteAproximacaoDoTile`, ramo de `'colher'`
  em `reclamar`)
- Teste: `tests/F-T3-caminho.test.ts` (segunda metade)

**Interfaces:**
- Consome: `alvosDeAproximacao` (Tarefa 2), `buscarCaminho`.
- Produz: `caminhoAteAproximacaoDoTile(state, tile, unidadeId, dados) => Caminho | null`.

- [ ] **Passo 1: testes que falham**

```ts
it('tile ilhado nao se reclama: o claim recusa por sem-caminho', () => {
  const estado = comTileIlhado(cenarioDePedreira(DADOS));   // rocha cercada de agua/predio
  const criada = criarTarefaDeColheita(estado, {
    destino: 'q1', origemTile: { gx: 26, gy: 30 }, recurso: 'rock', quantidade: 1,
  });
  const r = reclamar(criada.state, criada.id, 'u1', DADOS);
  expect(r).toEqual({ ok: false, motivo: 'sem-caminho' });
});

it('e a escolha nao devolve esse tile: criar-e-recusar todo tick seria espera indefinida', () => {
  const estado = comTileIlhado(cenarioDePedreira(DADOS));
  const escolhido = melhorTileDeColheita(
    estado, predioDe(estado, 'q1'), colheitaDe('quarry', DADOS), 1, undefined, DADOS,
    (k) => tileAlcancavelParaColheita(estado, k, DADOS),
  );
  expect(escolhido).not.toBe(chaveDeTile({ gx: 26, gy: 30 }));
});

it('o caminho ate a aproximacao termina AO LADO do lajedo, nunca em cima', () => {
  const estado = cenarioDePedreira(DADOS);
  const caminho = caminhoAteAproximacaoDoTile(estado, { gx: 26, gy: 30 }, 'u1', DADOS);
  expect(caminho).not.toBeNull();
  const ultimo = (caminho as Caminho).tiles.at(-1) as TileDeGrid;
  expect(ultimo).not.toEqual({ gx: 26, gy: 30 });
  expect(Math.max(Math.abs(ultimo.gx - 26), Math.abs(ultimo.gy - 30))).toBe(1);
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run tests/F-T3-caminho.test.ts
```

- [ ] **Passo 3: implementar em `src/sim/jobs.ts`**

```ts
/** F-T3 — o caminho do especialista ate UMA APROXIMACAO do tile de colheita.
 *  Irmao de `caminhoAteOTile`, com dois desvios: o alvo e o conjunto de
 *  aproximacoes (ninguem pisa no lajedo) e o modo e `'livre'`, como todo
 *  deslocamento de especialista — ele nao carrega nada. */
export function caminhoAteAproximacaoDoTile(
  state: GameState, tile: TileDeGrid, unidadeId: string, dados: GameData = gameData,
): Caminho | null {
  const unidade = state.unidades.porId[unidadeId];
  if (!unidade) return null;
  const alvos = alvosDeAproximacao(state, tile, dados);
  if (alvos.length === 0) return null;
  return buscarCaminho(state, { gx: unidade.gx, gy: unidade.gy }, alvos, 'livre', dados);
}
```

E no ramo de `ehTarefaDeColheita(tarefa)` de `reclamar`, substituindo o comentário
que ficou falso:

```ts
    // F-T3: o especialista SAI do predio para colher, entao o claim confere o
    // caminho, como o de `'assentar-estrada'` confere. Sem isto ele reclamaria um
    // tile ilhado e largaria no tick seguinte, reservando o lajedo a cada volta.
    if (caminhoAteAproximacaoDoTile(state, tarefa.origemTile, unidadeId, dados) === null) {
      return { ok: false, motivo: 'sem-caminho' };
    }
```

- [ ] **Passo 4: verde, e suíte inteira**

```bash
npx vitest run tests/F-T3-caminho.test.ts
npm run test
```

Atenção esperada: testes da F-T2c que reclamam tarefa de colheita em cenário sem
caminho até a rocha podem passar a recusar. Se algum quebrar, o conserto é
**tornar o cenário do teste coerente** (rocha alcançável, que é o caso do jogo),
nunca afrouxar a regra.

- [ ] **Passo 5: commit**

```bash
git add src/sim/jobs.ts tests/F-T3-caminho.test.ts
git commit -m "feat(F-T3): o claim de colheita exige caminho ate a aproximacao do tile"
```

---

## Tarefa 4 — Os três estados novos

**Arquivos:**
- Modificar: `src/sim/systems/especialistas.ts`
- Teste: `tests/F-T3-ciclo-em-campo.test.ts` (novo)

**Interfaces:**
- Consome: `caminhoAteAproximacaoDoTile` (T3), `tileAlcancavelParaColheita` (T2),
  `andar`, `chegou`, `dadosDaFsm`, `comUnidade`, `comPredio`, `liberar`,
  `depositar`, `predioDoOcupante`, `colheitaSeguraPor`.
- Produz: os estados `'indo_colher'`, `'colhendo'`, `'voltando'` em `unit.fsm`;
  `fsmData` com `tarefa`, `caminho`, `progresso` (nada novo).

- [ ] **Passo 1: o prólogo compartilhado (aceite 2, perna da demolição)**

Extrair de `passoProduzindo` o que já existe, sem mudar corpo, para que os três
estados novos usem a MESMA resposta a "o prédio sumiu":

```ts
/** F-T3 — "eu ainda tenho predio?", e o que fazer quando nao. Era o prologo de
 *  `passoProduzindo` (F-T2c), extraido sem mudar corpo ao ganhar o segundo
 *  consumidor — os tres estados em campo. Demolir o predio com o especialista no
 *  campo cai TODO aqui: tarefa liberada com `'pedido-da-unidade'` (o tile REABRE
 *  para o proximo ocupante) e a unidade fica ociosa NO TILE em que estava. */
function largarOPredioPerdido(state: GameState, u: Unidade): Passo {
  const minha = colheitaSeguraPor(state, u.id);
  if (minha === null) return ficarOcioso(state, u);
  const l = liberar(state, minha.id, 'pedido-da-unidade');
  const ocioso = ficarOcioso(l.state, u);
  return { state: ocioso.state, events: [...l.events, ...ocioso.events] };
}

/** O predio deste especialista e a tarefa de colheita que ele segura, ou `null`
 *  se perdeu um dos dois. `null` significa "volte a procurar trabalho". */
function posseEmCampo(
  state: GameState, u: Unidade,
): { readonly predio: PredioCompleto; readonly tarefa: TarefaColher } | null {
  const predio = predioDoOcupante(state, u.id);
  if (predio === null) return null;
  const tarefa = colheitaSeguraPor(state, u.id);
  if (tarefa === null || tarefa.destino !== predio.id) return null;
  return { predio, tarefa };
}
```

- [ ] **Passo 2: a saída, dentro de `produzir`**

Depois de `garantirColheita` e **antes** do relógio, substituindo o avanço no
lugar para quem colhe:

```ts
  // F-T3 — o ciclo COMECA com a saida: o pedreiro nao lavra de dentro das
  // proprias paredes. O relogio (`prod.progresso`) so anda com ele NO tile, e o
  // deposito acontece na volta — o tile segue reservado a viagem inteira, que e
  // o contrato da F-T2c esticado no tempo, nao um contrato novo.
  if (tarefa !== null && prod.progresso === 0) {
    const caminho = caminhoAteAproximacaoDoTile(base, tarefa.origemTile, u.id, dados);
    if (caminho === null) {
      // ilhado entre o claim e a saida (um predio nasceu no caminho neste tick):
      // `'caminho-cortado'` NAO reabre, e e isso que faz o ciclo seguinte
      // escolher OUTRO tile em vez de insistir neste.
      const l = liberar(base, tarefa.id, 'caminho-cortado');
      return { state: comFsm(l.state, u, 'esperando_insumo').state, events: l.events };
    }
    // o insumo e cobrado DEPOIS do caminho: quem nao vai sair nao paga (F13a
    // cobra ao iniciar, e iniciar aqui e sair).
    if (!temInsumo(predio, receita)) return comFsm(base, u, 'esperando_insumo');
    const pago = comPredio(base, consumirInsumos(predio, receita));
    return semEventos(comUnidade(pago, {
      ...u,
      fsm: 'indo_colher',
      fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }),
    }));
  }
```

Consequência a escrever no cabeçalho do arquivo: para prédio **com** `colheita` o
avanço de relógio de `produzir` deixa de ser alcançado (o relógio anda em
`colhendo`); para prédio sem colheita (moinho, padaria, serraria) nada muda.

E a chamada de `melhorTileDeColheita` dentro de `garantirColheita` passa o
predicado da Tarefa 2 — os dois lados perguntando o mesmo:

```ts
    const chaveDoTile = melhorTileDeColheita(
      state, predio, colheita, quantidade, tilesReservadosParaColheita(state), dados,
      (k) => tileAlcancavelParaColheita(state, k, dados),
    );
```

- [ ] **Passo 3: os três handlers**

```ts
/** Andando para o tile. Pausa congela onde esta (D6): pausa e "este predio para",
 *  e mandar o pedreiro para casa seria movimento que o jogador nao pediu. */
function passoIndoColher(state: GameState, u: Unidade, dados: GameData): Passo {
  const posse = posseEmCampo(state, u);
  if (posse === null) return largarOPredioPerdido(state, u);
  const { predio, tarefa } = posse;
  if (predio.pausado) return semEventos(state);

  const proximo = (u.fsmData.caminho ?? [])[0];
  let atual = u;
  if (proximo !== undefined && !tileAndavel(state, proximo, 'livre', dados)) {
    const caminho = caminhoAteAproximacaoDoTile(state, tarefa.origemTile, u.id, dados);
    if (caminho === null) return voltarSemColher(state, u, predio, tarefa, dados);
    atual = { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }) };
  }
  const andou = andar(state, atual, dados);
  if (!chegou(andou)) return semEventos(comUnidade(state, andou));
  return semEventos(comUnidade(state, {
    ...andou, fsm: 'colhendo', fsmData: dadosDaFsm({ tarefa: tarefa.id }),
  }));
}

/** No tile: o relogio do CICLO anda aqui, e e o mesmo relogio de sempre
 *  (`predio.producao.progresso`, `receita.ticksDoCiclo`). Nenhum numero novo. */
function passoColhendo(state: GameState, u: Unidade, dados: GameData): Passo {
  const posse = posseEmCampo(state, u);
  if (posse === null) return largarOPredioPerdido(state, u);
  const { predio, tarefa } = posse;
  if (predio.pausado) return semEventos(state);

  const receita = receitaDoTipo(predio.tipo, dados);
  const prod = predio.producao;
  if (receita === null || prod === null) return voltarSemColher(state, u, predio, tarefa, dados);

  const progresso = prod.progresso + 1;
  const avancado: PredioCompleto = { ...predio, producao: { progresso, plantio: null } };
  const comRelogio = comPredio(state, avancado);
  if (progresso < receita.ticksDoCiclo) return semEventos(comRelogio);
  return voltar(comRelogio, u, avancado, tarefa, dados);
}

/** Voltando. Com tarefa na mao, a chegada e o DEPOSITO — e e o `depositar` da
 *  F-T2c, intocado: gaveta, `colherDoTile`, tarefa fora do quadro e
 *  `vein-exhausted`, tudo no mesmo tick. Sem tarefa (o tile secou enquanto ele
 *  vinha), a chegada so zera o relogio: mercadoria sem tile seria pedra vinda do
 *  nada. */
function passoVoltando(state: GameState, u: Unidade, dados: GameData): Passo {
  const predio = predioDoOcupante(state, u.id);
  if (predio === null) return largarOPredioPerdido(state, u);
  if (predio.pausado) return semEventos(state);

  const proximo = (u.fsmData.caminho ?? [])[0];
  let atual = u;
  if (proximo !== undefined && !tileAndavel(state, proximo, 'livre', dados)) {
    const caminho = caminhoAtePredioCompleto(state, predio.id, u.id, dados);
    if (caminho === null) return desfazerPosse(state, u, predio);
    atual = { ...u, fsmData: dadosDaFsm({ ...u.fsmData, caminho: caminho.tiles, progresso: 0 }) };
  }
  const andou = andar(state, atual, dados);
  if (!chegou(andou)) return semEventos(comUnidade(state, andou));

  const receita = receitaDoTipo(predio.tipo, dados);
  const tarefa = colheitaSeguraPor(state, u.id);
  if (receita === null) return ficarOcioso(state, andou);
  if (tarefa === null) {
    const zerado: PredioCompleto = { ...predio, producao: { progresso: 0, plantio: null } };
    return semEventos(comUnidade(comPredio(state, zerado), {
      ...andou, fsm: 'trabalhando', fsmData: {},
    }));
  }
  return depositar(state, andou, predio, receita, tarefa, dados);
}

/** Volta de maos vazias: o ciclo perdeu o tile (secou, ou o caminho de ida
 *  morreu). Larga a tarefa REABRINDO (o tile continua sendo do predio) e zera o
 *  relogio na chegada — meio ciclo pago nao vira pedra. */
function voltarSemColher(
  state: GameState, u: Unidade, predio: PredioCompleto, tarefa: TarefaColher, dados: GameData,
): Passo {
  const l = liberar(state, tarefa.id, 'pedido-da-unidade');
  const caminho = caminhoAtePredioCompleto(l.state, predio.id, u.id, dados);
  if (caminho === null) return desfazerPosse(l.state, u, predio, l.events);
  const zerado: PredioCompleto = { ...predio, producao: { progresso: 0, plantio: null } };
  return {
    state: comUnidade(comPredio(l.state, zerado), {
      ...u, fsm: 'voltando', fsmData: dadosDaFsm({ caminho: caminho.tiles, progresso: 0 }),
    }),
    events: l.events,
  };
}

/** D7 — ele nao consegue mais voltar: a posse se desfaz dos DOIS lados. O predio
 *  fica vago (e ai `sem-trabalhador` acende com razao) e ele fica ocioso onde
 *  esta, livre para reclamar outra ocupacao — cujo claim confere caminho. */
function desfazerPosse(
  state: GameState, u: Unidade, predio: PredioCompleto, eventos: readonly GameEvent[] = [],
): Passo {
  const vago = comPredio(state, { ...predio, ocupante: null, producao: predio.producao === null
    ? null : { progresso: 0, plantio: predio.producao.plantio } });
  return ficarOcioso(vago, u, eventos);
}
```

```ts
/** Fim do ciclo no tile: pede o caminho de volta e sai andando COM a tarefa na
 *  mao — e a tarefa que faz a chegada virar deposito. Sem caminho, D7. */
function voltar(
  state: GameState, u: Unidade, predio: PredioCompleto, tarefa: TarefaColher, dados: GameData,
): Passo {
  const caminho = caminhoAtePredioCompleto(state, predio.id, u.id, dados);
  if (caminho === null) return voltarSemColher(state, u, predio, tarefa, dados);
  return semEventos(comUnidade(state, {
    ...u, fsm: 'voltando', fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }),
  }));
}
```

`voltar` cai em `voltarSemColher`, e não direto em `desfazerPosse`, por um motivo:
`voltarSemColher` **libera a tarefa antes** de descobrir que também não há caminho
de volta, e é esse `liberar` que impede o tile de ficar reservado por uma unidade
que nunca mais vai colher dele.

No `passoDoEspecialista`, três `case` novos apontando para os três handlers. O
`default` que hoje lança para estado desconhecido **continua lançando**.

- [ ] **Passo 4: o teste da sequência (aceite 1)**

```ts
it('o pedreiro sai, chega ao lado do lajedo, lavra o ciclo e volta com a pedra', () => {
  let estado = comEspacoNaSaida(cenarioDePedreira(DADOS));
  const passos: { tick: number; fsm: string; gx: number; gy: number }[] = [];
  const saidaAntes = saidaDe(estado, 'q1').stone ?? 0;
  for (let i = 0; i < 400; i += 1) {
    estado = step(estado, [], DADOS);
    const u = estado.unidades.porId.u1 as Unidade;
    passos.push({ tick: estado.tick, fsm: u.fsm, gx: u.gx, gy: u.gy });
    if ((saidaDe(estado, 'q1').stone ?? 0) > saidaAntes) break;
  }
  const sequencia = passos.filter((p, i) => i === 0 || p.fsm !== passos[i - 1]?.fsm);
  expect(sequencia.map((p) => p.fsm)).toEqual(
    ['indo_colher', 'colhendo', 'voltando', 'trabalhando'],
  );
  // ele andou de verdade: passou por tiles intermediarios, e nao pulou
  const trilha = passos.filter((p) => p.fsm === 'indo_colher');
  expect(new Set(trilha.map((p) => `${p.gx},${p.gy}`)).size).toBeGreaterThan(1);
  for (let i = 1; i < trilha.length; i += 1) {
    const a = trilha[i - 1] as typeof trilha[number];
    const b = trilha[i] as typeof trilha[number];
    expect(Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy))).toBeLessThanOrEqual(1);
  }
  // colheu do tile reservado, e o lajedo perdeu exatamente o que a gaveta ganhou
  expect(saidaDe(estado, 'q1').stone).toBe(saidaAntes + 1);
  expect(violacoesDaFsmDoEspecialista(estado, DADOS)).toEqual([]);
  expect(violacoesDeInvariantes(estado, DADOS)).toEqual([]);
});
```

- [ ] **Passo 5: rodar, verde, e a suíte inteira**

```bash
npx vitest run tests/F-T3-ciclo-em-campo.test.ts
npm run test
```

**Esperado aqui: falha em massa, e é ela que esta tarefa tem de consertar.** Tudo
o que media o ciclo da pedreira ou da fazenda de dentro do prédio muda de número:
`F15a-*`, `F-T2c-*`, `F18-*`, `F19-*`, `F16c-*` e o oráculo. A regra: **reescrever
a asserção mais estrita**, dizendo a sequência nova, e nunca alargar a tolerância.
O que NÃO pode acontecer é ajustar `data/` para o ciclo voltar ao número antigo —
o ciclo ficou mais longo porque o trabalho deixou de ser escondido, e isso é
`BALANCE_LOG.md` (Tarefa 8), não conserto de teste.

- [ ] **Passo 6: commit**

```bash
git add src/sim/systems/especialistas.ts tests/F-T3-ciclo-em-campo.test.ts tests/
git commit -m "feat(F-T3): o especialista sai, lavra no tile e volta para depositar"
```

---

## Tarefa 5 — "Ocupado, mas fora" (aceite 2)

**Arquivos:**
- Modificar: `tests/helpers/especialista-invariantes.ts`
- Teste: `tests/F-T3-ocupado-mas-fora.test.ts` (novo)

- [ ] **Passo 1: consertar o guarda, não a asserção**

`violacoesDaFsmDoEspecialista` hoje reprova qualquer estado fora de
`ESTADOS_DO_ESPECIALISTA`, reprova `caminho` pendente fora de `indo_ocupar` e
reprova prédio cujo ocupante não está em estado de produção. Os três estados novos
violam os três — e a invariante é que está desatualizada, não a FSM:

```ts
/** F-T3 — os tres estados EM CAMPO. Do ponto de vista da POSSE eles valem o
 *  mesmo que `trabalhando`: a unidade ocupa um predio. O que muda e o que ela
 *  pode ter na mao — uma tarefa de COLHEITA e um caminho. */
export const ESTADOS_EM_CAMPO = ['indo_colher', 'colhendo', 'voltando'] as const;

export const ESTADOS_DE_PRODUCAO = ['trabalhando', 'esperando_insumo', 'saida_cheia'] as const;

export const ESTADOS_DO_ESPECIALISTA = [
  'ocioso', 'indo_ocupar', ...ESTADOS_DE_PRODUCAO, ...ESTADOS_EM_CAMPO,
] as const;
```

E três regras novas, escritas como exigência e não como permissão:

```ts
      case 'indo_colher':
      case 'colhendo':
        if (predio === null) v.push(`${id}: ${u.fsm} sem predio que o reconheca`);
        if (tarefaDeColheitaDe(id) === null) v.push(`${id}: ${u.fsm} sem tarefa de colheita reclamada por ele`);
        if (u.fsm === 'indo_colher' && (u.fsmData.caminho ?? []).length === 0) {
          v.push(`${id}: indo_colher sem caminho`);
        }
        break;
      case 'voltando':
        if (predio === null) v.push(`${id}: voltando sem predio que o reconheca`);
        if ((u.fsmData.caminho ?? []).length === 0) v.push(`${id}: voltando sem caminho`);
        break;
```

`produzido(fsm)` da direção inversa (prédio → ocupante) passa a aceitar
`ESTADOS_EM_CAMPO`, e a regra "`caminho` pendente só em `indo_ocupar`" passa a
listar também `indo_colher` e `voltando`. `colhendo` **não** pode ter caminho.

- [ ] **Passo 2: provar que o guarda ACUSA, e não só que não acusa à toa**

```ts
it('a invariante acusa especialista em campo sem predio', () => {
  const estado = semOcupante(emCampo(cenarioDePedreira(DADOS)), 'q1');
  expect(violacoesDaFsmDoEspecialista(estado, DADOS).join(' ')).toContain('sem predio');
});

it('a invariante acusa indo_colher sem caminho', () => {
  const estado = comFsmDaUnidade(emCampo(cenarioDePedreira(DADOS)), 'u1', 'indo_colher', {});
  expect(violacoesDaFsmDoEspecialista(estado, DADOS).join(' ')).toContain('sem caminho');
});
```

- [ ] **Passo 3: os três casos do aceite 2, um teste cada**

```ts
/** `emCampo` roda o cenario ate o pedreiro estar em `indo_colher` FORA do
 *  footprint da pedreira — o estado de que as tres perguntas falam. */

it('1. o painel continua dizendo quem trabalha ali', () => {
  const estado = emCampo(cenarioDePedreira(DADOS));
  const painel = painelDoPredio(estado, 'q1', DADOS);
  expect(painel?.ocupante).toEqual({ unidade: 'u1', tipo: 'stonemason' });
  expect(fsmDe(estado, 'u1')).toBe('indo_colher');
  expect(foraDoFootprint(estado, 'u1', 'q1', DADOS)).toBe(true);
});

/** As causas de UM predio, do seletor de verdade (`alertasDoEstado`): o teste nao
 *  reimplementa a derivacao que ele quer verificar. */
const causasDe = (estado: GameState, id: string): readonly string[] =>
  alertasDoEstado(estado, DADOS).filter((a) => a.predio === id).map((a) => a.causa);

it('2. o alerta sem-trabalhador NAO dispara com o ocupante em campo', () => {
  const estado = emCampo(cenarioDePedreira(DADOS));
  expect(causasDe(estado, 'q1')).not.toContain('sem-trabalhador');
  // e a contraparte: some a UNIDADE e o alerta acende, senao o teste acima nao
  // prova nada — provaria so que o alerta nunca dispara neste cenario
  const semEle = step(semAUnidade(estado, 'u1'), [], DADOS);
  expect(causasDe(semEle, 'q1')).toContain('sem-trabalhador');
});

it('3. demolir com ele em campo: fica ocioso onde esta, sem tarefa presa e sem perder o lajedo', () => {
  const estado = emCampo(cenarioDePedreira(DADOS));
  const antes = estado.unidades.porId.u1 as Unidade;
  const quantidadeAntes = estado.recursos[chaveDeTile(tarefaDe(estado, 'u1').origemTile)]?.quantidade;
  const depois = step(estado, [{ type: 'DemolishBuilding', predio: 'q1' }], DADOS);
  const u = depois.unidades.porId.u1 as Unidade;
  expect(u.fsm).toBe('ocioso');
  expect(u.fsmData).toEqual({});
  expect({ gx: u.gx, gy: u.gy }).toEqual({ gx: antes.gx, gy: antes.gy });
  expect(tarefasDeColheita(depois)).toEqual([]);                       // nenhuma presa
  expect(depois.recursos[chaveDeTile(tarefaDe(estado, 'u1').origemTile)]?.quantidade)
    .toBe(quantidadeAntes);                                            // o lajedo intacto
  expect(violacoesDeInvariantes(depois, DADOS)).toEqual([]);
});
```

- [ ] **Passo 4: os dois casos de borda das decisões D6 e D7**

```ts
it('D6 — prédio pausado congela ele no tile em que esta', () => {
  let estado = emCampo(cenarioDePedreira(DADOS));
  estado = step(estado, [{ type: 'SetBuildingPaused', predio: 'q1', pausado: true }], DADOS);
  const antes = estado.unidades.porId.u1 as Unidade;
  const relogioAntes = progressoDe(estado, 'q1');
  estado = avancar(estado, 30, DADOS);
  const depois = estado.unidades.porId.u1 as Unidade;
  expect({ gx: depois.gx, gy: depois.gy, fsm: depois.fsm })
    .toEqual({ gx: antes.gx, gy: antes.gy, fsm: antes.fsm });
  expect(progressoDe(estado, 'q1')).toBe(relogioAntes);                // relogio parado
  expect(depois.fsmData.progresso).toBe(antes.fsmData.progresso);      // nem meio passo
});

it('D7 — sem caminho de volta, a posse se desfaz dos dois lados', () => {
  let estado = emCampo(cenarioDePedreira(DADOS));
  estado = comMuroEmVoltaDaPorta(estado);        // fixture: cerca a porta da pedreira
  estado = avancar(estado, 200, DADOS);
  expect(fsmDe(estado, 'u1')).toBe('ocioso');
  expect(predioDe(estado, 'q1').ocupante).toBeNull();
  expect(causasDe(estado, 'q1')).toContain('sem-trabalhador');
  expect(violacoesDeInvariantes(estado, DADOS)).toEqual([]);
});
```

- [ ] **Passo 5: rodar, verde, commit**

```bash
npx vitest run tests/F-T3-ocupado-mas-fora.test.ts
npm run test
git add tests/helpers/especialista-invariantes.ts tests/F-T3-ocupado-mas-fora.test.ts
git commit -m "test(F-T3): ocupado mas fora — painel, alerta e demolicao com ele em campo"
```

---

## Tarefa 6 — Determinismo no meio do passo (aceite 3)

**Arquivos:** criar `tests/F-T3-determinismo.test.ts`.

- [ ] **Passo 1: o teste**

```ts
it('save e load com o pedreiro A CAMINHO dao o mesmo estado 200 ticks depois', () => {
  const tickNoMeio = tickEmQueEstaAndando();   // medido: primeiro tick em `indo_colher`
  const { direto, comSave } = compararComESemSave({
    seed: 1, totalTicks: tickNoMeio + 200, saveAtTick: tickNoMeio,
    antesDoStep: (e) => (e.tick === 0 ? comEspacoNaSaida(cenarioDePedreira(DADOS)) : e),
  });
  expect(comSave).toBe(direto);
});

it('e o tick escolhido e mesmo o do meio do passo: nem na porta, nem no tile', () => {
  const estado = noTick(tickEmQueEstaAndando());
  const u = estado.unidades.porId.u1 as Unidade;
  expect(u.fsm).toBe('indo_colher');
  expect((u.fsmData.caminho ?? []).length).toBeGreaterThan(0);
  expect(u.fsmData.progresso).toBeGreaterThan(0);          // dentro de um passo
  expect(foraDoFootprint(estado, 'u1', 'q1', DADOS)).toBe(true);
});
```

O segundo teste não é enfeite: sem ele, "save no meio do passo" poderia estar
salvando com o pedreiro ainda na porta, e o aceite 3 passaria sem exercitar nada.

- [ ] **Passo 2: gravar a evidência**

No fim do arquivo, `gravarEvidencia('F-T3', …)` com: a sequência de estados e
tiles do ciclo completo (aceite 1), o tick de cada transição, o par
`{ painel.ocupante, causas }` com ele em campo (aceite 2), o resultado da
demolição, e `{ iguais: comSave === direto, tickDoSave }` (aceite 3).

- [ ] **Passo 3: rodar e ABRIR o JSON com Read**

```bash
npx vitest run tests/F-T3-determinismo.test.ts tests/F-T3-ciclo-em-campo.test.ts
```

- [ ] **Passo 4: commit**

```bash
git add tests/F-T3-determinismo.test.ts test-output/F-T3.json
git commit -m "test(F-T3): determinismo com o pedreiro a caminho, e a evidencia do aceite"
```

---

## Tarefa 7 — A captura (nota de integração §10)

**Arquivos:** criar `tools/shots/F-T3.js`. Modificar `src/render/*` **só se** a
captura mostrar o pedreiro parado na porta (ver D9).

- [ ] **Passo 1: o roteiro**

Geometria derivada do JSON (molde de `tools/shots/F-TA.js` e `_recursos.js`),
nunca digitada. Passos:

1. `?pausado`: abre o painel da pedreira do cenário, afirma `ocupante` presente e
   guarda o tile desenhado do pedreiro (`window.__cangaco.unidadesRenderizadas`).
2. **Despausado** (§8): `press('p')`, esperar ticks suficientes para ele sair, com
   `mouse.down` / `waitForTimeout(150)` / `mouse.up` no painel no meio — é a classe
   de defeito do BUG-B, e o painel se redesenha a cada tick.
3. Afirmar, com o jogo andando, que o tile desenhado dele **saiu do footprint** da
   pedreira e que o painel continua com `ocupante` — a nota de integração provada
   na tela, e não descrita.
4. Captura `screenshots/F-T3-1-pedreiro-no-campo.png`, pausar de volta, e uma
   segunda captura na volta dele com a pedra na gaveta.

- [ ] **Passo 2: rodar e conferir o código de saída**

```bash
npm run shot -- F-T3
```

- [ ] **Passo 3: ABRIR `screenshots/F-T3-1-pedreiro-no-campo.png` com Read**

É a única imagem desta feature a abrir. Conferir: o retângulo do pedreiro está
fora do prédio, sobre o lajedo ou ao lado dele.

- [ ] **Passo 4: não-regressão dos outros roteiros**

Rodar todos os roteiros e conferir **código de saída** (sem abrir imagem de outra
feature). Os que medem a pedreira produzindo (`F15a`, `F16c`, `F-TA`, `F19`) são os
candidatos a quebrar por tempo: cada um que quebrar se conserta **esperando o
ciclo novo**, nunca afrouxando a asserção.

- [ ] **Passo 5: commit**

```bash
git add tools/shots/F-T3.js screenshots/F-T3-*.png
git commit -m "test(F-T3): roteiro prova na tela que o pedreiro sai do predio"
```

---

## Tarefa 8 — Medir o que mudou, registrar e fechar

- [ ] **Passo 1: medir a vazão, antes e depois (D1)**

```bash
npm run sim -- oraculo --ticks 12000
```

Registrar em `BALANCE_LOG.md`: pedra por minuto antes (número já medido na F19) e
depois, com a distância percorrida, e a conta `ida + ticksDoCiclo + volta`. **Sem
ajustar nada**: balanceamento se ajusta em lote.

- [ ] **Passo 2: `PROGRESS.md`**

Separando verificado de concluído. Entram: as três respostas com arquivo e linha;
a sonda da Tarefa 1 como **evidência de sessão** e o teste da Tarefa 2 como
**guarda permanente** (são coisas distintas); o que a Tarefa 4 obrigou a reescrever
na suíte; e a dívida da herança (abaixo).

- [ ] **Passo 3: a dívida da herança, escrita no item da fila**

`src/sim/systems/especialistas.ts` diz hoje, no `reposicaoDe`: *"O roceiro NAO sai
do predio nesta feature: isso e a F-T3"*. Esta feature faz o roceiro sair para
**colher** (a regra é de classe, vem do dado: receita com `colheita`), e deixa o
**plantio** acontecendo de dentro do prédio — `avancarPlantio` não anda. É meia
regra, e meia regra sem registro é o pior resultado possível: **nota no item da
fila que herda** (o item do roceiro/lenhador), dizendo o que já vem de graça e o
que falta, mais a atualização do comentário em `reposicaoDe` para não descrever um
jogo que deixou de existir.

- [ ] **Passo 4: o portão**

```bash
npm run verify
```

Só depois disso, `test-results.json` → `"F-T3": { "passes": true }`.

- [ ] **Passo 5: commit**

```bash
git add BALANCE_LOG.md PROGRESS.md BUILD_PLAN.md test-results.json src/sim/systems/especialistas.ts
git commit -m "feat(F-T3): o especialista sai do predio — medicao, registro e fechamento"
```

---

## Riscos, em ordem de tamanho

1. **A Tarefa 4 pode não caber na sessão.** Ela muda o tempo do ciclo de todo
   prédio extrator, e a suíte tem medição de vazão em pelo menos cinco arquivos.
   Se ao rodar `npm run test` o estrago passar de umas poucas asserções, a regra do
   CLAUDE.md §6 vale: **quebrar em sub-itens no `BUILD_PLAN.md`** (T1–T3 como
   `F-T3a — por onde se chega`, T4–T6 como `F-T3b — a FSM em campo`), registrar e
   entregar o primeiro. Não improvisar.
2. **O A* passa a ser chamado por ciclo e por replanejamento.** Hoje o especialista
   não pedia caminho depois de ocupar. Medir com `nosExpandidos()` no teste da
   Tarefa 4 e anotar o número; se subir demais, é item de medição, não ajuste de
   dado.
3. **A fazenda herda meia regra** (colhe fora, planta dentro) — Tarefa 8, passo 3.

## Perguntas em aberto (para o operador, não para mim)

1. **O painel deve dizer "está no campo"?** Hoje ele diz só *quem* trabalha, e o
   aceite 2 pede que "fora" não apareça como problema. Mostrar o estado do
   ocupante seria dado de tela novo; a interpretação conservadora é não mostrar.
2. **A contagem do painel (F-TA) deve descontar tile inalcançável?** O predicado
   novo é da *escolha*; `tileTrabalhavel` não mudou, então "13 ao alcance" continua
   contando um lajedo que o pedreiro não consegue rodear. Mudar isso muda o número
   do painel e da prévia da planta fantasma — tem aceite escrito nos dois, então
   não mexo sem decisão.
3. **Pedra visível no braço na volta?** D3 diz que não existe carga nesta feature.
   Se ele deve aparecer carregando, é regra nova (o que acontece se morrer no
   caminho) e vai para `IDEIAS.md`, congelado até a F17-aceite-fase-a.
