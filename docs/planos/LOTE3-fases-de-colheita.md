# LOTE3 — fases da colheita (saída (a)), começando pelo Canavial — plano de implementação

> Execução: `superpowers:executing-plans`, nesta sessão. Sem subagente (CLAUDE.md §11).
> **Não começa antes da revisão do operador.**

**Objetivo:** o tempo que o trabalhador passa NO TILE deixa de ser derivado da taxa `sai`.
A receita de quem sai a colher declara as fases, como o KaM: tempo no tile, tempo dentro
da casa, descanso e quantidade por viagem. A caminhada continua saindo do pathfinding e
não ganha campo.

**Não é mudança de modelo** (decisão do operador, 2026-09-27). É alinhar com a referência,
que separa as fases desde sempre: no KaM não existe taxa, e a vazão emerge das fases
(BALANCE_LOG, "PRÓXIMO LOTE COMEÇA AQUI", subseção REFERÊNCIA).

**Escopo deste plano:** b1 = Canavial (`wineyard`). Os outros quatro que saem a colher
(`quarry`, `woodcutters`, `farm`, `fishermans`) vêm em b2, **em lote**, porque mover o
tempo deles para os números do KaM é balanceamento (CLAUDE.md §12). As minas
(`aDistancia`) ficam fora: elas colhem de dentro, e para elas tempo e vazão são a mesma
coisa.

---

## Decisão 1 — o que a taxa `sai` passa a significar

**Proposta:** em receita com `colheita.fases`, `sai` deixa de ser entrada e vira o número
que o oráculo **confere**, como já fizemos com a fazenda 2.0 (o 247,5 por milho conferido
contra o ciclo do moinho, medido na F19).

- **O carregador** não converte mais a taxa `sai` dessa receita em período. O ciclo
  passa a ser a soma das fases: `ticksDoCiclo = noTile + naCasa + descanso`. A quantidade
  por ciclo em `sai` sai de `porViagem`, e a mercadoria continua sendo a chave de `sai`.
- **Receita sem `fases`** segue exatamente como hoje, com o ciclo derivado da taxa.
  Nesse caso `ticksNoTile = ticksDoCiclo`, e o comportamento é idêntico por construção.

**O que muda no `validate:data`:**

| arquivo | mudança |
|---|---|
| `tools/data-schema.js` | três linhas novas em `CAMPOS_ESCALONADOS`, **por receita** (`production.predios.wineyard.colheita.fases.{noTile,naCasa,descanso}_segundos_base`), segundos, grupo `escala` de `production.json`. É o mesmo contrato da reposição: caminho por tipo não vira curinga, e quem ganha fase escreve a linha dele. |
| `tools/data-rules.js`, regra nova `producao/fases` | `fases` exige os quatro campos; `noTile` > 0; `naCasa` e `descanso` ≥ 0; `porViagem` inteiro ≥ 1. É proibido com `aDistancia: true` (quem colhe de dentro não tem tile) e em receita com `entra` ou mais de uma `sai` (nenhum dos cinco tem, e o carregador não saberia repartir). |
| `tools/data-rules.js`, `validarCicloDaReceita` | pula a receita com `fases`: a razão entre taxas não existe mais nela. |
| `tools/data-rules.js`, regra nova `producao/sai-conferido` (condição necessária) | `porViagem × 60 / (noTile + naCasa + descanso)` ≥ `sai`, as duas na escala 1,0. A caminhada só atrasa: se as fases sozinhas já são mais lentas que a taxa declarada, o dado se contradiz. Tolerância: `TOLERANCIA_DA_RAZAO` (2 %), a que já existe. |
| teste da sim (não é `validate:data`) | a conferência **com caminhada** só existe rodando: vazão entregue no cenário de referência contra `sai`, no eixo determinístico (ticks por unidade). No b1 ela entra como número da corrida em `test-output/`, não como asserção, porque o `sai.wine` 0,5 de hoje é vazão **sem** caminhada. Reescrever o `sai` para o valor entregue medido é decisão do lote b2, junto com o 1:1:1 (`proporcoesDeReferencia`). |

