# ESCOPO — o projeto hoje (foto de 2026-10-01)

**O que é:** uma leitura cruzada, sem código. **Não é plano nem prazo.**

**Fontes (`main` em `43c6a80`):**
- **o alvo:** `docs/GDD.md` e `docs/varredura-kam.md`. O pedido citava
  `knights-and-merchants-gdd.md`, que não existe no repositório nem no disco. O `docs/GDD.md` é o
  GDD do projeto e se declara derivado do *Knights and Merchants* (linhas 8-10);
- **o plano:** `BUILD_PLAN.md`, todas as fases e filas;
- **o feito:** `test-results.json`, com 176 chaves, **todas** `passes: true`, e `BUGS.md`, com 2
  bugs abertos.

**Critério de "feito":** o item tem chave `passes: true`. O plano não tem item marcado como pronto
sem chave, e nenhuma chave está `false`. Por isso "em andamento" e "planejado" são os itens do
plano **sem** chave.

---

## 1. Marcos que o BUILD_PLAN define

| Marco | Definição de pronto escrita? | Onde |
|---|---|---|
| **Fase 0 — Fundação** | **Não**, para a fase inteira. Só os aceites de F01 a F04 (esqueleto, tick determinístico, dados validados, grid ortogonal) | `BUILD_PLAN.md:25` |
| **Fase A — Loop de construção jogável** | **Sim.** "partindo do estado inicial, o jogador consegue, só com o mouse, construir 2 Woodcutter's, 1 Quarry e 1 Sawmill conectados por estrada, treinar os trabalhadores e ver o estoque subir. Nenhum prédio surge sem clique do jogador." Quem prova é a **F17 (aceite da Fase A)** | `:70-73`; F17 em `:748-753` |
| **Fase B — Comida e crescimento** | **Não.** A seção começa direto nos itens | `:1074` |
| **Fase C — Militar** | **Não** | `:5059` |
| **Fase D — Profundidade** | **Não** | `:5583` |
| **Fila C** (dez itens do operador) | **Não** como marco; é uma lista de itens | `:5845` |
| **Fila da primeira partida** (onze itens) | **Não.** A origem diz "o que impede jogar" (`:6198`), mas não há um critério de partida jogável: a fila é a lista dos itens | `:6197` |
| **Segunda partida** (4 problemas e fila de 11) | **Não.** Mesma forma da anterior | `:6276` |

A única regra de ordem entre marcos é "Fase A inteira antes de qualquer item da Fase B"
(`:6499`).

## 2. Estado por marco

"Itens" são os cabeçalhos `###` do plano, e as filas contam as entradas numeradas. As listas de
ids estão no **Anexo A**.

| Marco | Feito | Em andamento | Planejado | Esperando decisão |
|---|---|---|---|---|
| Fase 0 | **4** | 0 | 0 | 0 |
| Fase A | **26** (inclui a F17, **fechada**) | 0 | 0 | 0 |
| Fase B | **44** | 0 | 1: F-CAMPO-b (o desenho da cultura) | 2: F-REPL-c (replantar em terra virgem) e F-CAMPO-b (espera arte) |
| Fase C | **11** | 1: **BUG-T** (tropa travada), severidade `trava`; a emenda do aceite está em curso na `main` | 1: B-TERRENO-01 (recentrar a vila) | 0 |
| Fase D | **12** | 2: D-TELA-LUZ-RELEVO (luz de relevo) e D-TERRENO-ALTURA (altura só de render), no branch `dellanio/relevo-a` | 1: D-TELA-05e (mercenários em 8 direções) | 1: D-MOVIMENTO-01e (aceite da colisão civil): "MEDIDO, NÃO FECHA … espera o operador" (`:5976-5979`) |
| Fila C | **10 de 10** | — | — | — |
| Primeira partida | **11 de 11** | — | — | — |
| Segunda partida | **4 de 4 problemas e 10 de 11 itens** | — | — | item 11: VARREDURA-KAM, "sem posição na fila" (`:4356`) |

**Revisões pendentes do operador:** 34 marcas "PARA REVISÃO" no `BUILD_PLAN.md` e 90 no
`PROGRESS.md`. São decisões de implementação conservadoras que esperam o seu aval. Elas não
bloqueiam nenhum item.

## 3. Lacunas: está no GDD e não está em plano nenhum

1. **Névoa de guerra** (GDD §6.5, P1 na §7.2). No plano só aparece como "fica para depois"
   (`:5538`).
