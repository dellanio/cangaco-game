# C-COMBATE-01c — os controles de formação (tela)

Fila do operador, item 2. O critério do BUILD_PLAN: sobre a seleção da C-TELA-03, no painel do
grupo:
- "+/− colunas" manda `MoveUnits` com `colunas` e com o destino no líder;
- segurar o botão direito e soltar numa direção manda `direcao` (GDD §controles);
- o botão Storm manda `StormAttack`.
- A tela guarda as `colunas` da seleção, porque a sim não tem grupo persistente.

Herda da C-COMBATE-01a: os textos de `direcao-invalida` e `colunas-invalidas`. Herda da
C-COMBATE-01b: `StormAttack` em `ORDENS_MILITARES`, o texto de `sem-infantaria-corpo-a-corpo`,
e a tela não fingir que a ordem pegou em quem está em carga.

Toca `src/ui`, `src/input`, `src/render/scenes/WorldScene.ts` (um `pointerup`), `src/main.ts`
e `data/theme-sertao.json`. **Não toca `src/sim/`**: a §10 não se aplica.

## O desenho

1. **`src/ui/formacao.ts`** (novo, puro, lê o estado e devolve comando):
   - `direcaoDoArrasto(de, ate)`: a direção 0..7 do vetor em px de mundo, por
     `direcaoAproximada` da sim; `null` abaixo de `LIMIAR_DA_CAIXA_PX` (o mesmo limiar da
     caixa: px de tela, não número de jogo).
   - `colunasAtuais(guardadas, n)`: as guardadas, ou a padrão da sim (`colunasDaFormacao`).
   - `colunasAjustadas(guardadas, delta, n)`: `colunasDaFormacao(atual + delta)`, presas no
     mesmo intervalo da sim.
   - `ordemDeFormacao(estado, grupo, colunas)`: `MoveUnits` com o destino no tile do líder,
     `direcao` = a do líder (virar sem mover não muda a frente) e `colunas`.
   - `quemAceitaOrdem(estado, grupo)`: tira quem está `em_carga` incontrolável.
   - `podeCarregar(estado, grupo)`: alguém da lista `carregaNaInvestida` e não está em carga.
2. **O botão direito** passa a mandar a ordem ao SOLTAR, não ao apertar:
   - `input/colocar.ts`: com a mão vazia, `aoClicarDireito` guarda o tile e o ponto, e devolve
     `false` como antes. Com ferramenta, larga a ferramenta na hora, como antes.
   - O `aoSoltarDireito(ponto)` novo chama `aoOrdenar(tile, ponto, fim)`, e `fim` é o ponto
     de soltura. `aoSairDoMapa` cancela o gesto, como cancela a caixa.
   - `WorldScene`: o `pointerup` do direito chama `aoSoltarDireito`. Nenhum roteiro existente
     aperta sem soltar; todos já fazem down/150 ms/up ou `click`.
   - `main.ts`: `direcao = direcaoDoArrasto(ponto, fim)`. Com direção, ou com colunas
     guardadas, os campos vão no `MoveUnits` do botão direito (`ordemDoBotaoDireito` ganha um
     parâmetro opcional `formacao`).
   - Arrasto curto: sem `direcao`, como hoje (a sim usa a do líder até o destino).
   - Ataque (unidade ou prédio sob o ponteiro): o arrasto é ignorado.
3. **Quem está em carga** sai do grupo de `ordemDoBotaoDireito` (e do +/−). Se só há gente em
   carga, não sai comando nem marcador de destino.
4. **O painel do grupo** ganha:
   - uma linha "‹−› N por fileira ‹+›", com N das colunas atuais. O +/− manda
     `ordemDeFormacao` e guarda o valor.
   - o botão Investida (o Storm, nome no tema). Manda `StormAttack` com o grupo, e fica
     desabilitado sem `podeCarregar`.
   - As colunas guardadas zeram quando a seleção muda (outro grupo, outro assunto; PARA
     REVISÃO: o KaM guarda no grupo, que aqui não existe).
   - Os nós continuam nascendo uma vez (BUG-B); `atualizar` só troca texto e `disabled`.
5. **O aviso de ordem** (`ui/aviso-de-ordem.ts`):
   - `StormAttack` entra em `ORDENS_MILITARES` (a paz recusa o storm, C-COMBATE-01b);
   - `textoDaRecusa` ganha `sem-infantaria-corpo-a-corpo`, `direcao-invalida` e
     `colunas-invalidas`, com texto em `theme-sertao.json` (`ordem`).
   - `recusaDaPaz` segue só com a paz: é ela que apaga o marcador da C-TELA-02.

## Aceite

`tests/C-COMBATE-01c-controles.test.ts` (headless):
1. `direcaoDoArrasto`: os 8 octantes pelo vetor, e `null` abaixo do limiar.
2. `colunasAjustadas` sobe e desce 1 e prende em `[colunasMin, n]`; sem guardadas, parte da
   padrão da sim.
3. `ordemDeFormacao` manda `MoveUnits` com o destino no líder, a direção do líder e as
   colunas. Na escaramuça, rodando a sim, os 18 param em fileiras de N.
4. `ordemDoBotaoDireito` com `formacao` põe `direcao`/`colunas` só no `MoveUnits`; quem está
   em carga fica de fora, e só gente em carga dá zero comando e nenhum marcador.
5. O gesto: `aoClicarDireito` de mão vazia não ordena; `aoSoltarDireito` ordena com o ponto
   de soltura; `aoSairDoMapa` no meio cancela. Com ferramenta, larga e não ordena.
6. `textoDaRecusa`: o storm em paz dá o texto da paz; os três motivos novos dão o texto do
   tema.

Roteiro `tools/shots/C-COMBATE-01c.js` (despausado, com down/150 ms/up, §8):
- pega os 18 pela caixa;
- aperta "+" duas vezes: o painel mostra 7 por fileira, e os 18 param em fileiras de 7;
- arrasta o botão direito do destino para o leste: os 18 param virados para o leste;
- aperta Investida: os 18 entram `em_carga`.

Não-regressão:
- os roteiros C-TELA-01, C-TELA-02, C-TELA-03, C-TELA-04, F26b, F06 e C-IA-03c, pelo código
  de saída;
- `npm run verify`.
