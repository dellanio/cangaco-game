# Plano — C8: a IA com prioridade de alvo e de tipo de tropa (fila do operador, item 8)

Pedido: *"Hoje ataca o mais perto e forma o mais barato. Meça no kam_remake como eles
escolhem."*

## Medido no kam_remake
- **Alvo:**
  - a IA **clássica** (`ai/KM_AIGeneral.pas:489,683-695`) ataca o prédio inimigo mais
    perto da **posição inicial dela**, de qualquer tipo (`TARGET_HOUSES = HOUSES_VALID`),
    concluído ou não;
  - a IA **nova** (`ai/newAI/KM_ArmyAttack.pas:155-160,1391`) tem prioridade: o alvo
    primário é o mais perto entre **Quartel, Armazém, Escola e Prefeitura**
    (`TARGET_HOUSES`). Ela derruba a Torre que estiver no raio (`SCAN_HOUSES`), e só no
    fim ataca qualquer prédio (`ALL_HOUSES`).
- **Tropa:** `AI_TROOP_TRAIN_ORDER` (`common/KM_Defaults.pas:701-705`) forma **o mais forte
  que o equipamento permite**, na ordem:
  - corpo a corpo: Espadachim, Machadeiro, Miliciano;
  - antimontaria: Piqueiro, Lanceiro;
  - distância: Besteiro, Arqueiro;
  - montado: Cavaleiro, Batedor.
  O laço tenta o primeiro e cai para o seguinte quando não consegue equipar
  (`KM_AIGeneral.pas:282-300`).

## A nossa versão
- **Alvo:** a da IA nova. O primeiro é o prédio de outro lado mais perto do centro do grupo
  **entre os prioritários** (`combat.json: ia.alvosPrioritarios` = `barracks`,
  `storehouse`, `schoolhouse`, `town_hall`). Sem nenhum desses de pé, qualquer prédio,
  como hoje.
  - Os três primeiros são exatamente o que a F34 conta para a vitória.
  - A Torre no raio (`SCAN_HOUSES`) fica fora (PARA REVISÃO).
- **Tropa:** `combat.json: ia.ordemDeTreino`, por tipo de grupo, na ordem do KaM. A
  reposição (ponto 4) forma o primeiro da lista que o quartel consegue formar agora, pelo
  `motivoParaFormar` da C3, que é a mesma regra do comando.
- **Regra de dado:** todo id da ordem é militar do tipo de grupo da chave, e todo alvo
  prioritário é prédio de `buildings.json`.

## Aceite
- (a) A reposição com machado, gibão e escudo (o suficiente para o Machadeiro) forma
  **Machadeiro**, não Miliciano. Só com machado, forma Miliciano (o de hoje). Com espada,
  armadura e escudo de ferro, forma Espadachim.
- (b) O ataque escolhe o prioritário mesmo com um não prioritário mais perto: com uma
  pedreira inimiga colada ao grupo e um armazém inimigo mais longe, vai ao armazém. Sem
  prioritário de pé, ataca a pedreira.
- (c) Determinismo; os testes da F28-IA continuam verdes.
