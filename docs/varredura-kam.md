# VARREDURA-KAM — GDD contra o código do KaM Remake

Frente 1 (GDD × fonte), feita em 2026-09-28. Só números e referências de
linha entram aqui: nenhum dado, arte ou arquivo do KaM está no repositório. Os
clones ficaram fora dele.

Fontes:

- `kr` = reyandme/kam_remake, commit 731a8a4 (linha principal). Os caminhos
  `kr/src/...` abaixo são relativos a esse clone.
- `kk` = Kromster80/kam_remake, commit b199128 (mais antigo).
- `houses.dat` e `unit.dat` do jogo de 1998, lidos com script próprio pelo
  layout de `TKMUnitSpecLegacy` em `KM_ResUnits.pas`. Só os números lidos entram aqui.

Classes: **correção** (o GDD diz que é igual ao KaM e não é) · **divergência
deliberada** (o KaM faz diferente e nós escolhemos outra coisa) · **confirmado**
· **sem correspondente** · **HIPÓTESE** (não verificado).

**Estado das hipóteses (decisão do operador, 2026-09-28):** as linhas marcadas
**HIPÓTESE — ABERTA** ficam abertas de propósito. São de seções de baixo risco e
não travam nada. Não são fato: quem citar uma delas confere antes.

**Estado das correções:** as três foram aplicadas no GDD em 2026-09-28 (ver
"Correções" no fim). O que elas mudam em número de balanceamento está em
`BALANCE_LOG.md`.

---

## Seção 11.4 — Combate (prioridade 1)

| GDD | Afirmação | Classe | KaM | Nota |
|---|---|---|---|---|
| GDD.md:822-824 | `ChanceToHit = (Attack × Direction) / Defence` [fonte] | confirmado | kr/src/units/actions/KM_UnitActionFight.pas:291-300 | `damage := Attack * (dirMod+1) div Defence; isHit := damage >= KaMRandom(101)`. Bate estruturalmente: Attack×modificador/Defence comparado a um sorteio 0–100. |
| GDD.md:828 | "HP não é vida, é número de golpes até morrer" [fonte, implícito] | confirmado | kr/src/units/KM_Units.pas:2604 (`Dec(fCondition)`... ) e KM_UnitActionFight.pas:302 `fOpponent.HitPointsDecrease(1, fUnit)` | Cada acerto tira sempre 1 ponto, não o valor de `damage`. |
| GDD.md:829 | "Attack não é dano, é chance de acerto" [fonte] | confirmado | KM_UnitActionFight.pas:300 | Idem acima. |
| GDD.md:838-841 | Fórmula própria: `attackEfetivo`, `chanceAcerto = clamp(...,0.08,0.92)`, `multiplicadorDirecao = frente 1.0 · flanco 1.35 · costas 1.75` [proposta, "Nossa fórmula"] | **divergência deliberada** | KM_UnitActionFight.pas:296 + KM_Points.pas:874 (`GetDirModifier`) | O KaM real usa `GetDirModifier` com 5 níveis discretos (diferença de direção 0–4, multiplicador **1×** a **5×**, não 3 níveis 1,0/1,35/1,75). Também **não há clamp** no KaM: `damage` pode passar de 100 (acerto garantido) ou ficar bem abaixo de 8% — o clamp 0,08–0,92 é escolha nossa, registrada como tal. |
| GDD.md:843-845 | "HP dobrado e cadência de ataque dobrada" [proposta explícita] | divergência deliberada (já marcada como nossa) | — | Não há o que verificar; o texto já não afirma que é do KaM. |
| GDD.md:846-847 | "espadachim já acerta 55% contra um miliciano que acerta 11,7%" | confirmado | unit.dat (idx 16 Att=55, Def vs idx 14 Def=1 → 55/1=55%; idx14 Att=35 vs idx16 Def=3 → 35/3=11,67%) | Aritmética bate exatamente com os números crus do `unit.dat`, reforçando que a fórmula-base (sem nosso clamp/HPx2) é a do jogo de 1998, não só do Remake. |
| GDD.md:850-851 | "coluna vs Cavalo é Attack alternativo, não bônus percentual" [fonte/nota] | confirmado | KM_UnitActionFight.pas:291-294 (`damage := Attack; if alvo montado then damage := damage + AttackHorse`) | Note: é `Attack + AttackHorse`, não *substituição* pura — ver nota abaixo. |