## Decisão 2 — o Canavial primeiro, e o encaixe com a F-VIVO-b

**Números (proposta):** a proporção vem do KaM e o total é o de hoje.

- KaM, em ticks do KaM: 100 no tile, ≈ 320 na casa e 50 de descanso, total ≈ 470.
- Hoje: 600 ticks na escala 2,0, isto é, 120 s na escala 1,0, todos no tile.
- Repartindo os 120 s na proporção do KaM:

| fase | segundos (escala 1,0) | ticks (escala 2,0) |
|---|---|---|
| no tile | 26 | 130 |
| na casa | 82 | 410 |
| descanso | 12 | 60 |
| total | 120 | **600**, o ciclo de hoje |

- `porViagem` 1, o mesmo do KaM e o de hoje.
- Com o total mantido, a vazão não se move: é conta, e o Task 3 afirma essa igualdade.
- Os absolutos do KaM (≈ 470 ticks do KaM, isto é, ≈ 47 s **sob a HIPÓTESE do tick de
  100 ms**) dariam 235 ticks aqui, 2,5× a vazão de hoje. Isso é balanceamento, e vai para
  o lote b2. A repartição acima usa só a **proporção**, que é razão entre ticks do KaM,
  e por isso **não** depende da hipótese dos 100 ms.

**O que a mudança destrava, e o que não destrava** (conta, a medir no Task 1):

- **Não muda a razão N tiles : 1 tile.** O canavieiro continua sendo o gargalo, e o tempo
  dele por unidade (tile + casa + descanso + caminhada) é o mesmo. Com 1 tile ele fica
  parado o mesmo tanto enquanto a cana cresce. A previsão é que o 1,5× continue 1,5×.
- **Muda onde ele está.** Ele sai do tile depois de 130 ticks, não de 600, e passa 470
  dentro da casa. É o que se vê na tela, e é o que o KaM faz.
- **A reserva do tile:** neste plano o tile continua reservado até o depósito. A tarefa
  fica na mão do canavieiro dentro da casa, como a mina já faz (`aDistancia`,
  `especialistas.ts:531`). Liberar o tile na chegada é possível, mas exige partir o
  `depositar` em dois (colher na chegada, entregar no fim). Esse é o ramo em que um
  `produzir` sem tarefa, no meio do ciclo, reclamaria um segundo tile e o consumiria em
  dobro. Só destrava algo com dois produtores disputando os mesmos tiles, e fica para
  decisão do operador.

**Encaixe com a F-VIVO-b:**

- O `wineyard` já é caso `'transforma'` (`src/render/manifesto-camadas.ts:24`), com
  `inicio`, `meio` e `fim` pelos terços do progresso.
- `ROTULOS_QUE_ANIMAM` (`src/render/trabalho.ts:34`) já inclui `trabalhando`, e o total é
  `ticksDoCiclo`, que continua sendo o ciclo inteiro (600).
- **Hoje:** a prensa anima enquanto o canavieiro está no campo, porque o progresso anda
  no tile.
- **Depois:**
  - de 0 a 130, ele está no tile e a casa mostra o `inicio`, em `colhendo`, como hoje;
  - de 130 a 600, ele está dentro da casa, em `trabalhando`, e a casa anima o resto do
    `inicio`, o `meio` e o `fim` com ele dentro;
  - dos terços de 200 ticks, quase dois inteiros caem com ele dentro.
- **Com zero linha de render.** A §10 fica respeitada: o render lê o mesmo campo, com o
  mesmo significado. A outra sessão continua dona de `src/render/`.
- **O que fica para o render, depois (não é deste plano):**
  - animar só na fase da casa;
  - deixar o descanso parado.
  Os dois pedem que o render conheça `ticksNoTile`. Isso vira nota no item da F-VIVO no
  BUILD_PLAN, para quando o Codex sair do render.