2. **Áudio** (§9.8) e a parte sonora do **feedback** (§10). Tampouco há item para a poeira da
   martelada, o pulso do HUD e o botão novo piscando.
3. **Halt, Split e Link da tropa** (§2.4; o painel de grupo é P1 na §7.2). A Frente 4b propõe um
   item (`varredura-kam.md:375-378`), que espera você.
4. **Teclado proposto** (§2.2): `B`, `F`, `Delete`, `Ctrl+1..9` e `1..9` para grupos.
5. **Do KaM, sem item** (Frente 4b, `varredura-kam.md:359-369`): modo de entrega por casa, fechar
   a casa para o trabalhador, recusa no quartel, ponto de corte do lenhador, reunião e teto de
   ouro da prefeitura, reordenar a fila da escola.

Detalhe e linhas no **Anexo B**.

## 4. Acréscimos: está no plano e não está no GDD

- **Relevo pseudo-3D:** D-TELA-LUZ-RELEVO e D-TERRENO-ALTURA. O GDD não fala de relevo.
- **Animação direcional das unidades** (8 direções, estados, passo, virada):
  `docs/planos/2026-09-30-animacao-direcional-de-unidades.md`, a D-TELA-05a (feita) e a D-TELA-05e.
  Exceção: a **carga visível no serf**, que é a Leva 1 do plano, **está** no GDD §10.
- **O prédio vivo em camadas** (F-VIVO-0 a h): pilha por unidade, ocioso, curral, escola. O GDD
  §10 só pede a fumaça ao concluir.
- **Infraestrutura de tela:** WebGL obrigatório (D-TELA-06), sinal de pausado (D-TELA-07), barra
  lateral única (UI-barra-a).
- **Infraestrutura de verificação:** calibração (F-CAL), fixtures sem posição absoluta (F18c),
  dev server sem processo órfão (F-DEV), recentrar a vila (B-TERRENO-01).

## 5. Planejados sem marco

Como as fases B, C e D não têm definição de pronto, **todo item aberto está sem marco**:

- B-TERRENO-01 (recentrar a vila)
- D-TELA-LUZ-RELEVO (luz de relevo)
- D-TERRENO-ALTURA (altura só de render)
- D-TELA-05e (mercenários em 8 direções)
- F-CAMPO-b (o desenho da cultura)
- F-REPL-c (replantar em terra virgem)
- D-MOVIMENTO-01e (aceite da colisão civil)
- BUG-T (tropa travada)

Fora do `BUILD_PLAN.md`, e por isso também sem marco:
- as **Levas 1 a 3 do plano de animação**, sem ids na fila;
- o **agrupamento de matas no gerador**, que o estudo de relevo registrou como item de gameplay.

## Perguntas ao operador

1. **As fases B, C e D ganham definição de pronto** como a da Fase A, ou os marcos passam a ser as
   filas de partida?
2. **O que é "pronto" para a "primeira partida" e a "segunda partida"?** Hoje é "a lista acabou",
   e não "uma partida se joga de ponta a ponta".
3. **A campanha é marco?** O plano a cita (`:290-293`, `:1117-1126`), mas não há item nem
   definição.
4. **Névoa, áudio e comandos de grupo:** entram em algum marco, ou ficam fora do escopo atual?
5. **Os itens do plano de animação** entram no `BUILD_PLAN.md` e em qual marco?
6. **`knights-and-merchants-gdd.md`:** o `docs/GDD.md` é o arquivo certo, ou existe outro?

---

# Anexos

## Anexo A — ids por marco (cabeçalhos `###` do plano com chave em `test-results.json`)

- **Fase 0 (4):** F01 F02 F03 F04.
- **Fase A (26):** F05a F05b F06 F07 F08 F09 F10 F11a F11b F11c F12 F13a F13b F14 F15a F15b-1
  F15b-2 F16a F16b F16c F17 F17b F17c F17d F17e F17f.
- **Fase B (44 cabeçalhos):** F18a F18b F18c (1a, 1b, 1c) F18d (1a, 1b, 2) F18e F18f F18g F18h
  F18i F-T1 F-T2 (a, b, c) F-T3 F-T4 (a, b, d) F-D1 F-D2 F-D3 F-D4 F-SPR F-TR (a, b) F18 F-TP F19
  F19b F-TA F20 (a, b, c) F21 F21b F22 F23 F23b F-CAL (a, b1, b2) F-CANA F-CANA-b F-CAMPO-a F17g
  F-REPL (a, b, d, e) F-ESC F-VIVO (0, a, b, c, d1, d2, e, f, g, h) UI-barra-a F-DEV LOTE3 (b1, b2,
  c).