**Nota fina não coberta antes**: o código faz `damage := Attack; ... damage := damage + AttackHorse` — ou seja, é **Attack BASE + AttackHorse**, não "AttackHorse substitui Attack" como a fórmula do GDD (`attackEfetivo = ... ? attackVsCavalo : attack`, ou seja, substituição). Isso é uma **divergência real não documentada como tal**: no KaM real, o Attack normal soma com o extra contra cavalaria (ex.: Pikeman contra montado = 35 + 80 = 115, não 80). O GDD trata "vs Cavalo" como valor alternativo que substitui o normal (linha 850: "não um bônus percentual" já reconhece que não é bônus, mas o texto da fórmula em `attackEfetivo` ainda modela substituição, não soma). **Classificação: correção** (ver lista de correções).

### Storm attack (§2.4)

| GDD | Afirmação | Classe | KaM | Nota |
|---|---|---|---|---|
| GDD.md:160 | "Acelera temporariamente; carrega em linha reta e fica incontrolável até bater em algo" [fonte] | confirmado, com lacuna | kr/src/units/actions/KM_UnitActionStormAttack.pas:37-42, 156-168 | Confirmado: `CanBeInterrupted` retorna quase sempre `False` (incontrolável) e anda até (1) esgotar `fStamina` (12–13 tiles, `MIN/MAX_STAMINA`), (2) achar inimigo, ou (3) bloqueio. O GDD só cita o bloqueio como fim; a exaustão de fôlego (12–13 tiles) também termina o storm mesmo sem obstáculo — omissão, não erro. |

### Arqueiros só atiram na direção que estão virados (§2.4)

| GDD | Afirmação | Classe | KaM | Nota |
|---|---|---|---|---|
| GDD.md:164 | "Arqueiros só atiram na direção em que estão virados" [fonte] | confirmado (nível geral) | KM_UnitActionFight.pas:216-217, 338-339 | Unidade vira para o alvo ao entrar em combate (`fUnit.Direction := KMGetDirection(...)`) e mantém `FaceDir` de formação quando ociosa. Não achei um bloqueio explícito de "não pode atirar se o alvo está fora do cone", mas a mecânica de direção condicionando o tiro existe. |

---

## Seção 12.1 e 12.2 — Anexo A: unidades militares (prioridade 1/2)

| GDD | Afirmação | Classe | KaM | Nota |
|---|---|---|---|---|
| GDD.md:875-885 | Requisitos de Barracks por unidade (tabela completa) [fonte] | **confirmado, exato** | kr/src/res/KM_ResUnits.pas:168-178 (`TROOP_COST`) | Toda linha bate: Militia=Axe; Axefighter=WoodenShield+LeatherArmor+Axe; Swordfighter=IronShield+IronArmor+Sword; Bowman=LeatherArmor+Bow; Crossbowman=IronArmor+Crossbow; LanceCarrier=LeatherArmor+Lance; Pikeman=IronArmor+Pike; Scout=WoodenShield+LeatherArmor+Axe+Horse; Knight=IronShield+IronArmor+Sword+Horse. |
| GDD.md:887-888 | Town hall, custo em ouro dos mercenários: "Rebel 2, Rogue 3, Vagabond 5, Barbarian 7, Warrior 8" [fonte] | **correção** | kr/src/res/KM_ResUnits.pas:215-217 (`TH_DEFAULT_TROOP_COST = (2,3,5,8,8)` p/ rebel/rogue/vagabond/barbarian/warrior) | Barbarian custa **8**, não 7. Rebel 2, Rogue 3, Vagabond 5 e Warrior 8 batem. |
| GDD.md:895-910 | Tabela completa HP/Attack/vsCavalo/Defence/Velocidade/Visão, 14 unidades | **confirmado, linha a linha** | `unit.dat` bruto (idx 14–27) + patches de `PatchUnitSpec` em kr/src/res/KM_ResUnits.pas:565-598 | Ver detalhamento abaixo — todas as 14 linhas conferem com o valor **efetivo no Remake** (dado bruto + patch), não sempre com o dado bruto de 1998. |

