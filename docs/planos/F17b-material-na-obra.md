# F17b — Material entregue visível na obra · plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, inline.
> Os passos usam `- [ ]` para acompanhamento. `subagent-driven-development` e
> `dispatching-parallel-agents` estão **proibidos** (CLAUDE.md §11).

**Objetivo:** o jogador, olhando o mapa **sem selecionar nada**, vê em cada obra
quanto de cada material já chegou e quanto falta — em blocos geométricos, o
placeholder de sempre. E o painel da obra selecionada passa a dizer "chegou 2 de
5" em vez de só "falta 3".

**Arquitetura:** `src/sim/` **não muda**. A informação já está no estado
(`PredioEmObra.obra.faltam`) e o custo já está no dado; o total entregue é
`custo − faltam`, e essa aritmética vira um arquivo puro em `src/render/`, do
mesmo feitio de `estagio-obra.ts` (zero imports, testável headless). A cena
desenha; o painel usa o seletor que já existe.

**Stack:** Vitest (headless) para a aritmética, Playwright via `npm run shot`
para a tela.

**Fonte do critério:** `BUILD_PLAN.md`, item **F17b** (escrito antes deste
plano). Escopo herdado: `docs/planos/F16b-painel-predio.md` §2 (o painel) e a
F11c (`estagio-obra.ts`, o diff por estágio na cena).

---

## Restrições globais

- **Nada em `src/sim/`.** Nem seletor novo, nem campo novo em `PainelDoPredio`,
  nem `state`. Instrução explícita do operador (2026-09-23). Se a implementação
  parecer pedir um seletor, **pare e reporte** — não é para negociar sozinho.
- Toca `src/render/` e `src/ui/`. É exceção à §10 e está **escrita no item da
  fila**, antes do código.
- Nenhum número de balanceamento em `.ts`: o custo sai de `data/buildings.json`
  pelo funil (`render/predios.ts` na cena, `opcoesDoMenuBuild` no painel).
  Tamanho de bloco e cor **não são balanceamento** — são desenho, e ficam no
  `.ts` da cena como o resto do placeholder já fica.
- A ordem das mercadorias é a de `economia.mercadorias`, nunca `Object.keys`
  (contrato da F05a).
- `render/` só pode importar `../sim/data` em `mapa.ts` e `predios.ts` — há
  teste estrutural (`tests/F04-grid-ortogonal.test.ts:138`). O arquivo novo de
  aritmética **não importa nada**.
- Placeholder é comportamento normal (§9): sem PNG, blocos.

---

## 0. Escopo e autorização

Do pedido do operador, palavra por palavra:

> O jogador vê, olhando a obra no mapa, quanto de cada material já chegou e
> quanto falta. A informação já existe em `obra.faltam` e no custo do dado.
> Placeholder geométrico, como todo o resto — blocos ou contagem, não arte.

**Fora do escopo**, e não entra por conveniência:
- qualquer regra de simulação (prioridade de entrega, reserva, ordem de obra);
- barra de HP/progresso nova no mapa — o progresso de martelada já tem os três
  estágios da F11c e **não** é o que esta feature mede;
- arte, atlas, `assets/manifest.json`;
- alerta de "obra sem material" no HUD (é F22, e é outra coisa).

---

## 1. A decisão do ponto 1 do operador: mapa, e o painel ganha a metade que falta

O operador pediu uma decisão entre "mostrar no painel da F16b" e "aparecer no
mapa sem selecionar". A decisão é **mapa**, e ela não é preferência: é o que a
leitura do que já existe obriga.

**O painel já responde metade da pergunta, para a obra selecionada.**
`src/ui/painel-predio.ts:76` (`desenharObra`) já desenha a linha "Em obra N%" e a
gaveta "Falta chegar" com `dados.faltam`. Ou seja: *quanto falta* já está na
tela desde a F16b. Repetir isso no painel não seria feature nenhuma.

