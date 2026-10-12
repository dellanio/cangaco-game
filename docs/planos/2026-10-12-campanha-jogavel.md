# A campanha jogável: a missão na sim, o menu e a fase 1 de ponta a ponta

Pedido do operador, 2026-10-12: "Crie uma worktree separada e comece a implementar o planejamento das
campanhas". As respostas dele às três perguntas do relatório de 2026-10-11:

1. **Confirma** os prédios encaixados (Açude e Torre na fase 4, Canavial na 6, Igreja na 9). E pede o
   **ícone da Campanha no menu**, com a imagem gerada pelo Codex.
2. **Aprova** as regras propostas para o que não existia: **capturar** o Vicente (fase 7) é chegar com
   tropa ao lado dele e ficar ali por um tempo, sem ele ter escolta perto; e o **navio** da fase 10 é
   narrativa: a vitória é tomar o forte antes do prazo (o objetivo que o dado da fase 10 já tem).
3. **De acordo** com a ordem: primeiro a fase 1 jogável do começo ao fim (menu, vitória, a fase 2
   liberada), e as outras fases depois, uma a uma.

Branch `campanha-jogavel`, worktree `../cangaco-game-campanha`. O merge na `main` espera a sessão da
Feira terminar (o operador, 2026-10-12).

## 1. O que existe (verificado em `ef391cf7`)

- As dez fases em `data/campanha/fase-NN-<local>.json` (mapa, lados, ondas, objetivos, libera), com
  o tipo em `tools/fase-formato.d.mts`, validadas por `validarCampanha` (`tools/data-rules.js`).
- O teste `tests/I-TERRENO-DEZ-MAPAS-DA-CAMPANHA.test.ts` já monta uma fase na sim, com duas funções
  locais: `dadosDaFase` (o `loadGameData` com o mapa da fase e sem a vila do jogo livre) e
  `estadoDaFase` (os prédios completos e as tropas de cada lado). Elas são a semente do item A.
- O `gameData` é um singleton congelado (`src/sim/data/index.ts`), com o mapa `sertao-128` fixo
  (`src/sim/data/raw.ts:20`). A sim recebe os dados por parâmetro (`step(state, comandos, dados)`), mas
  o render e a UI leem o singleton.
- O menu inicial (`src/ui/menu-inicial.ts`) escolhe a partida antes de o `main.ts` existir
  (`src/inicio.ts:62`, `import('./main')`), e "voltar ao menu" recarrega a página (`src/main.ts:423`).
  Ou seja, uma página joga uma partida só.
- O fim da partida hoje é o da escaramuça (`src/sim/partida.ts`, F34), e só vale com `state.ia`.

## 2. A decisão de arquitetura: o mapa da fase troca uma vez, antes da partida

O mapa vive no `gameData`, e quase todo leitor do render o lê pelos funis (`render/mapa.ts`,
`render/predios.ts`). Pôr o mapa no `GameState` seria refatoração ampla.

O conservador é **escolher os dados da partida uma vez, antes do `main.ts`**, como a escolha da
partida já é feita:

- `src/sim/data/index.ts` passa a exportar `gameData` como **ligação viva** (`export let`) e uma função
  `usarDadosDaFase(fase)`, que troca o singleton pelo `dadosDaFase(fase)` (congelado também).
- Ela só pode ser chamada **uma vez por página e antes do primeiro `step`**. A segunda chamada, com
  outra fase, lança erro. Como "voltar ao menu" recarrega a página, ninguém precisa voltar ao mapa
  de antes.
- `src/inicio.ts` chama a troca entre a escolha e o `import('./main')`. Assim o `main.ts`, o render e
  a UI já nascem lendo o mapa da fase.
- O save de uma partida de fase guarda `state.fase.id`. Ao carregar, a troca acontece antes do
  `main.ts`, pelo mesmo caminho.

## 3. Os itens, na ordem

### A. I-TERRENO-FASE-NA-SIM — a fase vira estado de partida
- `src/sim/fase.ts`: `dadosDaFase(fase, raw)` e `criarFase(fase, dados)`, movidas do teste (as duas
  funções locais passam a importar daqui). `state.fase = { id, numero, ondasDisparadas }`.
- As fases são dado: `src/sim/data/raw.ts` importa `data/campanha/*.json`, e `gameData.campanha` lista
  as fases em ordem, com as durações (`aos_segundos`, `segundos`) convertidas em ticks no carregamento
  pela escala `combate` (CLAUDE.md §5).
