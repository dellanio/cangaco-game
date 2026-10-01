# Plano: B-TERRENO-01 (antes F18c-2), recentrar a vila

Pedido do operador (2026-10-01): o plano, **sem código**, com a medida da folga de pedra com a vila
recentrada, feita numa cópia do mapa e sem commitar o dado. O item está em `BUILD_PLAN.md:5593`.

## 0. Resultado da medida, antes de tudo

**A folga de pedra fica menor que 2. Ela fica negativa: com a pedra do dado (30), a abertura da
vila recentrada trava.**

| | rua da abertura | pedra mínima que fecha (medida) | o guarda da abertura exige | dado | folga medida |
|---|---|---|---|---|---|
| hoje (armazém em 29,30) | 24 tiles | 28 (27 trava) | 28 (rua + 4) | 30 | **+2** |
| recentrada (armazém em 63,63) | **35 tiles** | **35** (34 trava) | 39 (rua + 4) | 30 | **−5** |

- **Ticks do critério fechado** (critério da F17, 12 000 ticks de teto):
  - hoje: 3 825 com 30 e 4 363 com 28; com 27, trava;
  - recentrada: 30 a 34 travam; 35 fecha no 5 202, 36 no 5 177, 37 no 5 173, 38 no 4 675, 39 no
    4 551.
  - Nenhum comando recusado em nenhuma corrida.
- **Controle:** a mesma sonda, no mapa de hoje, deu os mesmos 3 825, 4 363 e "trava" da medida
  da manhã (PROGRESS, item 4, "a ponta A da folga de pedra").
- **Com a vila recentrada, o guarda e a medida divergem:** o limiar medido é a própria rua (35), e
  não rua + 4. Hoje os dois coincidem em 28. Não investiguei por quê.

### Como foi medido (sonda da sessão; apagada, não é cobertura contínua)

**O mapa recentrado.** É uma cópia de `tools/gerar-mapa.js` no scratchpad da sessão, e nada em
`data/` foi escrito.
- **O deslocamento:** a vila anda +34, +33, e o armazém vai de (29,30) para (63,63), o centro que a
  nota do item já cita. Andam a escola e o spawn de `economy.estadoInicial`.
- **Andam junto os cinco elementos da geografia da vila:** o lajedo, o açude e a caixa dele, o mato
  do nascente, o roçado e o canavial. É o "o gerador deriva da vila…" do escopo.
- **Não andam:** o resto do mapa (o lago, a serra, as manchas grandes de terra arada, a faixa de
  areia, os aglomerados de árvore sorteados) e a semente.

**A sonda.** Ela montou `GameData` com o mapa e a economia copiados (`loadGameData`), a abertura da
Fase A (`aberturaDaFaseA`, `comandosNoTick` e `criarMedidor`), e a pedra inicial varrida.

**A geometria da abertura recentrada:**
- os lenhadores vão para (77,60) e (80,60), ou seja, vila(+14,−3) e vila(+17,−3). Hoje ficam em
  vila(0,−3) e vila(+3,−3);
- a serraria e a pedreira ficam onde ficam hoje, relativas à vila: vila(−14,+1) e vila(−10,+1).
  **Os 11 tiles a mais de rua são a ida até os lenhadores.**

**Hipótese, não conferida:** um aglomerado de árvore sorteado, perto do centro do mapa, entra na
caixa de busca da mata e ganha do mato do nascente no "maior mínimo de árvores ao alcance", e por
isso os lenhadores vão para leste. Não identifiquei qual aglomerado.

## 1. O que muda no mapa

**No gerador** (`tools/gerar-mapa.js`):
- a posição de `LAJEDO_DA_VILA` (`:311`), `ACUDE` e a caixa dele (`:281`, `:257-258`),
  `MATO_DO_NASCENTE` (`:282`), `ROCADO_DA_VILA` (`:291`) e `CANAVIAL_DA_VILA` (`:298`) passa a sair da
  vila de `economy.estadoInicial`, e não de coordenada escrita;
- o cabeçalho (`:16-45`) e a nota do `_doc` do mapa, que falam do "quadrante noroeste", mudam
  junto.

**No dado:**
- `economy.estadoInicial.predios` e `spawnDeUnidades` vão para o centro;
- o `data/maps/sertao-128.json` e o `.relevo.json` são regerados.

**Efeito colateral do recentro, que o escopo não diz:**
- a mancha grande de terra arada em (77,62) (`:210`) passa a ficar a ~12 tiles do armazém e encosta
  na folga da vila;
- o lago (92,46) fica a ~30 tiles.

Os dois ficam ao alcance da abertura, o que hoje não acontece.

## 2. O que quebra

### Bloqueante, além da folga de pedra: a escaramuça

`data/escaramuca.json` põe a vila da IA em (72..95, 70..77):
- armazém da IA em (72,70);
- posição de defesa "frente" em (67,67);
- tropa do jogador nascendo em (28,38).

