# O clima (inverno e seca) e o Açude — plano (I-PLANO-ACUDE-E-CLIMA, 2026-10-05)

**Só planejamento.** Nenhum código. O operador aprova antes de qualquer implementação. Cada etapa
da seção 8 vira um item próprio no `BUILD_PLAN.md`, com o aceite escrito antes do código.

## 0. O pedido, resumido

Um ciclo de clima **previsível**: inverno (5 min), transição (1), seca (6), transição (1), tudo em
dado. Ele mexe **só no crescimento das plantações**:
- **inverno:** +20 %;
- **seca:** −35 %;
- **irrigação:** a fazenda irrigada recupera 25 pontos percentuais na seca.

Um prédio novo, o **Açude**, guarda água (capacidade 1 000), enche no inverno, gasta na irrigação e
perde por vazão/evaporação. A ligação com a fazenda é A (distância) ou B (serf entregando).

**Restrições do operador:**
- não mexer em fome nem em consumo de comida;
- sem sede individual, sem Aguadeiro, sem doença, sem desastre aleatório;
- tudo em dado.

---

## 1. Pesquisa histórica

### O açude no sertão
- **A Grande Seca de 1877–1879** foi a pior da história do Brasil, com 400 a 500 mil mortos. Só no
  Ceará, 100 mil sertanejos foram para Fortaleza. Ela levou D. Pedro II a mandar construir o
  **Açude do Cedro** (Quixadá, CE), a primeira grande obra contra a seca.
  - As obras foram de 1890 a 1906, com cinco barragens no rio Sitiá e 125 milhões de m³.
  - Foi a primeira grande construção com rede de canais de irrigação.
  - Ele "raramente sangra" (6 sangrias na história) e passou anos totalmente seco nos anos 2010.
  - Foi erguido por retirantes remunerados.
- **A IOCS** (Decreto 7.619, de 21/10/1909) fez da açudagem política pública. Virou IFOCS em 1919 e
  **DNOCS** em 1945, e construiu no semiárido ~310 açudes públicos e ~622 em cooperação.
- **No vale do Piancó**, o nome do jogo: o **Açude Coremas–Mãe d'Água** (Estevam Marinho) represa o
  **rio Piancó**.
  - Os estudos são de 1911–1912 (IOCS). A obra foi de 1937 a 1942, pelo DNOCS, e foi a maior obra de
    engenharia do país na época.
  - O sistema guarda 1,358 bilhão de m³ e foi feito para o Piancó e o Piranhas correrem o ano inteiro.
  - O povoado, Boqueirão do Curema, cresceu em volta do acampamento da obra, que tinha casas, escola,
    hospital e capela.
- **Uma leitura crítica:** a "naturalização" da seca fez da solução uma questão técnica, de engenheiro
  (Frederico de Castro Neves). Para o jogo, isso quer dizer que **o açude é obra pública grande e cara,
  não um balde**.