**Detalhamento unidade a unidade** (idx do `unit.dat`, valor bruto → valor final após patch do Remake, comparado à linha do GDD):

- Militia (14): HP3 Att35 AttH0 Def1 Vel24→0,1 Vis9 — bate sem patch.
- Axe fighter (15): HP3 Att35 AttH0 Def2 Vel24→0,1 Vis9 — bate sem patch.
- Sword fighter (16): HP3 Att55 AttH0 Def3 Vel24→0,1 Vis9 — bate sem patch.
- Bowman (17): HP1 Att60 AttH0 Def2 Vel24→0,1 Vis9 — bate sem patch.
- Crossbowman (18): HP1 Att120 AttH0 Def3 Vel24→0,1 Vis9 — bate sem patch.
- Lance carrier (19): AttHorse **bruto 55** → patch `PatchUnitSpec` linha 587 detecta o sentinela 55 e regrava para **60**. GDD diz 60 → confirmado contra o valor **do Remake**, não do jogo de 1998 (que era 55). HIPÓTESE não necessária: o patch está no código, é fato.
- Pikeman (20): HP3 Att35 AttH**80** Def3 Vel24→0,1 Vis9 — bate sem patch.
- Scout (21): Att35 Def2 Vis**18** (bruto, não bate no sentinela `DEF_SCOUT_SIGHT=9`, então não é patched — fica 18) — bate. Velocidade bruta 39 → patch regrava para 40 (sentinela `DEF_MOUNTED_SPEED=39` bate) → 40/240=0,1666 — bate.
- Knight (22): HP4 Att55 Def3, Vel bruta 39 → patch para 40 → 0,1666 — bate. Sight9 sem patch — bate.
- Barbarian (23): HP4 Att75 Def2 Vel24→0,1 Vis9 — bate sem patch.
- Rebel (24): AttHorse bruto **60** → bate no sentinela `DEF_REBEL_ATTACK_HORSE=60` → patch regrava para **50**. GDD diz 50 → confirmado contra o Remake (bruto de 1998 era 60).
- Rogue (25): HP1 Att60 Def1 Vel24→0,1 Vis9 — bate sem patch.
- Warrior (26): HP4 Att75 Def2 Vel24→0,1 Vis9 — bate sem patch.
- Vagabond (27): Attack bruto **40** → bate no sentinela `DEF_VAGABOND_ATTACK=40` → patch regrava para **35**. GDD diz 35 → confirmado contra o Remake. Velocidade bruta 39→ patch para 40 → 0,1666 — bate.

Conclusão: **as 14 linhas do Anexo A batem com o comportamento efetivo do KaM Remake**, inclusive nos três casos em que o Remake corrige o dado original de 1998 via `PatchUnitSpec` (Lance carrier, Rebel, Vagabond). Nenhuma correção a fazer aqui.

