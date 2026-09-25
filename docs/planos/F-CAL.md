# F-CAL — A calibração medida na abertura

> Plano de implementação do item `F-CAL` do `BUILD_PLAN.md`. O critério de aceite
> é o que está escrito lá; este documento não o reescreve. O que ele faz é
> registrar o que foi **medido antes de escrever código** e quebrar o trabalho em
> dois sub-itens, porque a feature não cabe em uma sessão.

**Por que a feature existe** (decisão do operador, 2026-09-25, ao mergear a
`calibracao-fase-b`): o lote da cadeia de comida foi calibrado em dois cenários que
**não passam pela abertura**. *"É a única medição que ainda falta para dizer que a
Fase B está calibrada, e a caminhada é o termo que pode mudar."*

---

## 1. O que já está medido (sonda de 2026-09-25, apagada; os números ficaram)

Sonda em cima de `aberturaDaFaseA` + `comandosNoTick`, semente do dado, sem
nenhuma linha nova de simulação. **Nada aqui é estimativa.**

| Fato | Medido |
|---|---|
| `farm` desbloqueia | tick **1110** (é quando a serraria completa) |
| `mill`, `bakery` desbloqueiam | **nunca**, na abertura pura — dependem de `farm` e `mill` **construídos** |
| `inn` desbloqueia | tick **1** (pai é o armazém, que já nasce completo) |
| abertura fecha o critério da F17 | tick **3993** |
| ouro no armazém no tick 8000 | **16** (dos 20; a abertura gasta 4 treinos a 1 cada) |
| timber / stone no tick 8000 | **63** / **32**, os dois subindo |
| recusas de comando em 8000 ticks | **0** |
| custo de parede | **117 ms por 1000 ticks** na abertura pura |

**O que estes números decidem:**

- **O cenário é alcançável pelos comandos que já existem.** Não há travamento a
  reportar: `farm` abre no 1110, e `mill`/`bakery` abrem em cascata assim que a
  anterior ficar **completa** — não basta plantar.
- **O orçamento fecha.** Os quatro prédios novos custam **18 timber + 14 stone**
  (`farm`/`mill`/`bakery` 4+3 cada, `inn` 6+5) e os treinos custam **3 de ouro**
  (roceiro + dois padeiros; a Taverna tem `trabalhador: null`). Contra 63 timber,
  32 stone e 16 de ouro disponíveis a partir do tick ~1110, com produção corrente.
  A margem existe, mas **não é folgada em `stone`** se a rua precisar de extensão —
  cada tile de rua custa pedra, paga **à vista**, e `PlaceRoad` é tudo ou nada.
- **O custo de parede é o risco de tamanho.** 117 ms/1000 ticks é a abertura
  **pura**; com mais nove civis, quatro prédios e um campo arado, o número sobe.
  24 000 ticks ≈ 2,8 s hoje; 36 000 ≈ 4,2 s. O orçamento de 10 s dos casos lentos
  (2026-09-25) é o teto a respeitar — **medir por corrida e registrar**, nunca
  afirmar tempo (`CLAUDE.md` §8).

### A geometria disponível (medida no mapa da semente)

- Armazém em **(29,30)**, escola em **(34,30)**, linha de porta / rua em **y=33**,
  rua de **26** tiles: `18..34` em y=33, mais a perna `x=32, y=29..32` e
  `33..37` em y=29 para o grupo da mata.
- Grupo da pedra a oeste: serraria **(15,31)**, pedreira **(19,31)**.
  Grupo da mata acima: lenhadores **(34,27)** e **(37,27)**.
- **Toda a faixa ao sul de y=34 está livre e é arável** de x=10 a x=48, e o mesmo
  vale para x=10..23 nas linhas da vila. Espaço não é a restrição; **a rua é**.

---

## 2. A decisão de desenho que o plano toma, e por quê

> **CORRIGIDO pela sonda, 2026-09-25, depois de escrito.** Este parágrafo dizia
> *"a rua não precisa crescer"* e *"a leste da escola e a oeste da serraria"*. As
> duas metades estavam erradas, e a medição é que disse: **a oeste não há vão**
> (o lajedo bloqueia de x19 a x26, e serraria e pedreira tomam o resto; entre
> armazém e escola sobram dois tiles, e o menor destes quatro prédios tem três de
> largura), e **por isso a rua cresce**, 13 tiles a leste. O que ficou de pé é a
> regra da linha de porta, abaixo. Fica escrito em vez de reescrito: o plano
> supôs, a sonda mediu, e é a sonda que vale.

**Os quatro prédios novos entram ao NORTE da rua que já existe, com a porta na
própria y=33.** Um prédio cuja caixa termina em y=32 tem a porta em y=33 e já está
ligado; ao sul, a caixa começa em y=34 e a porta cai em y=34+altura, **fora** da
rua — precisaria de rua nova em outra linha.

Logo: **as plantas novas ficam na linha de porta y=33, a leste da escola**, que é
o único vão onde elas cabem, e **a rua cresce em linha reta sobre y=33**, um
trecho por prédio, cada um pago à vista quando o prédio já está desbloqueado.
Medido: Roçado em (37,30), Moinho em (41,30), Padaria em (44,30), Bodega em
(47,30); 13 tiles de rua, 13 de pedra.

