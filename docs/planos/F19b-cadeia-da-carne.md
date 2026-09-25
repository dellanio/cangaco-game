# F19b — A segunda comida: Malhada e Casa de Carne

**Objetivo:** provar, com teste permanente e evidência aberta, que a cadeia
`milho → bode → carne de sol` fecha do tile ao armazém sem uma linha de código
novo — e registrar o que a medição expôs.

**Arquitetura:** nada entra em `src/`. A feature é de **prova**: um cenário novo
no helper de produção (`tests/helpers/producao-cenario.ts`), um teste de aceite
(`tests/F19b-cadeia-da-carne.test.ts`) e uma evidência
(`test-output/F19b.json`). A sonda da sessão é descartável e sai do repo.

**Stack:** TypeScript estrito, Vitest, sim headless. Sem Playwright (nada muda na
tela).

**Spec:** `BUILD_PLAN.md:1986-2057` (item F19b, com os cinco critérios de aceite).

## Restrições globais (CLAUDE.md, valem em toda tarefa)

- `src/sim/` não importa `phaser` e não toca `window`/`document`/`performance`.
- Nenhum número de balanceamento digitado em `.ts`: tudo derivado de `data/*.json`.
- Toda duração em **ticks** dentro de `sim/`; nada de milissegundos.
- **Medida de relógio não entra em `expect`** (§8): as asserções usam eixo
  determinístico — tick, contagem de mercadoria, estado de FSM.
- Nenhuma dependência nova.
- Evidência aberta com Read antes de marcar `passes: true`; `npm run verify`
  verde; commit `feat(F19b): …`.

## O que a medição já respondeu (sonda da sessão, 2026-09-24)

Cenário 1 Fazenda : 1 Malhada : 1 Casa de Carne, na geografia da cadeia do pão
(a terra arada do mapa está no norte, `campoArado` em y=26..30), ligado por
estrada a um armazém próprio, com 4 serfs. Janela de 20 000 ticks.

| o que | valor |
|---|---|
| receita `farm` | ciclo 246 ticks, `sai {corn: 1}`, colheita `corn` alcance 4 |
| receita `swine_farm` | ciclo 600 ticks, `entra {corn: 4}`, `sai {pigs: 1, skins: 1}` |
| receita `butchers` | ciclo 200 ticks, `entra {pigs: 1}`, `sai {sausages: 3}` |
| primeiro milho entregue | tick 546 |
| primeiro bode entregue | tick 1984 (no armazém 2018) |
| primeira carne entregue | tick 2276 (no armazém 2359) |
| em 20 000 ticks | 61 milhos, 15 bodes, 15 couros, 42 carnes |
| ocioso (`esperando_insumo`) | criador 55 %, carneador 86 % |
| sem a Malhada | 61 milhos empilhados no armazém, **zero** carne, carneador esperando |
| sem a Fazenda | **nada** produzido, criador e carneador esperando |
| árvore, vila inicial | `farm requer sawmill`, `swine_farm requer farm`, `butchers requer swine_farm` |

**Conclusão: nada faltou.** O escopo é a prova.

## Decisões desta feature (todas registradas no PROGRESS.md para revisão)

- **D1 — Medir contra a linha de base do tick 0, nunca contra zero.** O armazém da
  abertura já traz `sausages: 10` (`economy.json estadoInicial.estoque`). Contra
  zero, o critério 1 passaria com o presente da abertura. É a mesma regra que a
  F19 usou para o cuscuz.
- **D2 — "Chega ao armazém" é saldo de armazém, não gaveta de prédio.** A F19
  mediu `entregue` (a soma das gavetas de todos os prédios, incluindo o armazém);
  aqui o critério escrito pelo operador é mais estrito — *"carne de sol chega ao
  armazém"* —, então o eixo é `estoqueDosArmazens`, que só sobe quando a tarefa de
  transporte termina no armazém.
- **D3 — O cenário é mínimo, não é o oráculo.** A F19 pôde afirmar "o cenário é o
  oráculo" porque a proporção do pão é 1 : 1 : 1. A da carne é 1,63 : 1 e 3 : 1, o
  que pediria ~5 fazendas para uma Casa de Carne, e a terra arada do norte tem 65
  tiles em um bloco só. O cenário prova a **cadeia**; a proporção vira medição no
  `BALANCE_LOG.md`, sem ajustar número nenhum (o lote é da F20).