| GDD | Afirmação | Classe | KaM | Nota |
|---|---|---|---|---|
| GDD.md:912-914 | "Pedra-papel-tesoura: lanceiros/piqueiros bônus vs cavalaria; cavalaria rápida flanqueia arqueiros; arqueiros castigam infantaria lenta" [fonte/geral] | confirmado em parte | AttackHorse>0 só em LanceCarrier/Pikeman/Rebel (unit.dat); Scout/Knight/Vagabond com velocidade 0,1666 vs 0,1 do resto | O "infantaria lenta" não tem apoio direto: toda a infantaria a pé (inclusive arqueiros) compartilha a mesma velocidade 0,1 no dado — não há um tipo de infantaria mecanicamente "mais lento" que o arqueiro. A vantagem de cavalaria é velocidade + o multiplicador de ataque pelas costas (`GetDirModifier`), não uma penalidade de velocidade do alvo. |

---

## Seção 2.3 e 6.1 — Comandos de prédio / autonomia (treino, prioridade 2)

| GDD | Afirmação | Classe | KaM | Nota |
|---|---|---|---|---|
| GDD.md:148 | "Schoolhouse: fila de 5 slots, 1 ouro cada [fonte] (5 no wiki, 6 no guia da Steam; adotamos 5 [proposta])" | confirmado (resolve a ambiguidade a favor do wiki) | kr/src/houses/KM_HouseSchool.pas:17 (`fQueue: array[0..5]`, 6 posições) e kr/src/gui/pages_game/KM_GUIGameHouse.pas:104 (`Button_School_UnitPlan: array[1..5]`) | O array interno tem 6 posições, mas a posição 0 é "em treino agora" e a UI mostra exatamente **5** botões de fila além do "em treino". Isso bate com "5" do wiki (fila visível) — o "6" do guia da Steam provavelmente conta o slot em treino junto. |
| GDD.md:52, 315 | "1 ouro por unidade" / "1 gold → 1 civil" [fonte] | confirmado | kr/src/houses/KM_HouseSchool.pas:255,275 (`CheckWareIn(wtGold)`, `WareTakeFromIn(wtGold)`) | Consome exatamente 1 unidade de `wtGold` por treino. |
| GDD.md:150 | "Oficinas: quantas de cada arma produzir" [geral] | **confirmado** | kr/src/houses/KM_Houses.pas:136,175,183,315,1555-1560 (`fWareOrder`, `WareOrder`, `MAX_WARES_ORDER`) | Existe exatamente esse mecanismo — o jogador define a ordem de produção por tipo de saída. |
| GDD.md:153 | "Qualquer prédio: demolir, pausar, ligar/desligar reparo" [geral] | **confirmado** | kr/src/houses/KM_Houses.pas:223 (`Demolish`), 164/1381 (`IsClosedForWorker`, "pausar"), 112/182/1366 (`BuildingRepair`) | As três ações existem tal como descritas. |
| GDD.md:151 | "Barracks: tipo de soldado a treinar" [fonte] | confirmado (estrutural) | kr/src/houses/KM_HouseBarracks.pas:43,53 (`CanEquip`, `Equip`) | Equipa por tipo de unidade a partir dos itens estocados. |
| GDD.md:152 | "Storehouse: bloquear ou liberar cada item" [fonte] | **HIPÓTESE — ABERTA** (não conferido) | — | Não abri `KM_HouseStore.pas`; plausível mas não verificado. |
| GDD.md:154 | "Unidade civil: Dismiss, volta à escola e some, sem reembolso" [fonte] | confirmado (estrutural) | kr/src/units/KM_Units.pas: menções a `DoDismiss`, `fDismissASAP`, `TKMTaskDismiss` (linhas 2584-2596) | O mecanismo de dismiss existe; não conferi a ausência literal de reembolso, mas nenhuma devolução de recurso aparece no trecho lido. |
| GDD.md:162 | "Halt, Split, Link | Parar, dividir, unir" [geral] | **confirmado** | kr/src/units/KM_UnitGroup.pas:169-175 (`OrderHalt`, `OrderSplit`, `OrderLinkTo`) | As três operações existem com esses nomes quase literais. |
| GDD.md:918-... (não aplicável aqui) | — | — | — | — |

---

## Seção 4.3 e 11.3 — Comida, fome e condição (prioridade 3)