- **Fase C (11 cabeçalhos):** F24a F24 (b, c) F-CERCO (a1, a2, b) F25 (a, b) F26 (a, b)
  C-COMBATE-01 (a, b, c) F28 (a, b, c, d) F28-IA (pontos 1-4, 6) C-IA-01 C-COMIDA-01 (a-d, f).
- **Fase D (12 cabeçalhos):** D-PRODUCAO-01 (a, b) D-PRODUCAO-03 (a, b) D-TRANSPORTE-01 (a, b)
  D-TRANSPORTE-02 (a, b) D-TRANSPORTE-03 D-TELA-01 D-TELA-02 D-TELA-06 D-TELA-07 F34 F35 F36.
- **Fila C (10):** C1 C2 (a, b) C3 C4 C5 C6 C7 C8 C9 (e C9b) C10.
- **Primeira partida (11):** C-MOVIMENTO-01 C-COMBATE-02 C-TELA-01 C-TELA-02 C-IA-04 C-TELA-03
  C-TELA-04 C-TELA-05 D-TELA-02 F-REPL-d C-COMBATE-01.
- **Segunda partida:** P1 C-COMBATE-02b, P2 D-PRODUCAO-02, P3 C-MOVIMENTO-02 (e 02b), P4 a IA sem
  serf (C-IA-02c); fila: C-COMBATE-01b, C-COMBATE-01c, C-IA-02 (a, b, c), D-TELA-01,
  D-TRANSPORTE-01, D-TRANSPORTE-02, D-PRODUCAO-01, D-PRODUCAO-03, F24b/F24c, as quatro hipóteses
  do avaliador (conferidas) e VARREDURA-KAM (aberto, contínuo).
- **D-MOVIMENTO-01 (colisão civil), na Fila C:** 01a, 01c, 01d, 01g, 01h e 01j com chave; 01b
  só medida; **01e medido, não fecha**; 01i medido; **01f cancelado**.
- **Bugs abertos (`BUGS.md`):** **BUG-T** (tropa travada, `trava`, operador em 2026-09-30) e
  **BUG-N** (cana em pousio parece mato cortado, `feio`).

**Como foi contado:** um script no scratchpad da sessão leu os `###`, as entradas numeradas das
filas e as tabelas de sub-itens do `BUILD_PLAN.md`, e casou os ids com as chaves por igualdade ou
prefixo. Os nomes de screenshot (`F17b-2`, `F17f-1`) e as propostas absorvidas por itens
entregues (`F18g-1/2`) foram descartados à mão. **Contar "feito" por prefixo pode esconder
sub-item sem chave dentro de um cabeçalho com chave.** Os que achei estão no §2.

## Anexo B — lacunas do GDD, com a origem

| Lacuna | GDD | No plano |
|---|---|---|
| Névoa de guerra | §6.5 (`GDD.md:542`); P1 na §7.2 (`:624`) | "fica para depois" (`BUILD_PLAN.md:5538`); a IA não respeita a névoa, PARA REVISÃO (`:5457`) |
| Áudio | §9.8 (`:756-763`) | nenhum item (o `grep` por áudio e som só acha notas de evento) |
| Feedback sonoro e visual | §10 (`:775-790`): som da planta, poeira da martelada, pulso do HUD, botão piscando | nenhum item. A "carga visível no serf" está no plano de animação (Leva 1), fora do `BUILD_PLAN.md` |
| Halt, Split, Link | §2.4 (`:156-166`), §7.2 | nenhum item; proposta da Frente 4b |
| Teclado proposto | §2.2 (`:136-139`) | nenhum item |
| Menu principal / tela de título | não está no GDD | nenhum. Registrado como ausência, não como lacuna |

## Anexo C — lacunas vistas contra o KaM (Frente 4b, `docs/varredura-kam.md:349-378`)

Os itens 4, 5, 6, 8, 9, 10 e 11 da tabela são **lacuna** ou **divergência sem decisão**. As três
propostas ao operador (`:375-380`) esperam você:
- declarar o item 5 como divergência ou alinhá-lo ao KaM;
- um item para os comandos de grupo (11);
- os itens 4, 6 e 8 juntos, num item de comandos de prédio.

O fogo por dano (KaM) está decidido para depois da C-IA-02 (IA inimiga com economia)
(`docs/planos/2026-09-30-F-VIVO-e-em-diante.md`).