## Decisão 3 — o custo, medido compilando (2026-09-27, revertido, árvore limpa)

| experimento | erros do `tsc --noEmit` | onde |
|---|---|---|
| tirar `ticksDoCiclo` de `ReceitaDePredio` | **42** | sim 4 (`loader.ts` 1, `especialistas.ts` 3), render 1 (`predios.ts`), testes 37 em 12 arquivos (`F19-cadeia-do-pao` 10, `F15a-producao` 6, `F15a-receita` 6, `F19b-cadeia-da-carne` 6, `F16c-pausar` 3, e 1 em cada um de `F15a-aceite`, `F18-ciclo-do-roceiro`, `F18-rocado`, `F-CAL-b-calibracao`, `F-T3-ciclo-em-campo`, `F-T3-determinismo`) |
| acrescentar três campos obrigatórios a `ColheitaDeRecurso` | **2** | `loader.ts:396` (quem constrói) e `tests/F-TP-alcance-previa.test.ts:149` (um literal de fixture) |

- A contagem por texto dizia "5 arquivos de sim, 2 de render e 13 testes". O compilador
  diz outra coisa: `trabalho.ts` não acusa, porque lê o `DadosDoTrabalho` montado em
  `predios.ts`, e `state.ts` e `producao.ts` citam sem depender.
- **Por isso o desenho mantém `ticksDoCiclo`** e acrescenta **um** campo obrigatório,
  `ColheitaDeRecurso.ticksNoTile`: custo de 2 erros, nenhum em render.
- **`naCasa` e `descanso` não viram campo de runtime.** Na sim, os dois são "o resto do
  relógio dentro do predio", e o carregador só os soma. A distinção entre eles só tem
  leitor quando o render quiser deixar o descanso parado, e aí o campo entra (memória
  "dado sem leitor vira folclore").

---

## Global Constraints

- `src/sim/` puro e determinístico; nenhum número de balanceamento em `.ts`
  (CLAUDE.md §2).
- Conversão segundos → ticks **uma vez, no carregamento**, com `Math.round`, pelo mesmo
  `registrar` / `paraTicksDeDuracao` da auditoria (§5).
- **Zero linha em `src/render/` e `src/ui/`.** Esses diretórios são da outra sessão, e a
  §10 vale.
- Nenhum `skip`, `eslint-disable` ou `ignores` ampliado (§10).
- Números do KaM só como tabela, com fonte anotada. Nenhum arquivo do KaM no repositório.
- O tick de 100 ms do KaM é **HIPÓTESE**, e se escreve assim ao lado de toda conta que o
  usa.
- Medida de relógio nunca vai para `expect` (§8).

## Review Focus

1. **Canavieiro pausado dentro da casa.** O relógio congela e a tarefa segue com ele. Ao
   despausar, ele termina o ciclo sem reclamar um segundo tile. Teste no Task 2.
2. **Casa demolida com ele dentro, na fase da casa.** A tarefa é liberada por
   `sanearTarefas` e o tile não fica reservado para sempre. Teste no Task 2.
3. **Saída cheia no fim da fase da casa.** O ciclo fica pronto e espera, sem recomeçar e
   sem voltar ao tile. Teste no Task 2.
4. **Receita sem `fases`** (pedreira, lenhador, roçado, pescador). O comportamento é
   byte a byte o de hoje: `ticksNoTile === ticksDoCiclo`. Hash de estado igual no Task 3.
5. **Dado com `fases` e `aDistancia`, ou com duas saídas.** O `validate:data` reprova com
   a regra certa. Teste no Task 4.

---

### Task 1 — sonda: segurar a tarefa dentro da casa não trava nada

Memória "sonda o travamento antes de construir em cima". Arquivo temporário
`tests/zz-fases-sonda.test.ts`, **apagado no fim do Task 2**.

