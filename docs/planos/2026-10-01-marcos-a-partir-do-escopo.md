# Marcos a partir do ESCOPO (leva desatendida 2, item 7) — só leitura

Pedido do operador: a partir do `docs/ESCOPO.md` (`bfd6fd5`), (1) os marcos que existem, com a
definição de pronto citada; (2) os itens sem marco; (3) 2 ou 3 candidatos a próximo marco, com o
que falta para cada um. **Não escolho.** Nenhum código, dado ou aceite mudou por causa deste
documento.

**Fontes:**
- o `docs/ESCOPO.md` é uma foto da `main` em `43c6a80`;
- as linhas e o estado abaixo foram **reconferidos na `main` de agora** (`02aa604`), em
  `BUILD_PLAN.md`, `test-results.json` e `BUGS.md`.

Onde a foto ficou velha, digo.

---

## 1. Os marcos que existem, e a definição de pronto

Só **um** marco tem definição de pronto escrita: a Fase A.

| Marco | Definição de pronto, citada | Onde | Estado |
|---|---|---|---|
| **Fase 0 — Fundação** | **nenhuma** para a fase. Só os aceites de F01–F04 | `BUILD_PLAN.md:25` | 4 de 4 com chave |
| **Fase A — Loop de construção jogável** | "partindo do estado inicial, o jogador consegue, só com o mouse, construir 2 Woodcutter's, 1 Quarry e 1 Sawmill conectados por estrada, treinar os trabalhadores e ver o estoque subir. Nenhum prédio surge sem clique do jogador." Quem prova é a F17 (aceite da Fase A) | `:70-73`; F17 em `:748` | **fechada** |
| **Fase B — Comida e crescimento** | **nenhuma**: a seção começa direto nos itens | `:1074` | itens com chave; F-CAMPO-b e F-REPL-c abertos |
| **Fase C — Militar** | **nenhuma** | `:5059` | itens com chave; B-TERRENO-01 aberto |
| **Fase D — Profundidade** | **nenhuma** | `:5583` | itens com chave; D-TELA-CHAO-DETERMINISTICO aberto |
| **Fila C** (dez itens) | nenhuma como marco: é uma lista | `:5917` | 10 de 10 |
| **Fila da primeira partida** | nenhuma: a origem diz "o operador jogou a escaramuça … e trouxe o que impede jogar" (`:6270`), sem um critério de "partida jogável" | `:6269` | 11 de 11 |
| **Segunda partida** | nenhuma: mesma forma da anterior | `:6348` | 4 de 4 problemas; VARREDURA-KAM "sem posição na fila" |

Regra de ordem entre marcos: só "Fase A inteira antes de qualquer item da Fase B. Sem exceção."
(`:6607`).

**O que mudou desde a foto do ESCOPO:**
- **BUG-T (tropa travada)** foi fechado e saiu do `BUGS.md` (`3a470f2` e `4b331d5`);
- **D-TELA-LUZ-RELEVO** e **D-TERRENO-ALTURA** entraram na `main` por fast-forward, com o relevo
  desligado por padrão: ligar "espera a arte de terreno da F-TR";
- **D-TELA-05e (mercenários em 8 direções)** foi entregue nesta leva (`2d005c2`);
- **D-TELA-CHAO-DETERMINISTICO** é item novo e está **parado**: a medida contradiz a premissa
  (`387d65a`);
- **C-COMBATE-CUSTO-ENCOSTADO** está no "Backlog com gatilho" (`:6569`).

## 2. Itens sem marco

Como só a Fase A tem definição de pronto, todo item aberto está sem marco. Na `main` de agora:

| Item | Estado | Depende de |
|---|---|---|
| B-TERRENO-01 (recentrar a vila) | aceite escrito; "depois da Fase C por decisão do operador" | nada além da ordem |
| F-CAMPO-b (o desenho da cultura) | o título da F-CAMPO diz "não implementar antes do sim do operador" | o sim, e a arte |
| F-REPL-c (plantar em tile vazio) | "ADIADO … volta se alguém sentir falta" | decisão |
| F-TR, o resto (esgotado por tipo: pousio ≠ lajedo cavado) | "continua aberto"; sem aceite próprio | aceite |
| D-TELA-CHAO-DETERMINISTICO | parado: o chão é determinístico na amostra; o que muda é a câmera e o tick dos roteiros | decisão (o objetivo vira "captura determinística"?) |
| Ligar a luz de relevo por padrão (D-TELA-LUZ-RELEVO) | "espera a arte de terreno da F-TR" | arte |
| D-MOVIMENTO-01e (aceite da colisão civil) | "MEDIDO, NÃO FECHA" (`:6048`); a D-MOVIMENTO-01 está "FECHADO DESLIGADO, DEFINITIVO" (`:6066`) | decisão |
| SISTEMA DE FASES (a campanha do Piancó em dado) | "SIGLA A DEFINIR pelo operador" (`:6154`) | sigla e módulo novo |
| o grupo que mata o alvo procura o próximo inimigo | "Proposta, não na fila (decisão do operador)" | decisão |
| VARREDURA-KAM | "sem posição na fila"; as frentes 1–4 e 4b já estão no documento | qual frente falta |
| C-COMBATE-CUSTO-ENCOSTADO | backlog; gatilho: "antes de qualquer feature que aumente o número de unidades em jogo" | o gatilho |

Fora do `BUILD_PLAN.md`, e por isso sem marco nem id:
- as Levas 1 a 3 do plano de animação (`docs/planos/2026-09-30-animacao-direcional-de-unidades.md`);
- o agrupamento de matas no gerador.

**Lacunas do GDD sem item** (ESCOPO §3, conferido que continuam sem item): névoa de guerra (§6.5),
áudio (§9.8), feedback sonoro e visual (§10), Halt / Split / Link da tropa (§2.4) e o teclado
proposto (§2.2).

## 3. Candidatos a próximo marco (não escolho)

Os três são da mesma forma da Fase A: uma frase que diz o que o jogador consegue fazer, e um teste
de integração que a prova. Para cada um: o que já existe e o que falta.

### Candidato A — "Uma partida de escaramuça se joga de ponta a ponta"
- **Uma definição possível**, no molde da Fase A: partindo da escaramuça, o jogador, só com mouse e
  teclado, levanta a economia, treina e equipa a tropa, vence a IA (F34) e vê o fim da partida, sem
  nenhuma intervenção de fora.
- **Já existe:**
  - a escaramuça (C-IA-03a/b/c), com paz, tropas e a IA com economia (C-IA-02a/b/c);
  - vitória e derrota (F34);
  - o roteiro que joga pela tela (C-IA-03c) e a "partida inteira" headless (C-IA-03b, na suíte
    longa).
- **Falta:**
  - a frase escrita como definição de pronto, e um teste de integração que parta do estado
    inicial do **jogador** (a C-IA-03b começa com a tropa pronta, e não com a economia);
  - a IA usa andaime (os atacantes da C-IA-04);
  - o grupo que procura o próximo alvo está fora da fila.
  - **Pergunta 2 do ESCOPO.**

### Candidato B — "A campanha do Piancó: a primeira fase jogável"
- **Uma definição possível:** a fase 1 da campanha carrega do dado, com objetivo, permissões e fim
  próprios, e se joga do início ao fim.
- **Já existe:** a menção no plano (`:290-293`, `:1117-1126`), o
  `pianco-campanha-10-missoes.md` na raiz e o cenário de escaramuça, que se declara provisório
  (`:6127`).
- **Falta:**
  - a sigla e o módulo novo do sistema de fases (`:6154`), que são decisão do operador;
  - a definição do que é uma fase em dado;
  - a segunda cidade, que pede o B-TERRENO-01 (recentrar a vila).
  - **Pergunta 3 do ESCOPO.**

### Candidato C — "O jogo se lê sem placeholder no que o jogador vê sempre"
- **Uma definição possível:** numa partida da Fase A e da escaramuça, terreno, prédios e unidades
  na tela são arte, e não o retângulo do §9; a luz de relevo liga por padrão.
- **Já existe:** a arte de 23 tipos de unidade e de vários prédios, o pipeline de arte
  (`skills/pianco-art-pipeline/SKILL.md`), a F-TR e o relevo pronto (atrás da flag).
- **Falta:**
  - a arte de terreno da F-TR (de que o relevo depende), a dos mercenários e a do ocioso;
  - a F-CAMPO-b;
  - uma medida do que ainda é placeholder numa partida (não existe hoje).
  - **Arte só entra por decisão humana** (CLAUDE.md §9).

As três dependem de decisão sua antes de virar item: a definição de pronto, e no B a sigla.
