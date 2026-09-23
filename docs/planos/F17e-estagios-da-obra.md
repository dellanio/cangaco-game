# F17e — Estágios visuais da obra: cinco, não três

> **Para quem executa:** este plano é para execução INLINE, tarefa a tarefa, na
> sessão que o escreveu. **Não** use `subagent-driven-development` nem
> `dispatching-parallel-agents` (CLAUDE.md §11: são os componentes mais caros em
> token e o orçamento é semanal). Os passos usam `- [ ]` para acompanhamento.

**Objetivo:** `estagioDaObra` passa de três valores a seis — cinco em obra mais o
completo —, o placeholder geométrico distingue os seis sem uma linha de arte, e
um roteiro observa os seis no mesmo cenário, com um PNG por estágio.

**Arquitetura:** a fronteira mora em `src/render/estagio-obra.ts`, aritmética
pura de ZERO imports (guarda estrutural em `tests/F04-grid-ortogonal.test.ts`).
A cena lê o estado e desenha; a contagem por estágio continua saindo por
`window.__cangaco.estagiosDeObraRenderizados`, que é onde o roteiro afirma.
**`src/sim/` não muda, e `src/ui/` não muda.**

**Stack:** TypeScript estrito, Vitest (headless), Playwright pelo runner
`tools/shot.js`.

**Fonte do critério:** `BUILD_PLAN.md`, item "F17e — Estágios visuais da obra:
cinco, não três" (linhas 951–1019). A tabela das seis fronteiras e as cinco Notas
são o contrato; este plano não reescreve nenhuma delas.

---

## Restrições globais

- `src/sim/` **não muda**. Se a implementação parecer pedir campo novo no estado
  ou seletor novo, **pare e reporte** (mesma regra que a F17d herdou).
- `src/render/estagio-obra.ts` continua com **zero imports**. A guarda é
  `tests/F04-grid-ortogonal.test.ts` (`ARITMETICA_PURA_EM_RENDER`) e a do
  `tests/F11c-estagio-obra.test.ts`. Os limiares entram como **constantes
  nomeadas** no próprio arquivo — decisão do operador, registrada na Nota "os
  limiares são constantes de desenho, não balanceamento".
- As fronteiras se escrevem em **aritmética inteira** (`hp * 3 <= hpTotal`),
  nunca em fração de float: a `barracks` tem 600 de HP e a fronteira cai
  exatamente em 200.
- Nenhum asset novo, nenhuma arte gerada ou baixada (CLAUDE.md §9). Placeholder é
  comportamento normal.
- Estágio sem arquivo no manifesto cai no **retângulo daquele estágio**; herdar o
  sprite do estágio vizinho é o que a Nota da F17f proíbe explicitamente.
- Evidência: `test-output/F17e.json` + `screenshots/F17e-*.png`. **Abrir com Read
  só `paredes` e `cobertura`**; os outros quatro valem pelo código de saída do
  roteiro (CLAUDE.md §8).

---

## Mapa de arquivos

| arquivo | o que acontece |
|---|---|
| `src/render/estagio-obra.ts` | seis estágios, terceiro argumento `nivelada`, constantes nomeadas, `ORDEM_DOS_ESTAGIOS`, `contagemDeEstagios()`, `estaEmObra()` |
| `tests/F17e-estagios.test.ts` | **novo**: os dois lados das seis fronteiras + monotonicidade + evidência |
| `tests/F11c-estagio-obra.test.ts` | atualizado na MESMA tarefa que muda a função |
| `src/render/debug.ts` | o record de contagem passa a nascer de `contagemDeEstagios()` |
| `src/render/scenes/WorldScene.ts` | passa `nivelada`, conta pelos seis, e (Tarefa 2) desenha os seis |
| `data/theme-sertao.json` | `obra`: cinco rótulos, um por estágio em obra |
| `tools/shots/F11c.js` | atualizado na MESMA tarefa que muda a forma do record |
| `assets/manifest.json` | a chave `madeira` do armazém vira `estrutura` |
| `tests/F17f-manifesto.test.ts` | asserção do armazém fica mais estrita |
| `tools/shots/F17e.js` | **novo**: os seis estágios num cenário, um PNG cada |

---

## Tarefa 1 — a função: seis estágios, e a cena os conta

**Files:**
- Modify: `src/render/estagio-obra.ts` (arquivo inteiro)
- Create: `tests/F17e-estagios.test.ts`
- Modify: `tests/F11c-estagio-obra.test.ts`
- Modify: `src/render/debug.ts`, `src/render/scenes/WorldScene.ts`
- Modify: `data/theme-sertao.json` (bloco `obra`)
- Modify: `tools/shots/F11c.js`

**Interfaces:**
- Produz: `estagioDaObra(hp, hpTotal, nivelada): EstagioDaObra` com a união de
  seis; `ORDEM_DOS_ESTAGIOS: readonly EstagioDaObra[]`;
  `contagemDeEstagios(): Record<EstagioDaObra, number>`;
  `estaEmObra(e): e is EstagioEmObra`.
- Consome: `CanteiroDaObra.nivelada` (F17d), que a cena já calcula.

**Por que tanta coisa num commit só:** o terceiro argumento é **obrigatório** e a
união muda de tamanho, então `npm run typecheck` só volta ao verde quando a cena,
o debug e o tema acompanham. Dividir aqui entregaria um commit que não compila.
O **desenho** continua o de hoje nesta tarefa; quem o muda é a Tarefa 2.
`tools/shots/F11c.js` entra aqui, e não no fim, porque é esta tarefa que muda a
forma do record que ele afirma — roteiro que afirma o texto substituído reprova,
e a única dúvida é quantas tarefas depois.

- [ ] **Passo 1: escrever o teste que falha** — `tests/F17e-estagios.test.ts`

