# A Igreja e o padre — pesquisa (I-PESQUISA-IGREJA, 2026-10-05)

Pedido do operador (madrugada de 2026-10-05):
- um prédio novo, a **Igreja**, bem característica do Nordeste, com a padaria como base de tamanho e
  proporção, e o sprite feito pelo Codex;
- ela forma **padres**, com dois poderes:
  - **Bênção das Tropas:** uma aura de 8 tiles, com +x% de dano ou +x% de resistência; a aura de vários
    padres não acumula;
  - **Converter:** como no Age of Empires 2, converte uma unidade inimiga por vez, depois de uma oração
    de x ticks, com a janela de sucesso entre ~5 e 9 intervalos.

Este documento é **só pesquisa e proposta**. A implementação abre depois, como itens próprios, um de
cada vez, cada um com o aceite escrito antes do código. Tudo o que é número fica em dado. O que é
decisão do operador está marcado como **Pergunta**.

---

## 1. A igreja do sertão: o que a arte precisa ter

O que as fontes dizem da igreja do interior nordestino:
- **pedra e cal, caiada de branco.** Os ornamentos (volutas, cornijas) são de "simples reboco", e não
  de cantaria;
- **torre única**, muitas vezes por falta de recursos para a segunda. A Matriz do Aracati e outras do
  Ceará são assim;
- **frontão** triangular ou de linhas curvas com volutas arrematando a fachada;
- a capela de fazenda e a de engenho têm corpo pequeno, alvenaria branca e portada de verga reta,
  às vezes com frontão interrompido. Elas foram tombadas pelo IPHAN em Pernambuco;
- a igreja domina a paisagem da vila e serve de marco geográfico (a Catedral de Santo Antônio, em
  Salgueiro, no sertão de Pernambuco).