- [ ] Montar `cenarioDeCanavial(gameData, 12)` e rodar até o canavieiro chegar de volta
  com a tarefa na mão (`fsm` passa de `voltando` a outro valor).
- [ ] No tick da chegada, reescrever à mão:
  - `predio.producao.progresso = 130`;
  - o `fsm` da unidade para `'trabalhando'`.
  Rodar 10 ticks.
- [ ] Afirmar três coisas:
  - `Object.values(state.tarefas...)` tem **uma** colheita de `c1`, a mesma de antes;
  - o progresso andou 10;
  - nenhum tile perdeu quantidade.
- [ ] Rodar a mesma sonda antes da mudança para medir a razão 12 : 1 do Canavial. A
  previsão é que ela não mude depois do Task 2. Anotar o número.
- [ ] **Se a sonda reclamar um segundo tile, parar e reportar ao operador.** Isso é o
  `escolherNoCampo` ou o `garantirColheita` ignorando a tarefa já segura, e é regra dele.

### Task 2 — sim + dado: as fases do Canavial

**Files:**
- Modify: `src/sim/data/types.ts` (`ColheitaDeRecurso`)
- Modify: `src/sim/data/loader.ts:349-400`
- Modify: `src/sim/systems/especialistas.ts`: o cabeçalho, `passoColhendo` (~:706) e
  `passoVoltando` (~:733)
- Modify: `data/production.json` (`wineyard`)
- Modify: `tests/F-TP-alcance-previa.test.ts:149`, só o literal: acrescentar
  `ticksNoTile`
- Create: `tests/LOTE3-fases-canavial.test.ts`

- [ ] **Teste que falha**, `tests/LOTE3-fases-canavial.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { receitaDoTipo } from '../src/sim/producao';
import { step } from '../src/sim/tick';
import { cenarioDeCanavial, comEspacoNaSaida } from './helpers/producao-cenario';

const RECEITA = receitaDoTipo('wineyard', gameData);

describe('LOTE3 — o canavieiro colhe no tile e trabalha na casa', () => {
  it('o dado declara as fases e o ciclo é a soma delas', () => {
    expect(RECEITA?.ticksDoCiclo).toBe(600);
    expect(RECEITA?.colheita?.ticksNoTile).toBe(130);
    expect(RECEITA?.sai.wine).toBe(1);
  });

  it('um ciclo: ticksNoTile em colhendo, o resto em trabalhando, depósito no fim', () => {
    let s = cenarioDeCanavial(gameData, 12);
    const noTile = RECEITA?.colheita?.ticksNoTile ?? 0;
    const total = RECEITA?.ticksDoCiclo ?? 0;
    let colhendo = 0;
    let dentroAposVoltar = 0;
    let voltou = false;
    for (let i = 0; i < 6000; i += 1) {
      s = comEspacoNaSaida(step(s, [], gameData), 'c1');
      const u = s.unidades.porId.canavieiro;
      if (u?.fsm === 'colhendo') colhendo += 1;
      if (voltou && u?.fsm === 'trabalhando') dentroAposVoltar += 1;
      if (u?.fsm === 'voltando') voltou = true;
      if (s.events.some((e) => e.type === 'goods-produced' && e.predio === 'c1')) break;
    }
    expect(colhendo).toBe(noTile);
    expect(dentroAposVoltar).toBe(total - noTile);
  }, 60000);
});
```

- [ ] Rodar `npx vitest run tests/LOTE3-fases-canavial.test.ts`. Esperado: FAIL, com
  `ticksNoTile` undefined.
- [ ] **O tipo** (`types.ts`, em `ColheitaDeRecurso`):

```ts
  /** LOTE3 — os ticks do ciclo que correm NO TILE (`colhendo`). O resto, ate
   *  `ReceitaDePredio.ticksDoCiclo`, corre dentro do predio. Receita sem `fases` no dado:
   *  e o ciclo inteiro, o comportamento de antes. */
  readonly ticksNoTile: Ticks;
```