```ts
/**
 * F17e — os SEIS estagios visuais da obra.
 *
 * Os dois lados de cada fronteira, com `hpTotal` vindo do DADO (nunca digitado
 * aqui), mais a propriedade que nenhum caso isolado prova: varrendo `hp` de 0 a
 * `hpTotal`, o estagio nunca anda para tras.
 *
 * A `barracks` esta aqui de proposito: 600 de HP faz as duas fronteiras do meio
 * cairem em 200 e 400 EXATOS, que e onde comparacao de float seria sorteio.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import {
  estagioDaObra, estaEmObra, contagemDeEstagios, ORDEM_DOS_ESTAGIOS,
} from '../src/render/estagio-obra';
import type { EstagioDaObra } from '../src/render/estagio-obra';
import { gravarEvidencia } from './helpers/evidence';

const hpDe = (id: string): number => {
  const def = gameData.predios.find((p) => p.id === id);
  if (!def) throw new Error(`o dado nao tem o predio '${id}'`);
  return def.hp;
};

const HP_BARRACKS = hpDe('barracks');
const HP_QUARRY = hpDe('quarry');
const posicao = (e: EstagioDaObra): number => ORDEM_DOS_ESTAGIOS.indexOf(e);

describe('F17e — as seis fronteiras', () => {
  it('a barracks tem os 600 de HP que fazem as fronteiras cairem em inteiro', () => {
    expect(HP_BARRACKS).toBe(600);
  });

  it('hp === 0 e NAO nivelada e marcacao; hp === 0 e nivelada e fundacao', () => {
    expect(estagioDaObra(0, HP_BARRACKS, false)).toBe('marcacao');
    expect(estagioDaObra(0, HP_BARRACKS, true)).toBe('fundacao');
  });

  it('o primeiro martelo tira a obra da fundacao, nivelada ou nao', () => {
    expect(estagioDaObra(1, HP_BARRACKS, true)).toBe('estrutura');
    expect(estagioDaObra(1, HP_BARRACKS, false)).toBe('estrutura');
  });

  it('estrutura -> paredes cai em 200 na barracks (600/3), nos dois lados', () => {
    expect(estagioDaObra(200, HP_BARRACKS, true)).toBe('estrutura');
    expect(estagioDaObra(201, HP_BARRACKS, true)).toBe('paredes');
  });

  it('paredes -> cobertura cai em 400 na barracks (600*2/3), nos dois lados', () => {
    expect(estagioDaObra(400, HP_BARRACKS, true)).toBe('paredes');
    expect(estagioDaObra(401, HP_BARRACKS, true)).toBe('cobertura');
  });

  it('cobertura -> completo cai no hpTotal, nos dois lados', () => {
    expect(estagioDaObra(HP_BARRACKS - 1, HP_BARRACKS, true)).toBe('cobertura');
    expect(estagioDaObra(HP_BARRACKS, HP_BARRACKS, true)).toBe('completo');
  });

  it('num hpTotal que NAO divide por 3 as fronteiras truncam (quarry, 250)', () => {
    expect(HP_QUARRY).toBe(250); // 250/3 = 83,33 e 500/3 = 166,66
    expect(estagioDaObra(83, HP_QUARRY, true)).toBe('estrutura');
    expect(estagioDaObra(84, HP_QUARRY, true)).toBe('paredes');
    expect(estagioDaObra(166, HP_QUARRY, true)).toBe('paredes');
    expect(estagioDaObra(167, HP_QUARRY, true)).toBe('cobertura');
  });

  it('passar do teto nao trava a funcao', () => {
    expect(estagioDaObra(9999, HP_QUARRY, true)).toBe('completo');
    expect(estagioDaObra(-5, HP_QUARRY, false)).toBe('marcacao');
  });
});

describe('F17e — monotonicidade: o estagio nunca anda para tras', () => {
  for (const nivelada of [false, true]) {
    it(`varrendo hp de 0 a hpTotal com nivelada=${nivelada}`, () => {
      for (const hpTotal of [HP_QUARRY, HP_BARRACKS]) {
        let anterior = -1;
        for (let hp = 0; hp <= hpTotal; hp++) {
          const p = posicao(estagioDaObra(hp, hpTotal, nivelada));
          expect(p, `hp=${hp} de ${hpTotal} caiu num estagio fora da ordem`).toBeGreaterThanOrEqual(0);
          expect(p, `hp=${hp} de ${hpTotal} andou para tras`).toBeGreaterThanOrEqual(anterior);
          anterior = p;
        }
      }
    });
  }

  it('todos os seis aparecem em ALGUM hp da varredura (nenhum e inalcancavel)', () => {
    const vistos = new Set<EstagioDaObra>();
    for (const nivelada of [false, true]) {
      for (let hp = 0; hp <= HP_BARRACKS; hp++) vistos.add(estagioDaObra(hp, HP_BARRACKS, nivelada));
    }
    expect([...vistos].sort()).toEqual([...ORDEM_DOS_ESTAGIOS].sort());
  });
});

describe('F17e — a ordem e a contagem sao a MESMA lista', () => {
  it('contagemDeEstagios tem exatamente as chaves de ORDEM_DOS_ESTAGIOS', () => {
    expect(Object.keys(contagemDeEstagios()).sort()).toEqual([...ORDEM_DOS_ESTAGIOS].sort());
    expect(Object.values(contagemDeEstagios()).every((n) => n === 0)).toBe(true);
  });

  it('estaEmObra separa os cinco do completo, sem lista paralela', () => {
    expect(ORDEM_DOS_ESTAGIOS.filter(estaEmObra)).toHaveLength(ORDEM_DOS_ESTAGIOS.length - 1);
    expect(estaEmObra('completo')).toBe(false);
  });

  it('grava a evidencia', () => {
    const fronteiras = [
      { tipo: 'quarry', hpTotal: HP_QUARRY },
      { tipo: 'barracks', hpTotal: HP_BARRACKS },
    ].map(({ tipo, hpTotal }) => {
      const transicoes: { hp: number; de: EstagioDaObra; para: EstagioDaObra }[] = [];
      for (let hp = 1; hp <= hpTotal; hp++) {
        const de = estagioDaObra(hp - 1, hpTotal, true);
        const para = estagioDaObra(hp, hpTotal, true);
        if (de !== para) transicoes.push({ hp, de, para });
      }
      return {
        tipo,
        hpTotal,
        semNivelar: estagioDaObra(0, hpTotal, false),
        nivelada: estagioDaObra(0, hpTotal, true),
        transicoes,
      };
    });
    gravarEvidencia('F17e', {
      feature: 'F17e-estagios-da-obra',
      ordem: ORDEM_DOS_ESTAGIOS,
      emObra: ORDEM_DOS_ESTAGIOS.filter(estaEmObra),
      fronteiras,
    });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run tests/F17e-estagios.test.ts`
Esperado: FALHA — `estaEmObra` / `contagemDeEstagios` / `ORDEM_DOS_ESTAGIOS` não
existem, e `estagioDaObra` aceita dois argumentos.

- [ ] **Passo 3: reescrever `src/render/estagio-obra.ts`**

