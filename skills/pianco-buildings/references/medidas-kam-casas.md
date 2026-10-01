# Levantamento externo de animação das casas

Transcrição da tabela enviada pelo operador em 2026-09-30, baseada em `houses.dat`, `houses.rx` e `kam_remake` commit `731a8a4`. É **medição comparativa, não decisão de arte do Piancó**. Não contém nem autoriza importar PNG, som, mapa, texto ou geometria específica do jogo original. Não passe sprites do KaM como referência para geração. Alguns itens são `não achado` ou hipótese no levantamento; preserve esses rótulos.

Leia somente a linha do id planejado. `q` é número de quadros medidos; `região` agrega os quadros e é fração do sprite de origem, podendo ultrapassar 0–1. `pé` é o apoio da pilha. Essas regiões **não são âncoras aprovadas para o Piancó**; redimensione e escolha posições a partir da nova composição, footprint e render reais. `Descanso` é medida do KaM e não define tempo da simulação do Piancó.

Cada estágio 1–5 da pilha do KaM é um sprite completo próprio, não uma repetição do ícone de uma unidade. O trabalhador dentro da casa é invisível para o render de unidade; `haIdle` é animação da casa. O conteúdo visual de `haIdle` não foi confirmado por inspeção de pixels: não afirme que há pessoa na janela. Fumaça, mastro e bandeira são camadas distintas. O `marketplace` não consta do `houses.dat` original.

## Tabela medida

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

## Decisão pendente no Piancó

Para cada id, antes de criar o master, registre no plano: animação de trabalho da **casa** (ou atividade fora), animação de ocioso, visibilidade da unidade, fumaça, mastro/bandeira, mercadorias de entrada/saída, modo da pilha (`unidade repetida` atual ou `estágios completos 1–5` proposto), posições locais, estados vazios e suporte no render. Marque cada campo como `decidido`, `hipótese`, `medido no KaM` ou `pendente`; nunca converta os números da tabela diretamente em requisitos de produção. Para `schoolhouse`, a medição KaM de animação diverge da decisão atual do operador de não animar trabalhador; preserve a decisão atual até nova instrução. Para `storehouse`, a medição KaM sem pilha diverge do render Piancó, que mostra quatro mercadorias. Não deduza comportamento do `marketplace` a partir de dados ausentes.
