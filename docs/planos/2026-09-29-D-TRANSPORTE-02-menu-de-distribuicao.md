# D-TRANSPORTE-02 — menu de distribuição

**Item da fila (lote do operador, item 6):** "menu de distribuição". GDD §4 ("reparte
recursos disputados entre consumidores **[fonte]**") e §7.2 ("Aba Distribuição | Sliders
por recurso disputado | P2"). O `BUILD_PLAN.md` não tem aceite escrito; o aceite é o
deste plano.

## A regra no KaM (conferido no fonte, `reyandme/kam_remake` 731a8a4)

- `KM_WareDistribution.pas`: uma tabela por jogador, valor 0..5 por par
  (mercadoria, tipo de casa), só nos quatro recursos disputados:
  - ferro: ferraria de armas 5, de armaduras 5;
  - carvão: fundição de ferro 3, de ouro 5, ferraria de armas 3, de armaduras 3;
  - madeira: oficina de armaduras 2, de armas 5;
  - milho: moinho 4, chiqueiro 5, estábulo 3.
  O par fora da tabela vale 5.
- `KM_Houses.pas: UpdateDemands`: o valor é o **máximo na gaveta de entrada, contando o
  que está a caminho** (`waresMaxCnt - resDelivering`). Baixar o valor retira as
  demandas que ninguém pegou (`TryRemoveDemand`); a carga já pega segue, e o que já está
  dentro da casa fica lá e é consumido (não há "evacuar").

## Os pares aqui (conferido em `production.json`)

Os consumidores de cada insumo com mais de um tipo de predio são os mesmos do KaM:

| mercadoria | consumidores |
|---|---|
| `coal` | `metallurgists`, `iron_smithy`, `weapon_smithy`, `armor_smithy` |
| `corn` | `mill`, `swine_farm`, `stables` |
| `timber` | `armory_workshop`, `weapons_workshop` |
| `iron` | `weapon_smithy`, `armor_smithy` |

## Divisão (§6)

- **D-TRANSPORTE-02a (sim):** o dado, o estado, o comando e o limite na demanda.
- **D-TRANSPORTE-02b (ui):** a aba Distribuição destrancada, com os pares e os botões.

## 02a — a regra

- **Dado** `delivery.json: distribuicao { maximo: 5, padrao: { <mercadoria>: { <tipo>: n } } }`.
  - **PARA REVISÃO:** o padrão é **5 em todos os pares**, e não o padrão do KaM. Com 5, o
    limite nunca fica abaixo do alvo de hoje (a gaveta de entrada é 5, repartida pela
    receita), e a partida não muda de balanceamento até o jogador mexer. Os números do
    KaM ficam no `_doc` do dado para o lote de balanceamento.
  - `validate:data` (`validarDistribuicao`):
    - `maximo` é inteiro >= 1;
    - todo valor é inteiro em `0..maximo`;
    - todo par declarado é insumo real (a mercadoria está no `entra` do tipo);
    - toda mercadoria consumida por dois ou mais tipos está declarada, com todos os
      consumidores. É isso que impede a F24 ou a D-PRODUCAO-01 de criar uma disputa nova
      em silêncio.
- **Estado** `GameState.distribuicao?: { [lado]: { [mercadoria]: { [tipo]: n } } }`. Guarda
  só o que difere do padrão, e o valor igual ao padrão apaga a chave (e o objeto vazio
  some), para o estado continuar comparável byte a byte com o de quem nunca mexeu.
  O campo é opcional para não obrigar todo fixture.
- **Comando** `SetWareDistribution { mercadoria, tipo, quantidade }`, sempre no lado do
  jogador (os comandos do jogador não levam lado). Recusado com `command-rejected`, e o
  estado intacto, quando:
  - o par não está no dado (`par-desconhecido`);
  - a quantidade não é inteiro em `0..maximo` (`fora-da-faixa`).
  O mesmo valor devolve o mesmo objeto de estado.
- **Helper** `sim/distribuicao.ts`: `limiteDeDistribuicao(state, lado, tipo, mercadoria,
  dados): number | null` (`null` fora da tabela), `motivoDaRecusaDeDistribuicao`,
  `comDistribuicao`.
- **Onde morde:** `insumo.ts: demandaDeInsumo` passa a ser
  `min(alvoDeEntrada, limite) - estoque`. O `excedenteNaEntrada` continua contra o
  `alvoDeEntrada` inteiro: o que já está dentro fica (como no KaM), e como limite <= alvo
  as duas contas nunca são positivas juntas, sem vaivém.
  - O saneamento já corta a aberta além da demanda (`grupoDeAbertas` usa
    `demandaNoDestino`, que é `demandaDeInsumo`); a reclamada e a carregando seguem.
    Isso é o `TryRemoveDemand` do KaM, sem linha nova.
- **IA:** nunca emite o comando; os predios dela usam o padrão.

### Testes (`tests/D-TRANSPORTE-02a-distribuicao.test.ts`)

1. O comando grava a diferença e o valor padrão apaga a chave. O mesmo valor devolve o
   mesmo objeto.
2. As duas recusas, com o estado intacto.
3. Limite na demanda: um moinho com a gaveta vazia pede 5 (o padrão); com
   `SetWareDistribution corn mill 2` pede 2; com 0 não pede.
4. Ponta a ponta: com o moinho em 0, o milho do armazém não sai para ele (nenhuma tarefa
   de insumo com destino no moinho), e com o moinho de volta em 5 a tarefa nasce.
5. Baixar o limite com a gaveta cheia não devolve nada ao armazém (excedente zero).
6. A aberta além do limite novo cai no saneamento; a reclamada segue.
7. O lado da IA não é afetado pelo comando do jogador.
8. Determinismo.

Mutação: tirar o `min` de `demandaDeInsumo` derruba 3, 4 e 6.

## 02b — a aba

- Seletor `distribuicaoDaVila(state, dados)`: `{ maximo, linhas: [{ mercadoria,
  consumidores: [{ tipo, valor }] }] }`, na ordem do dado.
- `ui/distribuicao.ts`: destranca a aba (`ABAS_TRANCADAS` fica vazia). Uma seção por
  mercadoria, com o nome do tema; uma linha por consumidor com o nome do predio do tema,
  o valor e os botões `−` / `+` (`data-distribuicao="<mercadoria>|<tipo>"`,
  `data-passo="-1"|"+1"`), que emitem `SetWareDistribution` com o valor ± 1. O botão no
  limite fica desabilitado.
  - **PARA REVISÃO:** botões `−`/`+` no lugar do slider do GDD: o `input range` do browser
    não segue a moldura do HUD, e o gesto de segurar 150 ms (§8) é o mesmo dos outros
    botões.
- Tema: `distribuicao.titulo`, `distribuicao.ajuda`, `distribuicao.menos`, `distribuicao.mais`.

### Roteiro (`tools/shots/D-TRANSPORTE-02.js`)

1. Abrir a aba Distribuição: quatro seções (carvão, milho, madeira, ferro) na ordem do
   dado, todas em 5.
2. Despausado, com o botão seguro 150 ms (§8), baixar o milho do moinho duas vezes: a
   linha mostra 3; o `−` segue habilitado e o `+` também.
3. Captura (evidência, aberta com Read).
4. Subir de volta a 5: o `+` fica desabilitado.

Não-regressão pelo código de saída: D-TELA-01 (a aba vizinha) e F16b.
