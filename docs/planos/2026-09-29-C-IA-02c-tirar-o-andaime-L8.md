# C-IA-02c — tirar o andaime L8 (dado + teste longo)

**Item da fila (BUILD_PLAN.md):** "`condicao.iaDrena: true`. A tropa da IA sente fome e come
da produção pelo `comida-para-tropa`."

## A sonda (2026-09-29, antes do plano)

Escaramuça com `iaDrena: true`, sem comando do jogador, 40000 ticks:

- as 12 das posições (9 de frente e 3 de arco) pedem comida no limiar do civil, o serf da IA
  leva, e ninguém delas morre. O pão da IA sobe de 25 para 159;
- **os 9 atacantes (C-IA-04) morrem de fome no tick ~18000.** A C-IA-01 (IA alimentar tropas)
  só alimenta quem está em POSIÇÃO. Depois da paz, eles derrubam os prédios do jogador parado
  e ficam ociosos lá, sem alvo, até morrer.
  - O jogador não perde porque tem 18 cabras vivos (regra da F34). É o comportamento de
    hoje, não é deste item.

**O KaM alimenta todo grupo, não só a posição.** O `TKMGeneral.CheckArmy`
(`KM_AIGeneral.pas:306-327`, 731a8a4) percorre `gHands[fOwner].UnitGroups` inteiro e dá
`OrderFood` ao grupo que não está em luta e está abaixo de `UNIT_MIN_CONDITION`. Sem isso,
"a tropa da IA come da produção" vale só para 12 dos 21.

## O que muda

1. **Dado:** `data/condition.json: militar.iaDrena` passa a `true`. O `_docIaDrena` diz que
   o andaime saiu e por quê (a IA tem armazém, pão e serf desde a C-IA-02a).
   - A chave continua existindo (conservador, PARA REVISÃO). Apagar a chave e o ramo de
     `condicao.ts` é uma limpeza que o operador pode pedir.
2. **Sim (`systems/ia.ts`):** a `alimentarAPosicao` vira `alimentarGrupo(state, membros,
   dados)`, com a mesma regra: ninguém lutando, o mais faminto abaixo do limiar do civil e
   alguém que pediria. Ela roda para cada posição e, depois, para a **sobra**, que são os
   militares vivos do lado que não são membros de posição.
   - A sobra é um grupo só: na escaramuça é o grupo dos atacantes. Isso é PARA REVISÃO: a
     sim não tem grupo como entidade.
3. **Testes que codificam o andaime:**
   - `C-COMIDA-01c`: "ANDAIME (L8)" hoje afirma `iaDrena === false`. Ele passa a afirmar que
     o dado real drena e que o dado com `iaDrena: false` não drena. A chave continua testada
     nos dois sentidos;
   - `C-COMIDA-01e`: o comentário do andaime é atualizado. O teste baixa a condição à mão,
     então não depende da chave.

## Testes (`tests/C-IA-02c-fome-da-ia.test.ts`)

1. **Longo:** escaramuça com o dado real, sem comando, 24000 ticks (passa dos 18000 em que o
   militar sem comida morre):
   - nenhum militar da IA morre de fome. Conta quem some com condição ≤ 1 no tick anterior;
   - houve `comida-para-tropa` para membro de posição e para membro da sobra;
   - o pão da IA foi consumido: o acumulado entregue à tropa é > 0 (memória: se o saldo é
     GASTO, a medida é o entregue).
2. **A sobra é alimentada:** 3 militares da IA fora de posição, com condição abaixo do limiar,
   ociosos, na vila do cenário da C-COMIDA-01e. A IA dá `FeedUnits` a eles.
3. **Mutação:** sem o passo da sobra, o teste 1 acusa as 9 mortes (verificado na sessão, e
   não entra como teste).
4. Determinismo: duas corridas de 3000 ticks, mesmo JSON.

Não-regressão: C-IA-01 (C-COMIDA-01e), C-IA-03a/b, C-IA-04 e a partida sem tela no
`npm run verify`. Roteiros C-IA-02a e C-IA-03c pelo código de saída. A tela não muda.

## O que a execução acrescentou

- O teste longo começa com a tropa da IA faminta, com ¼ da cheia, e roda 6000 ticks. A
  partida cheia, de 24000 ticks, disputava CPU com a suíte paralela e derrubava testes
  alheios por timeout.
- A C-COMIDA-01e tinha mais um teste preso ao andaime: "os três ficam cheios". Ele passou a
  afirmar cheio no tick em que cada um come. Foi o mundo transladado que acusou.
- A C-IA-03b "peace-ended" (12 s) caiu em 2 de 5 verifies, por carga. O risco está no
  PROGRESS, e o `timeout` não foi tocado.
