# KaM: animação da casa, pilhas e trabalhador sem insumo (medida)

**Para que serve:** insumo da skill de arte do Codex. **É medida, não decisão**: nada aqui
obriga o nosso jogo a fazer igual.

**Fonte (2026-09-30):**
- `houses.dat` e `houses.rx` da instalação do operador
  (`D:\SteamLibrary\steamapps\common\Knights and Merchants Historical Version`);
- o fonte do `kam_remake`, commit `731a8a4` (2026-09-25), clone fora do repositório.

**Como foi lido:**
- o layout de `TKMHouseSpecLegacy` (`src/res/KM_ResHouses.pas:21-47`);
- o leitor de cabeçalho `.rx` de `tools/kam-medir.js:86`, que lê só largura, altura e pivot,
  sem pixel;
- `WorkerRest` pelo próprio `tools/kam-medir.js` (`workerRestTicks`).

Os campos novos (pilhas, `Ocioso`, fumaça, mastro, região) saíram de duas sondas no scratchpad
da sessão. **O `tools/kam-medir.js` ainda não lê esses campos.** Nenhum dado, arte ou pixel do KaM
entrou no repositório (`tools/kam-medir.md`).

## Como ler as tabelas

- **Posição** é a fração do sprite da casa pronta: x da esquerda (0) para a direita (1) e y do
  topo (0) para a base (1). Valor fora de [0, 1] quer dizer que passa do sprite, como a fumaça
  acima do telhado. É o mesmo referencial das `ancoras` do nosso manifesto.
- **Região** é a caixa que junta todos os quadros da animação, já com o `MoveX/MoveY` da
  animação.
- **Pé** é o ponto de baixo, no centro, da pilha de 1 unidade.
- **q** é o número de quadros.
- A casa do KaM vai de 1 a 5 estágios de pilha: **um sprite pronto por quantidade**, e não
  unidades empilhadas (`AddHouseSupply`, `src/render/KM_RenderPool.pas:878-949`). O teto é
  `MAX_WARES_IN_HOUSE = 5` (`src/common/KM_Defaults.pas:299`).

## Os estados de animação da casa

O enum é `TKMHouseActionType` (`src/common/KM_Defaults.pas:764-768`):

| Estado | O que é | Quando roda |
|---|---|---|
| `haWork1..haWork5` (W1..W5) | o trabalho, "Start, InProgress, .., .., Finish" (`KM_Defaults.pas:765`) | durante o ciclo de produção, um de cada vez, na ordem do plano de trabalho (`src/units/tasks/KM_UnitTaskMining.pas:357`, `:375`) |
| `haIdle` (Ocioso) | a casa com o trabalhador dentro e **sem** trabalhar | de `hstIdle` (`src/houses/KM_Houses.pas:2451-2453`) até o trabalho começar (`:2455`) ou o trabalhador sair (`:2456`) |
| `haSmoke` (Fumaça) | a fumaça | ligada durante o trabalho (`KM_UnitTaskMining.pas:353`), e roda contínua (`KM_RenderPool.pas:837-840`) |
| `haFlagpole`, `haFlag1..3` (Mastro, Band.) | o mastro e as bandeiras | sempre: entram ao completar a casa (`KM_Houses.pas:698`) |
| `haFire1..8` | o fogo da casa danificada | 6 q cada em todas as casas. A posição não foi medida |

## Tabela por casa

A coluna **Descanso** é o `WorkerRest × 10` em ticks do KaM: quanto o trabalhador espera dentro
antes de procurar trabalho de novo.