```ts
/**
 * Aritmetica pura, ZERO imports (nem `../sim/data`, nem Phaser): os SEIS
 * estagios visuais de um predio — cinco em obra mais o de pe. Ate a F17d eram
 * tres (`marcacao`, `madeira`, `completo`); a decisao de tres foi minha e estava
 * errada (BUILD_PLAN, Nota de correcao de aceite da F17e). O PROGRESS da F11c ja
 * registrava a saida: "a mesma funcao pura pode dividir a fase do meio pela
 * fracao de `hp`". E o que esta feito aqui.
 *
 * As tres entradas sao as unicas que existem: `hp`, `hpTotal` e o "ja nivelou"
 * que a F17d passou a calcular (`render/nivelamento-obra.ts`). Nenhuma delas e
 * dado novo — a fronteira `marcacao`/`fundacao` e a unica que olha o terreno.
 */
export type EstagioDaObra =
  | 'marcacao'
  | 'fundacao'
  | 'estrutura'
  | 'paredes'
  | 'cobertura'
  | 'completo';

/** Um estagio de OBRA: qualquer um menos o predio de pe. */
export type EstagioEmObra = Exclude<EstagioDaObra, 'completo'>;

/**
 * A ordem em que a obra sobe. Uma lista so, e dela saem a monotonicidade do
 * teste e a contagem do debug — duas listas paralelas e como elas divergem.
 */
export const ORDEM_DOS_ESTAGIOS: readonly EstagioDaObra[] = [
  'marcacao', 'fundacao', 'estrutura', 'paredes', 'cobertura', 'completo',
];

/**
 * As duas fronteiras do meio, em PARTES inteiras do HP total. Sao constantes de
 * DESENHO, nao balanceamento (decisao do operador, 2026-09-23): um jogador nao
 * distingue fronteira em 1/3 de fronteira em 0,35 — distingue a casa subindo.
 * Por isso ficam aqui e nao em `data/`; a guarda estrutural deste arquivo (zero
 * imports) nem deixaria ele ler `data/`. Se um dia virarem dado, passam pelo
 * funil `render/predios.ts`, como o custo e o alvo de nivelamento.
 *
 * INTEIRAS de proposito: `hp * PARTES <= hpTotal` e nunca `hp / hpTotal <= 1/3`.
 * A `barracks` tem 600 de HP e a fronteira cai exatamente em 200 — comparacao de
 * float ali e sorteio.
 */
const PARTES = 3;
const PARTES_ATE_ESTRUTURA = 1;
const PARTES_ATE_PAREDES = 2;

export function estagioDaObra(hp: number, hpTotal: number, nivelada: boolean): EstagioDaObra {
  if (hp >= hpTotal) return 'completo';
  if (hp <= 0) return nivelada ? 'fundacao' : 'marcacao';
  if (hp * PARTES <= hpTotal * PARTES_ATE_ESTRUTURA) return 'estrutura';
  if (hp * PARTES <= hpTotal * PARTES_ATE_PAREDES) return 'paredes';
  return 'cobertura';
}

/** Type guard, e nao um `!==` solto em cada chamador: e o que deixa o
 *  compilador provar que o tema tem rotulo para todo estagio EM OBRA. */
export function estaEmObra(estagio: EstagioDaObra): estagio is EstagioEmObra {
  return estagio !== 'completo';
}

/** O contador zerado dos seis estagios. Existe para a cena e o debug nascerem
 *  da MESMA forma: o `Record` exige as seis chaves, entao acrescentar um estagio
 *  a uniao quebra a compilacao aqui, e nao silenciosamente na tela. */
export function contagemDeEstagios(): Record<EstagioDaObra, number> {
  return { marcacao: 0, fundacao: 0, estrutura: 0, paredes: 0, cobertura: 0, completo: 0 };
}
```

- [ ] **Passo 4: rodar o teste novo e ver passar**

Rodar: `npx vitest run tests/F17e-estagios.test.ts`
Esperado: PASSA. `npx vitest run` inteiro ainda FALHA — `F11c-estagio-obra` e a
compilação da cena vêm nos passos seguintes.

- [ ] **Passo 5: atualizar `tests/F11c-estagio-obra.test.ts`**

O aceite da F11c **não é reaberto**: o que ela fixou — nada martelado / em obra /
de pé — continua verdade, e agora com um nome por camada. As asserções ficam mais
estritas, não só diferentes: a antiga não distinguia a primeira martelada da
última, e a nova distingue.

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { estagioDaObra, estaEmObra } from '../src/render/estagio-obra';

// F17e: os tres estagios da F11c viraram seis (cinco em obra + completo). O que
// a F11c fixou continua valendo e e o que este arquivo guarda — "nada martelado",
// "em obra" e "de pe" —; a divisao fina do meio e da F17e.
describe('F11c — estagioDaObra: aritmetica pura, sem import nenhum', () => {
  it('hp === 0 e o chao: marcacao antes de nivelar, fundacao depois', () => {
    expect(estagioDaObra(0, 250, false)).toBe('marcacao');
    expect(estagioDaObra(0, 250, true)).toBe('fundacao');
  });

  it('0 < hp < hpTotal e SEMPRE um estagio de obra, nunca chao nem predio de pe', () => {
    for (const hp of [1, 120, 249]) {
      const e = estagioDaObra(hp, 250, true);
      expect(estaEmObra(e), `hp=${hp}`).toBe(true);
      expect(['marcacao', 'fundacao'], `hp=${hp}`).not.toContain(e);
    }
  });

  it('hp >= hpTotal e completo (o predio de pe)', () => {
    expect(estagioDaObra(250, 250, true)).toBe('completo');
  });

  it('nunca passa de hpTotal na pratica, mas a funcao nao trava se passasse', () => {
    expect(estagioDaObra(999, 250, true)).toBe('completo');
  });

  it('nao importa nada: aritmetica pura, como grid.ts', () => {
    const fonte = readFileSync('src/render/estagio-obra.ts', 'utf-8');
    expect(/^\s*import\b/m.test(fonte)).toBe(false);
  });
});
```

- [ ] **Passo 6: os cinco rótulos do tema** — `data/theme-sertao.json`, bloco `obra`

A chave `madeira` **sai**: ela nomeia um estágio que não existe mais, e rótulo
órfão é o que um leitor futuro confunde com estágio vivo. O `completo` continua
sem rótulo (o prédio de pé mostra só o nome).

```json
  "obra": {
    "marcacao": "marcação no chão",
    "fundacao": "alicerce pronto",
    "estrutura": "armação de madeira",
    "paredes": "paredes subindo",
    "cobertura": "telhado por fechar"
  },