- **D4 — Teto e piso derivados da receita, e o piso é tolerância de TRANSPORTE.**
  Teto: `bode ≤ ⌊milho / entra.corn⌋` e `carne ≤ sai.sausages × bode`. Piso: 85 %
  do teto, o mesmo número e o mesmo motivo da F19 (medido 93 %). Nenhum dos dois é
  medida de relógio.
- **D5 — A saída dupla ganha critério próprio.** Uma receita com duas saídas que
  entregasse só a primeira passaria no critério 1 e ninguém veria. O critério 4
  afirma `unidadesPorCiclo === 2` **e** o couro chegando ao armazém — e a asserção
  é derivada de `Object.keys(receita.sai).length`, não do id `skins`.

## Estrutura de arquivos

| arquivo | o que muda |
|---|---|
| `tests/helpers/producao-cenario.ts` | **+** `cenarioDaCadeiaDaCarne`, `cenarioDaCarneSemGranja`, `cenarioDaCarneSemFazenda` |
| `tests/F19b-cadeia-da-carne.test.ts` | **novo** — os cinco critérios |
| `test-output/F19b.json` | **novo** — evidência da corrida |
| `BALANCE_LOG.md` | **+** a terceira observação de vazão (proporção da carne) |
| `PROGRESS.md`, `test-results.json` | fecho da sessão |
| `tests/zz-probe-carne*.test.ts` | **apagados** ao fim (sonda é descartável) |

## Tarefa 1 — O cenário da cadeia da carne no helper

**Arquivos:** `tests/helpers/producao-cenario.ts` (já escrito nesta sessão para a
sonda; a tarefa é fechar as duas variações negativas).

- [ ] **Passo 1:** `cenarioDaCadeiaDaCarne(dados, serfs = 4)` — armazém `arm`
      (116,34), fazenda `f1` (112,30) com `roceiro`, Malhada `sf1` (107,34) com
      `criador`, Casa de Carne `bu1` (103,34) com `carneador`, rua em x=112
      (y=33..37) e em y=37 (x=103..119). `exigirLigado` nos três — a fixture
      confere a si mesma.
- [ ] **Passo 2:** `cenarioDaCarneSemGranja` e `cenarioDaCarneSemFazenda`, pelo
      mesmo molde de `cenarioDaCadeiaSemMoinho`: tira o prédio **e** o ocupante, e
      refaz `tiposJaConstruidos` com `comHistoricoDosPredios`.

```ts
function semPredioEOcupante(estado: GameState, predio: string, unidade: string): GameState {
  const porId = { ...estado.predios.porId };
  delete porId[predio];
  const uPorId = { ...estado.unidades.porId };
  delete uPorId[unidade];
  return comHistoricoDosPredios({
    ...estado,
    predios: { porId, ordem: estado.predios.ordem.filter((i) => i !== predio) },
    unidades: { porId: uPorId, ordem: estado.unidades.ordem.filter((i) => i !== unidade) },
    tiposJaConstruidos: [],
  });
}
```

- [ ] **Passo 3:** rodar `npx vitest run tests/F19b-cadeia-da-carne.test.ts` (ainda
      vermelho — o teste não existe) e seguir para a Tarefa 2.

## Tarefa 2 — Os cinco critérios

**Arquivos:** criar `tests/F19b-cadeia-da-carne.test.ts`.

- [ ] **Passo 1: escrever o teste que falha.** Um `describe` por critério, com os
      marcos derivados do dado:

```ts
const FAZENDA = receitaDoTipo('farm', gameData);
const GRANJA = receitaDoTipo('swine_farm', gameData);
const ACOUGUE = receitaDoTipo('butchers', gameData);
// ... guardas que lançam se algum for null ou sem colheita

const GRAO = FAZENDA.colheita.recurso;              // corn
const BODE = Object.keys(ACOUGUE.entra)[0];          // pigs
const CARNE = Object.keys(ACOUGUE.sai)[0];           // sausages
const COURO = Object.keys(GRANJA.sai).filter((m) => m !== BODE)[0]; // skins
const PLANTIO = gameData.recursos.tipos[GRAO].reposicao.ticks;
const PISO_DA_CADEIA = PLANTIO + FAZENDA.ticksDoCiclo
  + GRANJA.ticksDoCiclo + ACOUGUE.ticksDoCiclo;      // 1346
```