- [ ] **O dado** (`production.json`, a `colheita` do `wineyard`; `sai.wine` 0.5 fica,
  agora como número conferido):

```json
"colheita": { "recurso": "grapes", "alcance_tiles": 2,
  "fases": { "noTile_segundos_base": 26, "naCasa_segundos_base": 82, "descanso_segundos_base": 12, "porViagem": 1 } }
```

  E uma frase nas `notas` do `wineyard`: a proporção é do KaM (100 : 320 : 50), o total
  é o de hoje, e a fonte está no BALANCE_LOG.

- [ ] **O carregador** (`loader.ts`, dentro do laço das receitas, depois de ler
  `colheita`):

```ts
    // LOTE3 — quem declara `fases` tem o ciclo SOMADO delas, como no KaM: a taxa `sai`
    // deixa de ser entrada e vira o numero que o oraculo confere (validate:data,
    // `producao/sai-conferido`). Sem `fases`, o ciclo e o de sempre, inteiro no tile.
    const fases = colheita !== null && 'fases' in colheita ? colheita.fases : null;
    const fase = (nome: 'noTile' | 'naCasa' | 'descanso'): Ticks => {
      const v = fases === null ? 0 : fases[`${nome}_segundos_base`];
      return registrar(
        `production.predios.${predioId}.colheita.fases.${nome}_segundos_base`, raw.production.escala,
        v, 'segundos', paraTicksDeDuracao(v, 'segundos', escalaEconomiaProducao, tickHz),
      );
    };
    const ticksNoTile = fases === null ? null : fase('noTile');
    const ticksDoCiclo = ticksNoTile === null
      ? Math.max(...todos)
      : ticksNoTile + fase('naCasa') + fase('descanso');
```

  `sai` fica `fases === null ? quantidades(periodos.sai) : { [mercadoria]: fases.porViagem }`,
  com a mercadoria única de `sai`. O carregador lança erro, como os outros, se houver
  `fases` com `entra` ou com mais de uma `sai`. Na `colheita` construída entra
  `ticksNoTile: ticksNoTile ?? ticksDoCiclo`. Confira a assinatura real de
  `paraTicksDeDuracao` e o tipo que o `resolveJsonModule` dá a `escalaEconomiaProducao`
  (hoje há um `as number` na chamada de `taxaParaTicksPorUnidade`).

- [ ] **A FSM** (`especialistas.ts`):
  - `passoColhendo`: trocar `if (progresso < receita.ticksDoCiclo)` por
    `if (progresso < (receita.colheita?.ticksNoTile ?? receita.ticksDoCiclo))`.
  - `passoVoltando`: antes do `return depositar(...)` final, entra

