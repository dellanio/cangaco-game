# F-T4b — O lenhador sai para colher (plano)

**Objetivo:** declarar `colheita` na receita do `woodcutters` e mover a abertura
para uma posicao que tenha mata, rocha e terra ao alcance, de modo que as TRES
reprovacoes medidas (F15a, F15b, F17) passem a verde **sem assercao afrouxada**.

**Saida escolhida:** (a) mover a abertura — decisao do operador (2026-09-25).
Nao mexe em alcance (que viraria decorativo) nem em tiles do mapa (que fixtures usam).

**Criterio de aceite, as quatro pernas:**
1. `data/production.json` declara `colheita` no `woodcutters`, e a F15a afirma a
   forma — assercao ESTRITA, nao apenas diferente da antiga.
2. F15b (oraculo) volta a acumular `timber` > 0 em 3000 ticks.
3. F17 (aceite da Fase A) volta a ver `timber` no armazem ACIMA do inicial.
4. **Perna nova:** partindo do estado inicial novo, o lenhador produz tora pelo
   CAMINHO REAL (sai do predio, anda ate a arvore, volta) e o timber sobe.

---

## Os dois cuidados que o operador mandou tratar no plano

### C1 — a duplicacao da geometria e o que morde

A mesma derivacao existe HOJE, escrita a mao, em dois arquivos:

| onde | linguagem | como deriva |
|---|---|---|
| `tests/helpers/abertura.ts` | TS estrito, ESM, typecheck | `caixaDeTipo` da sim + `recursoBloqueiaConstrucao` sobre o `GameState` |
| `tools/shots/F17.js` | CommonJS, **fora** do `tsconfig.include` | `defDe()` sobre `data/buildings.json` + `caixaLivre` de `_recursos.js` |

A fila de hoje e uma linha reta: dava para escrever duas vezes. A geometria nova
tem **dois grupos, varredura para leste por contagem de mata e uma rua em L** —
escrever isso duas vezes e garantir que o roteiro clique nos mesmos tiles que o
headless planta e exatamente o defeito que o operador antecipou.

**Decisao: extrair ANTES de mexer.** Um modulo unico,
`tools/geometria-da-abertura.mjs`, com `tools/geometria-da-abertura.d.mts`
escrito a mao.

Por que `.mjs` e nao `.ts` nem `.js` — medido nesta sessao, nesta arvore:
`vitest` importa o `.mjs` a partir de um teste TS e o `tsc --noEmit` aceita com o
`.d.mts` ao lado (o `tsconfig` nao tem `allowJs` e nao inclui `tools/`); o
roteiro CommonJS carrega com `await import('./...mjs')`; `eslint .` passa nos
dois. Um `.js` CJS quebraria do lado do vitest (o transform trata `.js` local
como ESM e `module.exports` some).

**A fronteira do modulo:** ele nao le arquivo nenhum e nao conhece a sim. Recebe
as caixas do armazem e da escola e **predicados injetados**:

```js
geometriaDaAbertura({ armazem, escola, tamanhoDe, bloqueia, temArvore, alcanceDaMata })
```

Cada lado liga os predicados a sua propria fonte de verdade — a sim do lado do
teste, os JSON do lado do roteiro. O que fica escrito uma vez so e o ALGORITMO:
a varredura, a ordem dos predios e o tracado da rua. Ler o dado ja tinha modulo
proprio de cada lado (`caixaDeTipo` / `_recursos.js`) e continua tendo.

### C2 — "canPlace na fila da zero" e resultado nulo que parece resposta

`sawmill.desbloqueadoPor = woodcutters`, entao no tick 0 `canPlace('sawmill', …)`
responde `{ok:false, motivo:'bloqueado'}` **em qualquer tile do mapa**. Uma
varredura que exige `canPlace().ok` devolve ZERO posicoes para o mapa inteiro, e
zero parece "nao existe lugar" quando o que houve foi a pergunta errada. Custou
uma rodada nesta sessao: 14 720 posicoes varridas, `filaCabe: 0`, com a fila de
hoje existindo e funcionando.