- `usarDadosDaFase` (a seção 2).

### B. I-COMBATE-FASE-ONDAS-E-OBJETIVOS — a missão roda dentro do `step`
- **Ondas:** no tick da onda, as tropas dela nascem em volta do ponto `de` (o mesmo jeito de achar
  tile livre do `criarFase`) e vão atacar o prédio do jogador mais perto, pela mesma escolha de alvo da
  IA (`atacarComASobra`, `src/sim/systems/ia.ts:182`: os prioritários primeiro).
- **Objetivos** (o vocabulário do desenho, seção 2), avaliados no fim do tick e gravados uma vez em
  `state.partida`, como a F34:
  - `destruir` (lado, `alvo` prédios ou tropas, ou a lista `predios`): nenhum de pé;
  - `perder` (lado 0, `predios` ou `alvo` tropas): a derrota quando **todos** os listados caíram (o
    conservador: perder um só não encerra);
  - `proteger` (lado, `predios`): a derrota quando **qualquer** um dos listados cai;
  - `prazo` (`segundos`): a derrota quando o tempo passa sem a vitória;
  - `sobreviver` (`ondas`): a vitória quando a última das N ondas nasceu e nenhuma tropa dela está viva;
  - `manter` (`predios`, `segundos`): a vitória quando o prédio fica de pé pelo tempo;
  - `capturar` (lado, `unidade`): a vitória quando uma tropa do jogador fica a 1 tile da unidade, sem
    militar do lado dela a até 3 tiles, por `segundosDaCaptura` (o tempo e os raios em
    `data/campanha.json`; decisão 2 do operador).
  - Vitória exige **todos** os objetivos de vitória; derrota, **qualquer** um de derrota. A derrota
    conta antes da vitória no mesmo tick.
- O `resultadoDaPartida` da escaramuça continua igual. Com `state.fase`, vale o da fase.

### C. I-OBRA-FASE-LIBERA — a fase tranca o que ainda não liberou
- Liberado na fase N: a soma do `libera` das fases 1..N, mais os tipos que o jogador já tem de pé no
  início da fase. O `PlaceBuilding` de um tipo trancado é recusado (`fase-trancada`). A escola e o
  quartel não treinam tropa trancada.
- O menu Build mostra o trancado com o cadeado que já existe para o "ainda não desbloqueado", com o
  motivo "Liberado mais adiante na campanha".

### D. I-ARTE-ICONE-CAMPANHA — o ícone do botão da campanha
- Gerado pelo Codex (`assets/base/ui/campanha/`, derivado `assets/sprites/ui/menu/campanha.png`,
  96x96), com entrada no manifesto. A homologação é do operador.

### E. I-TELA-MENU-DA-CAMPANHA — escolher a fase, jogar e seguir
- Novo jogo ganha **Campanha**, com o ícone. Ela abre a lista das dez fases (número, local, título).
  A fase 1 está sempre aberta. As outras abrem quando a anterior foi vencida, e as fechadas mostram o
  cadeado e não começam.
- Escolher uma fase mostra a narrativa e o desafio dela, com **Começar** e **Voltar**.
- O progresso (as fases vencidas) fica no `localStorage`, chave própria, fora do save da partida.
- No fim da partida, a vitória numa fase grava o progresso e oferece **Próxima fase**; a derrota
  oferece **Tentar de novo**. Dentro de uma partida de fase, os botões de nova partida do jogo
  recarregam a página pelo menu (a seção 2).
- O contador e o objetivo da fase aparecem no HUD numa linha curta (por exemplo, "Destrua o
  acampamento do Cabo Branco"), com o texto em `data/theme-sertao.json`.

## 4. Fora desta leva
- As fases 2 a 10 jogáveis de verdade (balanceamento, a IA do inimigo em cada uma). A mecânica dos
  objetivos já serve a todas, mas só a fase 1 tem roteiro jogado do começo ao fim.
- O mapa maior da fase 8 e o brejo da fase 6 (seção 4 do desenho).
- O inimigo com IA própria (defesa, reposição) numa fase. Na fase 1, a guarda do acampamento só revida,
  e o ataque vem pelas ondas.
- Um módulo `FASE` na lista dos 12: módulo novo é decisão do operador. Os itens usam TERRENO,
  COMBATE, OBRA, ARTE e TELA.