**O que o painel NÃO responde — e é defeito, não escolha.** O seletor monta as
linhas com `if (quantidade > 0)` (`src/sim/selectors.ts`, `linhasDeEstoque`).
Logo, o material **inteiramente entregue some da gaveta**. Uma obra que já
recebeu toda a pedra e espera só tábua mostra uma gaveta com uma linha só, e o
jogador não tem como distinguir "a pedra chegou" de "esta obra nunca pediu
pedra". A pergunta do operador é "quanto de cada material **já chegou**", e essa
metade não está em lugar nenhum da tela hoje.

**E o mapa não responde nada.** `WorldScene.criarPredio` desenha o retângulo com
alfa por estágio e o rótulo `nome\n(em obra)`. Duas obras, uma abastecida e uma
faminta, são **pixel a pixel idênticas** até que alguém martele. O GDD §1.2 lista
"serfs trazem material" como uma seta do loop micro que precisa de retorno
visual próprio, separada de "obra sobe em 3 estágios visíveis" — são dois sinais
diferentes e hoje existe só o segundo.

**Portanto:**
1. **No mapa, sem selecionar** — um medidor de blocos por obra. É o entregável
   principal e é o que a feature ganha o nome.
2. **No painel** — a mesma informação em número, `chegou/total` por material,
   inclusive o material com falta 0. É uma linha a mais em `desenharObra`, e
   fecha o buraco descrito acima sem criar mecanismo novo.

Os dois lêem a **mesma** aritmética (`medidor-obra.ts`), para não existirem dois
lugares calculando "entregue" com risco de divergir.

---

## 2. O que já existe e é reusado

| Preciso de | Já existe em | Como |
|---|---|---|
| o que falta entregar | `PredioEmObra.obra.faltam` (`src/sim/state.ts`) | leitura crua, no laço que a cena já faz |
| o custo do prédio | `data/buildings.json` (`timber`, `stone` na def) | cena: `render/predios.ts` (funil autorizado); painel: `opcoesDoMenuBuild(estado)`, que já expõe `custo: { timber, stone }` |
| a ordem das mercadorias | `gameData.economia.mercadorias` | pelo funil `render/predios.ts`; o arquivo puro recebe a lista pronta |
| o nome que o jogador lê | `data/theme-sertao.json` → `mercadorias` | `painel-predio.ts` já importa; a cena já importa para `obra`/`predios` |
| redesenhar só quando muda | o diff de `atualizarPredios` por `(id, estado, estagio)` | ganha uma quarta parte na chave — ver D3 |
| o roteiro afirmar sem pixel | `window.__cangaco` (`render/debug.ts`) | campo novo `medidoresDeObra` |
| plantar obra por clique | `tools/shots/F16b.js` e `tools/shots/F17.js` | a geometria da rua e do encaixe já validada contra a regra da porta |

Nenhum mecanismo novo: nem evento, nem comando, nem seletor, nem segundo painel.

---

## 3. Mapa de arquivos

**Criar**
- `src/render/medidor-obra.ts` — aritmética pura, **zero imports**. Recebe
  `faltam`, `custo` e a ordem das mercadorias; devolve as linhas do medidor.
- `tests/F17b-medidor-obra.test.ts` — a aritmética, headless.
- `tools/shots/F17b.js` — o roteiro: planta, fotografa vazio, deixa o material
  chegar, fotografa cheio, abre o painel.

**Modificar**
- `src/render/predios.ts` — `AparenciaDoPredio` ganha `custo` e a lista de
  mercadorias na ordem do dado. É o funil; é aqui que `sim/data` pode entrar.
- `src/render/scenes/WorldScene.ts` — desenha os blocos em obra; põe o medidor
  na chave do diff; publica `medidoresDeObra` no debug.
- `src/render/debug.ts` — o campo novo e seu tipo.
- `src/ui/painel-predio.ts` — `desenharObra` passa a escrever `chegou/total`.
- `data/theme-sertao.json` — dois rótulos novos em `painelPredio`.
- `styles.css` (ou onde vive o CSS do painel) — a classe da linha nova.
- `BUILD_PLAN.md`, `PROGRESS.md`, `test-results.json`.

---

## 4. Decisões