```

- [ ] **Passo 7: `src/render/debug.ts`** — o record nasce da função

Trocar o import de tipo por um que traga também o valor, e a inicialização:

```ts
import { contagemDeEstagios } from './estagio-obra';
import type { EstagioDaObra } from './estagio-obra';
```

Na doc do campo, trocar "quebrada por estagio (`estagio-obra.ts`)" por
"quebrada pelos SEIS estagios da F17e (`estagio-obra.ts`)"; em
`publicarEstadoDebug`, trocar a literal pelos seis:

```ts
    estagiosDeObraRenderizados: contagemDeEstagios(),
```

E na doc de `obrasRenderizadas`, trocar "marcacao + madeira, F11c" por
"a soma dos cinco estagios EM OBRA (F17e); o completo fica de fora".

- [ ] **Passo 8: `src/render/scenes/WorldScene.ts`** — passar `nivelada` e contar pelos seis

Três edições, todas mecânicas (o desenho é da Tarefa 2):

1. Import: `import { contagemDeEstagios, estagioDaObra, estaEmObra, ORDEM_DOS_ESTAGIOS } from '../estagio-obra';`
2. Em `atualizarPredios`, trocar a literal do contador por
   `const porEstagio = contagemDeEstagios();` e **mover o cálculo do canteiro
   para ANTES do estágio**, que agora depende dele:

```ts
      const aparencia = aparenciaDoPredio(predio.tipo);
      // F17e: o canteiro vem ANTES do estagio porque a fronteira
      // marcacao/fundacao e a unica das seis que olha o terreno (F17d).
      const canteiro = predio.estado === 'obra'
        ? canteiroDaObra(
          predio.obra.nivelamento, aparencia.alvoDeNivelamento, aparencia.largura * aparencia.altura,
        )
        : null;
      if (canteiro !== null) canteiros[id] = canteiro;
      const estagio = estagioDaObra(predio.hp, aparencia.hpTotal, canteiro === null || canteiro.nivelada);
      porEstagio[estagio] += 1;
```

   (o bloco antigo do canteiro, que ficava depois do medidor, sai daqui.)
3. A contagem publicada:

```ts
    // F17e: a soma dos estagios EM OBRA, derivada da MESMA lista que os nomeia —
    // somar chave por chave aqui seria a segunda lista que diverge da primeira.
    debug.obrasRenderizadas = ORDEM_DOS_ESTAGIOS
      .filter(estaEmObra)
      .reduce((total, e) => total + porEstagio[e], 0);
```

- [ ] **Passo 9: `tools/shots/F11c.js`** — o record mudou de forma nesta tarefa

O roteiro comparava o record inteiro com `JSON.stringify`, o que quebra com seis
chaves. A asserção nova é mais estrita: além de exigir os mesmos números, ela
falha se **qualquer outro** estágio tiver contagem — inclusive um estágio que
ainda não existe.

Acrescentar, junto dos outros helpers:

```js
  /** Exatamente estas contagens, e zero em todo o resto — inclusive em estagio
   *  que nao existia quando este roteiro foi escrito (F17e). */
  const so = (record, esperado) => Object.entries(record)
    .every(([estagio, n]) => n === (esperado[estagio] ?? 0));
```

e trocar as três comparações:

```js
  afirmar(
    so(s0.estagiosDeObraRenderizados, { completo: 2 }),
    `no inicio os 2 predios do cenario deveriam contar como 'completo', veio ${JSON.stringify(s0.estagiosDeObraRenderizados)}`,
  );
```
```js
  afirmar(
    so(s.estagiosDeObraRenderizados, { marcacao: 1, completo: 2 }),
    `recem-plantada (hp=0, terreno por aplainar) a obra deveria contar como 'marcacao', veio ${JSON.stringify(s.estagiosDeObraRenderizados)}`,
  );
```
```js
  // F17e: a primeira martelada cai em ESTRUTURA, e nao mais no generico 'madeira' —
  // 250 de HP na pedreira poem a fronteira estrutura/paredes em 83.
  s = await ate(
    (e) => e.estagiosDeObraRenderizados.estrutura === 1,
    10, 60, 'a obra deveria passar a ESTRUTURA (primeira martelada)',
  );
  afirmar(
    so(s.estagiosDeObraRenderizados, { estrutura: 1, completo: 2 }),
    `com hp>0 e no primeiro terco a obra deveria contar como 'estrutura', veio ${JSON.stringify(s.estagiosDeObraRenderizados)}`,
  );
  afirmar(s.obrasRenderizadas === 1, `a obra em estrutura ainda e 'obra' (nao completou), veio ${s.obrasRenderizadas}`);
  await capturar('estrutura');
```
```js
  afirmar(
    so(s.estagiosDeObraRenderizados, { completo: 3 }),
    `de pe, o Quarry deveria somar ao 'completo' dos 2 predios do cenario (3 no total), veio ${JSON.stringify(s.estagiosDeObraRenderizados)}`,
  );
```

Atualizar também o comentário de topo: "passa pelos TRES estagios visuais
(marcacao -> madeira -> completo)" vira "passa pelos estagios visuais
(marcacao -> ... -> completo); a prova dos SEIS e o roteiro da F17e".

- [ ] **Passo 10: verificar**

Rodar: `npm run test` → verde (inclui F17e e F11c).
Rodar: `npm run typecheck && npm run lint && npm run validate:data` → sem erro.
Rodar: `npm run shot -- F11c` → EXIT 0. **Não abrir as imagens** (§8: em roteiro
de outra feature vale o código de saída).

- [ ] **Passo 11: commit**

```bash
git add src/render/estagio-obra.ts src/render/debug.ts src/render/scenes/WorldScene.ts \
  data/theme-sertao.json tests/F17e-estagios.test.ts tests/F11c-estagio-obra.test.ts \
  tools/shots/F11c.js