| GDD | Afirmação | Classe | KaM | Nota |
|---|---|---|---|---|
| GDD.md:218 | "Inn: 8 comensais simultâneos" [fonte] | **correção** | kr/src/houses/KM_HouseInn.pas:11 (`INN_MAX_EATERS = 6`) | O valor real é **6**, comentário no próprio código diz "only 6 units are allowed in the inn". |
| GDD.md:218 | "5 unidades de cada comida estocadas" [fonte] | confirmado | kr/src/common/KM_Defaults.pas:299 (`MAX_WARES_IN_HOUSE = 5`) | Constante genérica de todas as casas, bate. |
| GDD.md:219-220 | "Restauração: Wine 30%, Loaves 40%, Fish 50%, Sausages 60%" [fonte] | **confirmado, exato** | kr/src/common/KM_Defaults.pas:383-386 (`BREAD_RESTORE=0.4; SAUSAGE_RESTORE=0.6; WINE_RESTORE=0.3; FISH_RESTORE=0.5`) | Bate número a número. |
| GDD.md:221-222 | "Civil precisa de 2 comidas diferentes para 100%; militar enche com 1 item qualquer" [fonte] | confirmado | kr/src/units/tasks/KM_UnitTaskGoEat.pas:101 (`MAX_FEED_CNT = 2`) para civil; kr/src/units/tasks/KM_UnitTaskDelivery.pas:517 (`fToUnit.Feed(UNIT_MAX_CONDITION)`) para militar via Feed | Civil come no máximo 2 tipos por visita; guerreiro alimentado pelo comando Feed recebe condição máxima de uma vez com "1 item qualquer". |
| GDD.md:223 | "Militares não vão ao Inn; serfs levam comida no comando Feed" [fonte] | confirmado (estrutural) | kr/src/units/tasks/KM_UnitTaskDelivery.pas:517 | O caminho de alimentação de guerreiro passa por uma entrega de serf, não por ida ao Inn. |
| GDD.md:813-818 (tabela) | "Condição cheia, civil 40 min (base) / militar 60 min (base)" (sem tag explícita, mas dado de balanceamento nosso) | **divergência deliberada** (não é fonte — é decisão de escala) | kr/src/common/KM_Defaults.pas:371 (`UNIT_MAX_CONDITION = 45*60 // Minutes of life. In KaM it's 45min`) | No KaM Remake **existe uma única constante de condição máxima (45 min) para TODOS os tipos**, civis e guerreiros — não há distinção civil/militar na duração máxima. A distinção real do KaM é o **limiar de quando cada tipo procura comida**: civil usa `IsHungry` (`fCondition < UNIT_MIN_CONDITION`, `UNIT_MIN_CONDITION = 6*60`, ou seja ~13,3% de 45min) e guerreiro pede comida abaixo de `TROOPS_FEED_MAX = 0.55` (55% de 45min). O GDD converteu isso em duas *durações máximas* diferentes (40 e 60 min), o que é uma modelagem distinta da do KaM (que varia o limiar de fome, não o teto). Vale registrar como decisão de design, não como fato do KaM. |
| GDD.md:818 | "Alerta visual a 35%, o civil sai para comer a 50%, morre a 0%" (data/condition.json, citado na seção 10) | **divergência deliberada** | kr/src/units/KM_Units.pas:2050-2052 (`IsHungry: fCondition < UNIT_MIN_CONDITION`, = 6/45 ≈ 13,3%) | O civil do KaM só sai proativamente para comer a ~13,3% de condição, não a 50%. Nosso `civilVaiComer: 0.50` faz o civil comer bem mais cedo/com mais frequência — decisão de ritmo de jogo, não fidelidade. |
| GDD.md:806-809 | "uma nota de versão do Remake descreve o ajuste em 'cerca de 12 minutos a menos de condição'" / "tropas ficam com fome por volta de 1h21" [fonte] | **HIPÓTESE — ABERTA** (fonte externa, não verificável nos clones) | — | Vem do site knightsandmerchants.net (version-history / fórum), fora do escopo dos clones de código que tenho aqui. Não contradiz nem confirma o que achei no código; é consistente em ordem de grandeza com `UNIT_MAX_CONDITION=45min` mais o tempo de ida-e-volta ao Inn. |

