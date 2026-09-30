# F-VIVO a partir da F-VIVO-e: ocioso, caso 2 na casa, curral que fica e escola

**Estado: plano, sem código.** Escrito na leva noturna de 2026-09-30 sobre as decisões do
operador para `docs/planos/2026-09-30-vivo-contra-kam-e-texto-das-8-direcoes.md`. A F-VIVO-0, a
F-VIVO-a e a F-VIVO-b **não se reescrevem**: o que muda o comportamento delas entra como sub-item
novo, com o seu próprio aceite, e o texto antigo fica como registro.

Tudo aqui é **render**. Nenhum sub-item toca em `src/sim/`. Onde o render precisa de um número
da sim (duração de fase), ele lê pelo funil que já existe (`recursosDeRender`,
`DadosDoTrabalho`), e não duplica dado.

## Decisões do operador que este plano aplica (2026-09-30)

```text
| #     | Decisão                                                       | Onde entra        |
|-------|---------------------------------------------------------------|-------------------|
| A1/A2 | O ocioso é REGRA, com UM laço genérico (não um por prédio)    | F-VIVO-e          |
| A6    | A torre não ganha ocioso próprio: cai na regra, se tiver      | F-VIVO-e (nota)   |
|       | ocupante dentro; hoje não tem                                 |                   |
| C2    | Caso 2 anima só na fase da casa, como o KaM (nota LOTE3-b2)   | F-VIVO-f          |
| C3    | O curral guarda o último quadro desenhado                     | F-VIVO-g          |
| A5/C1 | A escola anima enquanto treina. Prioridade baixa              | F-VIVO-h          |
| C4    | A feira fica sem pilha                                        | nota, sem item    |
| C5/C6 | Ligadas ao BUG-X (especialista dentro da casa)                | F-VIVO-e depende  |
| A3    | Fogo por dano: só como item de fila DEPOIS da C-IA-02         | nota, fora daqui  |
```

## Ordem e dependências

```text
| Sub-item | O que entra                                          | Depende de        |
|----------|------------------------------------------------------|-------------------|
| F-VIVO-e | ocioso genérico: casa ocupada e parada ≠ casa vazia  | BUG-X, F-VIVO-b   |
| F-VIVO-f | caso 2 anima só de descanso+noTile até o fim do ciclo | F-VIVO-e          |
| F-VIVO-g | curral guarda o último quadro enquanto ocupado       | F-VIVO-c          |
| F-VIVO-h | escola anima enquanto há recruta em treino (baixa)   | F-VIVO-0          |
```

**Por que a F-VIVO-e espera o BUG-X.** Com o especialista visível na porta (o defeito do
BUG-X), a casa ociosa já "mostra" alguém, e o laço ocioso duplica o sinal. Com ele escondido
dentro (o conserto do BUG-X, `docs/planos/2026-09-30-BUG-X-especialista-dentro-da-casa.md`), o
ocioso passa a ser o único sinal de que a casa tem gente: é esse o quadro que o aceite mede. Se
o operador decidir o BUG-X de outro jeito (casa aberta), a F-VIVO-e continua válida, mas o
roteiro dela muda de pergunta, e isso volta ao operador antes do código.

**Por que a F-VIVO-f vem depois da e.** Tirar o laço de trabalho da fase de descanso sem o
ocioso deixaria a casa **ocupada e em branco**, que é o contrário do que o A1 decidiu. Com a e
pronta, o descanso mostra o ocioso e a fase no tile mostra nada (casa vazia, `hstEmpty` do
KaM, `KM_UnitTaskMining.pas:247-251`).

A F-VIVO-g e a F-VIVO-h são independentes das outras e podem ir em qualquer ordem depois
delas; a h é a última por decisão de prioridade.

---

## F-VIVO-e — o ocioso genérico

**Regra.** Um prédio completo, **com o ocupante dentro** e **sem quadro de trabalho**, desenha
o laço `ocioso` na `area` de trabalho. Um laço só para todos os prédios, 8 quadros (a regra de
custo da B2). O quadro vem do tick: `n = 1 + ⌊tick / TICKS_POR_QUADRO⌋ mod 8`. Não há duração
de ciclo a respeitar: o ocioso não termina.

"Ocupante dentro" é o mesmo predicado que o BUG-X usa para esconder a unidade: `ocupante` do
prédio completo e `!ocupaTile(u)`. Um predicado só nas duas features: se divergirem, a casa
mostra ocioso com o homem na porta, ou esconde o homem sem ocioso.

Quando o ocioso aparece (e o de trabalho não):
- `esperando_insumo`;
- `saida_cheia`;
- a fase de descanso da receita com colheita (`progresso < colheita.ticksDeDescanso`,
  `trabalhando` por dentro), que é a C6 decidida junto com o A1. Até a F-VIVO-f entrar, o
  caso 2 continua com o laço de trabalho no descanso, e a F-VIVO-e **não** mexe nisso: ela
  cobre o descanso só no caso 1, onde hoje o quadro é `null`.