O campo do roceiro é a exceção de propósito: ele vai **ao sul**, colado à fazenda,
porque `PlowField` não pede rua nenhuma — arar não cobra material e o laborer vai a
pé (F18h). É o único lugar onde "colado" é uma escolha do jogador e não da rede.

> **Nenhuma coordenada é digitada.** As posições saem dos mesmos predicados da sim
> que a abertura usa (`caixaDeTipo`, `recursoBloqueiaConstrucao`, `canPlaceRoad`,
> `canPlowField`), varrendo a linha y=33 a partir das bordas dos grupos. Foi assim
> que a F-T4b tirou a fila de cima do lajedo, e é a mesma regra.

---

## 3. A quebra em dois sub-itens

O item vira **F-CAL-a** e **F-CAL-b** no `BUILD_PLAN.md`. O **critério de aceite
escrito continua sendo o da F-CAL-b, palavra por palavra**; a F-CAL-a é o que ele
pressupõe e que hoje não existe.

### F-CAL-a — a vila da cadeia de comida sobe pela abertura

**Entrega:** `tests/helpers/cal-vila.ts` — a abertura mais Roçado, Moinho, Padaria e
Bodega, os treinos, e o `PlowField` colado à fazenda; e um teste que prova que a
vila **chega lá**: os oito prédios completos, os sete ocupados, o campo arado e
**zero recusa de comando**, dentro de um teto de ticks medido.

**Aceite:** `test-output/F-CAL-cenario.json` com o tick de cada marco e a lista de
recusas vazia. Eixo determinístico (tick e contagem), nunca relógio.

**Tarefas:**

1. **A geometria das quatro plantas novas**, derivada na linha y=33 pelos
   predicados da sim. Teste: as caixas não se cruzam, não pisam em recurso que
   bloqueia, e cada uma tem **uma porta que é tile da rua da abertura**.
2. **A ordem dos comandos reage ao ESTADO, como em `comandosNoTick`**: a fazenda
   só é plantada quando `estaDesbloqueado(farm)`, o moinho quando a fazenda está
   **completa**, e assim por diante. Nada de tick digitado.
3. **O `PlowField`**, com os tiles derivados do footprint da fazenda (colados ao
   sul dela) e validados por `canPlowField` antes de virarem comando.
4. **Os três treinos novos** (roceiro, dois padeiros) enfileirados na escola, com
   o ouro conferido contra `custoOuroPorUnidade`.
5. **O teste do caminho inteiro**, com o teto vindo da sonda + 25 % de folga, do
   mesmo jeito que a F17 fez o dela.

### F-CAL-b — as quatro afirmações do aceite

**Entrega:** o medidor e o teste que afirmam (a) intervalo de entrega da fazenda
dentro de ±10 % do ciclo do moinho, lido do dado; (b) moinho e padaria em
`esperando_insumo` abaixo de 10 % dos ticks; (c) milho nunca acima de 1 no armazém;
(d) nenhuma morte de fome em 36 000 ticks. Mais `test-output/F-CAL.json` com o
tempo do roceiro **por fase**, no formato da tabela de `docs/calibracao-fase-b.md`.

**O termo a comparar** é **ida + volta do roceiro por milho** (~100 ticks nos dois
cenários de lá): é o único que a geometria da abertura pode mudar, e é o motivo de
a feature existir.

**Se falhar:** registrar os três números (longe / vila / abertura) no
`BALANCE_LOG.md` e **não girar `farm.sai.corn` sozinho** — a conta do doc diz qual
termo mudou, e só ele se ajusta.

---

## 4. O que este plano NÃO faz

- **Não mexe em `src/`.** É cenário e medição; zero linha de simulação, como o
  escopo do item já diz. Se algum elo obrigar a mudar a sim, isso **para e vai para
  o operador** — vira bug ou vira decisão, não vira improviso aqui.
- **Não toca `src/render/`, `src/ui/` nem `index.html`.** Não há nota de integração
  no item, e a ordem do operador sobre `src/ui/` e `index.html` continua valendo.
- **Não calibra pedreira, lenhador nem minas.** O próprio item põe isso fora de
  escopo, e a medição de 2026-09-25 já está no `BALANCE_LOG.md`: a proporção 2:1 da
  madeira é o que ficou aberto para o lote 2.
- **Não afirma tempo de parede.** O custo por corrida vai para o JSON de evidência
  como número da corrida, nunca para um `expect` (`CLAUDE.md` §8).

---

## 5. Riscos, nomeados antes de começar

| Risco | Sinal | O que fazer |
|---|---|---|
| A cadeia não fecha em 24 000 ticks porque a abertura consome os 4 000 primeiros | marco `todos-ocupados` tarde demais | é **resultado**, não defeito: registrar a diferença contra os dois cenários de `docs/calibracao-fase-b.md` |
| `stone` não cobre os quatro prédios no tick em que o comando sai | recusa `sem-pedra` no medidor | a ordem reage ao estado: plantar quando **couber**, e registrar o tick |
| O teste estoura o orçamento de 10 s | duração da corrida | dividir as duas janelas (24 000 e 36 000) em **dois casos**, que é o que a F19 já faz |
| A revogação da D6 (2026-09-25) muda os números de referência | qualquer comparação com medida anterior a ela | comparar só com medida re-corrida **depois** da revogação; a de `docs/calibracao-fase-b.md` é anterior |
