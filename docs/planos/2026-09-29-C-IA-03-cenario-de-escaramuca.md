# C-IA-03 — Cenário de escaramuça (plano)

Decisão do operador (2026-09-29): o cenário vem ANTES da economia da IA (C-IA-02), porque sem
ele nada do combate é jogável — há ataque a prédio, torre, tipos de tropa, IA e fim de
partida, e nenhum adversário na tela. Item próprio, o próximo. "Duas vilas, dois lados, o mapa
que já existe. Comece pelo mínimo: a IA com a vila de pé e tropa, sem economia."

## 1. O que existe hoje (verificado no código, 2026-09-29)
- `createInitialState` só monta o lado do jogador, de `economy.json estadoInicial`
  (`src/sim/state.ts:1704`). `state.ia` nunca é criado fora de teste e save.
- A sim já aguenta dois lados: JobBoard por lado (C7), IA (F28-IA), fim de partida (F34), save
  com `ia` e `partida`.
- **O que VAZA entre lados** e o cenário expõe:
  - `tiposJaConstruidos` é global (`sim/desbloqueio.ts`): o quartel da IA liberaria o quartel
    no menu do jogador;
  - o HUD soma estoque e população dos dois lados (`estoqueDosArmazens`, `comidaTotal`,
    `populacaoPorGrupo`);
  - os avisos (`alertasDoEstado`) e o centro da câmera (`centroDaVila`) também.
- **Nada distingue o inimigo na tela:** a cor da unidade e do prédio não depende do lado.
- O mapa `sertao-128` tem área livre em torno de (64..88, 64..88), a ~45 tiles da vila.

## 2. Sub-itens (uma sessão cada)
- **C-IA-03a — o cenário na sim (só `sim/` e `data/`).**
  - `data/escaramuca.json`: a vila da IA (prédios completos com posição), o estoque do
    armazém, o quartel (armas na entrada e recrutas), a tropa inicial e as posições de defesa.
  - `sim/cenario.ts`, `criarEscaramuca(semente)`: `createInitialState` + a vila da IA no lado
    `LADO_DA_IA` + `state.ia` com as posições.
  - Os vazamentos da §1 fecham: desbloqueio só conta prédio do jogador; HUD, avisos e centro
    da câmera leem só o lado do jogador.
  - Regra de dado: tipos existem, tropa é militar, posição tem tipo de grupo válido e cabe no
    grupo (≤ `tamanhoDoGrupo`).
  - **Aceite:** os prédios da IA passam no `canPlace` e não se sobrepõem; a IA guarnece e fica;
    o menu do jogador não ganha o quartel; o HUD não soma a IA; destruir a IA dá vitória;
    save byte a byte; determinismo.
- **C-IA-03b — jogar o cenário pela tela (integração: `ui/` + `render/` + `main.ts`).**
  - Começar uma escaramuça pela tela (botão "Nova escaramuça" no painel H, e `?escaramuca`
    para o roteiro).
  - O inimigo se distingue: cor por lado vinda do tema, sem arte nova.
  - Screenshot com roteiro despausado: a vila da IA, o ataque do jogador, a vitória.
- **C-IA-03c — a partida se joga até o fim.** Um roteiro longo: o jogador forma tropa, marcha,
  derruba a vila da IA e vê a vitória; e o caminho da derrota. Ajuste de números em lote se
  preciso (`BALANCE_LOG.md`).

## 3. Decisões tomadas na sessão (conservadoras, PARA REVISÃO)
1. **Sigla C-IA-03**, módulo IA: o cenário é "o adversário". Nasceu na Fase C.
2. **O lado da IA é `LADO_DO_JOGADOR + 1`**, constante `LADO_DA_IA` no código: é identificador,
   não balanceamento.
3. **A vila mínima:** armazém (com estoque), escola, quartel (com armas e recrutas finitos) e
   duas posições de defesa com 9 cabras (corpo a corpo, frente) e 9 bodoqueiros (distância,
   trás). Sem serf, sem produção: é o "sem economia" do operador. Com 18 soldados em posição,
   a regra do ataque (F28-IA ponto 6: 9 ociosos FORA de posição) não dispara — a IA mínima
   defende e repõe pelo quartel, não ataca. O ataque vem com a economia (C-IA-02).
4. **A escaramuça NÃO substitui o jogo livre no 03a:** `createInitialState` continua igual
   (todos os testes e roteiros dependem dele). Como a tela começa é decisão do 03b.
5. **Sem fome da IA:** o andaime L8 (`iaDrena: false`) continua até a C-IA-02.

## 4. Riscos
- **Desbloqueio por lado muda a regra da F12** (desbloqueio): hoje "qualquer prédio completo".
  Com um lado só, não muda nada; com dois, só o do jogador conta.
- **Seletor do HUD por lado:** hoje sem parâmetro; os testes antigos têm um lado só e não
  mudam de resultado.
- **Gerador de mapa:** `tools/gerar-mapa.js` reserva só a vila do jogador. Se o mapa for
  regerado, a vila da IA pode cair em pedra. O teste do 03a pega isso (o `canPlace` reprova).