| KaM → nosso id | Trabalho: q e região (x; y) | Ocioso: q e região (x; y) | Fumaça | Mastro / bandeiras | Pilha de entrada: pé (x; y), estágios | Pilha de saída: pé (x; y), estágios | Descanso |
|---|---|---|---|---|---|---|---|
| Sawmill → `sawmill` | W1 30, W2 10, W5 30 · (0,51–0,81; 0,50–0,92) | 30 · (0,52–0,61; 0,50–0,91) | — | Band. 10 | 1: (0,13; 0,85), 1–5 | 1: (0,38; 0,64), 1–5 | 50 |
| IronSmithy → `iron_smithy` | W2 30, W3 30 · (0,49–0,80; 0,60–0,93) | 10 · (0,36–0,53; 0,59–0,98) | 4 · (0,58–0,82; −0,42–0,11) | mastro 1, Band. 10 | 2: (0,75; 0,88), (0,19; 0,83), 1–5 | 1: (0,90; 0,67), 1–5 | 50 |
| WeaponSmithy → `weapon_smithy` | W1..W5 30 cada · (0,27–0,65; 0,34–0,89) | 30 · (0,41–0,59; 0,43–0,78) | 4 · (0,36–0,59; −0,43–0,07) | mastro 1, Band. 10 | 2: (0,10; 0,76), (0,12; 0,93), 1–5 | 3, todas em ~(0,84; 0,8), 1–5 | 50 |
| CoalMine → `coal_mine` | W1 30, W2 15, W5 30 · (0,48–0,73; 0,00–0,79) | 1 · (0,28–0,39; 0,63–0,92) | — | Band. 5 | — | 1: (0,14; 0,93), 1–5 | 50 |
| IronMine → `iron_mine` | W2 16 · (0,30–0,69; 0,54–0,88) | 30 · (−0,03–0,19; 0,52–0,97) | — | mastro 1, Band. 5 | — | 1: (0,75; 0,83), 1–5 | 50 |
| GoldMine → `gold_mine` | W2 16 · (0,46–0,65; 0,51–0,84) | 30 · (0,13–0,38; 0,54–0,98) | — | mastro 1, Band. 5+5 | 1 (*): (0,81; 0,89), 1–5 | 1: (0,81; 0,89), 1–5 | 50 |
| Fishermans → `fishermans` | **nenhum** (trabalha fora) | 30 · (0,26–0,46; 0,61–1,01) | — | mastro 1, Band. 5 | — | 1: (0,69; 0,95), 1–5 | 590 |
| Bakery → `bakery` | W2 24, W3 30 · (0,37–0,50; 0,69–0,89) | 30 · (0,39–0,50; 0,69–0,98) | 4 · (0,58–0,82; −0,37–0,05) | mastro 1, Band. 10 | 1: (0,12; 0,82), 1–5 | 1: (0,16; 0,92), 1–5 | 50 |
| Farm → `farm` | **nenhum** (trabalha fora) | 30 · (0,40–0,50; 0,60–0,73) | — | Band. 10 | — | 1: (0,77; 0,90), 1–5 | 50 |
| Woodcutters → `woodcutters` | **nenhum** (trabalha fora) | 30 · (0,61–0,82; 0,46–0,92) | — | mastro 1, Band. 5 | — | 1: (0,13; 1,01), 1–5 | 50 |
| ArmorSmithy → `armor_smithy` | W2..W5 30 cada · (0,64–0,95; 0,50–0,87) | 30 · (0,74–0,95; 0,63–0,99) | 4 · (0,73–0,95; −0,16–0,28) | mastro 1, Band. 5 | 2: (0,39; 0,91), (0,10; 0,78), 1–5 | 2: (0,45; 0,98), (0,46; 0,98), 1–5 | 50 |
| Store → `storehouse` | **nenhum** | **nenhum** | — | Band. 5+5 | **nenhuma** | **nenhuma** | — |
| Stables → `stables` | W1..W5 30 cada · (0,41–0,88; 0,56–0,94) | 18 · (0,74–0,87; 0,65–0,92) | — | mastro 1, Band. 10 | 1: (0,47; 0,68), 1–5 | — (os cavalos são animais, ver abaixo) | 100 |
| School → `schoolhouse` | W1..W5 30 cada · (0,35–0,47; 0,25–0,39) | **nenhum** | — | mastro 1, Band. 10 | — | — | 10 |
| Quarry → `quarry` | W2 18, W5 30 · (0,22–0,43; 0,59–0,98) | 18 · (0,24–0,43; 0,58–0,97) | — | mastro 1, Band. 5 | — | 1: (0,72; 0,85), 1–5 | 50 |
| Metallurgists → `metallurgists` | W2 28, W3 30, W4 30 · (0,13–0,29; 0,29–0,41) | 30 · (0,14–0,28; 0,28–0,45) | 4 · (0,54–0,78; −0,31–0,12) | mastro 1, Band. 5 | 2: (0,13; 0,97), (0,21; 0,81), 1–5 | 1: (0,69; 0,87), 1–5 | 50 |
| Swine → `swine_farm` | W2 30, W3 30 · (0,43–0,55; 0,62–0,74) | 30 · (0,44–0,55; 0,63–0,75) | — | mastro 1, Band. 10 | 1: (0,14; 0,63), 1–5 | 2: (0,49; 0,40), (0,47; 0,89), 1–5 | 50 |
| WatchTower → `watchtower` | W2 1 (quadro fixo) · (0,21–0,39; 0,32–0,41) | 30 · (0,20–0,40; 0,32–0,46) | — | mastro 1, Band. 10 | — | — | 0 |
| TownHall → `town_hall` | **nenhum** | **nenhum** | — | Band. 5+5 | — | — | 10 |
| WeaponWorkshop → `weapons_workshop` | W1 16, W2..W5 30 · (0,18–0,43; 0,55–1,07) | 30 · (0,23–0,34; 0,64–1,04) | — | Band. 10 | 1: (0,13; 0,96), 1–5 | 3, todas em ~(0,51; 0,78), 1–5 | 50 |
| ArmorWorkshop → `armory_workshop` | W2..W4 30 cada · (0,63–0,88; 0,43–0,83) | 30 · (0,57–0,71; 0,43–0,71) | — | mastro 1, Band. 10 | 2: (0,25; 0,75), (0,29; 0,85), 1–5 | 2: (0,55; 0,94), (0,55; 0,91), 1–5 | 50 |
| Barracks → `barracks` | **nenhum** | **nenhum** | — | mastro 1, Band. 5+5+10 | — | — | 50 |
| Mill → `mill` | W2 8 · (0,36–0,51; 0,29–0,42) | 30 · (0,35–0,50; 0,28–0,42) | — | **mastro 10** (as pás, região (−0,15–0,80; −0,26–1,04)), Band. 5 | 1: (0,72; 0,84), 1–5 | 1: (0,24; 1,00), 1–5 | 50 |
| Butchers → `butchers` | W1 15, W2 27, W3 30, W4 3 · (0,07–0,29; 0,36–0,59) | 20 · (0,18–0,31; 0,22–0,57) | — | Band. 10 | 1: (0,47; 0,83), 1–5 | 1: (0,28; 0,85), 1–5 | 50 |
| Tannery → `tannery` | W1 29 · (−0,05–0,28; 0,42–1,00), W2 12 · (0,48–0,63; 0,57–0,83) | 30 · (0,52–0,65; 0,56–0,91) | 4 · (0,50–0,74; −0,45–0,05) | Band. 5+5 | 1: (0,27; 1,00), 1–5 | 1: (0,80; 0,83), 1–5 | 50 |
| Inn → `inn` | **nenhum** | **nenhum** | — | Band. 5+5+10 | 4: (0,30; 0,66), (0,19; 0,80), (0,44; 0,64), (0,47; 0,64), 1–5 | — | 50 |
| Vineyard → `wineyard` | W1 30, W2 24, W5 28 · (0,10–0,34; 0,46–0,83) | 30 · (0,55–0,70; 0,49–0,89) | — | mastro 1, Band. 5 | — | 1: (0,58; 0,80), 1–5 | 50 |
| (Market) → `marketplace` | **não está no `houses.dat` original** | **não achado** | **não achado** | **não achado** | o remake preenche no código (`src/res/KM_ResHouses.pas:812-828`) e desenha **uma** pilha, a da mercadoria de maior quantidade (`src/houses/KM_HouseMarket.pas:603`) | — | **não achado** |
| SiegeWorkshop → (não temos) | W2..W4 30 · (0,38–0,59; 0,46–0,97) | 30 · (0,49–0,70; 0,53–0,98) | — | Band. 5+1 | 2: 3 e 4 estágios | — | 50 |

