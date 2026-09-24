# Bugs abertos

Só o que está aberto. Bug corrigido **sai deste arquivo no mesmo commit que o
corrige** — o histórico do git é o arquivo morto. Isso mantém o arquivo curto e
barato de carregar em toda sessão.

Registre com `/bug` ou edite à mão. Se não souber a feature, escreva `?`.

**Severidades e o que cada uma provoca:**
- `trava` — interrompe a fila do BUILD_PLAN; é a próxima coisa a ser feita.
- `errado` — vira a chave da feature para `false` em `test-results.json`.
- `feio` — vai para `## Polimento` e não bloqueia nada.

---

## Modelo

```markdown
## BUG-000 — resumo em uma linha
- feature: F##-nome
- severidade: trava | errado | feio
- repro: repro/AAAA-MM-DD-x.json (semente, tick)
- esperado: o que a regra diz que deveria acontecer
- observado: o que aconteceu
- evidência: screenshots/bug-000.png
- status: aberto
```

---

## Abertos

## BUG-F — prédio e estrada aceitam ser postos em cima de recurso natural, e o recurso continua sendo colhido por baixo
- feature: F06-placement (prédio) e F-T2b-obstaculo (estrada) — mas **nenhum aceite escrito quebra**: `canPlace` é de antes de existir camada de recurso (F-T2a), e o aceite da estrada só fala do que fecha o passo. É **lacuna de aceite**, não critério violado; qual chave virar (se alguma) é decisão do operador.
- severidade: `errado`
- relato: operador, jogando, 2026-09-24.
- repro: sem arquivo — é o estado inicial, `createInitialState(1)`. Âncoras medidas abaixo.
- esperado: indefinido no GDD e no BUILD_PLAN. As duas leituras possíveis (recusar / permitir-e-consumir) estão em aberto e **a escolha é do operador** — por isso este bug está registrado, não corrigido.
- observado (medido, não inferido):
  1. **É alcançável no mapa de abertura, com tipo já desbloqueado.** Das posições que `canPlace` aceita: `schoolhouse` **14038** aceitas, das quais **37** cobrem rocha, **706** cobrem árvore e **214** cobrem milho; da `quarry`, **30** cobrem rocha (exemplo: âncora `22,28` cobre o tile de rocha `24,29`) — dá para pôr a pedreira em cima do lajedo que ela veio lavrar.
  2. **Estrada tem o mesmo buraco, com um recorte.** `canPlaceRoad` aceita os **13** tiles de rocha transponíveis e os **130** de milho; recusa árvore (motivo `recurso`, via `recursoBloqueiaPasso`) e peixe (motivo `terreno`, porque é água). Dos 311 tiles de rocha do mapa, só 13 são de terreno transponível — os outros 298 já caem em `terreno`, e é por isso que o buraco parecia menor do que é.
  3. **O que a construção faz com o recurso: nada.** Das três hipóteses do relato, é a terceira. O recurso **continua lá e continua sendo colhido por baixo do prédio e por baixo da estrada**. Medido com a pedreira sobre o lajedo: os 4 tiles de rocha sob o próprio footprint dela entram na lista de colheita dela, e em 900 ticks a saída é **idêntica** nos três casos — sem nada por cima, com estrada por cima e com obra por cima: tile 15 → 10, 5 `stone` entregues. Nada é consumido e nada se perde.
  4. **Efeito colateral já visível:** o prédio deixa o tile **não-andável** enquanto ele segue na lista de colheita (medido: `andavel: false`, tile na lista `true`). Hoje é inofensivo porque o especialista não sai do prédio; **vira travamento na F-T3**, quando ele passar a andar até o tile.
- evidência: medições desta sessão, por sonda temporária (`tests/zz-probe-bug*.test.ts`, apagadas — sonda é evidência de sessão, não cobertura). Números transcritos acima.
- **decisão de desenho pendente** (é o que bloqueia a correção, não o código):
  - **recusar**: motivo próprio em `canPlace` (na ordem, junto de `terreno`, que é a outra recusa sobre o chão) e o mesmo motivo em `canPlaceRoad`, que já tem `'recurso'` de pé — seria alargar o predicado, não conceito novo.
  - **permitir e consumir**: exige retorno antes do clique (a prévia da F-TP é o lugar) e resolve o item 4 apagando o recurso.
  - **o que as duas precisam decidir junto**: a regra não pode ser "todo recurso". Milho é tile que o jogador plantou, e o campo em pousio continua sendo recurso com `quantidade: 0` — recusar construção sobre pousio seria proibir construir onde já se plantou uma vez. O recorte tem de vir de `resources.json` por tipo (uma bandeira ao lado de `bloqueiaPasso`), não de lista escrita em `.ts`.
- status: aberto — **investigado e medido, não corrigido** (o relato pediu nesta ordem)

---

## Polimento

### BUG-D — terceiro teste de tempo da mesma classe: o teto da F-T1 oscilou