Com a vila do jogador em (63..70, 63..66):
- **a defesa "frente" da IA cai dentro da vila do jogador**;
- o armazém da IA fica a ~2 tiles da folga dela;
- a tropa do jogador nasce a ~40 tiles da vila dele.

O `_doc` da escaramuça diz "~45 tiles da vila do jogador". A escaramuça tem de andar junto, e as
posições dela são dado de cenário. **Decisão do operador** (§5).

### Os testes do arquivo publicado (`FORA_DO_MUNDO_TRANSLADADO`, nota do item)

- o F-D3, gerador byte a byte;
- o F18b, "publica 128x128" e "área ×4";
- o D-TERRENO-ALTURA, o relevo byte a byte.

Os três mudam junto com o mapa novo, como contrato do arquivo, e não como afrouxamento.

### As guardas de geografia do gerador

A reserva da F-D3, o roçado da F18h, a cana da F-CANA-b, a mata da F-T4b e os "9 arquivos de
geografia" do aceite. Elas afirmam a geografia em volta da vila, e devem passar se a derivação for
fiel.

**Hipótese:** a da mata não passa como está, pela medida do §0.

### Literal absoluto em teste

A suíte transladada (F18c-1c) já prova, a cada `verify`, que nenhum teste fora da lista acima
escreve coordenada absoluta. Por construção, eles passam no mapa novo.

### Roteiros

- **Com coordenada literal provável** (o grep achou par numérico): `tools/shots/F18e.js`,
  `F18i.js` e `F-TP.js`. **Hipótese:** não conferi linha a linha se o número é tile.
- **Os 38 roteiros que derivam a posição da vila** (economia, âncora e `centroDaVila`) andam
  junto.
- **Os roteiros que carregam um `*.save.txt`** gerado pela suíte se refazem sozinhos com ela.

### O save do operador

O `saves/teste-operador-vila-pronta.txt` (D-SAVE-VILA-PRONTA) é recusado pelo `carregar` quando o
hash do mapa muda. Ele se regera com `CANGACO_GRAVAR_SAVE_DO_OPERADOR=1`.

### Calibração e marcos (no escopo do item)

- A F-CAL-b é refeita.
- Os marcos da F17 andam: o critério fechado passa de 3 825 para algo entre 4 551 (39 de pedra)
  e 5 202 (35, a pedra mínima), e com 30 nem fecha.

## 3. Ordem proposta

1. **A decisão da pedra (§5, pergunta 1), antes de tudo.** Sem ela, o mapa novo trava a abertura.
2. A escaramuça (§5, pergunta 2).
3. O gerador deriva da vila, e o mapa é regerado.
4. Os testes do arquivo publicado, as guardas de geografia, os roteiros com literal e a calibração.

## 4. Aceite (o do item, mais o que a medida pede; escrito antes do código)

1. O do item: a regra do centro da caixa em `tools/data-rules.js` (a vila no centro do mapa, pela
   caixa dos prédios do estado inicial), e os 9 arquivos de geografia verdes no mapa novo.
2. **A folga de pedra:** a abertura da vila recentrada fecha o critério da F17 com a pedra do dado,
   e a folga medida (o dado menos a menor pedra que fecha) é **≥ 2**, como hoje. A medida vira teste
   permanente, numa suíte longa se o operador mover para lá (ela roda 12 000 ticks por caso).
3. **A escaramuça:** a vila da IA, as posições de defesa e a tropa do jogador guardam, em relação à
   vila do jogador, as distâncias de hoje (o "~45 tiles" do `_doc`). Um teste afirma que nenhuma
   posição da IA cai dentro da folga da vila do jogador.
4. Os testes do arquivo publicado (F-D3, F18b, D-TERRENO-ALTURA) atualizados junto com o mapa novo,
   cada um afirmando o arquivo novo byte a byte.
5. Todos os roteiros com saída 0 (`npm run shot:todos`), e o `verify` completo e a `test:longo`
   verdes.

## 5. Perguntas ao operador

1. **Como a folga volta a ≥ 2?** Ela está em −5.
   - (a) O gerador traz a mata para perto da vila, como hoje, e a rua volta a uns 24 tiles. É
     autoria do mapa, sem número de balanceamento.
   - (b) Mais pedra no estado inicial: pelo menos 37 (35 + 2). É número de `data/`: vai para o
     `BALANCE_LOG` e para o lote.
   - (c) As duas.
   - **Recomendação:** (a), porque devolve a geometria de hoje e não mexe em balanceamento. Depende
     de confirmar a hipótese do aglomerado de árvore do §0.
2. **A escaramuça anda junto com a vila** (os mesmos deslocamentos relativos de hoje), ou a vila
   da IA ganha lugar novo no mapa recentrado?
3. **O centro é (63,63)** (o da nota do item), ou outra caixa?