**(*)** A GoldMine tem 5 sprites de entrada, mas `WareInput` vazio (`-1`). É **hipótese** que
seja resto de dado sem uso.

**Animais** (Swine, Stables): `AddHouseStableBeasts` (`src/houses/KM_HouseSwineStable.pas:106`)
desenha 5 animais, cada um em até 3 idades. Os quadros saem de `fBeastAnim` (2 casas × 5 animais
× 3 idades) no começo do `houses.dat`:
- primeiro bloco: 26, 9, 28 / 28, 26, 9 / 9, 8, 26 / 26, 25, 9 / 8, 26, 28;
- segundo bloco: 12, 30, 30 / 11, 30, 12 / 12, 30, 30 / 11, 30, 12 / 12, 30, 12.

É **hipótese** que o primeiro bloco seja o Swine e o segundo o Stables: a ordem não foi
conferida no fonte.

**O que o `Ocioso` mostra — não confirmado, hipótese:** a região do `haIdle` fica em geral na
parte de baixo da casa (y até ~0,9–1,0, perto da porta). Na WatchTower, no Mill, no Metallurgists
e no Butchers ela fica mais alta (y ~0,2–0,45), o que sugere janela. **Isso não foi visto no
pixel**: o leitor não abre imagem. Para confirmar, basta abrir um quadro do `haIdle` de uma casa
de cada grupo.