**D1 — o medidor é por MATERIAL do custo, não por total somado.** Um bloco por
unidade de material, uma fileira por material. Somar "9 de 13" esconde
exatamente a informação que o jogador precisa (é pedra que falta, ou tábua?), e
é ela que decide se ele planta outra pedreira ou outro lenhador. Os custos da
Fase A são pequenos (2 a 6 por material), então a fileira cabe no footprint.

**D2 — bloco cheio = entregue, bloco vazio (só contorno) = falta.** Nada de cor
por mercadoria nesta feature: a fileira de cima é sempre a primeira mercadoria
do custo na ordem de `economia.mercadorias`, a de baixo a segunda, e o painel
resolve a dúvida de qual é qual. Cor por mercadoria é arte, e arte entra por
decisão humana (§9). Se o operador quiser cor depois, o ponto de entrada é
`medidorDaObra` já devolvendo a `mercadoria` em cada linha.

**D3 — o medidor entra na chave do diff da cena.** Hoje
`atualizarPredios` pula o redesenho quando `(estado, estagio)` não mudou. Uma
entrega **não** muda `hp`, logo não muda `estagio`: sem isto o medidor nasceria
correto e congelaria para sempre. A chave nova é a string
`linhas.map(l => l.entregue).join(',')` — muda exatamente quando uma entrega
chega, e não muda em mais nada. Este é o defeito mais provável da feature e o
teste da Tarefa 4 existe só por causa dele.

**D4 — o medidor some no prédio completo.** `estado === 'completo'` não tem
`obra`. Nada a desenhar, e nada a decidir: o `if` é o mesmo que já separa os
estágios.