O comentario disso existe pela metade em `filaCabe`
(`tests/helpers/abertura.ts:115-119`). **Vai virar nota explicita no helper de
medicao e no modulo novo**, com o numero medido e o predicado que se deve usar no
lugar (`motivo !== 'bloqueado'`, ou `recursoBloqueiaConstrucao` direto, que e o
que a fila usa).

---

## A REGRA da posicao (nao a coordenada)

O operador aprovou o formato separado: *"vila de verdade nasce em volta do
armazem, com a pedreira na pedra e o lenhador virado para o mato"*.

**Grupo da pedra — `sawmill` + `quarry`, a oeste, na linha de porta do armazem.**
Regra identica a de hoje (BUG-F): comeca encostado no armazem e RECUA para oeste
ate os dois footprints estarem livres de recurso que bloqueia. Com o mapa
publicado isso para em x=15 (serraria 15..18, pedreira 19..21), que e onde os
dois ja estao hoje — a pedreira encostada no lajedo 22..26, com 13 rochas ao
alcance. Ou seja: **o grupo da pedra nao se move**, e nenhuma medicao de pedra
muda.

**Grupo da mata — os dois `woodcutters`, na linha ACIMA do armazem.**
- linha: `gyDoPar = armazem.gy - 1 - altura` (a linha de porta do par fica em
  `armazem.gy - 1`, logo acima do armazem; nao cruza o footprint de ninguem).
- varredura: para leste, a partir de `gx = armazem.gx`, entre as posicoes que
  cabem (sem recurso que bloqueia) e cuja caixa esta a no maximo `alcance` tiles
  do armazem — **`alcance` e o da propria `colheita` do lenhador, lido do dado,
  nao digitado**.
- escolha: a posicao de MAIOR MINIMO de arvores ao alcance entre os dois
  lenhadores; empate resolve pelo mais perto do armazem, depois pelo menor `gx`.
  Maximizar dispensa limiar: nao ha "5 arvores" digitado em lugar nenhum.
- se nenhuma posicao der mata aos dois, o modulo LANCA. Pela regra do operador,
  nesse caso quem ajusta e o gerador, nao a vila — e a mensagem de erro diz isso.

**Rua em L.** A reta de hoje (ponta do grupo da pedra ate a porta da escola, com
o desvio de um tile na rocha) continua igual. Acrescenta-se o ramo do par: o
trecho horizontal na linha de porta do par, mais uma coluna vertical descendo ate
a rua principal, pela primeira coluna livre entre o armazem e a escola. Estrada
em L existe desde a F08 e o arrasto interpola — o roteiro ganha um arrasto a
mais, nao um mecanismo novo.

**Contagem de arvore: bruta no modulo, ALCANCAVEL afirmada na sim.** O modulo
compartilhado so sabe "tem arvore neste tile" (e o unico predicado que o roteiro
consegue fornecer: `window.__cangaco` expoe leitura de render, nao API de sim).
Do lado do teste, depois de escolher, o helper AFIRMA com
`tileAlcancavelParaColheita` que cada lenhador tem ao menos uma arvore
alcancavel. Se um dia a mata escolhida for so miolo inalcancavel, o fixture
estoura alto em vez de o lenhador morrer de fome em silencio.

---

## Tarefas

### Tarefa 1 — o modulo compartilhado, com a fila de HOJE

Criar `tools/geometria-da-abertura.mjs` + `.d.mts` reproduzindo a geometria
ATUAL (uma fila), ligar `tests/helpers/abertura.ts` e `tools/shots/F17.js` nele,
e provar que nada mudou. Refatoracao sem mudanca de comportamento primeiro, para
que o passo seguinte tenha um so eixo de falha.

- [ ] escrever o modulo com a assinatura acima e a nota do C2 no topo
- [ ] `.d.mts` a mao
- [ ] teste estrutural em `tests/F-T4b-geometria.test.ts`: a geometria que o
      helper entrega e IGUAL a que o modulo entrega com os predicados do roteiro
      (JSON puro) — e o guarda contra as duas copias divergirem de novo
- [ ] `npm run test` e `npm run shot -- F17` verdes, coordenadas identicas