Fontes:
- [A Arquitetura dos Sertões — Ceará em Fotos](https://cearaemfotos.blogspot.com/2018/09/a-arquitetura-dos-sertoes.html)
- [Capelas com planta centralizada no Nordeste do Brasil — Revista População e Sociedade (CEPESE)](https://www.cepese.pt/emigrante/portal/pt/populacao-e-sociedade/edicoes/revista-populacao-e-sociedade-no-19/capelas-com-planta-centralizada-no-nordeste-do-brasil-entre-a-tradicao-portuguesa-e-a-tratadistica-italiana/capelas-com-planta-centralizada-no-nordeste-do-brasil-entre-a-tradicao-portuguesa-e-a-tratadistica-italiana/@@display-file/file/Capelas%20com%20planta%20centralizada%20no%20Nordeste%20do%20Brasil.pdf)
- [IPHAN — página de patrimônio (torre única central, ou ausência de torres)](http://portal.iphan.gov.br/pagina/detalhes/1296)
- [Catedral de Santo Antônio, Salgueiro — BM&C News](https://bmcnews.com.br/ultimas-noticias/com-sua-torre-sineira-e-fachada-historica-a-catedral-de-santo-antonio-em-salgueiro-tornou-se-o-principal-marco-religioso-e-arquitetonico-da-cidade/)

**Limite da pesquisa:** poucas fontes tratam do sertão em si; a maior parte é do litoral e da zona
canavieira. O que se repete nas duas é a cal branca, a torre única e o frontão de reboco.

### O pedido de arte (para o Codex, pelo `/codex`, depois da aprovação)
Uma igreja pequena de vila sertaneja:
- **forma:** corpo retangular caiado, **uma torre** sineira de um lado (com o sino visível na
  abertura), frontão de volutas em reboco e porta de madeira de verga reta ou em arco pleno;
- **detalhes:** cruz no topo do frontão, telhado de telha cerâmica, adro de terra batida com um
  cruzeiro de madeira opcional;
- **base:** a padaria (`bakery`, 3×3, `data/buildings.json`) para o tamanho e a proporção do sprite;
- **regras:** a mesma régua de 64 px por tile, a luz única de cima levemente do sul (CLAUDE.md §9), e o
  caminho da skill `pianco-sprite-director` → `pianco-buildings`;
- **obra:** a obra revelada pede o par madeira + completo (F17g).

**Pergunta 1:** a torre fica à esquerda ou à direita? Ou centrada, como no Serro, que é de Minas?

---

## 2. O padre do Age of Empires 2: como a conversão funciona

Medido pela comunidade e documentado na wiki (Definitive Edition):
- **o intervalo:** a conversão se tenta em intervalos de **1,2 s**;
- **o aquecimento:** os quatro primeiros intervalos não convertem;
- **a janela:** do 5º ao 9º intervalo, **38 %** de chance ao fim de cada um, e o 9º é **garantido**. É a
  "janela de 5 a 9" que o operador citou;
- **contra prédio:** do 15º ao 25º, com 13 % por intervalo;
- **trocar de alvo** ou ver o alvo sair do alcance por pouco **não zera** a contagem;
- **vários padres no mesmo alvo:** cada tentativa é independente, e a primeira que acerta converte.
  Com ~25 % cada, dois dão 43,75 % por intervalo;
- **resistência (Faith):** "unidades 50 % mais difíceis de converter". Na prática, ela soma ~2 s ao
  mínimo e ~4 s ao máximo, e a chance por intervalo cai;
- **a recarga:** depois de converter, o monge precisa recuperar a fé antes da próxima conversão (dezenas
  de segundos, encurtada por tecnologia). Isso limita a uma conversão por vez;
- **a versão antiga:** as medidas do HD/AoC davam outros números (28 % do 4º ao 10º). Os números mudaram
  entre versões.

Fontes:
- [Conversion — Age of Empires Wiki (fandom)](https://ageofempires.fandom.com/wiki/Conversion)
- [Conversion Mechanics — AoE 2 Database](https://www.aoe2database.com/conversion_mechanics/en)
- [How monks really work v.2 — AoEZone](https://aoezone.net/threads/how-monks-really-work-v-2-all-the-details.119879/)
- [Faith — Liquipedia](https://liquipedia.net/ageofempires/Faith)
- [Sanctity — Age of Empires Wiki (fandom)](https://ageofempires.fandom.com/wiki/Sanctity_(Age_of_Empires_II))
- [Monk (Age of Empires II) — fandom](https://ageofempires.fandom.com/wiki/Monk_(Age_of_Empires_II))

### Como isso cabe no Piancó (sim determinística, 10 Hz)
- **O intervalo** vira ticks no carregamento (`intervaloDaOracao_segundos`, grupo `combate`).
- **O sorteio** sai do RNG semeado (`sim/rng.ts`), um por intervalo, nunca `Math.random`.
- **A janela** fica no dado: `intervaloMinimo` 5, `intervaloGarantido` 9, `chancePorIntervalo` 0,38.
- **O alvo:** uma unidade inimiga **militar** por vez, ao alcance. **Pergunta 2:** converte civil?
  No AoE2 converte; aqui o civil inimigo convertido entraria na economia do jogador, e isso mexe no
  JobBoard e no lado das tarefas dele.
- **A unidade convertida:** troca de `lado`, e as tarefas e ordens dela são liberadas. Isto toca o
  `release` do JobBoard (CLAUDE.md §5: toda tarefa reclamada tem caminho de volta).
- **A recarga:** em ticks, no dado (`recargaDepoisDeConverter_segundos`). Ela torna a regra "uma por
  vez" explícita.
- **Os padres empilhados:** como no AoE2, cada padre sorteia o próprio intervalo. **Pergunta 3:** vale
  assim, ou só um padre por alvo (os outros escolhem outro alvo)?
- **Contra prédio:** fica de fora na primeira versão (proposta conservadora).

---

## 3. A aura nos RTS

- **Age of Empires 2:** não tem aura de padre. O monge cura e converte, e o bônus de área vem de
  tecnologia ou de unidade única.
- **Age of Empires 3 e 4:** há aura em herói e unidade religiosa (o Imam do AoE4 cura ao redor). Isto é
  memória de jogo, **não conferido em fonte nesta sessão**: hipótese.
- **Warcraft 3:** a aura do herói é passiva, de raio fixo, e as auras do **mesmo tipo não acumulam**.
  Também é memória de jogo, **hipótese**, mas é o modelo que o operador pediu ("não acumula").
- **KaM:** não tem aura nem padre. A única moral de tropa é a fome (a condição). A Igreja é extensão
  nossa, fora do que o KaM faz, e deve ficar registrada assim no GDD.

### Proposta para a Bênção das Tropas
- **o raio:** 8 tiles, euclidiano (a mesma conta da visão, `dx² + dy² ≤ r²`), em dado;
- **o efeito**, uma de duas, e **Pergunta 4:** qual, ou o jogador escolhe no padre?
  - **+x % de dano:** multiplica o `attackEfetivo` da fórmula de acerto (`src/sim/combate.ts:105-114`).
    É chance de acerto, não dano: no Piancó o golpe acerta ou erra, e o hp é contado em golpes;
  - **+x % de resistência:** multiplica a `defence` da mesma fórmula, ou seja, a chance de o inimigo
    acertar cai;
- **não acumula:** a tropa dentro do raio de vários padres recebe o bônus uma vez. O predicado é
  booleano ("algum padre do meu lado a até 8 tiles"), e não soma;
- **valores iniciais propostos:** +20 % em qualquer das duas, em `data/combat.json` (ou num
  `data/igreja.json`). É balanceamento: entra no `BALANCE_LOG.md` e se ajusta em lote;
- **o custo de sim:** uma busca de padres por tropa em combate a cada tick. Com poucos padres é barata.
  Se crescer, a grade espacial que a colisão já usa resolve.

---

## 4. O prédio e a unidade: a proposta em dado

| o quê | proposta | onde | decisão |
|---|---|---|---|
| Igreja | 3×3, `timber` 5, `stone` 5, hp 450 | `buildings.json` | Pergunta 5: custo e desbloqueio |
| desbloqueio | pela Escola (`schoolhouse`)? | `buildings.json` | Pergunta 5 |
| padre | `priest`, treinado na Igreja, custa ouro | `units.json` | Pergunta 6: treina na Igreja ou na Escola? |
| hp do padre | 2 (frágil) | `units.json` | balanceamento |
| alcance de conversão | 7 tiles | `combat.json` | balanceamento |
| intervalo | 1,2 s | `combat.json` (grupo `combate`) | AoE2 |
| janela | do 5º ao 9º, 38 % | `combat.json` | AoE2 |
| recarga | 30 s | `combat.json` | balanceamento |
| aura | 8 tiles, +20 %, não acumula | `combat.json` | pedido do operador / balanceamento |
| sub-aba | Guerra | `menu-build.json` | Pergunta 7: Guerra ou Vila? |

**Ordem de execução proposta** (cada um com aceite próprio, escrito antes do código):
1. **I-ARTE-IGREJA** (Codex): o sprite, com as bases e o par da obra. A homologação é do operador.
2. **I-PREDIO-IGREJA**: o prédio no dado e no menu, sem padre. Planta, constrói e aparece.
3. **I-UNIDADE-PADRE**: o padre treinado, andando e obedecendo à ordem de mover, sem poder.
4. **I-COMBATE-BENCAO**: a aura, pelo `step`, por tabela. Afirma que não acumula, e o raio.
5. **I-COMBATE-CONVERTER**: a conversão, pelo `step`, determinística. Afirma a janela (nunca antes do
   5º intervalo, sempre até o 9º), a recarga, a troca de lado e o `release` das tarefas do convertido.
6. **I-ARTE-PADRE** (Codex ou PixelLab): o padre em 8 direções, a pose de oração e o balão de conversão.

## 5. Riscos

- **A conversão sem contra** vira a arma dominante. O AoE2 equilibra com a cavalaria barata contra o
  monge, e com a resistência (Faith). Aqui o padre frágil (hp 2) e a recarga fazem esse papel no
  começo.
- **A IA não sabe usar padre** nem reagir a ele. A primeira versão fica só para o jogador, e a IA
  continua sem Igreja (**Pergunta 8**).
- **O determinismo:** o sorteio por intervalo precisa sair do RNG da sim, numa ordem fixa (a ordem das
  unidades). A conversão no meio de uma luta muda o alvo de quem lutava com o convertido, e esse ramo
  precisa de teste.
- **A camada temática:** o id neutro é `church` / `priest`, e "Igreja" e "Padre" ficam no tema
  (CLAUDE.md §9).

## Perguntas ao operador (resumo)

1. A torre da igreja fica à esquerda, à direita ou ao centro?
2. O padre converte civil inimigo, ou só militar?
3. Vários padres no mesmo alvo sorteiam juntos (como no AoE2), ou um alvo por padre?
4. A bênção é dano **ou** resistência, fixo, ou o jogador escolhe?
5. O custo e o desbloqueio da Igreja.
6. O padre treina na própria Igreja?
7. A Igreja vai na sub-aba Guerra ou Vila?
8. A IA ganha Igreja e padre, ou fica para depois?
