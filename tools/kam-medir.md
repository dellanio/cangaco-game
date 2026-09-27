# tools/kam-medir.js — medida de referência do KaM original

**O que é.** Um leitor que abre, **no lugar**, os binários de uma instalação do
*Knights and Merchants* original e imprime **números**:

- `houses.dat`: produção, ritmo e custo de cada prédio;
- `unit.dat` e `units.rx`: o tamanho do sprite do serf, do lenhador e do fazendeiro;
- `houses.rx` e `trees.rx`: largura, altura e pivot do sprite de cada prédio pronto e de
  cada árvore adulta.

Dos `.rx` ele lê **só o cabeçalho** de cada imagem (largura, altura, pivot). Os pixels são
pulados sem serem lidos.

**Para que serve: MEDIR, não importar** (decisão do operador, 2026-09-27). Quando surge
uma dúvida de comportamento ou de proporção do original, este leitor responde com um
número em vez de wiki. Duas regras valem sempre:

- **Nenhum dado, arte ou arquivo do KaM entra no repositório.** Não se commita saída
  bruta, sprite, pixel nem binário. Não se aponta o jogo para dentro de `assets/`.
- **O que entra é o número medido, com a fonte anotada.** Números de balanceamento vão
  para o `BALANCE_LOG.md`, números de proporção para o `docs/BRIEF-ARTE.md`. A fonte
  diz "lido de `<arquivo>` com `tools/kam-medir.js`".

**Precisa do jogo original instalado.** Nada aqui funciona sem ele, e o repositório não
traz cópia. A instalação do operador fica em
`D:\SteamLibrary\steamapps\common\Knights and Merchants Historical Version`, e dela o
script lê:

- `data/defines/houses.dat`, `unit.dat` e `mapelem.dat`;
- `data/gfx/res/houses.rx`, `units.rx` e `trees.rx`.

**O lote e a árvore adulta vêm do kam_remake.** O lote 4×4 de cada prédio não está no
`houses.dat` de um jeito legível: o campo `BuildArea` do binário não é a área, e o
remake não o lê. A espécie de árvore adulta também não está no binário. As duas coisas
vivem em tabelas do código do
[kam_remake](https://github.com/reyandme/kam_remake): `PlanYX` em `KM_ResHouses.pas` e
`CHOPABLE_TREES` em `KM_ResMapElements.pas`.

O script **não copia essas tabelas**. Com `--remake <pasta>`, ele as lê de um checkout
do remake e acha `KM_ResTypes.pas`, `KM_ResHouses.pas` e `KM_ResMapElements.pas` por
nome, em qualquer subpasta. Sem `--remake`, o lote e as árvores saem `null`.

```bash
node tools/kam-medir.js "D:/SteamLibrary/steamapps/common/Knights and Merchants Historical Version" \
  --remake ../kam_remake --saida "$TEMP/kam.json"
```

A saída vai para fora do repositório (`--saida`) ou para o terminal.

**Como os números se leem:**

- O tile do KaM tem **40 px** (`CELL_SIZE_PX`).
- O sprite do prédio se mede a partir do canto superior esquerdo do tile de origem
  (`aLoc`). A imagem ocupa `[pivotX, pivotX + w] × [pivotY, pivotY + h]`.
- O lote é a caixa das células não nulas do `PlanYX`. A célula `[I, K]` cai no tile
  `aLoc + (K − 3, I − 4)`, em base 1.
- `transborda*Px` é quanto o sprite passa do lote em cada lado. Um valor negativo quer
  dizer que ele fica para dentro.
- O ritmo sai em ticks do KaM. Que o tick valha 100 ms é **hipótese**, apoiada só no
  comentário de `CORN_AGE_1` no remake.

**Layout conferido.** O tamanho de cada `.dat` é comparado com o layout antes da
leitura, e o de cada `.rx` tem de fechar byte a byte. Um arquivo de outra versão
reprova com mensagem; o script não devolve número errado. Os deslocamentos de cada
campo estão comentados no script, com o arquivo do remake de onde vieram.
