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

---

## Frente 4 — combate (começada em 2026-09-28): ataque a prédio

Tudo aqui foi lido no fonte (`kr`, 731a8a4). Nada foi medido em execução, porque
o combate não existe na nossa sim. Os ritmos "a cada ~12 ticks" vêm da leitura
das esperas em `SetActionLockedStay` e são **HIPÓTESE — ABERTA** até alguém
medir (1 tick do KaM = 100 ms).

### O que o KaM faz — verificado no código

| Regra | Fonte |
|---|---|
| Atacar prédio é **ordem do jogador** (ou de script/IA): a tropa nunca começa sozinha. A ordem vale para o grupo inteiro e passa para os grupos ligados. | `game/gip/KM_GameInputProcess.pas:1009` (`gicArmyAttackHouse`); `units/KM_UnitGroup.pas:1320-1340`; `units/KM_UnitWarrior.pas:940-962` |
| Corpo a corpo: **2 de dano por golpe, sem sorteio.** Attack e Defence não entram. | `units/tasks/KM_UnitTaskAttackHouse.pas:191-192` |
| Ritmo do golpe: espera 6 + 6 no ciclo, ~12 ticks por golpe (HIPÓTESE — ABERTA, lida, não medida). | `KM_UnitTaskAttackHouse.pas:167`, `:189` |
| Corpo a corpo encosta no prédio (distância 1). | `KM_UnitTaskAttackHouse.pas:108` |
| À distância: o arqueiro recua se estiver mais perto que o mínimo e avança se estiver além do máximo. Cada flecha, virote ou pedra de funda que cai no prédio tira **1, sem sorteio**. | `KM_UnitTaskAttackHouse.pas:98-106`; `KM_Projectiles.pas:325-330` |
| Alcance do arqueiro, do besteiro e do rogue: **mínimo 4, máximo 10,99 tiles** ("atira a 4, não a 3"; "atira a 10, não a 11"). | `units/KM_UnitWarrior.pas:837-839`, `:855-857` |
| Vida do prédio = **progresso da obra − dano**. Obra inacabada cai mais rápido, e obra inacabada pode ser atacada "de dentro". | `houses/KM_Houses.pas:1175`; `KM_UnitTaskAttackHouse.pas:130`, `:152` |
| Vida zero: o prédio é demolido, creditado ao dono do atacante. O dano também avisa a IA do dono. | `houses/KM_Houses.pas:1296-1330` |
| Fogo na tela: 8 níveis, um a cada 1/8 da vida máxima. | `houses/KM_Houses.pas:1352` |
| Reparo: **5 de vida por martelada** do laborer, ~12 ticks por ciclo (HIPÓTESE — ABERTA, lida). O prédio só entra na lista se o reparo estiver **ligado** nele, e para o jogador humano ele começa **desligado**. | `units/tasks/KM_UnitTaskBuild.pas:995-1001`; `houses/KM_Houses.pas:532`, `:1307-1308`; `game/gip/KM_GameInputProcess.pas:1024` |
| A torre de vigia atira até 6,99 tiles da porta, sem mínimo. A pedra dela **mata na hora**. | `common/KM_Defaults.pas:392-393`; `KM_Projectiles.pas:336` |
| O projétil pode errar a unidade: o sorteio é pela distância entre onde a unidade está e onde a pedra cai. Isso vale para a pedra da torre também. | `KM_Projectiles.pas:305-306` |

### Contra o nosso GDD e os dados

- **Lacuna que muda a fila (sem correspondente no GDD):** a vitória da
  escaramuça é destruir Armazém, Escola e Quartel (`GDD.md:611`, item F34), mas
  nem o GDD nem item nenhum da Fase C diz como tropa derruba prédio.
  - A F28 é "combate e IA inimiga simples"; a F28b é a torre.
  - Sem o ataque a prédio, a F34 não tem mecânica que a satisfaça.