Quando **nenhum** dos dois aparece:
- sem ocupante, ou ocupante fora (colhendo no tile, indo comer, comendo na Bodega);
- prédio pausado. **Interpretação conservadora**, igual à F-VIVO-b: pausado não anima.
  Pergunta ao operador abaixo.
- obra, prédio sem receita (armazém, Bodega, feira, torre, quartel, escola). A torre (A6)
  entra na regra no dia em que tiver ocupante dentro; hoje não tem.

A fumaça **não** acompanha o ocioso (B7: igual ao KaM, a fumaça é do trabalho).

**Manifesto.** O `F17f` aceita hoje em `trabalho` só o id de prédio com receita, ou
`fumaca`. A F-VIVO-e acrescenta o id `ocioso`, com os estados `ocioso_1..8` e um `tamanho`
único, no molde da `fumaca`. Caso que reprova no próprio teste: `ocioso_9`, e `ocioso` com dois
tamanhos. Sem PNG, o placeholder é o retângulo da `area` com `ocioso_<n>` escrito, como o do
trabalho.

**Arquivos.**
- Modificar: `src/render/trabalho.ts` — `quadroOcioso(predio, unidade, tick, dados)`, pura,
  ao lado de `quadroDeTrabalho`; o predicado "dentro" vem de `src/render/visibilidade.ts`
  (criado pelo BUG-X).
- Modificar: o validador do manifesto e `tests/F17f-manifesto.test.ts` (o id `ocioso`).
- Modificar: `src/render/scenes/WorldScene.ts` e `src/render/debug.ts` —
  `debug.quadrosOciosos` por prédio.
- Criar: `tests/F-VIVO-e-ocioso.test.ts`, `tools/shots/F-VIVO-e.js`.

**Aceite.**
1. `quadroOcioso` e `quadroDeTrabalho` **nunca** são não-nulos no mesmo prédio no mesmo tick:
   varredura tick a tick da vila da calibração, 6 000 ticks, com a contagem das duas
   camadas e das colisões (esperado 0) em `test-output/F-VIVO-e.json`.
2. O ocioso é não-nulo em `esperando_insumo` e `saida_cheia` com o ocupante dentro, e nulo
   nos casos da lista "nenhum dos dois"; cada ramo com cenário próprio, pelo `step`.
3. No caso 1, a fase de descanso mostra o ocioso, e a fase no tile não mostra nada.
4. O `n` avança e volta a 1 sem pulo.
5. Roteiro despausado (§8) com uma casa sem insumo e ocupada ao lado de uma casa vazia do
   mesmo tipo: `debug.quadrosOciosos` avança numa e fica ausente na outra; captura aberta.

---

## F-VIVO-f — o caso 2 só na fase da casa

**Regra (adotada do KaM).** Na receita com colheita, `quadroDeTrabalho` só devolve quadro em
`[ticksDeDescanso + ticksNoTile, ticksDoCiclo)`. No descanso vale o ocioso (F-VIVO-e); no
tile, nada. Isto é a nota LOTE3-b2 da F-VIVO-b aplicada, e fecha a pergunta em aberto da
F-VIVO-b ("o laço aparece no prédio enquanto ele está no campo"). O texto da F-VIVO-b não se
reescreve: ele ganha só uma linha "fechado pela F-VIVO-f".

Os terços `inicio`, `meio` e `fim` passam a dividir a **fase da casa**, e não o ciclo inteiro.
Quando a fase da casa é zero (fazenda, lenhador e pescador, nota LOTE3-b2), a receita não tem
laço de trabalho nenhum, e isso é consistente com eles serem caso 1.

**Arquivos.** `src/render/trabalho.ts` (`DadosDoTrabalho` ganha `ticksDeDescanso` e
`ticksNoTile` por tipo, lidos no mesmo funil de `ticksDoCiclo`), `tests/F-VIVO-b-trabalho.test.ts`
(a sequência do caso 2 muda: **não-regressão vai na tarefa que mudou o texto**),
`tests/F-VIVO-f-caso-2-na-casa.test.ts`, `tools/shots/F-VIVO-f.js`.

**Aceite.**
1. Pedreira (quarry) e Canavial, tick a tick num ciclo: quadro de trabalho nulo em
   `[0, descanso + noTile)`, e a sequência `inicio → meio → fim` inteira no resto.
2. Com o canteiro no tile (`colhendo`), a casa não tem quadro de trabalho **nem** ocioso.
3. Os números de fase vêm do dado carregado: o teste compara com
   `gameData.producao…colheita`, e não com literal.