**D5 — "entregue" é `custo − faltam`, com piso em 0.** É o contrato já escrito
em `src/sim/selectors.ts:28` ("Obra nao guarda mercadoria: o que ja foi
entregue a ela e custo - obra.faltam"). O piso existe porque `faltam` pode
teoricamente exceder o custo se o dado mudar entre partidas salvas; um número
negativo de blocos seria um `for` que não roda e um bug silencioso.

**D6 — material com custo 0 não vira fileira.** `storehouse` custa timber 6 e
stone 5; outros prédios podem ter um só. Fileira vazia é ruído, e o teste da
Tarefa 1 cobre o caso.

**D7 — o painel mostra TODO material do custo, inclusive o já completo.** É a
correção do buraco da §1. O rótulo muda de "Falta chegar" para "Material", e
cada linha é `Pedra 5/5`. A gaveta `faltam` do seletor **continua existindo e
não é tocada** — o painel simplesmente deixa de ser a única fonte; quem monta a
lista agora é `medidorDaObra`, a mesma do mapa.

**D8 — o custo no painel vem de `opcoesDoMenuBuild`, não de um import novo.**
`src/ui/` não importa `sim/data` hoje (comentário no topo de `menu-build.ts`, e
é intencional). `opcoesDoMenuBuild(estado)` já devolve `custo` por tipo. Custa
uma varredura de lista curta por quadro; se isso incomodar, a saída é memoizar
na montagem do painel, **não** abrir um import novo para `sim/data` em `ui/`.

---

## 5. Tarefas

### Tarefa 1: a aritmética do medidor

**Arquivos:**
- Criar: `src/render/medidor-obra.ts`
- Teste: `tests/F17b-medidor-obra.test.ts`

**Interfaces:**
- Produz: `LinhaDoMedidor`, `medidorDaObra(faltam, custo, mercadorias)` — usado
  pela Tarefa 2 (cena) e pela Tarefa 5 (painel).

- [ ] **Passo 1: escrever o teste que falha**

```ts
import { describe, expect, it } from 'vitest';
import { medidorDaObra } from '../src/render/medidor-obra';
import { gravarEvidencia } from './helpers/evidence';

// A ordem do dado, recortada. O arquivo sob teste nao conhece `economia`:
// ele recebe a lista, e e isso que o deixa sem import nenhum.
const ORDEM = ['tree_trunk', 'timber', 'stone'];

describe('F17b — o medidor da obra', () => {
  it('nada entregue: todas as linhas em 0, na ordem do dado', () => {
    const linhas = medidorDaObra({ timber: 3, stone: 5 }, { timber: 3, stone: 5 }, ORDEM);
    expect(linhas).toEqual([
      { mercadoria: 'timber', entregue: 0, total: 3 },
      { mercadoria: 'stone', entregue: 0, total: 5 },
    ]);
  });

  it('entrega parcial: entregue e custo menos falta', () => {
    const linhas = medidorDaObra({ timber: 1, stone: 5 }, { timber: 3, stone: 5 }, ORDEM);
    expect(linhas[0]).toEqual({ mercadoria: 'timber', entregue: 2, total: 3 });
  });

  // o buraco que o painel tem hoje: `faltam` nao guarda chave em 0
  it('material COMPLETO continua aparecendo, cheio', () => {
    const linhas = medidorDaObra({ stone: 5 }, { timber: 3, stone: 5 }, ORDEM);
    expect(linhas).toEqual([
      { mercadoria: 'timber', entregue: 3, total: 3 },
      { mercadoria: 'stone', entregue: 0, total: 5 },
    ]);
  });

  it('custo 0 nao vira linha', () => {
    expect(medidorDaObra({}, { timber: 0, stone: 4 }, ORDEM))
      .toEqual([{ mercadoria: 'stone', entregue: 4, total: 4 }]);
  });

  it('falta maior que o custo nao produz entregue negativo', () => {
    expect(medidorDaObra({ stone: 9 }, { stone: 4 }, ORDEM)[0]?.entregue).toBe(0);
  });

  it('a ordem e a do dado, nao a de insercao do objeto', () => {
    const linhas = medidorDaObra({ stone: 1, timber: 1 }, { stone: 2, timber: 2 }, ORDEM);
    expect(linhas.map((l) => l.mercadoria)).toEqual(['timber', 'stone']);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

`npx vitest run tests/F17b-medidor-obra.test.ts` → FAIL, "Cannot find module
'../src/render/medidor-obra'".

- [ ] **Passo 3: implementar o mínimo**

```ts
/**
 * Aritmetica pura, ZERO imports (nem `../sim/data`, nem Phaser), como
 * `estagio-obra.ts`: quanto de cada material ja chegou a uma obra. O estado
 * guarda so o que FALTA (`PredioEmObra.obra.faltam`); o entregue e
 * `custo - faltam`, contrato ja escrito em `sim/selectors.ts`.
 *
 * Recebe a ordem das mercadorias pronta em vez de ler `economia.mercadorias`:
 * e o que mantem o arquivo sem import e dentro da regra estrutural de
 * `render/` (so `mapa.ts` e `predios.ts` falam com `sim/data`).
 */
export interface LinhaDoMedidor {
  readonly mercadoria: string;
  readonly entregue: number;
  readonly total: number;
}

export function medidorDaObra(
  faltam: Readonly<Record<string, number>>,
  custo: Readonly<Record<string, number>>,
  mercadorias: readonly string[],
): LinhaDoMedidor[] {
  const linhas: LinhaDoMedidor[] = [];
  for (const mercadoria of mercadorias) {
    const total = custo[mercadoria] ?? 0;
    if (total <= 0) continue;
    const falta = faltam[mercadoria] ?? 0;
    linhas.push({ mercadoria, entregue: Math.max(0, total - falta), total });
  }
  return linhas;
}
```

- [ ] **Passo 4: rodar e ver passar** — os seis casos verdes.
- [ ] **Passo 5: commit** — `feat(F17b): a aritmetica do material entregue na obra`

---

### Tarefa 2: o custo chega ao funil da cena

**Arquivos:**
- Modificar: `src/render/predios.ts`
- Teste: `tests/F17b-medidor-obra.test.ts` (um `describe` a mais)

**Interfaces:**
- Consome: nada da Tarefa 1.
- Produz: `AparenciaDoPredio.custo: Readonly<Record<string, number>>` e
  `ordemDasMercadorias: readonly string[]` exportada — a Tarefa 3 usa as duas.

- [ ] **Passo 1: o teste que falha**

```ts
describe('F17b — o funil entrega o custo do dado', () => {
  it('a aparencia da quarry traz o custo de buildings.json', () => {
    const a = aparenciaDoPredio('quarry');
    const def = gameData.predios.find((p) => p.id === 'quarry');
    expect(def).toBeDefined();
    // igualdade contra o DADO, nunca contra um numero digitado aqui
    expect(a.custo).toEqual({ timber: def?.timber, stone: def?.stone });
  });

  it('tipo desconhecido cai no placeholder, com custo vazio e sem quebrar', () => {
    expect(aparenciaDoPredio('nao-existe').custo).toEqual({});
  });

  it('a ordem exportada e a de economia.mercadorias, a mesma lista', () => {
    expect(ordemDasMercadorias).toEqual(gameData.economia.mercadorias);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar** (`custo` não existe no tipo).
- [ ] **Passo 3: implementar** — em `src/render/predios.ts`:

```ts
export interface AparenciaDoPredio {
  readonly largura: number;
  readonly altura: number;
  readonly nome: string;
  readonly hpTotal: number;
  /** F17b: o custo em material, do dado. O medidor da obra desenha `custo -
   *  faltam`; sem isto a cena nao tem o denominador. */
  readonly custo: Readonly<Record<string, number>>;
}

/** F17b: a ordem canonica, reexportada do funil para quem nao pode importar
 *  `sim/data` (o resto de `render/`, por teste estrutural). */
export const ordemDasMercadorias: readonly string[] = gameData.economia.mercadorias;
```

E dentro de `construirAparencias`, no objeto por tipo:
`custo: { timber: p.timber, stone: p.stone }`; no fallback de
`aparenciaDoPredio`, `custo: {}`.

- [ ] **Passo 4: rodar e ver passar.**
- [ ] **Passo 5: commit** — `feat(F17b): o custo do predio chega ao funil do render`

---

### Tarefa 3: os blocos no mapa

**Arquivos:**
- Modificar: `src/render/scenes/WorldScene.ts`, `src/render/debug.ts`

**Interfaces:**
- Consome: `medidorDaObra` (T1), `AparenciaDoPredio.custo` e
  `ordemDasMercadorias` (T2).
- Produz: `EstadoDebug.medidoresDeObra: Readonly<Record<string, readonly
  LinhaDoMedidor[]>>` — a Tarefa 4 afirma sobre ele.

- [ ] **Passo 1: o campo de debug** — em `src/render/debug.ts`:

```ts
import type { LinhaDoMedidor } from './medidor-obra';

  /** F17b — o medidor de cada OBRA desenhada agora, por id: quanto de cada
   *  material chegou e quanto o prédio custa. Obra apenas; prédio completo não
   *  entra. O roteiro afirma sobre isto em vez de contar bloco por pixel (§8). */
  medidoresDeObra: Readonly<Record<string, readonly LinhaDoMedidor[]>>;
```

Inicializar com `{}` onde os outros campos nascem.

- [ ] **Passo 2: desenhar** — em `criarPredio`, depois do rótulo, só quando
  `predio.estado === 'obra'`:

```ts
  /** F17b — o medidor de material: uma fileira por material do custo, um bloco
   *  por unidade, cheio = ja entregue. Placeholder geometrico (§9): a pergunta
   *  que ele responde ("falta pedra ou falta tabua?") e de longe, sem clicar. */
  private desenharMedidor(
    linhas: readonly LinhaDoMedidor[], larguraPx: number, alturaPx: number,
  ): Phaser.GameObjects.GameObject[] {
    const LADO = 8;
    const VAO = 2;
    const objetos: Phaser.GameObjects.GameObject[] = [];
    linhas.forEach((linha, i) => {
      const larguraDaFileira = linha.total * LADO + (linha.total - 1) * VAO;
      const x0 = (larguraPx - larguraDaFileira) / 2 + LADO / 2;
      const y = alturaPx - 6 - (linhas.length - 1 - i) * (LADO + VAO);
      for (let n = 0; n < linha.total; n++) {
        const cheio = n < linha.entregue;
        const bloco = this.add.rectangle(x0 + n * (LADO + VAO), y, LADO, LADO,
          0xede3d0, cheio ? 1 : 0);
        bloco.setStrokeStyle(1, 0xede3d0, cheio ? 1 : 0.5);
        objetos.push(bloco);
      }
    });
    return objetos;
  }
```

Os filhos entram no mesmo `container` do retângulo e do rótulo — um só
`destroy()` continua limpando tudo.

- [ ] **Passo 3: pôr o medidor na chave do diff (D3)** — em `atualizarPredios`,
  calcular `const linhas = predio.estado === 'obra' ? medidorDaObra(predio.obra.faltam, aparencia.custo, ordemDasMercadorias) : [];`
  e uma `assinatura = linhas.map((l) => l.entregue).join(',')`. A comparação vira
  `existente.estado === predio.estado && existente.estagio === estagio && existente.assinatura === assinatura`.
  Guardar `assinatura` no item de `desenhados`. Publicar em
  `debug.medidoresDeObra` só as obras.

- [ ] **Passo 4: rodar `npm run verify`** — typecheck, lint e a suíte inteira.
- [ ] **Passo 5: commit** — `feat(F17b): blocos de material entregue na obra, no mapa`

---

### Tarefa 4: o roteiro e a prova de que o medidor ENCHE

Esta é a tarefa que prova D3. Um medidor que nasce correto e nunca mais muda
passa em qualquer screenshot único.

**Arquivos:**
- Criar: `tools/shots/F17b.js`

- [ ] **Passo 1: escrever o roteiro.** Reusa a geometria já validada de
  `tools/shots/F17.js` (rua em y=33, prédios na linha y=31) e o `avancar` de
  `window.__cangaco`:

  1. planta a rua e **uma** obra (`woodcutters`);
  2. espera `medidoresDeObra[id]` existir; afirma
     `linhas.every((l) => l.entregue === 0)` — **obra recém-plantada não tem
     material**; screenshot `F17b-1-vazio.png`;
  3. avança em passos de 50 ticks até `linhas.some((l) => l.entregue > 0)`, com
     teto declarado (a F17 mediu a primeira obra completa em 265 ticks; teto
     1000, ~4x de folga). **Falhar por teto é falhar**, não é dormir mais;
  4. screenshot `F17b-2-cheio.png` e afirma que a soma de `entregue` subiu
     contra a leitura do passo 2 — a comparação é contra a **primeira leitura**,
     não contra 0;
  5. clica na obra, afirma no DOM
     `#painel-predio [data-medidor="stone"]` com `data-entregue` e `data-total`;
     screenshot `F17b-3-painel.png`.

- [ ] **Passo 2: rodar** `npm run shot -- F17b`. Código de saída 0.
- [ ] **Passo 3: abrir com Read** `screenshots/F17b-2-cheio.png` e
      `screenshots/F17b-3-painel.png`. **Só estas duas** — imagem é o que mais
      pesa na janela (§8). A do passo 2 se confere pelo código de saída.
- [ ] **Passo 4: commit** — `feat(F17b): roteiro que prova o medidor enchendo`

---

### Tarefa 5: o painel diz "chegou 2 de 5"

**Arquivos:**
- Modificar: `src/ui/painel-predio.ts`, `data/theme-sertao.json`, o CSS do painel

- [ ] **Passo 1: os rótulos no tema** — em `painelPredio`:
  `"material": "Material"`, `"de": "de"`. O painel não inventa texto.
- [ ] **Passo 2: reescrever `desenharObra`**:

```ts
function desenharObra(raiz: HTMLElement, dados: PainelDoPredio, custo: Readonly<Record<string, number>>): void {
  raiz.append(linha('obra', rotulos.emObra, `${Math.round(dados.progresso * 100)}%`));

  // F17b — `chegou/total` por material, inclusive o material JA COMPLETO: a
  // gaveta `faltam` do seletor filtra quantidade 0, entao ela sozinha nao
  // distingue "a pedra chegou" de "esta obra nunca pediu pedra". Mesma
  // aritmetica que o mapa desenha (`medidor-obra.ts`), de proposito: duas
  // contas para o mesmo numero acabam divergindo.
  const faltam = Object.fromEntries((dados.faltam ?? []).map((i) => [i.mercadoria, i.quantidade]));
  const bloco = document.createElement('div');
  bloco.className = 'gaveta material';
  bloco.dataset.gaveta = 'material';
  const r = document.createElement('span');
  r.className = 'rotulo';
  r.textContent = rotulos.material;
  bloco.append(r);
  for (const l of medidorDaObra(faltam, custo, ordemDasMercadorias)) {
    const span = document.createElement('span');
    span.className = 'item';
    span.dataset.medidor = l.mercadoria;
    span.dataset.entregue = String(l.entregue);
    span.dataset.total = String(l.total);
    span.textContent = `${temaDeMercadorias[l.mercadoria] ?? l.mercadoria} ${l.entregue}/${l.total}`;
    bloco.append(span);
  }
  raiz.append(bloco);
}
```

O custo vem de `opcoesDoMenuBuild(estado)` filtrado por `dados.tipo` (D8), e
`ordemDasMercadorias` do funil `render/predios.ts`. **Se importar
`render/predios.ts` de dentro de `ui/` disparar o teste estrutural ou puxar
Phaser por transitividade, pare e reporte** — a saída é mover a constante para
o próprio `medidor-obra.ts` como parâmetro obrigatório, e não abrir exceção
nova. (`render/predios.ts` hoje não importa Phaser; confirmar antes.)

- [ ] **Passo 3: o CSS da classe `material`**, copiando o que `gaveta` já usa.
- [ ] **Passo 4: `npm run verify`** e `npm run shot -- F16b` (não-regressão do
      painel: **código de saída**, sem abrir a imagem — §8 e a lição da F17).
- [ ] **Passo 5: commit** — `feat(F17b): o painel da obra diz quanto chegou de cada material`

---

### Tarefa 6: fechar

- [ ] `npm run verify` verde (typecheck, lint, validate:data, test). **Conferir
      o código de saída do comando inteiro**, não o `tail` dele — foi assim que
      a F17 quase fechou com typecheck vermelho.
- [ ] Marcar `"F17b-material-na-obra": true` em `test-results.json` (o hook só
      aceita dentro dos 15 min do selo).
- [ ] `PROGRESS.md`: o que foi feito, as decisões D1–D8 e o que ficou aberto,
      separando **verificado** de **hipótese**.
- [ ] Commit `feat(F17b): material entregue visivel na obra`.

---

## 6. Auto-revisão contra o item do BUILD_PLAN

| O item pede | Onde está |
|---|---|
| "quanto de cada material já chegou" | T1 (`entregue`), T3 (bloco cheio), T5 (`2/5`) |
| "e quanto falta" | o mesmo, pelo complemento: bloco vazio e `total − entregue` |
| "olhando a obra no mapa" | T3, sem seleção; T4 fotografa |
| "placeholder geométrico, blocos" | D2, T3 |
| "nada em `sim/`" | Restrições globais; nenhuma tarefa abre arquivo de `sim/` |
| o aceite pede o medidor **enchendo** | T4 passo 3, contra a primeira leitura |

## 7. Riscos

1. **D3 é o risco real.** Se a assinatura ficar de fora do diff, tudo passa e
   nada funciona em partida. T4 passo 3 é o antídoto e não pode ser cortado.
2. **`ui/` importando do `render/`** (T5). Se isso puxar Phaser, o painel deixa
   de montar em teste headless. Plano B declarado na própria tarefa.
3. **Legibilidade dos blocos.** Custo de 6 unidades a 8px + vão dá 58px, e o
   footprint mais estreito da Fase A é 2 tiles (128px). Cabe. Se um prédio
   futuro custar 12 de um material, a fileira estoura o footprint — é o momento
   de trocar bloco por contagem, e o `LinhaDoMedidor` já carrega os dois
   números para isso. Não resolver agora: YAGNI e ainda não existe o caso.
4. **`opcoesDoMenuBuild` por quadro** (D8). Lista de ~10 itens; se pesar,
   memoizar, não mudar a fronteira.