- **Vida do prédio já existe no dado** (`buildings.json` `hp` = (timber+stone)×50,
  `GDD.md:304`, confirmado na frente 1). O que falta é quem a gasta e quem a repõe.
  - Ordem de grandeza, na leitura acima e sem medir: 2 por golpe a cada ~12 ticks.
  - Um soldado derruba um Armazém de 550 em ~275 golpes, ~5,5 min. Dez soldados, ~33 s.
  - Um laborer reparando (5 a cada ~12 ticks) anula ~2,5 soldados.
- **Reparo já está no GDD** ("ligar/desligar reparo", `GDD.md:153`), mas não tem
  item na fila. No KaM ele é o contrapeso do ataque a prédio, e começa desligado.
- **Arqueiro:** o nosso `combat.json` `aDistancia.alcance_tiles` é 8, sem mínimo.
  O KaM tem mínimo 4 e máximo 10,99. **Divergência não declarada:** o mínimo
  muda a tática (arqueiro encostado não atira) e hoje não está em lugar nenhum.
- **Torre:** `combat.json` `watchtower.alcance_tiles` 6 bate com o "menos de 7" do
  KaM; `mataEmUmGolpe` bate. **Mas** o aceite da F28b ("pedras gastas = mortos")
  supõe que a pedra nunca erra, e a do KaM pode errar se o alvo andou.
  Simplificar é legítimo; hoje isso não está escrito como decisão.

### Frente 4, continuação — carga, formação, engajamento e IA inimiga (2026-09-28)

Leitura ampla feita por subagente (§11). As linhas marcadas com ✔ eu reabri e
conferi no fonte; as outras são do relatório dele e valem como citação dele. O
que ele não achou no código está marcado **HIPÓTESE — ABERTA**.

**Carga (storm attack)** — nosso: `combat.json` `stormAttack` (1,5×, 8 s, incontrolável); `GDD.md:160`.

| Achado | Classe | Fonte KaM |
|---|---|---|
| Velocidade 1,5× ✔ (arredondada em passos por tile, então não é exata) | confirmado | `res/KM_ResUnits.pas:212`, `:604-605` |
| **A carga dura em TILES, não em segundos:** 12 a 13 tiles, sorteado ✔. O comentário diz que no TPR era 8 a 13. Os nossos "8 segundos" não têm base no código; provavelmente vêm dos "8 tiles" do mínimo antigo (HIPÓTESE). | **correção** | `units/actions/KM_UnitActionStormAttack.pas:41-49` |
| Cada fileira sai 5 ticks depois da anterior ✔ | lacuna | `KM_UnitActionStormAttack.pas:48` |
| Não se interrompe. Halt fica na fila e Split é bloqueado. Termina quando a stamina acaba, quando acha inimigo a até 1,42 tile ou quando o tile seguinte está bloqueado. | confirmado ("incontrolável até bater") | `KM_UnitActionStormAttack.pas:159-175`, `:217-220` |
| **Só infantaria corpo a corpo** (milícia, machado, espada, bárbaro, guerreiro). Montado e anti-cavalo não carregam. Sem cooldown. | lacuna (o GDD não diz quem carrega) | `common/KM_Defaults.pas:685-696`; `gui/pages_game/KM_GUIGameUnit.pas:532` |
| A carga só mexe no movimento. O dano não muda. | confirmado | `units/actions/KM_UnitActionFight.pas:291-302` |

**Formação** — nosso: `combat.json` `formacao` (recomendado 9–15, colunas 1–10).