## O que o trabalhador faz sem insumo (e sem trabalho)

Tudo abaixo foi verificado no fonte do remake (`731a8a4`):

1. **Ele fica dentro, invisível.** Dentro de casa e sem tarefa, ele pede trabalho
   (`TaskGetWork`). Sem trabalho, **descansa em casa** por `WorkerRest × 10` ticks e pergunta de
   novo (`src/units/KM_Units.pas:662-667`: "We didn't find any job to do - rest at home"). A
   invisibilidade vem de entrar pela porta: `Visible := ... (fStep > 0)`, "Make unit invisible
   when it's inside of House" (`src/units/actions/KM_UnitActionGoInOut.pas:444`).
2. **A casa mostra o `haIdle`** enquanto ele espera. O estado `hstIdle` é ligado:
   - ao chegar em casa (`src/units/tasks/KM_UnitTaskGoHome.pas:58`);
   - ao terminar um ciclo (`KM_UnitTaskMining.pas:423`);
   - ao abandonar um trabalho (`KM_UnitTaskMining.pas:67-68`).

   O `SetHouseState` põe o `haIdle` e tira os `haWork` e a fumaça
   (`src/houses/KM_Houses.pas:2451-2453`). **Nas casas sem `haIdle`** (TownHall, Store, Barracks,
   Inn, School), a casa fica parada.
3. **Ele só sai** em três casos:
   - para trabalhar fora: lenhador, fazendeiro, pescador, pedreiro e os que colhem. A casa vai
     para `hstEmpty` (`KM_UnitTaskMining.pas:247-251`);
   - para mostrar que está com fome (`KM_Units.pas:631-638`, `TKMTaskGoOutShowHungry`);
   - quando a casa é fechada para o trabalhador (`KM_Units.pas:530`, `ProceedHouseClosedForWorker`, saída em `:591`).
4. **Oficina com saída cheia não procura trabalho:** com `CheckWareOut >= MAX_WARES_OUT_WORKSHOP`,
   ele nem chama o `TaskGetWork` e descansa em casa (`KM_Units.pas:662-664`).

**Não achado no fonte:** porta abrindo, ou o trabalhador desenhado na janela como unidade. O que
aparece com ele dentro é só a animação `haIdle` **da casa**.
