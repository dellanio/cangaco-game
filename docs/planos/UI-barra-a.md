# Plano — UI-barra-a, a barra lateral única

Critério: `BUILD_PLAN.md` › UI-barra-a, intocado. Desenho: `docs/propostas/barra-lateral-unica.md`
› "Decisões do operador". Referência visual: a barra que o Codex desenhou, mandada pelo
operador em 2026-09-26 ("está perfeito como referência, replique fielmente").

## A referência, peça por peça

| Na imagem | Na barra |
|---|---|
| moldura de madeira em volta de tudo, rebites de latão | `#barra`: borda de madeira em CSS (gradiente + veio), cantos rebitados |
| placa de pergaminho com cactos, no topo | 1. logo (`[data-marca="logo"]`), placeholder com o id até a arte |
| — (pedido do operador) | 2. a dica do H, logo abaixo da logo, regra da F-D1 |
| quadro escuro rebaixado + faixa estreita com rosa dos ventos | 3. `#minimapa` reservado (placeholder), carimbo PAUSADO/velocidade sobre ele |
| cinco tábuas escuras com dois rebites cada | 4. `#hud`: os cinco recursos, um por tábua |
| — | 5. `#alertas`: faixa de altura fixa, tábua rebaixada, vazia sem alerta |
| quatro botões de pergaminho numa régua escura | 6. `#abas`: Construir, Distribuição, Estatísticas, Opções |
| folha de pergaminho pregada, grade de células de pergaminho | 7. `#corpo-aba`: grade (`#menu-build`) OU painel (`#painel-predio`) OU opções |
| placa de pergaminho com cactos, no pé | 8. `.marca` com o lema |

Divergência consciente: a imagem tem 4 colunas de células grandes. O aceite fixa
5 × 40 px (decisão do operador). Fica 5; registrado no PROGRESS para revisão.

A escala da imagem (941 px) não se aplica à barra de 260: a moldura fica fina (5 px)
para caber a grade (5×40 + 4×8 = 232) e o slot da fila (232).

## Tarefas

1. `index.html` e `estilo.css`: grade do `body` vira `260px 1fr`, uma linha. A barra
   é `flex` em coluna, `height: 100vh`, só `#corpo-aba` rola.
2. `src/ui/barra.ts` (novo, substitui `prancha.ts` e `balcao.ts`): monta logo,
   minimapa, abas e marca; regra pura `corpoDaAba(aba, haSelecao)` →
   `'grade' | 'painel' | 'opcoes'`, escrita em `data-corpo` no `<body>`. Aba
   Construir limpa a seleção (como o Esc). Selecionar um prédio volta a aba para
   Construir. Distribuição e Estatísticas: `aria-disabled` com cadeado.
   Opções: botão que abre a ajuda.
3. `hud.ts` fica (o `#hud` passa a ser o bloco das tábuas); `aviso-tempo.ts` monta
   no `#minimapa`; `ajuda.ts` põe a dica logo depois da logo e expõe `abrir()`.
4. `alertas.ts`: até 2 causas visíveis, "+N" para as outras; altura fixa em CSS.
5. Painel empilhado: blocos em coluna; engajar em 2 colunas; botão usa
   `civis.<id>.curto` se houver (`title` e slot com o nome longo).
6. Tema: `painelPredio.hp` = "Vida", `barra` (abas, lema, rótulos), sai `paineis`.
7. Menu Build: cadeado no lugar do `grayscale`.
8. Testes: `tests/UI-barra-a.test.ts` (regra, tema, curto, guarda de import) no lugar
   de `estilo-ui-balcao.test.ts`.
9. Roteiros: novo `tools/shots/UI-barra-a.js` (medidas a 1280 e 1920, `elementFromPoint`,
   rolagem, engajar, screenshot da escola); atualizar F06, F16b, F22, F11a, F-D1 e quem
   mais citar os seletores que saem.
10. `npm run verify`, roteiros, PROGRESS, `test-results.json`, commit.