| Achado | Classe | Fonte KaM |
|---|---|---|
| Unidades por fileira: mínimo 1, **máximo = tamanho do grupo** ✔. Não há teto de 10. | **correção** (`colunasMax` 10 é nosso, não do KaM) | `units/KM_UnitGroup.pas:661-666` |
| "Grupo recomendado 9": o único 9 no código é o padrão da IA, 9 homens, 3 por fileira ✔. **O 15 não aparece no código** (HIPÓTESE — ABERTA; deve vir de guia externo). | confirmado em parte | `ai/KM_AIDefensePos.pas:223-224` |
| O jogador muda ±1 fileira por clique (±5 com o botão direito). Recruta que se junta ao grupo reorganiza para √n por fileira, se o jogador não mexeu. | lacuna | `KM_UnitGroup.pas:2471-2472`; `gui/KM_InterfaceTypes.pas:49` |
| Halt, Link, Feed e Split existem. Split divide ao meio; em grupo misto, separa por tipo. SplitSingle solta um. | confirmado (o `[geral]` da linha 162 vira fonte) | `KM_UnitGroup.pas:1494-1559`, `:1722-1784` |
| Tamanho máximo de grupo: nenhum encontrado (HIPÓTESE — ABERTA de que não exista). | sem correspondente | — |

**Arco do arqueiro** — nosso: `combat.json` `aDistancia.arcoDeTiro_graus` 45.

| Achado | Classe | Fonte KaM |
|---|---|---|
| O arqueiro parado só procura alvo na direção em que está virado ✔ | confirmado (`GDD.md:164`) | `units/KM_UnitWarrior.pas:667`, `:705-706` |
| **O setor é de 90° (±45°)** ✔, não 45° no total. Se o nosso 45 é o meio-ângulo, bate; se é o total, está pela metade. O dado não diz qual. | **correção provável**, ambígua | `terrain/KM_Terrain.pas:2021-2033` |
| Com ordem explícita de ataque, o grupo gira para o alvo. | lacuna | `KM_UnitGroup.pas:1061-1062` |

**Engajamento automático**

| Achado | Classe | Fonte KaM |
|---|---|---|
| Sem ordem, o guerreiro procura inimigo a cada 6 ticks. Corpo a corpo, a 1 tile; arqueiro, de 4 a 10,99, no setor, e só parado. O alvo precisa estar em tile revelado. | confirmado ("corpo a corpo carrega ao contato", `GDD.md:99`) | `KM_UnitWarrior.pas:1110-1112`, `:413-426`; `KM_Terrain.pas:2049` |
| **Prédio, nunca sem ordem** | confirmado; já é regra da F-CERCO-a | `game/gip/KM_GameInputProcess.pas:1009` |
| Quem é atacado responde. O grupo guarda os agressores e, a cada 5 ticks, o corpo a corpo ocioso vai até eles e o arqueiro atira neles. | lacuna | `KM_UnitGroup.pas:840-848`, `:925-987` |

**IA inimiga** — nosso: F28 "IA inimiga simples", sem corpo.

- **Laço clássico** (`ai/KM_AIGeneral.pas:777-810`): posições de defesa → exército → ataques → contagem.
  - **Posição de defesa:** ponto, tipo de grupo, raio e linha de frente ou de trás; só a de trás ataca (`ai/KM_AITypes.pas:8-11`). O grupo ocioso volta ao ponto.
  - **Treino:** repõe até 9 por posição.
  - **Ataque:** é roteirizado na missão (atraso, homens mínimos, grupos por tipo); `AutoAttack` repete contra o prédio mais perto do ponto de partida.
  - **Alvos possíveis:** unidade mais perto, prédio mais perto do exército, prédio mais perto da base, ponto fixo (`ai/KM_AITypes.pas:21-26`). Na resolução, prédio tem preferência sobre unidade.
- **A IA escolhe alvo ignorando a névoa.** Só a busca de cada soldado respeita o que está revelado (`hands/KM_HandsCollection.pas:523-567`). **Divergência a decidir:** o nosso `GDD.md:516` fala da névoa para o jogador, não para a IA.
- **Proposta de IA mínima para a F28** (do que o KaM faz):
  1. posições de defesa com grupo de 9;
  2. voltar ao ponto quando ocioso;
  3. retaliar contra quem entra no raio;
  4. repor pelo quartel;
  5. alimentar os famintos;
  6. um ataque repetido contra o prédio mais perto quando houver homens suficientes. Este depende da F-CERCO-a.