git commit -m "feat(F17e): seis estagios no lugar de tres"
```

---

## Tarefa 2 — o desenho: os seis se distinguem sem uma linha de arte

**Files:**
- Modify: `src/render/scenes/WorldScene.ts` (`desenharPlaceholder`)

**Interfaces:**
- Consome: `EstagioDaObra`, `estaEmObra` (Tarefa 1).
- Produz: nada que outra tarefa leia — o resultado é pixel, e quem o afirma é o
  roteiro da Tarefa 4, pelo número que a Tarefa 1 já publica.

**O desenho, e por que ele basta:** contorno vazado do footprint em todo estágio
(o jogador continua vendo o lote), volume crescendo em **três patamares** de
altura, ancorado no pé do footprint, e **uma cor por camada** — terra, madeira,
pedra, telha. `marcacao` é o único sem volume: estacas e corda. Nada disso pede
arte; quando a arte chegar, troca o desenho, não a fronteira.

- [ ] **Passo 1: a tabela de aparência, ao lado de `desenharPlaceholder`**

```ts
/** F17e — a cara de cada estagio no placeholder geometrico (§9). `altura` e a
 *  fracao da altura do footprint que o volume ocupa, ancorado no PE: sao os tres
 *  patamares que distinguem estrutura, paredes e cobertura de longe. `marcacao`
 *  nao tem volume nenhum — e o lote marcado no chao, e so.
 *
 *  Cor e opacidade sao DESENHO, nao balanceamento, como ja valia para o canteiro
 *  da F17d e para o medidor da F17b (§2.3 fala de custo, tempo, capacidade e
 *  proporcao). O `Record` exige os seis: acrescentar um estagio a uniao quebra a
 *  compilacao aqui, e nao silenciosamente na tela. */
interface CaraDoEstagio {
  readonly altura: number;
  readonly cor: number;
  readonly opacidade: number;
}
const CARA_DO_ESTAGIO: Record<EstagioDaObra, CaraDoEstagio> = {
  marcacao: { altura: 0, cor: 0x6b4a33, opacidade: 0 },
  fundacao: { altura: 1 / 6, cor: 0x8a6a4a, opacidade: 0.6 },
  estrutura: { altura: 1 / 3, cor: 0xa9763f, opacidade: 0.55 },
  paredes: { altura: 2 / 3, cor: 0x9a968c, opacidade: 0.75 },
  cobertura: { altura: 1, cor: 0x7a4a33, opacidade: 0.9 },
  completo: { altura: 1, cor: 0x6b4a33, opacidade: 1 },
};
```

- [ ] **Passo 2: trocar o corpo de `desenharPlaceholder`**

```ts
  /** O placeholder do §9: o lote e o volume que sobe nele. A F11c desenhava o
   *  mesmo retangulo com tres opacidades; a F17e da a cada um dos seis estagios
   *  uma silhueta propria — contorno vazado sempre, volume em tres patamares de
   *  altura e uma cor por camada. Continua sendo o desenho de 27 dos 28 predios,
   *  e continua NAO sendo falha. */
  private desenharPlaceholder(
    estagio: EstagioDaObra, nome: string, larguraPx: number, alturaPx: number,
  ): Phaser.GameObjects.GameObject[] {
    const emObra = estaEmObra(estagio);
    const cara = CARA_DO_ESTAGIO[estagio];
    const objetos: Phaser.GameObjects.GameObject[] = [];

    // O lote, sempre: e o que diz ao jogador quanto chao a obra vai ocupar,
    // inclusive quando ainda nao ha volume nenhum em cima dele.
    const lote = this.add.rectangle(larguraPx / 2, alturaPx / 2, larguraPx, alturaPx, cara.cor, 0);
    lote.setStrokeStyle(2, emObra ? 0xede3d0 : 0x2c1d12);
    objetos.push(lote);

    // O volume, ancorado no PE do footprint: a obra sobe do chao para cima, e
    // nao cresce a partir do meio.
    if (cara.altura > 0) {
      const altura = alturaPx * cara.altura;
      const volume = this.add.rectangle(
        larguraPx / 2, alturaPx - altura / 2, larguraPx, altura, cara.cor, cara.opacidade,
      );
      objetos.push(volume);
    }

    const texto = emObra ? `${nome}\n(${temaSertao.obra[estagio]})` : nome;
    const rotulo = this.add.text(larguraPx / 2, alturaPx / 2, texto, {
      fontSize: '14px',
      color: '#ede3d0',
      align: 'center',
      wordWrap: { width: larguraPx - 8 },
    });
    rotulo.setOrigin(0.5, 0.5);
    objetos.push(rotulo);
    return objetos;
  }
```

`temaSertao.obra[estagio]` compila porque `estaEmObra` é type guard: dentro do
ternário o compilador sabe que `estagio` é um dos cinco que o tema nomeia. Se
alguém acrescentar um estágio em obra sem rótulo, **quebra aqui**.

- [ ] **Passo 3: verificar**

Rodar: `npm run typecheck && npm run lint && npm run test` → sem erro.
Rodar: `npm run shot -- F11c` e `npm run shot -- F17d` → EXIT 0 nos dois. Sem
abrir imagem: a prova visual dos seis é a Tarefa 4.

- [ ] **Passo 4: commit**

```bash
git add src/render/scenes/WorldScene.ts
git commit -m "feat(F17e): o placeholder distingue os seis estagios"
```

---

## Tarefa 3 — a arte do armazém reencontra o estágio que ela mostra

**Files:**
- Modify: `assets/manifest.json` (chave `madeira` -> `estrutura`)
- Modify: `tests/F17f-manifesto.test.ts`
- Modify: `tools/derivar-sprites.js` (um comentário)

**Por quê:** a F17f declarou a arte do armazém em três estágios, e o do meio se
chamava `madeira`. Com a F17e esse estágio deixa de existir, e sem esta tarefa o
arquivo entregue pelo operador ficaria **órfão**: o armazém teria arte em dois
estágios e o PNG do meio nunca mais apareceria na tela. A base versionada se
chama `armazem_02_estrutura.png` — o nome que o próprio operador deu à arte é o
nome do estágio novo. É remapeamento de UMA chave, sem arte nova e sem tocar em
PNG (CLAUDE.md §9: arte entra por decisão humana).

**O arquivo derivado continua se chamando `storehouse_madeira.png`:**
`render/manifesto.ts` é explícito em não parsear nome de arquivo — quem mapeia
estágio -> arquivo é o campo `estados`. Renomear o PNG seria mover binário no git
e rodar de novo o derivador, sem ganho nenhum.

- [ ] **Passo 1: o manifesto**

```json
      "estados": {
        "marcacao": "sprites/storehouse/storehouse_marcacao.png",
        "estrutura": "sprites/storehouse/storehouse_madeira.png",
        "completo": "sprites/storehouse/storehouse_completo.png"
      },
