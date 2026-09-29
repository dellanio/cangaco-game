# C-COMBATE-01a — formação e virar (sim)

Lote do operador de 2026-09-29, item 11. O C-COMBATE-01 sai em três partes:

- 01a, formação e virar, na sim (este plano);
- 01b, storm attack, na sim;
- 01c, os controles, na tela.

A quebra e a nota da §10 estão no item, no BUILD_PLAN. Nenhum dos três é feature de
integração.

## O comando

`MoveUnits` ganha dois campos opcionais: `colunas?: number` e `direcao?: number` (0..7, a
mesma rosa de `Unidade.direcao`).

- **`direcao` ausente:** a do primeiro da lista até o destino (`direcaoEntre`). No mesmo
  tile, a direção atual dele.
- **`colunas` ausente:** ⌈√n⌉, um bloco quase quadrado. PARA REVISÃO: o KaM guarda o valor
  no grupo, e a nossa sim não tem grupo persistente.
- **`colunas` fora do intervalo:** um inteiro abaixo de `formacao.colunasMin` ou acima de n
  se prende ao intervalo. `colunasMax` é `"tamanhoDoGrupo"`, e o loader já tem esse valor.
- **Recusas.** `direcao` que não é inteiro de 0 a 7, e `colunas` que não é inteiro, recusam
  o comando INTEIRO com os motivos novos `direcao-invalida` e `colunas-invalidas`.

## O desenho da formação (`tilesDaFormacao`, puro)

- `f` é o passo da direção e `r` o passo de `direcao + 2`, a direita de quem olha para `f`.
- O homem `i` fica na fileira `i ÷ c` e na coluna `i mod c`.
  - O deslocamento é `(coluna − ⌊(w − 1) / 2⌋)·r − fileira·f`, onde `w` é quantos homens
    a fileira tem. A última fileira, incompleta, também fica centrada.
  - A fileira 0 é a da frente, e o centro dela cai no destino.
- **Tile que não serve:** fora do mapa, não andável ou já tomado. Ele cai no primeiro tile
  livre dos anéis em volta dele, pelo mesmo critério de `tilesDoGrupo`. Nunca empilha
  enquanto houver tile.
- A `tilesDoGrupo` continua como está: a IA a usa para as posições (C-IA), e a mudança é
  só do `MoveUnits`.

## A virada ao chegar

- `fsmData.direcaoFinal?`: quem chega ao `alvoTile` fica ocioso e virado para ela.
- Quem já está no tile vira no primeiro passo do sistema.
- "Virar sem mover" é `MoveUnits` com o destino no tile do líder, o primeiro da lista, e a
  nova `direcao`. O líder fica e vira; os outros vão aos tiles da formação nova.

## Testes (`tests/C-COMBATE-01a-formacao.test.ts`)

1. **Tabela pura.** 6 homens, `colunas` 3, virados para o sul (4), no meio do mapa limpo:
   duas fileiras de 3, a da frente centrada no destino e a de trás atrás dela (ao norte).
   Para o leste (2), a mesma forma girada.
2. **Prender.** `colunas` 0 vira 1 (uma coluna, fila indiana) e `colunas` 99 com 5 homens
   vira 5 (uma fileira). Os valores 1,5 e -3 recusam, como a `direcao` 8.
3. **Pelo `step`.** 6 soldados marcham com `colunas` 3 e `direcao` 2 até parar:
   - cada um fica no seu tile da formação e ocioso, com `direcao` 2;
   - nenhum tile repete.
4. **Virar sem mover.** O mesmo grupo, com o destino no líder e `direcao` 6:
   - o líder não sai do tile;
   - todos acabam virados para 6;
   - a formação é a de 6.
5. **Obstáculo.** Com um tile do desenho sem andar, ninguém fica nele, ninguém empilha e
   todos param.
6. A evidência vai em `test-output/C-COMBATE-01a.json`.

**Não-regressão:** F26a (marcha), C5 (colisão militar), C6 (revidar marchando),
C-COMBATE-02 (cerca da paz), C-TELA-02 (marcador de destino) e C-TELA-04 (atacar unidade).
Se algum afirmar os tiles do anel antigo, é a asserção da regra velha: ela é trocada pela
da formação e fica registrada.

## PARA REVISÃO

- `colunas` ausente vale ⌈√n⌉.
- Quem revida marchando (C6) e retoma a marcha perde a `direcaoFinal`: o `retomarMarcha`
  guarda só o tile.
- Em paz, a cerca confere só o destino. Um homem da formação pode cair fora dela, como já
  acontecia com o anel.
