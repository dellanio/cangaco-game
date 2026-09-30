# As quatro hipóteses do avaliador: plano

Fila do operador, item 10. As quatro ressalvas que o avaliador deixou sem conferir
(PROGRESS, "Ressalvas do avaliador, não conferidas pelo autor"). Cada uma é conferida no
código ou no fonte do KaM antes de virar trabalho; só o que se confirmar recebe código.

## Conferência (feita antes do código)

1. **BUG-P (o alvo cercado) perde a ordem de atacar o prédio depois de revidar.** É o
   comportamento do KaM, e está escrito como escolha em `src/sim/systems/combate.ts`
   (`sistemaDoCombate`, ramo `FSM_INDO_ATACAR`/`FSM_ATACANDO`). No fonte (clone 731a8a4):
   `FightEnemy` só guarda a tarefa de atacar a casa (`Phase := 0`) quando o inimigo NÃO é
   guerreiro; contra guerreiro, `FreeAndNil(fTask)` (`KM_UnitWarrior.pas:740-748`), e
   `FindEnemy` só interrompe o ataque à casa por guerreiro (`:716-717`). **Refutada como
   defeito:** fiel ao KaM. Sem código.
2. **C9 (o fim da partida para o jogo) roda ticks a mais no mesmo quadro.** Confirmada na
   leitura: `sessao.passo()` avisa os ouvintes a cada passo, e `acompanharFimDePartida`
   chama `laco.encerrar()` de dentro do passo; mas o `while` de `tique` (`src/laco.ts`) não
   confere `pausado` de novo, e roda até `MAX_PASSOS_POR_QUADRO` (10). O `avancar(n)` tem o
   mesmo furo. A sim grava `partida` uma vez só (`tick.ts`), então o resultado não muda; o
   que anda são até 9 ticks de unidades e economia depois do fim.
3. **C3 (o quartel) solta os recrutas empilhados.** Já coberta: a porta e o empurrão da
   D-MOVIMENTO-01c/01d (colisão dos civis) tiram o empilhamento, e `tests/C3-quartel.test.ts`
   (caso "(b) demolir o quartel com 2 recrutas") afirma "sem empilhar". Sem código.
4. **Em paz, a tela não avisa a ordem recusada.** Já coberta pela C-TELA-01 (a mensagem da
   ordem recusada), `passes: true`, com `tests/C-TELA-01-mensagem-da-ordem-recusada.test.ts`
   pelo `step`. Sem código.

## O conserto do C9 (só `src/laco.ts`: nem sim, nem render)

- `tique`: o `while` para também quando `pausado` virou verdade dentro do passo. O resto do
  acumulado já é descartado pela linha que existe (`acumulado %= tickMs`), então retomar
  depois não vira rajada.
- `avancar`: o `for` para quando `encerrado` virou verdade dentro do passo.

## Aceite (em `tests/C9-fim-para-o-jogo.test.ts`, teste antes do código)

- (d) um passo que encerra o laco no 2º passo de um quadro de 1 s: `tique` devolve 2 e só 2
  passos rodaram; tempo passando depois, nenhum.
- (e) o mesmo pelo `avancar(5)`: 2 passos.
- (f) pausa pedida de dentro do passo também corta o quadro, e retomar depois não despeja o
  resto do quadro velho (no máximo 1 passo por 100 ms decorridos).
- O teste é do laço, sem sim (o laço não depende dela). Sem screenshot: o quadro só deixa de
  rodar passos depois do fim; o `tools/shots/F34.js` continua como não-regressão.