### Tarefa 2 — a geometria nova

- [ ] modulo: dois grupos, varredura da mata, rua em L
- [ ] `abertura.ts`: trocar as invariantes "altura igual nos quatro" e "uma rua
      reta" pelas novas (altura igual DENTRO de cada grupo; rua = reta + ramo,
      tudo num componente so), mais a assercao de arvore alcancavel
- [ ] `tests/F17-aceite.test.ts` nao nomeia coordenada (9 expects, medido) — deve
      passar sem toque; se precisar de toque, e sinal de que a regra esta errada

### Tarefa 3 — o dado e a F15a

- [ ] `data/production.json`: `predios.woodcutters.colheita = {recurso:'tree', alcance_tiles: 6}`
- [ ] `npm run validate:data`
- [ ] `tests/F15a-receita.test.ts`: trocar `expect(r?.colheita).toBeNull()` por
      `expect(r?.colheita).toEqual({recurso:'tree', alcance: 6})` — a forma
      inteira, que e ESTRITA (a antiga afirmava um campo nulo; a nova afirma
      recurso, alcance e a ausencia de qualquer outra chave)
- [ ] o texto do `it` muda junto: "sem colheita — ele replanta" virou falso

### Tarefa 4 — o oraculo (F15b)

`cenarioOraculo()` (`tests/helpers/producao-cenario.ts:131-143`) e fixture
SEPARADA, com `w2 (18,34)` e `w1 (22,34)` digitados: mover a abertura NAO
conserta a F15b. Medido: esses dois tem 0 arvores ao alcance 6/8/10 e 7 ao 12.

- [ ] mover os dois lenhadores do oraculo para a posicao que o modulo derivar
      (mesma regra), e estender a rua do oraculo ate a porta deles
- [ ] `exigirLigado` continua valendo para os quatro
- [ ] F15b verde com `acumulado.timber > 0`

### Tarefa 5 — a perna nova do aceite

- [ ] teste novo: do estado inicial novo, trilha por tick do lenhador — FSM
      `indo_colher` -> `colhendo` -> `voltando` -> `trabalhando`, passo <= 1
      tile/tick, colheita a distancia Chebyshev 1 da arvore reclamada e FORA do
      footprint, e `timber` no armazem acima do inicial ao fim. Mesmo formato do
      bloco (8) da F21b, que ja provou isso para o mineiro
- [ ] guarda de fixture: a arvore reclamada esta a mais de 1 tile do footprint
      (senao o teste "anda" nao exercita caminhada)

### Tarefa 6 — o roteiro e a evidencia visual

- [ ] `tools/shots/F17.js` consumindo o modulo (`await import`), com o arrasto do
      ramo em L
- [ ] o roteiro clica em `#painel-predio`/`#hud`: garantir o passo despausado
      (§8 — `press('p')`, `mouse.down`, `waitForTimeout(150)`, `mouse.up`, pausa
      de volta)
- [ ] `npm run shot -- F17`, abrir o PNG com Read (evidencia DESTA feature)
- [ ] nao-regressao dos demais roteiros: codigo de saida, sem abrir imagem

### Tarefa 7 — fechar

- [ ] `npm run verify`
- [ ] `test-results.json`: `F-T4b-lenhador` -> `true` (Edit, dentro do selo)
- [ ] `PROGRESS.md` (verificado vs. concluido) e `BUILD_PLAN.md` (risca o item)
- [ ] commit `feat(F-T4b): o lenhador sai para colher`

---

## Consequencias registradas

- **Roteiros que plantam na abertura:** 2 derivacoes (esta e a do F17.js), 0
  coordenadas fixas. Depois da Tarefa 1, **1 derivacao**.
- `tests/helpers/bodega-cenario.ts` deriva a propria geometria e nao depende desta.
- O grupo da pedra fica onde esta: nenhuma medicao de pedra ou de lajedo muda.
- `src/sim/` e `src/render/` nao se tocam nesta feature (so `data/`, `tests/`,
  `tools/`), entao a regra da §10 nao entra em jogo.
- `src/ui/` e `index.html` NAO sao tocados (outra branch esta neles).