**Mecânicas do KaM que o GDD não tem (lacunas)**

- **Regeneração: 1 HP a cada 100 ticks (10 s), inclusive em luta** ✔ (`common/KM_Defaults.pas:360`; `units/KM_Units.pas:2306-2314`). Com o nosso `multiplicadorHP` 2, o ritmo de regenerar precisa ser decidido junto.
- **Fogo amigo ligado** ✔ para flecha e torre (`KM_Defaults.pas:397`; `KM_Projectiles.pas:320`, `:334`). **Afeta a F28b:** no KaM a pedra da torre mata também o próprio soldado que estiver no ponto.
- **Escudo dá defesa extra contra projétil**: +1 contra arco e funda, +0,5 contra besta ✔ (`res/KM_ResUnits.pas:258-260`).
- Arqueiro com atraso de mira aleatório e trava contra tiro em rajada (`KM_UnitWarrior.pas:457-468`, `:788-806`).
- **Não existem**, e o GDD também não tem: veterania, recuo e moral (grep sem resultado).
- **Não achado:** efeito da fome no dano.

## Frente 2 — BALANCE_LOG contra o KaM, por classe (2026-09-28)

Feita por subagente (relatório completo no scratchpad da sessão, não versionado). As 48
observações abertas de `BALANCE_LOG.md` caíram em 10 classes. **Conferido por mim no fonte**
está marcado [C]; o resto é leitura do subagente, HIPÓTESE até alguém abrir a linha.

| Classe | Obs. | Veredito |
|---|---|---|
| A. Viagem, fases, lote | 13 | confirmado: o KaM não tem taxa, o fluxo sai de andar + trabalhar no tile + na casa + descanso + lote (`KM_UnitWorkPlan.pas:124-130`). O lenhador traz **1** tronco por viagem: o lote 2 nosso é decisão nossa, não fonte. |
| B. Tempo e crescimento | 5 | tick de 100 ms confirmado (`KM_Defaults.pas:319`). Nossos tempos de crescer (milho/árvore/uva 330/412,5/330 s) são ~metade dos do KaM (640/800/500 s, `KM_ResMapElements.pas:81-101` × `TERRAIN_PACE`) — diferença não registrada em lugar nenhum. |
| C. Rendimento por tile | 10 | pedreira bate (15 por tile, 3 por viagem). Diverge: árvore 4 contra 1; milho 4 por semeadura contra 1 por corte; uva volta sozinha à idade 1 no KaM; minério ≤ 5 extrações por tile no KaM contra 15/12/8. |
| D. Alcance | 6 | o KaM mede em tiles andados: pedreiro 16, pescador 14, lenhador e fazendeiro 10. O nosso é Chebyshev 6/6/6, fazenda 2. |
| E. Movimento e terreno | 4 | o KaM não tem bônus de estrada, custo de areia nem de campo arado; diagonal 1,4 (a nossa ~1,29). |
| F. Construção e logística | 11 | confirmado: 1 pedra por tile de estrada, material só após nivelar. **Ordem ouro/comida invertida [C]** (ver frente 3). Laborers: KaM 6 a 12 por tipo, nosso teto único 4. |
| G. Fome | 2 | confirmado; 50 % e 8 comensais são decisão do operador. |
| H. Combate | 1 | **bárbaro custa 8 no KaM [C]** (`KM_ResUnits.pas:215-217`, `TH_DEFAULT_TROOP_COST`), 7 no nosso `units.json`. Sem leitor ainda. |
| I. Cadeias industriais | 4 | ciclo depende da animação no `.dat`, fora do fonte: HIPÓTESE. |
| J. Fora do balanceamento | 2 | sem contraparte no KaM. |

Nenhum número foi mudado: pela §12 do CLAUDE.md, balanceamento se ajusta em lote. Os
achados que mudam número (classes B, C, D, F-laborers, H) ficam para o lote do operador.