---

## Seção 4.2, 4.4, 4.5, 5.1, 5.2 — Economia (prioridade 4/5)

| GDD | Afirmação | Classe | KaM | Nota |
|---|---|---|---|---|
| GDD.md:304-306 | "HP total = (timber+stone)×50, marteladas = HP÷5. Verificado contra os 28 prédios do Remake" [fonte] | **confirmado** (e agora também contra o jogo de 1998) | dat.txt (todas as 27 casas do `houses.dat` original) | Every casa bate: Storehouse (6+5)×50=550, Schoolhouse 550, Inn 550, Quarry (3+2)×50=250, Woodcutter's 250, Watchtower 250, Sawmill (4+3)×50=350, Farm 350, Wineyard 350, Fisherman's 350, minas 250, Weapons workshop 350, Barracks (6+6)×50=600, Mill 350, Bakery 350, Swine 350, Stables 550, Butcher's 350, Tannery 350, Armory workshop 350, Metallurgist's 350, Iron smithy 350, Weapon smithy 350, Armor smithy 350. Confirmado com dado bruto de 1998, não só do Remake. |
| GDD.md:312-341 | Tabela completa Timber/Stone por prédio | **confirmado, linha a linha, contra houses.dat de 1998** | dat.txt: `Store`(6/5) `School`(6/5) `Inn`(6/5) `Quarry`(3/2) `Woodcutters`(3/2) `WatchTower`(3/2) `Sawmill`(4/3) `Farm`(4/3) `Vineyard`(4/3) `Fishermans`(4/3) `GoldMine`(3/2) `CoalMine`(3/2) `IronMine`(3/2) `WeaponWorkshop`(4/3) `Barracks`(6/6) `Mill`(4/3) `Bakery`(4/3) `Swine`(4/3) `Stables`(6/5) `Butchers`(4/3) `Tannery`(4/3) `ArmorWorkshop`(4/3) `Metallurgists`(4/3) `IronSmithy`(4/3) `WeaponSmithy`(4/3) `ArmorSmithy`(4/3) | Todas as 26 linhas comparáveis batem exatamente. Marketplace não existe no `houses.dat` de 1998 (esperado — o próprio GDD já registra "só existe no Remake"). |
| GDD.md:206, 320 | "Sawmill: 1 tronco → 2 timber" [fonte] | confirmado | dat.txt `Sawmill ResProductionX=2` | `ResProductionX` é o multiplicador de saída por ciclo; bate com "2". |
| GDD.md:208, 331 | "Mill → Bakery (2 pães por farinha)" [fonte] | confirmado | dat.txt `Bakery ResProductionX=2` | Bate. |
| GDD.md:209, 334 | "Swine farm → Butcher's (3 por porco)" [fonte] | confirmado | dat.txt `Butchers ResProductionX=3` | Bate. |
| GDD.md:335 | "skin → 2 leather" (Tannery) [tabela 5.2] | confirmado | dat.txt `Tannery ResProductionX=2` | Bate. |
| GDD.md:337 | "gold ore + coal → 2 gold" (Metallurgist's) [tabela 5.2] | confirmado | dat.txt `Metallurgists ResProductionX=2` | Bate. |
| GDD.md:339 | "iron ore + coal → iron" (Iron smithy, sem múltiplo declarado) | confirmado (ResProductionX=1) | dat.txt `IronSmithy ResProductionX=1` | Consistente com não haver multiplicador citado no GDD. |
| GDD.md:230 | "guia do original sugere manter só Timber, Stone, Bread, Sausage, Wine, Fish e Gold" [bloqueio de armazém, fonte] | **HIPÓTESE — ABERTA** | — | Fonte é um guia externo (Steam), não teria como conferir em código — é configuração de jogador, não regra fixa do motor. |
| GDD.md:232 | "Marketplace: taxa fixa, máximo de 10 serfs negociando" [fonte, só Remake] | parcialmente confirmado | kr/src/houses/KM_HouseMarket.pas:149,165 (`MARKET_TRADEOFF_FACTOR`) | A taxa fixa existe (constante de tradeoff). Não achei o limite de "10 serfs" nesta sessão — **HIPÓTESE — ABERTA** quanto a esse número específico. |
| GDD.md:236-242 | Proporções de referência (2 Woodcutter's:1 Sawmill; 1,63 Farm:1 Swine; etc.) [fonte] | **HIPÓTESE — ABERTA** | — | Essas vêm de medição comunitária (fórum/wiki "Building ratios"), fora do que os clones de código expõem diretamente sem simular a produção; não recalculei a partir de `WorkerWork`/`ResProductionX` porque o modelo de ciclo (frames de animação + descanso) exigiria reconstrução do laço de produção inteiro — não fiz isso nesta sessão. |
| GDD.md:791-797 | "granja de porcos ~0,5 porco/min, precisa de 1,63 fazenda"; "valor da serraria é em tábuas, não troncos" [fonte] | **HIPÓTESE — ABERTA** | — | Mesma limitação acima: números de medição comunitária externa, não reconstruí o cálculo a partir do dat. |
| GDD.md:392-... | Town Hall existe só na versão Steam/TPR e no Remake | confirmado (indireto) | dat.txt: primeira leitura de `houses.dat` (base) tem `TownHall madeira=6 pedra=5`; a segunda leitura (`hd/`) tem `TownHall madeira=0 pedra=0 animWork=[0,0,0,0,0]` (zerado/placeholder) | Duas versões do dat do jogo instalado divergem entre si na Town Hall — consistente com o GDD dizer que ela não é universal a todas as versões do original. Registrado, não resolvido (não sei qual delas é "TSK puro" vs "TPR"). |

---

## Itens de menor prioridade — classificação rápida (sem verificação profunda)

| GDD | Afirmação | Classe | Nota |
|---|---|---|---|
| GDD.md:92 | Selecionar prédio/unidade/grupo por clique esquerdo [geral] | **HIPÓTESE — ABERTA** | Não achei o handler exato de seleção nesta sessão; comportamento básico de RTS, mas não confirmei linha de código. |
| GDD.md:96-99 | Botão direito: mover grupo, formação, virar, atacar [fonte] | **HIPÓTESE — ABERTA** | Não verificado nesta sessão (não é área de combate/produção; ficou fora do orçamento). |
| GDD.md:406 | "Estradas diagonais funcionam se nada bloquear" [fonte] | **HIPÓTESE — ABERTA** | Não verificado. |
| GDD.md:481-487 | Prioridade JobBoard: comida→Inn é a maior prioridade do Remake, ouro→escola é a segunda [fonte] | **HIPÓTESE — ABERTA** | Não achei o planejador de prioridade de entrega explícito nesta sessão (procurei por "Delivery" e só achei a task, não o planner); a alegação é plausível e citada em fonte externa (comparação com o original), mas não confirmada em código. |
| GDD.md:486-487 | "erro conhecido do próprio Remake: escolher alvo por distância euclidiana atravessando montanha" [fonte] | **HIPÓTESE — ABERTA** | Não verificado. |
| GDD.md:665 | "diferença de altura ≥25 impede andar/construir estrada, 18 impede casas" [fonte] | **HIPÓTESE — ABERTA** | Fora de escopo desta sessão (elevação; o próprio GDD já marca como fora do escopo do jogo atual). |
| GDD.md:900-... | Visão 9/18 civis e militares (§6.5) | confirmado (Scout=18 via unit.dat; resto=9) | Já coberto na tabela militar acima. |

---

## Correções (aplicadas no GDD em 2026-09-28)

1. **Vs Cavalo é soma, não substituição** (GDD.md:838, "attackEfetivo = ... ? attackVsCavalo : attack"): o KaM real faz `damage := Attack; damage := damage + AttackHorse` quando o alvo é montado — é Attack normal **mais** o adicional, não uma troca de valor. Fonte: `kr/src/units/actions/KM_UnitActionFight.pas:291-294`.
2. **Custo do Barbarian mercenário está errado** (GDD.md:888, "Barbarian 7"): o valor real é **8**. Fonte: `kr/src/res/KM_ResUnits.pas:215-217` (`TH_DEFAULT_TROOP_COST`).
3. **Capacidade do Inn está errada** (GDD.md:218, "8 comensais simultâneos"): o valor real é **6** (`INN_MAX_EATERS`). Fonte: `kr/src/houses/KM_HouseInn.pas:11`.

## Divergências deliberadas de destaque (não são erro, mas vale registrar o que o KaM faz)

- **Multiplicador de direção do combate**: nós usamos 3 níveis contínuos (1,0/1,35/1,75); o KaM usa 5 níveis discretos (1× a 5×) via `GetDirModifier` (`kr/src/common/KM_Points.pas:874`).
- **Clamp de chance de acerto (8%–92%)**: o KaM não tem clamp algum — a chance pode chegar a 0% ou passar de 100%.
- **Duração de condição civil×militar (40/60 min)**: o KaM usa uma única duração máxima (45 min) para todos, variando apenas o **limiar de quando procuram comida** (civil ~13,3%, militar 55%). Fonte: `kr/src/common/KM_Defaults.pas:369-373`.
- **Limiar de "civil sai para comer" (50% no nosso `condition.json`)**: no KaM real é ~13,3% (`UNIT_MIN_CONDITION`). **Medido em 2026-09-28:** mexe pouco (−18% de refeições, produção da vila da calibração igual, LOTE3 igual byte a byte), porque o KaM também come até 90% e a frequência vem do dreno, não do limiar. Tabela em `BALANCE_LOG.md`.

## Lacunas vistas de passagem (não é o foco desta frente; a frente 4, só combate, cobre o que falta)

- **`KM_UnitTaskAttackHouse.pas`**: unidades podem atacar prédios diretamente (assédio corpo a corpo ou à distância), dano ao HP do prédio até destruí-lo. Não mencionado no GDD.
- **Alcance mínimo e máximo de projéteis**: `AimTargetUnit`/`AimTargetHouse` recebem `aMaxRange` e `aMinRange` (`kr/src/KM_Projectiles.pas:40-41`) — arqueiros têm um alcance mínimo, não só máximo. O GDD só fala em "atiram na direção que estão virados", sem mencionar range.
- **Watchtower tem alcance fixo medido do jogo original**: `WATCHTOWER_RANGE_MAX = 6.99` tiles, `WATCHTOWER_RANGE_MIN = 0` (`kr/src/common/KM_Defaults.pas:392-393`). O GDD só menciona munição ("até 5 stone"), não alcance.
- **Sem sistema de moral/fuga**: busquei por "Morale", "Flee", "Rout", "Cowardice" em todo o `kr/src` e não achei nada — o KaM Remake não modela moral de tropa. (Confirma que a ausência no GDD não é lacuna, é fidelidade correta por omissão simétrica.)
- **`TH_TROOP_COST` é mutável em runtime** ("Could be modified by script functions") — os custos de mercenário do Town Hall podem ser alterados por script de missão, não são fixos como a tabela do GDD sugere.
- **`OrderSplitLinkTo` / `OrderSplitUnit`**: operações de grupo mais finas do que "Split" simples (dividir uma unidade específica, dividir e já linkar a outro grupo) — o GDD só cita "Split" genérico.
