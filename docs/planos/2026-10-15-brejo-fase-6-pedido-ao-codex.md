# O chão de brejo da fase 6 — pedido ao Codex (2026-10-15)

Decisão do operador (2026-10-15): "Brejo da fase 6 (peça ao Codex chão e arte)". Item `I-TERRENO-BREJO-FASE-6` no
`BUILD_PLAN.md`; tarefa **A22** na fila `docs/planos/2026-10-07-fila-execucao.csv`.

## Por que existe

A fase 6 (Areia, "O brejo", `docs/planos/2026-10-10-campanha-dez-fases.md` §3) é desenhada como **brejo**: verde,
mata densa e dois córregos com peixe, com cana em manchas e a serra a leste. O vocabulário de terreno do jogo tem
seis chãos (`grama`, `campoArado`, `areia`, `agua`, `rocha`, `montanha`) e nenhum é brejo. Hoje a fase usa grama,
mata e córregos, e **lê como caatinga**, não como brejo. O que falta é um chão novo.

## Quem faz o quê

| Parte | Quem | Por quê |
|---|---|---|
| A arte do chão (tiles, variantes, bordas, prévias, validação, homologação) | **Codex** | CLAUDE.md §9: arte só por decisão humana, e a decisão veio |
| `brejo` no vocabulário da sim, na legenda, no tema, na regra de dados e no custo de movimento | **Claude** | `src/sim/` nunca sai daqui (CLAUDE.md §11) |
| A fase 6 regenerada com o brejo | **Claude** | o gerador das fases e o dado são deste lado |

**Ordem:** o Codex pode começar já pelas candidatas e pelas prévias, fora do repositório. A integração no
`assets/manifest.json` e no render só acontece depois de o `brejo` entrar em `TERRENOS_DE_MAPA` (Claude, na leva
seguinte): antes disso a entrada de manifesto sem terreno na sim pode reprovar o `verify`, e a regra é **parar e
registrar, não afrouxar o teste**.

## O que o Codex entrega (a arte)

1. **Chão `brejo`**, 64x64, no mesmo contrato do chão existente (manifesto `tipo: terreno`, `footprint [1,1]`,
   `tamanho [64,64]`, `anchor [0.5,1]`). Estados `padrao`, `v1`, `v2` e `v3`, com o mesmo critério de variantes da
   `grama` e da `areia` (emendam entre si sem costura visível). Pasta sugerida: `assets/sprites/terrain/brejo/`.
2. **Bordas contra a grama**, as 16 máscaras `m0` a `m15`, como a `areia` tem (`borda-grama-m0` ... `m15`): o
   brejo encontra a grama em toda a fase 6.
3. **Como deve ler:** chão úmido e fértil, **verde mais saturado e escuro que a grama de caatinga**, com solo
   molhado e poças rasas MUITO pequenas. Tem de continuar lendo como chão **transitável**, e nunca como `agua`:
   a água é o que bloqueia o passo (`terrain.intransponivel`), e o jogador não pode confundir os dois nos três
   zooms. A mata densa da fase vem das árvores que já existem, não deste chão.
4. **Registro de luz:** a luz única de cima, levemente do sul, sem componente leste-oeste (CLAUDE.md §9), e o chão
   plano em 1,0 exato (o relevo liga por padrão desde 2026-10-15, e a sombra e a luz são neutras no plano).
5. **Prova:** prévia normal e RGB x 0,8 nos zooms 0,5, 1 e 2, sobre a grama e ao lado da água; o validador oficial
   de arte; capturas abertas; imagem base e derivados versionados com origem e hash (CLAUDE.md §9).
6. **Homologação** do operador pendente: a tarefa fica "feito, aguarda homologação" no CSV, como as outras.

**Fora do escopo do Codex:** `src/sim/`, `data/terrain.json`, a legenda do mapa, o gerador das fases, o
`test-results.json` e qualquer push ou merge na `main`.

## O contrato da sim (Claude, na leva seguinte)

Decisão conservadora, porque o GDD e o desenho não dizem o que o brejo faz com o passo e com a obra: **o brejo é só
visual**. Fica transponível e construível, com o custo de movimento da grama (1,3). Se o operador quiser que o
brejo atrapalhe o passo ou a obra, é balanceamento e vai para `BALANCE_LOG.md`.

- `TERRENOS_DE_MAPA` ganha `brejo` **no fim da lista** (a ordem é o código numérico do tile).
- A legenda do mapa, a cor no `theme-sertao.json` e a regra de dados (`tools/data-rules.js`) aceitam o terreno.
- A fase 6 é regenerada com o brejo onde está a mata densa (`x` de 0 a 90 no desenho atual, fora dos córregos e
  da serra). As outras nove fases e o sertão ficam **byte a byte iguais** (`gerar-fases.mjs --conferir`).
- A fase 6 jogada de novo: os alvos A, D e E continuam ok.