4. Roteiro despausado: a pedreira com o canteiro fora e a pedreira com ele dentro, lado a lado.

---

## F-VIVO-g — o curral guarda o último quadro

**Regra (só render, decisão C3).** Entre duas entregas de milho, `animaisDoCurral` devolve o
curral vazio (o aceite da F-VIVO-c diz "sem insumo, curral vazio"). A F-VIVO-g guarda o último
curral **não vazio** desenhado enquanto o prédio tiver ocupante, e esvazia quando o ocupante
sai de vez ou o prédio é demolido.

O KaM guarda a idade do animal **na sim** (`fBeastAge`, `KM_HouseSwineStable.pas:51-61`). Aqui
não: é memória de tela. Consequência aceita e escrita no aceite: **depois de carregar uma
partida, o curral começa vazio** até a próxima entrega, porque a memória não entra no save.
Se o operador quiser o curral certo no load, é feature de sim, e outra.

**Arquivos.** `src/render/animais.ts` — `curralDesenhado(anterior, atual, ocupado)`, pura: a
memória fica num `Map` do `WorldScene`, como o `estagioDesenhado` do BUG-W. Teste
`tests/F-VIVO-g-curral-guarda.test.ts`, roteiro `tools/shots/F-VIVO-g.js` (o save da F19b que
a F-VIVO-c já grava).

**Aceite.**
1. A função: com `atual` vazio e ocupado, devolve `anterior`; com `atual` cheio, devolve
   `atual`; desocupado, devolve vazio.
2. Na cadeia da carne (F19b), pelo `step`, a contagem de ticks com o curral **desenhado**
   vazio e o prédio ocupado cai a 0 depois da primeira entrega; o número antes e depois vai
   para `test-output/F-VIVO-g.json`.
3. Roteiro: avança até entre duas entregas e afirma `debug.animaisDesenhados` > 0.

---

## F-VIVO-h — a escola anima enquanto treina (prioridade baixa)

**Regra (adotada do KaM, A5/C1).** A escola (`schoolhouse`) sai da lista "sem receita" do
`docs/BRIEF-ARTE.md` e ganha um laço de 8 quadros, `treino_1..8`, desenhado enquanto a fila
de treino tem recruta **em curso**. Fila vazia, ou só com item esperando mercadoria: nada.

**A conferir na Tarefa 1 (hipótese, não aberta):** o campo da fila está em
`src/sim/escola.ts` (há um `ItemDeFila[]` exportado perto da linha 31), e "em curso" é o
primeiro item com progresso. Se o estado não distinguir "em curso" de "esperando", **parar e
reportar**: separar os dois é mudança de sim, e não entra num sub-item de render.

**Arquivos.** `src/render/trabalho.ts` (`quadroDaEscola`), o manifesto (`trabalho` com id
`schoolhouse` sem receita: exceção nomeada no validador, com caso que reprova para outro
prédio sem receita), `docs/BRIEF-ARTE.md` (a lista "sem receita" e a conta de quadros),
teste e roteiro próprios.

**Aceite.** O laço aparece do primeiro ao último tick do treino de um recruta e some no tick
em que ele sai; escola sem fila e escola esperando mercadoria não animam; roteiro despausado
com a escola treinando.

---

## Notas que não viram sub-item

- **C4, a feira sem pilha.** Decisão do operador: fica sem pilha até a feira ter regra de
  estoque na sim. Hipótese a conferir no primeiro sub-item que tocar em `pilhas`:
  `pilhasDoPredio` já devolve `[]` para `marketplace` (ela não tem receita). Se devolver, uma
  linha de teste guarda; se não, é BUG, e vai para o `BUGS.md`.
- **A3, o fogo por dano.** Fora da F-VIVO: é arte nova e é combate. Entra na fila **depois da
  C-IA-02** (economia da IA), no molde da fumaça: um laço genérico em N pontos derivados do
  `hp`, e não 8 por prédio como no KaM (`KM_Houses.pas:1348-1360`). A nota vai no
  `BUILD_PLAN.md` junto da C-IA-02 quando o operador aprovar este plano.
- **A4 (bandeira), B1–B7:** mantidos como estão, sem trabalho.

## Perguntas ao operador

1. **Pausado mostra ocioso?** No KaM, a casa parada pelo jogador tem o trabalhador dentro
   sem trabalhar. Este plano segue a F-VIVO-b (pausado não anima), que é a leitura
   conservadora. Se o operador quiser o ocioso no pausado, é uma linha no predicado e uma
   no aceite 2 da F-VIVO-e.
2. **Arte do ocioso.** Um laço genérico precisa caber em todos os prédios: a sugestão é algo
   que não depende da planta (luz de candeeiro na janela, um vulto). É decisão de arte, e o
   placeholder cobre até lá.