- [ ] **Passo 2: rodar e ver falhar** (`Cannot find module`), então implementar os
      critérios um a um, rodando entre eles.
- [ ] **Passo 3: critério 1** — `estoqueDosArmazens` de `CARNE` sobe acima da linha
      de base do tick 0, e o primeiro tick em que sobe é `> PISO_DA_CADEIA`.
- [ ] **Passo 4: critério 2** — nos dois cenários negativos, `CARNE` no armazém
      fica **igual** à linha de base; sem a Malhada o `GRAO` se acumula e
      `fsmDe(fim, 'carneador') === 'esperando_insumo'`; sem a Fazenda nada é
      produzido (`goods-produced` vazio) e os dois especialistas esperam.
- [ ] **Passo 5: critério 3** — contando `goods-produced` por mercadoria:
      `bodes <= Math.floor(graos / GRANJA.entra[GRAO])`,
      `carnes <= ACOUGUE.sai[CARNE] * bodes`, e
      `carnes >= 0.85 * ACOUGUE.sai[CARNE] * Math.floor(graos / GRANJA.entra[GRAO])`.
- [ ] **Passo 6: critério 4** — `unidadesPorCiclo(GRANJA) === 2`,
      `Object.keys(GRANJA.sai).length === 2`, e o `COURO` no armazém acima da linha
      de base.
- [ ] **Passo 7: critério 5** — `opcoesDoMenuBuild(createInitialState(...))`:
      `swine_farm` com `desbloqueado: false` e `requer: 'farm'`; `butchers` com
      `requer: 'swine_farm'`; e no cenário da cadeia (com fazenda construída) a
      Malhada aparece liberada.
- [ ] **Passo 8:** rodar e ver os cinco verdes.

## Tarefa 3 — Evidência

- [ ] **Passo 1:** um `it` de evidência grava `test-output/F19b.json` com
      `gravarEvidencia('F19b', …)`: receitas derivadas, marcos (primeiro milho,
      bode, couro, carne, e cada um no armazém), série de produção em quatro
      pontos, saldo final dos armazéns, fração de `esperando_insumo` por
      especialista, e os dois cenários negativos.
- [ ] **Passo 2:** abrir o JSON com Read e conferir que os números são os da
      medição (546 / 1984 / 2276, 61 / 15 / 15 / 42).

## Tarefa 4 — Registro e fecho

- [ ] **Passo 1:** `BALANCE_LOG.md` ganha a terceira observação de vazão: 1 : 1 : 1
      deixa criador 55 % e carneador 86 % ociosos; `farm_por_swine_farm: 1,63` do
      oráculo contra **2,19** medido; `swine_farm_por_butchers: 3` **confirmado**.
      Nenhum número ajustado.
- [ ] **Passo 2:** apagar `tests/zz-probe-carne*.test.ts` e
      `test-output/zz-sonda-carne*.json`.
- [ ] **Passo 3:** `PROGRESS.md` com o que foi verificado (comando rodado, arquivo
      aberto) separado das decisões, e D1–D5 marcadas como **decisão minha, para o
      operador revisar**.
- [ ] **Passo 4:** `npm run verify`, depois `test-results.json` com
      `"F19b": { "passes": true, … }`, depois commit
      `feat(F19b): a cadeia da carne fecha do tile ao armazém, e o teste prova`.

## Riscos

- **O teste é longo (20 000 ticks × 3 cenários).** A sonda rodou os três em 3,1 s;
  se passar de ~20 s, cortar a janela dos cenários negativos, que fecham muito
  antes.
- **`pigs === ⌊corn/4⌋` é frágil como igualdade** (milho em trânsito no fim da
  janela). Por isso o critério 3 usa **teto e piso**, não igualdade.
- **A proporção 1 : 1 : 1 deixa o açougue 86 % ocioso.** Isso é balanceamento, e o
  operador foi explícito: *"Não ajuste número nenhum — a Fase B inteira está com
  proporções desatualizadas desde a F18."*