```ts
  // LOTE3 — o ciclo tem trabalho DENTRO da casa: ele entra com a tarefa na mao (o tile
  // so e consumido no deposito, como na mina `aDistancia`) e o `produzir` anda o resto
  // do relogio. Receita sem `fases`: chegou com o ciclo completo, deposita como antes.
  if ((predio.producao?.progresso ?? 0) < receita.ticksDoCiclo) {
    return semEventos(comUnidade(state, { ...andou, fsm: 'trabalhando', fsmData: {} }));
  }
```

  - Atualizar o cabeçalho do arquivo ("o mesmo `receita.ticksDoCiclo`, só em outro
    lugar"): agora só `ticksNoTile` anda no tile.
- [ ] **Os três casos do Review Focus** (pausado, demolido e saída cheia na fase da casa)
  vão como `it` no mesmo arquivo. Cada um entra na fase da casa (rodar até
  `fsm === 'trabalhando'` depois de `voltando`) e então:
  - **pausa:** `step` com o comando de pausar. Afirmar progresso congelado e uma tarefa
    só, e depois despausar e ver o depósito.
  - **demolição:** `step` com o comando de demolir. Afirmar nenhuma colheita de `c1` no
    quadro.
  - **saída cheia:** encher a gaveta antes. Afirmar `saida_cheia`, progresso =
    `ticksDoCiclo` e nenhum `indo_colher`.
- [ ] Corrigir o literal de `tests/F-TP-alcance-previa.test.ts:149`, acrescentando
  `ticksNoTile: <o ticksDoCiclo da receita de lá>`.
- [ ] `npx vitest run tests/LOTE3-fases-canavial.test.ts`. Esperado: PASS.
- [ ] Apagar `tests/zz-fases-sonda.test.ts`.

### Task 3 — a vazão não se moveu, e quem não tem `fases` não mudou nada

- [ ] **Canavial:** no mesmo arquivo, injetar um `GameData` em que o `wineyard` tem
  `colheita.ticksNoTile = ticksDoCiclo` (o modelo de antes) e rodar 12 000 ticks com e
  sem. Afirmar que o `goods-produced` somado é igual ±1, porque o arredondamento do
  último ciclo pode cair diferente. A razão 12 : 1 medida vai para
  `test-output/LOTE3-fases.json`, ao lado da do Task 1.
- [ ] **Os outros:** `tests/F-T3-determinismo.test.ts` e a `F19` inteiros verdes, sem
  tocar no número de nenhum deles. Esse é o hash de estado de antes.
- [ ] `npm run test` completo, verde.

### Task 4 — `validate:data`

**Files:** `tools/data-schema.js`, `tools/data-rules.js`, `tests/F03-dados-validados.test.ts`

- [ ] Casos que falham em `F03-dados-validados.test.ts`, no estilo dos existentes, cada
  um afirmando o prefixo da regra:
  - `fases` com `aDistancia: true` → `producao/fases`;
  - `fases` sem `porViagem` → `producao/fases`;
  - `fases` com duas saídas → `producao/fases`;
  - `fases` de 60 s total com `sai` 2,0 (as fases dão 1,0/min) → `producao/sai-conferido`;
  - o dado real passa.
- [ ] Implementar as regras da Decisão 1 e as três linhas de `CAMPOS_ESCALONADOS`.
- [ ] **Provar que a regra acusa:** mudar `sai.wine` para 0.6 no dado real, rodar
  `npm run validate:data` e ver `producao/sai-conferido`. Reverter.
- [ ] `npm run verify`.

### Task 5 — registro e commit

- [ ] **BALANCE_LOG:**
  - (a) foi escolhida e é alinhamento;
  - o Canavial em fases, com a tabela acima;
  - os absolutos do KaM ficam para b2, com a hipótese dos 100 ms ao lado;
  - a razão 12 : 1 medida antes e depois.
- [ ] **BUILD_PLAN:**
  - LOTE3-b1 com a chave;
  - b2 (os quatro, em lote, com a decisão de reescrever `sai` para o valor entregue e
    recalcular o 1:1:1);
  - nota no item da F-VIVO sobre `ticksNoTile` para o render.
- [ ] **PROGRESS:** separar o que foi verificado do que é hipótese.
- [ ] `test-results.json` só depois do `npm run verify`.
- [ ] `git status`, só com arquivos meus, e então commit
  `feat(LOTE3-b1): Canavial em fases, tile 130, casa 410, descanso 60`.

## Perguntas ao operador (antes do Task 1)

1. **Os números 26 / 82 / 12 s:** a proporção é do KaM e o total é o de hoje, para a vazão
   não se mover no b1. Os absolutos do KaM ficam para o lote b2.
2. **O tile fica reservado até o depósito**, como na mina. Liberar na chegada fica para
   quando houver disputa de tile. A previsão é que a razão 12 : 1 **não** melhora com o
   b1, porque o gargalo é o canavieiro, não o tile. Se o objetivo era a razão, o que a
   move é o tempo total do ciclo (b2), não a repartição.