- feature: F-T1-terreno-base
- severidade: feio (nao bloqueia: `npm run verify` na corrida seguinte deu 0)
- observado: `tests/F-T1-terreno.test.ts > a busca curta com terreno nao custa
  mais que o teto contra o mapa liso` falhou com **2,8899 contra teto 2,5** numa
  corrida de `npm run verify`; **isolado, o mesmo teste passa** (14/14, 547 ms).
  Medido em 2026-09-24.
- e a **mesma classe** de `tests/F17c-buffer.test.ts` e `tests/F09-sistema.test.ts`
  (razao/tempo medidos em maquina compartilhada), entao vale a regra do operador
  escrita abaixo: **teto mais largo com o numero medido no comentario, nunca
  `skip`, nunca reduzir a carga**. Nao apliquei ainda porque a regra nomeia os
  dois testes de la, e este e um terceiro caso — o alargamento e uma linha e cabe
  em qualquer sessao que o veja falhar de novo.

### BUG-E — a razao de RELOGIO da F-T2b não tem patamar: alargar o teto não resolveu

- feature: F-T2b-obstaculo
- severidade: `feio` (não bloqueia — o teto está largo o bastante para `npm run verify`
  passar; o que segue aberto é a pergunta de desenho no fim)
- observado: `tests/F-T2b-obstaculo.test.ts > busca curta: o corredor limpo custa o
  mesmo, com ou sem floresta` reprovou com **4,7387**, depois **4,9684** e depois
  **8,7852** contra `RAZAO_TEMPO_MAXIMA`. Medido 2026-09-24.
- **mitigação aplicada (2026-09-24)**: teto do relógio 2,5 → 8,0 → **14,0**, com todos os
  números medidos no comentário, como manda a regra do operador abaixo. **Nunca `skip`,
  nunca carga reduzida**: as 400 buscas curtas continuam 400.
- **por que uma entrada e não um bug fechado**: alarguei para 8,0 e a corrida seguinte
  reprovou com 8,7852. O valor **não oscila em torno de um patamar** — ele não tem
  patamar. Quatro corridas do arquivo **sozinho** (`test-output/F-T2b.json`) mostram a
  causa: `noLiso` varia **8,8 / 15,7 / 23,4 / 24,3 µs** e `comFloresta` **7,2 / 7,4 / 9,5 /
  15,6 µs`**. É razão entre duas medidas independentes de ~10 µs; isolada ela dá **0,32 a
  1,00**, abaixo de 1, e na suíte morna estoura. Qualquer teto novo é palpite sobre ruído.
- **o que NÃO está em risco, e foi conferido**: o eixo determinístico do mesmo teste,
  `RAZAO_NOS_CURTA_MAXIMA`, não foi tocado e deu **4,0000 contra 4,2175 nós — razão 1,054
  idêntica nas quatro corridas**. A proteção permanente deste eixo é essa; o relógio é
  evidência de sessão.
- **pergunta para o operador** (é o que sobra em aberto): um eixo sem patamar deve
  continuar sendo **asserção**? A alternativa é ele virar **número registrado** em
  `test-output/F-T2b.json`, sem `expect`, com a contagem de nós como único guarda — o que
  **não** é desativar verificação (a verificação determinística fica), mas é mudança de
  desenho de teste, e por isso não fiz por conta própria. Vale também para o BUG-D.
- status: aberto — mitigado, não resolvido

### A regra dos dois testes de tempo (decisão do operador, 2026-09-23)

São dois casos da mesma classe — medição de tempo em máquina compartilhada:
`tests/F17c-buffer.test.ts` (este) e `tests/F09-sistema.test.ts:429`
(`cargaComMuitasObras`, que foi o BUG-001, corrigido e fora deste arquivo desde
`839c5ad`).

**Se qualquer um dos dois voltar a oscilar, a correção é orçamento mais largo com
o número medido escrito no comentário — nunca `skip`, nunca reduzir a carga.**
Reduzir a carga troca o sintoma pela cobertura: a carga é o que o teste existe
para exercer. É o §10 do CLAUDE.md, e é o que já foi aplicado no F09: orçamento
explícito de 20 s, com "mede 3,5 s isolado e ~3,6 s na suíte morna" no
comentário, dando ~5x de folga.

**A separação que importa:** a proteção permanente da F17c é a **contagem de
alocação** (`estatisticasDoRascunho().alocacoes`), que é determinística e roda em
todo `npm run verify`. A medição de tempo é **evidência da sessão** — ela mostra
que a regra valia naquela corrida, não que continua valendo. Quando um dos dois
oscilar, é a evidência que se ajusta; a proteção não se toca.

**Aplicada na F17c em 2026-09-24, e o BUG-003 saiu daqui com ela.** A oscilação
voltou e desta vez a mensagem foi capturada: quem caiu foi o **teto da razão**
(3,0599 contra `RAZAO_MAXIMA = 3.0`), não o timeout — exatamente a hipótese que o
BUG-003 dava como improvável. Teto alargado para 5,0 com os quatro números
medidos escritos no comentário de `tests/F17c-buffer.test.ts`. Resta o F09 sob a
mesma regra.
