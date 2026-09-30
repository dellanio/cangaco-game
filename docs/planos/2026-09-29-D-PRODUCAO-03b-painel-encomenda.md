# D-PRODUCAO-03b — Encomendas das oficinas, o painel (ui): plano

Lote do operador (2026-09-29). Escopo do BUILD_PLAN: "No painel da oficina, uma linha por
saída com −/+ e a encomenda restante, no molde da aba Distribuição, e o alerta de encomenda
cumprida." A regra é a da 03a (`sim/producao.ts`, `SetProductionQuota`), já entregue.

Camadas: `sim/selectors.ts` (leitura pura) + `src/ui/` + `data/theme-sertao.json`. Nada em
`src/render/`, nada em regra da sim (§10 respeitada).

## O que existe (verificado no código)

- `painelDoPredio` (`sim/selectors.ts:677`) monta um campo por seção (`feira`, `quartel`,
  `armazem`…), `null` em quem não tem.
- `ui/painel-predio.ts` redesenha a 10 Hz com `replaceChildren`; botões mandam o VALOR, nunca
  um toggle; o molde −/+ é o `botaoDaFeira` da C-TELA-05.
- `SetProductionQuota { predio, cota }` substitui a encomenda inteira; faixa
  `0..producao.encomenda.maxima`; acima é `cota-invalida`.
- `production-order-completed { predio }` sai no depósito do último ciclo encomendado (03a).
  Hoje ninguém o consome.
- `ui/aviso-de-ordem.ts` escreve o `#aviso-de-ordem` sobre o mapa e some depois de
  `ordem.segundosNaTela`.

## O que entra

1. Seletor: `PainelDoPredio.encomenda: { maxima, emCurso, saidas: [{ mercadoria, falta }] } |
   null`. `null` em quem não tem receita com `escolheSaida`. As saídas na ordem de
   `economia.mercadorias` (`saidasDaReceita`); `falta` é a cota restante; `emCurso` é a saída
   que o ciclo em andamento vai entregar (já descontada).
2. `ui/encomenda.ts` (puro, testável sem DOM):
   - `comandoDeEncomenda(predio, encomenda, mercadoria, delta): Command | null` — manda o mapa
     inteiro com a saída mexida, grampeada em `0..maxima`; `null` se nada muda (no zero,
     − não manda nada).
   - `textoDaEncomendaCumprida(estado, rotulo, nomeDoPredio)` — o texto do aviso se algum
     `production-order-completed` do tick é de prédio do jogador (`LADO_DO_JOGADOR`).
3. Painel: seção "Encomenda" no bloco do meio, uma linha por saída com `− falta +`, marca
   "em curso" na saída do ciclo, e `data-encomenda`, `data-falta`, `data-em-curso`. Linha
   "Sem encomenda: parada" quando tudo é zero e nada está em curso.
4. Aviso: `aviso-de-ordem.ts` mostra a recusa da ordem militar; sem recusa, a encomenda
   cumprida. Mesmo elemento, mesmo tempo na tela.
5. Tema: `painelPredio.encomenda`, `encomendaEmCurso`, `semEncomenda`,
   `encomendaMenos`/`encomendaMais` (title), `ordem.encomendaCumprida` com `{predio}`.

## Aceite da 03b

`tests/D-PRODUCAO-03b-painel-encomenda.test.ts`, tudo pelo `step`:

1. O seletor da oficina recém-nascida: três saídas da ferraria de armas, `falta` 0, sem
   `emCurso`; `null` na fundição (receita sem escolha) e no armazém.
2. `comandoDeEncomenda` com +1 levado ao `step` sobe a `falta` da saída em 1; com −1 no zero
   devolve `null`; no máximo, + devolve `null`.
3. O ciclo começa e o seletor passa a dizer `emCurso` com a `falta` já descontada.
4. No tick do `production-order-completed` do jogador, `textoDaEncomendaCumprida` dá o texto
   com o nome do prédio; num tick sem o evento, `null`; evento de prédio da IA, `null`.
5. Grava a partida do roteiro: ferraria de armas no fim de um ciclo encomendado (espada em
   curso, encomenda toda em zero, ~3 s de jogo para o depósito).

Roteiro `tools/shots/D-PRODUCAO-03.js` (§8: abre o painel com o jogo andando e clica com
`mouse.down`/150 ms/`mouse.up`):

1. Painel da ferraria: três linhas de encomenda, todas `falta` 0, espada `em curso`.
2. Despausa: o aviso "Encomenda cumprida" aparece sobre o mapa, e a linha "sem encomenda".
3. `+` da lança com o jogo andando: `falta` da lança 1 (ou 0 com a lança em curso, se o ciclo
   já começou).

## PARA REVISÃO

- A encomenda cumprida vai no `#aviso-de-ordem` (o texto passageiro sobre o mapa), e **não**
  como causa nova na aba Alertas: causa nova muda os roteiros da F22 e o alerta de lá é de
  estado persistente, não de evento.
- Um clique é ±1. Não há "+10" nem arrastar (o KaM tem clique direito ±10); fica para a
  varredura se o operador quiser.
- A oficina parada por falta de encomenda ganha a linha "sem encomenda", mas não muda o
  rótulo do ocupante (continua `trabalhando`, decisão da 03a).