```

- [ ] **Passo 2: `tools/derivar-sprites.js`, comentário na linha da saída**

```js
  // F17e: a chave do manifesto para esta saida e `estrutura` (o estagio `madeira`
  // deixou de existir). O NOME do arquivo fica: `manifesto.ts` nao parseia nome.
  { base: 'base/storehouse/armazem_02_estrutura.png', saida: 'sprites/storehouse/storehouse_madeira.png' },
```

- [ ] **Passo 3: `tests/F17f-manifesto.test.ts`, asserções mais estritas**

Duas mudanças. A primeira nomeia o estágio novo **e** exige que o antigo tenha
sumido — as duas coisas, porque só trocar o nome deixaria passar um manifesto com
as duas chaves:

```ts
  it('o armazem tem arte nos tres estagios', () => {
    const armazem = assetDoPredio(manifesto, 'storehouse');
    expect(armazem).not.toBeNull();
    expect(arquivoDoEstagio(armazem!, 'marcacao')).toBe('sprites/storehouse/storehouse_marcacao.png');
    // F17e: o estagio do meio passou a se chamar `estrutura`. O arquivo e o
    // mesmo; a chave e que acompanha o vocabulario dos seis estagios.
    expect(arquivoDoEstagio(armazem!, 'estrutura')).toBe('sprites/storehouse/storehouse_madeira.png');
    expect(arquivoDoEstagio(armazem!, 'completo')).toBe('sprites/storehouse/storehouse_completo.png');
    // e o nome antigo nao pode ter ficado para tras: chave orfa e arte que nunca
    // mais aparece na tela, sem ninguem reprovar.
    expect(arquivoDoEstagio(armazem!, 'madeira')).toBeNull();
  });
```

A segunda troca o estágio fictício por dois estágios **de verdade** que o armazém
ainda não tem, que é o caso que a Nota da F17f manda provar:

```ts
  it('estagio sem arte resolve null, mesmo num predio que tem arte', () => {
    const armazem = assetDoPredio(manifesto, 'storehouse');
    // F17e: `paredes` e `cobertura` existem no render e NAO tem arte. O
    // resolvedor devolve null e a cena cai no retangulo DAQUELE estagio — herdar
    // o sprite do estagio vizinho mentiria sobre o progresso.
    expect(arquivoDoEstagio(armazem!, 'paredes')).toBeNull();
    expect(arquivoDoEstagio(armazem!, 'cobertura')).toBeNull();
    expect(arquivoDoEstagio(armazem!, 'estagio_que_nao_existe')).toBeNull();
  });
```

- [ ] **Passo 4: verificar**

Rodar: `npm run test && npm run typecheck && npm run lint && npm run validate:data`
Rodar: `npm run shot -- F17f` → EXIT 0 (ele afirma que o armazém completo é
desenhado pelo PNG; a chave `completo` não mudou).

- [ ] **Passo 5: commit**

```bash
git add assets/manifest.json tests/F17f-manifesto.test.ts tools/derivar-sprites.js
git commit -m "feat(F17e): a arte do meio do armazem passa a ser o estagio estrutura"
```

---

## Tarefa 4 — o roteiro: os seis num cenário, um PNG cada

**Files:**
- Create: `tools/shots/F17e.js`

**Interfaces:**
- Consome: `window.__cangaco.estagiosDeObraRenderizados` (seis chaves, Tarefa 1),
  `prediosDoEstado`, `avancar` (F11a), `_canvas.js`.

**Enquadramento — medir antes de fotografar.** O `BALANCE_LOG` de 2026-09-23
registra que o enquadramento dos roteiros põe a obra parcialmente fora do quadro,
e que a F17e é justamente a feature que precisa mostrar seis desenhos. Este
roteiro **mede** o retângulo do footprint contra o do canvas antes da primeira
foto, e falha alto se não couber — o número medido vai na mensagem do `afirmar`,
que o runner grava em `test-output/F17e-shot.json`.

**Se não couber:** a saída é mover a obra para o **oeste** do armazém
(`gx = armazem.gx - largObra - 1`, mesma linha de porta, a mesma rua arrastada ao
contrário). Não mexer na geometria dos roteiros da F16b/F17b/F17d: eles estão
validados e não é esta feature que os reenquadra.

- [ ] **Passo 1: medir o quadro atual (sonda, antes de escrever o resto)**

Escrever o roteiro até o fim do plantio e rodar só até ali, com um
`afirmar(true, ...)` que imprima `canvas`, a posição de tela do footprint e a
sobra de cada lado. Ler o número em `test-output/F17e-shot.json`. **Decidir pela
medida**, e registrar a decisão em `PROGRESS.md` na Tarefa 5.

- [ ] **Passo 2: o roteiro inteiro** — `tools/shots/F17e.js`

```js
'use strict';

// Roteiro da F17e — OS SEIS ESTAGIOS VISUAIS, NO MESMO CENARIO.
//
// O que ele existe para provar: uma obra plantada pela UI passa pelos SEIS
// estagios, so pelo `step()`, e cada um deles chega a ser desenhado. Um PNG por
// estagio, tirado no tick em que o estagio aparece pela PRIMEIRA vez.
//
// Afirma numero, nunca pixel (§8): a contagem por estagio sai de
// `window.__cangaco.estagiosDeObraRenderizados`. A lista dos seis NAO esta
// digitada aqui — ela vem das chaves que a propria cena publica, senao o roteiro
// provaria a lista dele mesmo em vez da do jogo.
//
// `completo` e o unico que nao se conta por presenca: os 2 predios do cenario ja
// nascem completos. Para a obra, o que vale e a contagem SUBIR de 2 para 3.
//
// ENQUADRAMENTO: o BALANCE_LOG de 2026-09-23 registra que o quadro herdado poe a
// obra parcialmente fora. Aqui o footprint inteiro e medido contra o canvas antes
// da primeira foto, e a medida vai na mensagem do afirmar.

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

const TIPO_DA_OBRA = 'quarry';
/** Passo pequeno de proposito: `hpPorMartelada` e 5 e a martelada leva poucos
 *  ticks, entao cada estagio dura dezenas de ticks. Um passo de 5 nunca pula um
 *  estagio inteiro entre duas leituras — e o que torna "os seis apareceram"
 *  alcancavel, e nao sorte. */
const PASSO = 5;
/** O roteiro da F11c leva a MESMA obra de hp 0 ate o fim dentro de 3000 ticks.
 *  Falhar por teto E FALHAR, nao motivo para dormir mais. */
