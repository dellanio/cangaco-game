# F24a — As armas separadas nas seis do GDD (plano)

Critério: `BUILD_PLAN.md`, item F24a, intocado. Pedido do operador (2026-09-26):
cada arma chega ao armazém partindo do estado inicial pelo caminho real, e a regra
do `validate:data` que teria pegado o buraco.

## O que o GDD declara (conferido)

- §4.1: armas = Hand axes, Swords, Lances, Pikes, Longbows, Crossbows; armaduras e
  escudos = Leather armor, Iron armor, Wooden shields, Iron shields. Os dez ids já
  estão em `economy.json` e no tema.
- §5.2: Weapons workshop `2 timber → arma de madeira`; Weapon smithy `iron + coal →
  arma de ferro`; Armor smithy `iron + coal → armadura de ferro`; Armory workshop já
  sai `leather_armor` + `wooden_shield`.
- Anexo A §12.1: as proteções de ferro que as tropas pedem são `iron_armor` e
  `iron_shield`. Logo a Casa do Ferro sai **uma das duas**, e não as duas juntas.
- §2.3: "Oficinas: quantas de cada arma produzir" — a cota.

## Desenho

1. **Dado.** As três receitas declaram as saídas possíveis e `"escolheSaida": true`:
   - `weapons_workshop.sai`: `hand_axe`, `lance`, `longbow` (0,8/min cada);
   - `weapon_smithy.sai`: `sword`, `pike`, `crossbow`;
   - `armor_smithy.sai`: `iron_armor`, `iron_shield`.
   A taxa de cada uma é a taxa **quando é ela que sai**; o ciclo não muda.
   Saem do tema os três ids agregados.
2. **Carregador.** `ReceitaDePredio.escolheSaida: boolean`. Receita com a marca e
   menos de duas saídas é erro de carregamento.
3. **Estado.** `Producao.escolha?: EscolhaDeSaida` — presente só no prédio cuja
   receita escolhe, omitido nos outros (a convenção de `DadosDaFsm`: ausente, nunca
   `undefined`). `{ cota: Record<mercadoria, inteiro ≥ 0>, proxima: inteiro }`.
   Nasce com cota 1 para cada saída: é o rodízio fixo da ordem da tabela.
   Campo opcional para não obrigar os ~25 literais de `Producao` em testes.
4. **Escolha.** O rodízio expandido é, na ordem de `economia.mercadorias`, cada
   saída repetida `cota[m]` vezes. O ciclo que deposita entrega
   `rodizio[proxima % n]` e avança `proxima`. Determinístico, sem RNG.
   `unidadesPorCiclo` de receita que escolhe é a maior das saídas, e não a soma.
5. **Comando.** `SetProductionQuota { predio, cota }` fixa os pesos e zera
   `proxima`. Recusado (`command-rejected`) se o prédio não existe, está em obra,
   não escolhe saída, se a cota nomeia mercadoria fora das saídas, se algum valor não
   é inteiro ≥ 0, ou se todos são zero (parar é `SetBuildingPaused`).
6. **Validação.** `validate:data` ganha `producao/saida-desconhecida`: id de
   `production.predios.*.sai` fora de `economy.mercadorias`. E `producao/escolha-sem-opcao`
   para a marca com menos de duas saídas.
7. **Pilha.** Sem código: `render/pilhas.ts` já lê `sai` da receita; com ids reais,
   a saída das três casas passa a ter pilha. Afirmado no teste pelo funil do render
   (import, não varredura de texto).

## Aceite (teste `tests/F24a-armas.test.ts`)

- Caminho real a partir de `createInitialState`: as três oficinas saem de
  `PlaceBlueprint`, sobem por laborer e serf, o carpinteiro e os dois ferreiros são
  treinados na escola, ocupam, e o serf abastece da `saida` do armazém. Fixture
  declarada: estradas (como F15a), o desbloqueio (`tiposJaConstruidos` com a serraria
  e a Casa de Fundição, que exigiriam a árvore inteira) e ferro e carvão no armazém
  (a abertura não tem). Afirma: cada uma das oito saídas entra no armazém.
- Cota: `SetProductionQuota` com só `lance` → só sai `lance` numa corrida longa.
- Recusas do comando, uma por motivo.
- `validate:data` reprova um `data/` sintético com `arma_madeira` numa receita.
- Igualdade de conjuntos: a união de `receitas.*.sai` ⊆ `economia.mercadorias`.
- Determinismo com save/load no meio do rodízio.

## Fora

Painel da cota (ui). Nenhuma tropa consome arma (F25).