Fontes:
- [Grande Seca — Wikipedia](https://en.wikipedia.org/wiki/Grande_Seca)
- [Açude Cedro — Diário do Nordeste](https://diariodonordeste.verdesmares.com.br/ceara/acude-cedro-da-imponente-construcao-ordenada-por-dom-pedro-ii-a-completa-ausencia-de-agua-ha-anos-1.3215698)
- [Quixadá, Açude do Cedro — ipatrimônio](https://www.ipatrimonio.org/quixada-acude-do-cedro/)
- [IFOCS — verbete CPDOC/FGV](https://cpdoc.fgv.br/sites/default/files/verbetes/primeira-republica/INSPETORIA%20FEDERAL%20DE%20OBRAS%20CONTRA%20AS%20SECAS.pdf)
- [Açude Coremas–Mãe d'Água — Wikipedia](https://pt.wikipedia.org/wiki/A%C3%A7ude_Coremas-M%C3%A3e_d'%C3%81gua)
- [Mar de água doce no Sertão — Polêmica Paraíba](https://www.polemicaparaiba.com.br/cidades/mar-de-agua-doce-no-sertao-conheca-a-historia-do-acude-de-coremas/)
- [A Bacia — CBH Piancó-Piranhas-Açu](https://cbhpiancopiranhasacu.org.br/a-bacia/)
- [O Nordeste e a historiografia — F. de Castro Neves](https://revistas.uece.br/index.php/embornal/article/download/3179/2693/)

### A irrigação e as culturas (a validação do pedido)
- **"Inverno" no sertão** é a estação das **chuvas** (de mais ou menos fevereiro a maio), e não o frio.
  O nome do pedido está certo para o público nordestino.
- **O milho é cultura de sequeiro:** plantado na chuva, sem irrigação, e o mais exposto à estiagem.
  ANA e IBGE mediram um déficit hídrico médio de 37 % no sequeiro em 2013–2017, maior no milho e na
  cana. O milho irrigado pode mais que triplicar a safra (relato de Iguatu, CE).
- **A cana** tolera mais a seca, mas também perde. No sertão ela é exceção (a cana é da Zona da Mata),
  e onde existe depende de irrigação.
- **A vazante:** na seca, planta-se na margem úmida que o açude deixa ao baixar, com milho, mandioca e
  feijão, e a "irrigação de salvação" (Embrapa Semiárido). **Ideia para depois, fora deste plano:** a
  margem do Açude baixo vira tile arável.
- **Conclusão para o jogo:**
  - o milho sente mais a seca que a cana. **Pergunta 1:** a seca tem efeito diferente por cultura
    (milho −35 %, cana −20 %) ou um só?
  - o −35 % da seca está na ordem do déficit de 37 % medido no sequeiro: o número do pedido tem
    lastro.

Fontes:
- [Agricultura de sequeiro tem déficit hídrico de 37 % — Notícias Agrícolas (ANA/IBGE)](https://www.noticiasagricolas.com.br/noticias/clima/256935-dependente-das-chuvas-agricultura-de-sequeiro-tem-deficit-hidrico-de-37.html)
- [Milho irrigado mais que triplica safra — Diário do Nordeste](https://diariodonordeste.verdesmares.com.br/regiao/plantio-de-milho-irrigado-mais-que-triplica-safra-no-interior-tenho-melhor-qualidade-de-vida-1.3156525)
- [Agricultura de vazante — Embrapa](https://www.embrapa.br/en/busca-de-publicacoes/-/publicacao/154389/agricultura-de-vazante-uma-opcao-de-cultivo-para-o-periodo-seco)
- [Perspectivas da açudagem no Seridó — Redalyc](https://redalyc.org/jatsRepo/3213/321353638008/html/index.html)

---

## 2. Benchmark de sete jogos

| jogo | o que faz | o que levar | o que evitar |
|---|---|---|---|
| **Against the Storm** | ciclo fixo de 3 estações (Drizzle 4 min, Clearance 4 min, Storm mais curta); a fazenda planta numa e colhe noutra; a água da chuva por estação acelera produção ([wiki](https://wiki.hoodedhorse.com/Against_the_Storm/Seasons), [fazenda](https://wiki.hoodedhorse.com/Against_the_Storm/Farm_Field)) | **ciclo previsível e curto, com relógio visível**: é o modelo do pedido | travar a fazenda a estação inteira (abrir campo fora de hora espera quase um ano) |
| **Timberborn** | a seca é o desafio central; tanques e reservatórios guardam água, o reservatório aberto evapora por tile; a seca piora com o tempo ([clima](https://timberborn.fandom.com/wiki/Weather), [guia](https://timberborn.org/articles/water-management-guide)) | **o reservatório que enche e esvazia**, com **perda por evaporação** (a vazão do pedido) | a sede individual e a morte por falta d'água (proibidas pelo operador) |
| **Farthest Frontier** | a seca vem da simulação do clima, mais provável no meio do ano, nunca duas em 15 meses; cada cultura tem tolerância própria à seca ([wiki](https://farthestfrontier.wiki/wiki/Farming)); sem irrigação, o jogador "planta mais" ([fórum](https://steamcommunity.com/app/1044720/discussions/0/3911997462232050256/)) | a **tolerância por cultura** (Pergunta 1) | a seca aleatória que mata a safra (proibida) |
| **Manor Lords** | as estações definem plantio e colheita; o verão pode trazer seca; a defesa é diversificar ([estações](https://www.thegamer.com/manor-lords-all-seasons-effects-weather-guide/), [campo](https://wiki.hoodedhorse.com/Manor_Lords/Field)) | o clima como razão para **diversificar** (milho e cana) | perder o campo inteiro por calendário |
| **Banished** | 12 estações, a geada mata o que não foi colhido, e o inverno não planta ([wiki](https://banished-wiki.com/wiki/Seasons)) | a leitura da estação no HUD | a perda total por evento; a fome em cascata |
| **Civilization** | a água doce perto (rio, lago) e a irrigação melhoram a terra; a ligação é por **adjacência**, sem transporte. *Memória de jogo, não conferida nesta sessão: hipótese* | a **ligação por distância** (opção A) | — |
| **Frostpunk** | a temperatura cai em ciclos e eventos; o aquecimento cobre um **raio** em volta da fonte. *Memória de jogo, não conferida nesta sessão: hipótese* | o **raio de efeito** desenhado no chão ao posicionar | a punição pesada e a morte em massa |

**Leitura:** o pedido junta o relógio do Against the Storm, o reservatório do Timberborn e o raio
do Civilization/Frostpunk. Nenhum dos sete pede ao jogador para carregar água à mão: o que faz isso
é a opção B.

---

## 3. O fluxo de jogo final (a proposta)

1. A partida começa no **inverno**: as plantações crescem 20 % mais rápido, e o HUD mostra a estação
   e quanto falta para a próxima.
2. A **transição** avisa: "a seca vem aí" (alerta da F22, sem pausa).
3. Na **seca**, o crescimento cai 35 %. A roça perto de um Açude com água cai só 10 % (−35 + 25).
4. O **Açude** enche no inverno (`entradaNoInverno`), gasta água por fazenda irrigada na seca
   (`consumoPorFazenda`) e perde um pouco sempre (`vazao`). Vazio, ele não irriga, e a fazenda volta ao
   −35 %, sem dano nenhum além disso.
5. O jogador **planeja**: põe as roças perto do Açude e decide quantas ele aguenta. É uma escolha de
   posição, sem microgerência.
6. **Nada morre** por clima. A fome continua a de hoje e só sente a colheita menor.

---

## 4. O modelo de dados (a proposta)

Os nomes de tipo são em português, como o resto da sim. Os do pedido ficam entre parênteses.

### `data/clima.json` (novo; a sim lê)
```json
{
  "_doc": "...",
  "escala": "economia",
  "ciclo": [
    { "id": "inverno",       "duracao_segundos_base": 300, "multiplicadorDeCrescimento": 1.20 },
    { "id": "transicaoSeca", "duracao_segundos_base": 60,  "multiplicadorDeCrescimento": 1.00 },
    { "id": "seca",          "duracao_segundos_base": 360, "multiplicadorDeCrescimento": 0.65 },
    { "id": "transicaoChuva","duracao_segundos_base": 60,  "multiplicadorDeCrescimento": 1.00 }
  ],
  "irrigacao": { "pontosRecuperadosNaSeca": 0.25 },
  "estacaoInicial": "inverno"
}
```
- **Pergunta 2:** a duração do ciclo escala com `economia` (2,0 hoje, ou seja, o inverno dura 10 min de
  verdade) ou fica em minutos de relógio? A regra do CLAUDE.md §5 pede que cada duração declare o
  grupo. A proposta é `economia`, porque o clima é ritmo de economia.
- **Pergunta 1** (de novo): `multiplicadorDeCrescimento` por estação **e por cultura** (`porCultura:
  { corn, grapes }`)?

### O clima no estado (ClimateSystem)
**Nenhum campo novo no `GameState`.** A estação é função pura do tick: `estacaoNoTick(tick) = ciclo[(tick
mod período)]`. É determinística, sai do save de graça e não pode divergir. O render e o HUD leem o
mesmo seletor.

### O Açude (Reservoir)
- **Prédio** `reservoir` em `buildings.json`, com tamanho, custo e desbloqueio (**Pergunta 3**).
  - Proposta: 4×3, caro em pedra (6) e madeira (4), desbloqueado pela Pedreira.
  - É obra pública (a seção 1), e não tem trabalhador (**Pergunta 4:** um "vigia" ou nenhum?).
- **No estado:** `PredioCompleto.agua?: number`, opcional e só do `reservoir`. É a única mudança no
  `GameState`, e entra na guarda `GUARDA-step-preserva-opcionais`.
- **Em `data/acude.json`:** `capacidade` 1 000, `entradaNoInverno_porMinuto`,
  `consumoPorFazendaIrrigada_porMinuto`, `vazao_porMinuto`, `raioDeIrrigacao_tiles` (opção A) e
  `aguaMinimaParaIrrigar`.

### A fazenda e a cultura (Farm / Crop)
Não mudam de forma. `farm` e `wineyard` continuam colhendo `corn` e `grapes`
(`data/production.json`).

**O que muda é como o tile amadurece.** Hoje ele é derivado: `tick >= semeadoEm + ticksDeCrescer`
(`src/sim/recursos.ts:260-266`). A proposta é o **relógio de crescimento**:
- um contador global por **classe de irrigação**: `relogio.sequeiro` e `relogio.<id do açude>`;
- cada contador avança a cada tick pelo multiplicador da estação, já com a irrigação daquela classe;
- o tile guarda o valor do relógio da classe dele **na semeadura** (`semeadoNoRelogio`), e fica maduro
  quando o relógio andou `ticksDeCrescer`;
- o custo é O(número de açudes) por tick, nada por tile. O tile continua sem relógio próprio, como a
  F-CAMPO-a decidiu;
- os inteiros: o relógio conta em **milésimos de tick** (multiplicador × 1000, arredondado no
  carregamento), para não haver float acumulando no estado.

O contador global entra no `GameState` (`crescimento: Record<string, number>`). **A alternativa mais
simples** é fixar o multiplicador na semeadura: o tile semeado no inverno cresce como inverno até o
fim. Não precisa de contador, mas ignora a estação que muda no meio, e a irrigação que acaba no meio.
É a **Pergunta 5**.

### A ligação (IrrigationConnection)
- **Opção A, distância (recomendada):** a fazenda (o prédio, não o tile) está irrigada se há um Açude
  completo, com água ≥ `aguaMinimaParaIrrigar`, a até `raioDeIrrigacao_tiles` dela. Se houver mais de
  um, conta o mais perto, com desempate pelo id.
  - **Sem estado:** é um predicado derivado, como a "ligado ao armazém" das estradas.
  - O consumo sai do açude escolhido, por fazenda irrigada.
  - Cabe no `canPlace` como prévia: o raio aparece na planta fantasma.
- **Opção B, serf entregando:** a água é mercadoria (`water`), o Açude é origem e a fazenda tem gaveta de
  entrada; o serf leva pela escada de `delivery.json`.
  - **Contra:** é o Aguadeiro disfarçado e põe carga nova no JobBoard.
  - **Pró:** usa o que já existe.
  - **Não recomendada:** ela traz a microgerência que o pedido quer evitar.

---

## 5. A integração com o Piancó de hoje (arquivo:linha, conferido nesta sessão)

- **Como o tile cresce:** `tileMaduro` (`src/sim/recursos.ts:260-266`) deriva o maduro de `semeadoEm` e
  `reposicao.ticksDeCrescer` do tipo. `semeadoEm` é gravado na semeadura (`src/sim/recursos.ts:469`) e
  mantido na colheita parcial (`:535`). **Esse é o ponto que muda** (seção 4).
- **O dado do crescimento:** `crescer_segundos_base` (milho e cana 330 s, árvore 412,5 s) em
  `data/resources.json`, convertido no carregamento (`src/sim/data/loader.ts:813-826`) para
  `ticksDeCrescer` (`src/sim/data/types.ts:250`). A árvore **fica de fora** do clima nesta proposta
  (**Pergunta 6**).
- **Quem colhe:** `farm` (`corn`) e `wineyard` (`grapes`), em `data/production.json`, com `colheita.fases`.
  A colheita não muda: só o tempo até o tile ficar maduro.
- **O tick:** `step()` (`src/sim/tick.ts:52`) aplica os comandos e roda os sistemas numa ordem fixa. O
  sistema novo `sistemaDoClima` (o nível do açude e os relógios) entra **antes** dos sistemas de
  colheita, para o maduro do tick já ver o relógio do tick.
- **As escalas:** `data/time.json` `escalas.economia` = 2,0. Toda duração do clima declara o grupo e
  vira tick no carregamento (CLAUDE.md §5). Nenhum sistema lê `escalas`.
- **O estoque de prédio:** `PredioCompleto.estoque.entrada/saida`. A água da opção A **não** é estoque
  (é `agua`, um número do prédio); na B, seria.
- **O ambiente, o mapa e o render:**
  - o mapa já tem um "açude do norte", água de terreno em `tools/gerar-mapa.js` (`ACUDE`, F-D3). É
    cenário, não o prédio. **Pergunta 7:** o prédio exige ser posto na beira d'água (como o pescador),
    ou vai em qualquer lugar?
  - o render tem água animada (`data/agua.json`) e relevo, de onde sai o nível da água do Açude
    (estados de sprite `cheio`, `meio`, `baixo`, `seco`);
  - a estação muda a paleta do chão (verde no inverno, ocre na seca), só no render.
- **O balanceamento:** os números do pedido (+20 %, −35 %, +25 pp, 1 000) entram como **proposta** no
  `BALANCE_LOG.md`. O teste afirma a **mecânica** e não a produção (decisão do operador de 2026-10-04):
  - a razão entre o tempo de crescimento na seca e no inverno é 1,20 / 0,65;
  - o irrigado na seca cresce mais rápido que o sequeiro;
  - o açude vazio não irriga;
  - a estação é função do tick;
  - o determinismo.
- **A fome:** `src/sim/systems/fome.ts` e `alimentar.ts` **não mudam**. O teste de não-regressão afirma
  que o consumo por cabeça é o mesmo com e sem clima.

---

## 6. Interface

- **No HUD:** o ícone da estação e a contagem até a próxima (ex.: "Seca — 4:10"). A barra rápida
  (I-TELA-BARRA-RAPIDA-DE-RECURSOS) pode levar a estação na ponta.
- **No painel do Açude:** a água (X / 1 000), a tendência (enchendo, gastando), as fazendas que ele
  irriga e o raio.
- **No painel da fazenda:** "irrigada pelo Açude X", ou "sequeiro", e o multiplicador de agora.
- **Na planta fantasma do Açude e da fazenda:** o raio de irrigação desenhado.
- **O alerta (F22)** na transição para a seca e no açude vazio.

---

## 7. A arte (homologação do operador; pelo `pianco-sprite-director`)

- o Açude: uma barragem de pedra e terra com espelho d'água, em quatro estados de nível;
- o chão sazonal: a grama verde do inverno e a ocre da seca, por tint ou por troca de textura;
- as roças: a planta verde e a planta murcha (opcional).

---

## 8. O plano em etapas (cada uma um item, com aceite antes do código)

1. **I-CLIMA-ESTACAO**: `data/clima.json`, `estacaoNoTick` (pura) e o HUD com a estação e a contagem.
   Sem efeito em nada. *Aceite:* a tabela "tick → estação", a soma das durações e o determinismo.
2. **I-CLIMA-CRESCIMENTO**: o relógio de crescimento (ou a semeadura, conforme a Pergunta 5) e o
   multiplicador da estação no milho e na cana. *Aceite:* a razão seca/inverno e a árvore intocada.
   O consumo de comida por cabeça não muda.
3. **I-PREDIO-ACUDE**: o prédio no dado, no menu e no mapa, com o placeholder, sem água.
4. **I-ACUDE-AGUA**: o nível (entrada no inverno, vazão sempre, teto na capacidade), o painel e o
   estado de sprite pelo nível.
5. **I-ACUDE-IRRIGACAO** (opção A): o predicado de irrigação, o consumo por fazenda e a recuperação de
   25 pp na seca. *Aceite:* o irrigado cresce mais rápido que o sequeiro, o açude vazio não irriga, e
   dois açudes não somam.
6. **I-TELA-CLIMA**: o chão sazonal, o raio na fantasma, os alertas e a captura das quatro estações.
7. **I-ARTE-ACUDE**: o sprite nos quatro níveis.
8. *(depois, fora deste plano)* a vazante, a cultura que muda com a estação e a IA usando o Açude.

---

## 9. Riscos

| risco | o que é | mitigação |
|---|---|---|
| microgerência | o jogador cuidando de água o tempo todo | opção A (posição, não transporte); sem sede; o açude cheio dura a seca inteira com 2–3 roças |
| complexidade | dois sistemas novos na sim e um prédio | as etapas pequenas; a estação sem estado; um único campo novo (`agua`) |
| concentração | todas as roças amontoadas em volta de um açude | raio pequeno (6–8 tiles); a capacidade limita quantas o açude sustenta |
| Açude obrigatório | sem ele a vila não passa da seca | a seca só reduz (×0,65), nunca zera; a vila sem açude cresce mais devagar, e não morre |
| seca punitiva | a fome em cascata na seca | a seca é curta (6 min de 13) e previsível, com aviso na transição; a fome não muda; o celeiro do inverno cobre |
| multiplayer | a estação e o sorteio divergindo entre clientes | estação função do tick, sem RNG; tudo inteiro; determinístico como o resto |
| legibilidade | o jogador não entende por que o milho atrasou | HUD da estação, painel da fazenda com o multiplicador, raio na fantasma, alerta |
| custo de sim | relógio por tile, busca de açude por fazenda | relógio global por classe (O(açudes)); o predicado de irrigação memoizado por tick, como a ligação ao armazém |
| testes longos | a corrida longa e a calibração sentem o ritmo novo | o clima entra **desligável** no dado (`ligado`), e os testes de produção rodam com ele desligado até o lote de balanceamento |

---

## Perguntas ao operador (resumo)

1. A seca tem efeito diferente por cultura (o milho sofre mais que a cana) ou um só?
2. A duração do ciclo escala com `economia` (o inverno vira 10 min de verdade) ou fica em minutos de
   relógio?
3. O custo, o tamanho e o desbloqueio do Açude.
4. O Açude tem trabalhador?
5. O crescimento usa o relógio global (a estação muda no meio do crescimento) ou fixa o multiplicador
   na semeadura (mais simples)?
6. A árvore (o lenhador replanta) sente o clima?
7. O Açude exige beira d'água ou vai em qualquer lugar?
8. A ligação é a opção A (distância, recomendada) ou a B (serf)?