const TETO = 4000;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);

  const esperarFrame = () => page.waitForTimeout(200);
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);

  async function telaDoTile(gx, gy) {
    const { camera } = await estado();
    return {
      x: canvas.left + gx * TILE_PX - camera.scrollX,
      y: canvas.top + gy * TILE_PX - camera.scrollY,
    };
  }

  async function pontoDoTile(gx, gy) {
    const canto = await telaDoTile(gx, gy);
    const p = { x: canto.x + TILE_PX / 2, y: canto.y + TILE_PX / 2 };
    afirmar(
      p.x > canvas.left && p.x < canvas.right && p.y > canvas.top && p.y < canvas.bottom,
      `o tile (${gx},${gy}) deveria estar visivel no canvas, cairia em (${p.x},${p.y})`,
    );
    return p;
  }

  async function clicarNoTile(gx, gy) {
    const p = await pontoDoTile(gx, gy);
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  }

  // ---- geometria, tirada dos JSON ------------------------------------------
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largObra, altObra] = defDe(TIPO_DA_OBRA).tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');
  const obra = { gx: escola.gx + largEs + 1, gy: yRua - altObra };
  const meioDaObra = { gx: obra.gx + Math.floor(largObra / 2), gy: obra.gy };
  const pontaEsquerda = { gx: armazem.gx, gy: yRua };
  const pontaDireita = { gx: obra.gx + largObra - 1, gy: yRua };
  const tilesDaRua = pontaDireita.gx - pontaEsquerda.gx + 1;

  // ---- 0. ENQUADRAMENTO: o footprint INTEIRO cabe no canvas? ---------------
  const canto = await telaDoTile(obra.gx, obra.gy);
  const fim = await telaDoTile(obra.gx + largObra, obra.gy + altObra);
  const sobra = {
    esquerda: Math.round(canto.x - canvas.left),
    direita: Math.round(canvas.right - fim.x),
    topo: Math.round(canto.y - canvas.top),
    base: Math.round(canvas.bottom - fim.y),
  };
  afirmar(true, `enquadramento medido: canvas ${Math.round(canvas.width)}x${Math.round(canvas.height)}, `
    + `footprint ${largObra}x${altObra} tiles, sobra ${JSON.stringify(sobra)}`);
  afirmar(
    sobra.esquerda >= 0 && sobra.direita >= 0 && sobra.topo >= 0 && sobra.base >= 0,
    `o footprint inteiro da obra tem de caber no canvas para a foto do estagio valer: sobra ${JSON.stringify(sobra)}`,
  );

  // ---- 1. a rua ------------------------------------------------------------
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  const pEsq = await pontoDoTile(pontaEsquerda.gx, pontaEsquerda.gy);
  const pDir = await pontoDoTile(pontaDireita.gx, pontaDireita.gy);
  await arrastarDentroDoCanvas(page, canvas, [pEsq, pDir]);
  await avancar(1);
  await esperarFrame();
  afirmar(
    (await estado()).estradasRenderizadas === tilesDaRua,
    `a rua deveria ter ${tilesDaRua} tiles, veio ${(await estado()).estradasRenderizadas}`,
  );
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 2. a linha de base, ANTES de plantar --------------------------------
  const inicial = await estado();
  const ESTAGIOS = Object.keys(inicial.estagiosDeObraRenderizados);
  afirmar(
    ESTAGIOS.length === 6,
    `a cena deveria publicar os SEIS estagios da F17e, veio ${JSON.stringify(ESTAGIOS)}`,
  );
  const COMPLETOS_ANTES = inicial.estagiosDeObraRenderizados.completo;
  afirmar(
    inicial.obrasRenderizadas === 0 && COMPLETOS_ANTES === 2,
    `no inicio ha 2 predios de pe e nenhuma obra, veio ${JSON.stringify(inicial.estagiosDeObraRenderizados)}`,
  );

  // ---- 3. planta a obra ----------------------------------------------------
  await page.click(`[data-predio="${TIPO_DA_OBRA}"]`);
  await esperarFrame();
  await clicarNoTile(obra.gx, obra.gy);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  const achado = Object.entries((await estado()).prediosDoEstado)
    .find(([, p]) => p.gx === obra.gx && p.gy === obra.gy);
  afirmar(achado !== undefined, `deveria existir um predio plantado em (${obra.gx},${obra.gy})`);
  afirmar(achado[1].estado === 'obra', 'o predio recem-plantado deveria estar em obra');

  // ---- 4. ACEITE: os seis aparecem, e cada um vira um PNG -------------------
  // A obra e UNICA no cenario, entao contagem >= 1 num estagio em obra e ela.
  // `completo` e diferente: os 2 predios ja estao la, e o que prova a obra de pe
  // e a contagem SUBIR.
  const vistos = new Map();
  const jaFotografado = new Set();

  async function registrar() {
    const s = await estado();
    const contagem = s.estagiosDeObraRenderizados;
    for (const estagio of ESTAGIOS) {
      const apareceu = estagio === 'completo'
        ? contagem.completo > COMPLETOS_ANTES
        : contagem[estagio] >= 1;
      if (!apareceu) continue;
      if (!vistos.has(estagio)) vistos.set(estagio, { tick: s.tick, contagem: { ...contagem } });
      if (!jaFotografado.has(estagio)) {
        jaFotografado.add(estagio);
        await capturar(estagio); // screenshots/F17e-<n>-<estagio>.png
      }
    }
    return s;
  }

  await registrar();
  let ticks = 0;
  while (vistos.size < ESTAGIOS.length && ticks < TETO) {
    await avancar(PASSO);
    ticks += PASSO;
    await esperarFrame();
    await registrar();
  }

  const faltando = ESTAGIOS.filter((e) => !vistos.has(e));
  afirmar(
    faltando.length === 0,
    `em ${TETO} ticks estes estagios nunca apareceram: ${JSON.stringify(faltando)} `
      + `(vistos: ${JSON.stringify([...vistos.keys()])})`,
  );

  // a ordem em que apareceram e a ordem em que a obra sobe: nenhum estagio
  // apareceu depois de um que vem mais tarde na fila.
  const ordemVista = [...vistos.entries()].sort((a, b) => a[1].tick - b[1].tick).map(([e]) => e);
  afirmar(
    JSON.stringify(ordemVista) === JSON.stringify(ESTAGIOS),
    `os seis deveriam aparecer na ordem que a cena publica: esperado ${JSON.stringify(ESTAGIOS)}, veio ${JSON.stringify(ordemVista)}`,
  );
  afirmar(
    (await estado()).estagiosDeObraRenderizados.completo === COMPLETOS_ANTES + 1,
    'no fim a obra tem de estar de pe, somando 1 ao completo do cenario',
  );
  afirmar(
    jaFotografado.size === ESTAGIOS.length,
    `deveria haver um PNG por estagio, veio ${jaFotografado.size}`,
  );

  // ---- 5. o painel do predio pronto, para fechar o passeio ------------------
  await clicarNoTile(meioDaObra.gx, meioDaObra.gy);
  afirmar(
    (await page.getAttribute('#painel-predio', 'data-estado-do-predio')) === 'completo',
    'no fim o painel deveria abrir um predio completo, nao uma obra',
  );
}