## Frente 3 — PROGRESS contra o KaM: o quarto erro (2026-09-28)

Os três primeiros (projeção, modelo de taxa, fome) já estavam registrados. **O quarto:
o material de obra anda livre, "fonte: o jogo original".** Não é assim no KaM.
- O que o projeto supõe: decisão de 2026-09-23 (PROGRESS, F18d-1a): "entregar material
  numa construção anda livre... é assim que a primeira casa sobe sem rua. Fonte: o jogo
  original." Está em `data/delivery.json` (nível 3 `material-para-obra`, `modo: livre`) e
  no aceite da F18d-1a (`passes: true`).
- O que o KaM faz **[C]**: a obra pede o material como demanda **de casa**
  (`KM_UnitTaskBuild.pas:637-638`, `AddDemand(fHouse, …, diHigh4)`), e entrega casa→casa
  só acontece com estrada ligando as portas (`KM_HandLogistics.pas:1216-1220`, "House-House
  delivery should be performed only if there's connecting road"). Só entrega para unidade
  anda sem estrada (`:1222-1225`).
- O resto da regra bate: o construtor anda livre, pedra da estrada planejada e comida da
  tropa são livres, produção exige estrada.
- Saídas (decisão do operador): (a) corrigir — nível 3 vira `estrada`, cai o aceite da
  F18d-1a, muda `tests/F09-sistema.test.ts` e o GDD §6.3; (b) manter `livre` como
  divergência deliberada e tirar o "fonte: jogo original" do dado, do GDD e do BUILD_PLAN.

**Quinto, de etiqueta [C]:** `delivery.json` marca como `[fonte]` "comida→Inn é a maior
prioridade, ouro→escola a segunda". No KaM (`KM_HandLogistics.pas:30-35`) é o contrário:
ouro→escola (`diHigh1`), comida para soldado (`diHigh2`), comida para Inn (`diHigh3`),
material de obra (`diHigh4`), e só então o resto. Fecha a hipótese aberta da linha de
itens de menor prioridade acima.

**Divergências que precisam ser declaradas como nossas** (leitura do subagente):
- F24a: sem cota, a oficina daqui produz tudo; no KaM, sem ordem não produz nada
  (`KM_Units.pas:716-720`). A sessão da F24a chamou de "conservador"; é o inverso do KaM.
- Encostar prédios: o KaM exige 1 tile de folga nas 8 direções (`KM_Terrain.pas:3785-3806`).
- Replantio: no KaM o toco é o preferido e o tile vazio a segunda opção.


---

## Frente 4b — o que o KaM tem e nós não, fora do combate (2026-09-29)

Plano: `docs/planos/2026-09-29-VARREDURA-KAM-frente-4b.md`. Índice: os prédios do KaM
(`kr/src/res/KM_ResTypes.pas:49-57`) e os comandos do jogador
(`kr/src/game/gip/KM_GameInputProcess.pas:40-100`), um a um contra `data/buildings.json` e
`src/sim/commands.ts`. **Conferido por mim no fonte**, abrindo a linha, salvo onde está
escrito HIPÓTESE.

| # | O KaM | Nós | Classe |
|---|---|---|---|
| 1 | 28 tipos de prédio (`KM_ResTypes.pas:51-56`) | os mesmos 28 em `data/buildings.json`; falta só `htSiegeWorkshop` | **confirmado**. A oficina de cerco é do Remake, não de 1998 (HIPÓTESE sobre o 1998: não conferido no binário) |
| 2 | O peixe só diminui: `ReduceFish` tira 1 e mata o cardume no zero (`kr/src/units/KM_Units.pas:1204-1209`, chamado de `KM_Terrain.pas:3138`); peixe novo só nasce do mapa ou do script (`KM_ScriptingActions.pas:2095`) | `resources.json`, `fish`: regime `nunca` | **confirmado** |
| 3 | Paz bloqueia TODO comando de exército, inclusive andar, e o treino no quartel e na prefeitura (`KM_GameInputProcess.pas:153-155`) | `src/sim/paz.ts`: bloqueia ataque, storm, treino e mercenário; a marcha passa | **divergência deliberada**, já declarada (C-COMBATE-02b, operador 2026-09-29, `paz.ts:16-18`) |
| 4 | Toda casa tem modo de entrega: fechada, entregando, esvaziando (`TKMDeliveryMode`, `kr/src/houses/KM_Houses.pas:14`; comando `gicHouseDeliveryModeNext`) | por prédio só o armazém recusa (`SetStorehouseAccept`); nos outros, só o teto por TIPO do menu de distribuição (`SetWareDistribution`); esvaziar não existe | **lacuna**. Esvaziar (`dmTakeOut`) é HIPÓTESE de ser só do Remake |
| 5 | Fechar a casa para o trabalhador: ele sai e a casa para (`fIsClosedForWorker`, "If worker is already occupied it, then leave house", `KM_Houses.pas:110`) | `SetBuildingPaused` congela o relógio e **não** solta o ocupante (`src/sim/systems/pausa.ts:17-18`, operador 2026-09-23) | **divergência deliberada, não declarada como tal**: o motivo escrito ("vago anunciaria vaga") não vale no KaM, onde a casa fechada não pede trabalhador. O caminho no código que tira o trabalhador é HIPÓTESE (li o comentário do campo, não o laço que o executa) |
| 6 | O quartel recusa mercadoria de guerra por tipo e pode recusar recruta (`NotAcceptFlag`, `NotAcceptRecruitFlag`, `kr/src/houses/KM_HouseBarracks.pas:21-22`; `gicHouseBarracksAcceptFlag`) | nenhum comando de recusa no quartel | **lacuna** |
| 7 | A Casa do Gibão liga e desliga a entrega de couro e madeira (`gicHouseArmorWSDeliveryToggle`, `KM_GameInputProcess.pas:77`) | nenhum | **lacuna**; entra na F24c (a Casa do Gibão por encomenda), que já está proposta |
| 8 | Ponto de corte do lenhador (`gicHouseWoodcuttersCutting`, `:96`) | nenhum; o lenhador escolhe o tile ao alcance | **lacuna** |
| 9 | Prefeitura: ponto de reunião e teto de ouro (`gicHouseTownHallRally`, `gicHouseTownHallMaxGold`, `:93-94`) | nenhum | **lacuna**. HIPÓTESE: a prefeitura é do Remake |
| 10 | Escola: mudar a ordem da fila (`gicHouseSchoolTrainChOrder`, `gicHouseSchoolTrainChLastUOrder`, `:83-84`) | fila com enfileirar e cancelar (`EnqueueTraining`, `CancelTraining`) | **lacuna** menor |
| 11 | Exército: parar, dividir, dividir um, unir, formação (`gicArmyHalt`, `gicArmySplit`, `gicArmySplitSingle`, `gicArmyLink`, `gicArmyFormation`, `:47-53`) | nenhum desses comandos em `commands.ts`; o GDD §2.4 já os lista, e a seção "Frente 4, continuação" já os confirmou no fonte | **lacuna** de implementação: está no GDD e não tem item no BUILD_PLAN |

**Atualização de um achado da frente 3:** "F24a: sem cota, a oficina daqui produz tudo" deixou
de valer. A D-PRODUCAO-03a (encomendas das oficinas) fez a oficina nascer parada e produzir
só por encomenda, como o KaM. A exceção é a Casa do Gibão (F24c, proposta).

**Propostas ao operador** (nenhuma entra na fila sem decisão dele):
- Declarar o item 5 como divergência no `pausa.ts` e no GDD, ou alinhar ao KaM.
- Um item para os comandos de grupo do item 11. É o maior efeito na partida: hoje o
  jogador não divide nem une tropa.
- Os itens 4, 6 e 8, de logística fina, podem ir juntos num item de comandos de prédio.