module.exports = { roteiro };
```

**Se a ordem de aparição falhar** porque `marcacao` e `fundacao` (ou dois
estágios seguidos) caem no mesmo tick de leitura: **não** afrouxe a asserção para
`vistos.size === 6`. Diminua o `PASSO` para 1 nos primeiros ticks — o pulo
significa que a leitura é grossa demais para o que a feature mostra ao jogador, e
isso é informação, não ruído.

- [ ] **Passo 3: rodar**

Rodar: `npm run shot -- F17e`
Esperado: EXIT 0, `screenshots/F17e-1-marcacao.png` … `F17e-6-completo.png`.

- [ ] **Passo 4: abrir a evidência — SÓ `paredes` e `cobertura`**

Ler com a ferramenta Read `screenshots/F17e-4-paredes.png` e
`screenshots/F17e-5-cobertura.png` (os dois estágios que não existiam antes desta
feature). Conferir: o volume da obra é visivelmente mais alto em `paredes` do que
em `estrutura`, e mais alto ainda em `cobertura`; o footprint inteiro está no
quadro. Os outros quatro valem pelo código de saída (§8).

Ler também `test-output/F17e-shot.json` e conferir a linha do enquadramento.

- [ ] **Passo 5: commit**

```bash
git add tools/shots/F17e.js
git commit -m "feat(F17e): o roteiro dos seis estagios"
```

---

## Tarefa 5 — fechamento

**Files:**
- Modify: `PROGRESS.md`, `test-results.json`

- [ ] **Passo 1: `npm run verify`** — typecheck + lint + validate:data + test.
      Guardar o EXIT e a contagem de testes. O selo vale 15 minutos.

- [ ] **Passo 2: não-regressão dos roteiros vizinhos, por código de saída**

`npm run shot -- F11c`, `-- F17b`, `-- F17d`, `-- F17f`, `-- F16b`. EXIT 0 em
todos. **Não abrir imagem nenhuma** (§8).

- [ ] **Passo 3: `PROGRESS.md`** — seção da F17e antes de `## Perguntas em aberto`,
      separando o **verificado** do **decidido**:
  - verificado: EXIT do verify, número de testes, o que `test-output/F17e.json`
    diz (as transições por tipo), o EXIT de cada roteiro, os dois PNGs abertos;
  - decidido: a chave `madeira` -> `estrutura` no manifesto e o porquê; o nome do
    arquivo derivado que ficou; os rótulos novos do tema; o enquadramento
    **medido** (com o número), contra a observação do BALANCE_LOG — se a medida
    contrariar a observação, escrever a medida, não a suposição.

- [ ] **Passo 4: `test-results.json`** — acrescentar a entrada
      `F17e-estagios-da-obra` com `"passes": true`, na forma que as outras linhas
      já usam. O hook só aceita a escrita com o selo do verify.

- [ ] **Passo 5: commit**

```bash
git add PROGRESS.md test-results.json BALANCE_LOG.md docs/planos/F17e-estagios-da-obra.md
git commit -m "feat(F17e): estagios visuais da obra, cinco nao tres"
```

---

## Definition of Done (CLAUDE.md §7)

- [ ] `npm run test` verde, incluindo `tests/F17e-estagios.test.ts`.
- [ ] `npm run typecheck` e `npm run lint` sem erro.
- [ ] Aceite do BUILD_PLAN verificado com evidência aberta por Read:
      `test-output/F17e.json` (os dois lados de cada fronteira + monotonicidade) e
      `screenshots/F17e-4-paredes.png` / `F17e-5-cobertura.png`.
- [ ] `npm run validate:data` passa.
- [ ] Nenhum import de `phaser` em `src/sim/` — e `src/sim/` não mudou.
- [ ] `src/render/estagio-obra.ts` continua com zero imports (guarda da F04).
- [ ] Commits feitos, um por tarefa.

---

## Auto-revisão

| risco | onde | como o plano responde |
|---|---|---|
| a lista dos seis vira duas listas que divergem | `ORDEM_DOS_ESTAGIOS` vs contagem vs tema | `contagemDeEstagios()` é um `Record` completo (o compilador exige as seis chaves), `obrasRenderizadas` deriva de `ORDEM.filter(estaEmObra)`, e o tema é indexado sob type guard: acrescentar estágio quebra a compilação em três pontos |
| o roteiro prova a lista dele, não a do jogo | `tools/shots/F17e.js` | `ESTAGIOS` sai de `Object.keys(estagiosDeObraRenderizados)`, publicado pela cena |
| `completo` contado de graça | roteiro | linha de base `COMPLETOS_ANTES` medida antes de plantar; a obra tem de SUBIR a contagem |
| fronteira em float | `estagio-obra.ts` | `hp * PARTES <= hpTotal * k`, com a `barracks` (600) nos dois lados de 200 e 400 no teste |
| roteiro antigo afirma o que esta feature substituiu | `F11c.js`, `F17f-manifesto.test.ts` | cada um é atualizado na tarefa que muda o que ele afirma, e a asserção nova é mais estrita (o `so()` acusa estágio inesperado; o F17f exige que `madeira` tenha sumido) |
| a arte do meio some da tela sem ninguém notar | manifesto | Tarefa 3, com o teste exigindo `estrutura` presente **e** `madeira` ausente |
| a foto não mostra o que a feature fez | enquadramento | medido no Passo 0 do roteiro, com o número na evidência; fallback escrito (obra a oeste), sem tocar nos roteiros validados |
| estágio novo herda o sprite do vizinho | `spriteDoPredio` | não muda: `arquivoDoEstagio` devolve `null` e a cena cai no placeholder daquele estágio — a Nota da F17f, agora coberta por teste |
