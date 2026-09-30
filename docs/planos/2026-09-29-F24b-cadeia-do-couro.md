# F24b — A cadeia do couro no mapa emitido: plano

Lote do operador (2026-09-29), item "F24, o que resta: a cadeia de couro". O item F24 do
BUILD_PLAN não tem aceite escrito para o couro; a F24a (armas) fechou o resto. O aceite é o
deste plano.

## A sonda veio primeiro (como na D-PRODUCAO-01a)

`tests/zz-sonda-couro.test.ts` (apagada antes do commit): a cadeia da carne
(`cenarioDaCadeiaDaCarne`: fazenda, Malhada, açougue, armazém, bodega) mais um Curtume e
uma Casa do Gibão com rua até o armazém, e 20 de madeira no armazém. Em 20 000 ticks:

- a Malhada faz bode **e** couro no mesmo ciclo (tick 3309);
- o couro vai ao armazém e ao Curtume (3416); o couro curtido nasce no Curtume (4015);
- ele chega à Casa do Gibão (4162), que faz gibão e escudo (4461), e os dois chegam ao
  armazém (4474 e 4524);
- no fim, 20 gibões e 20 escudos no armazém, limitados pela madeira, e 9 de couro curtido
  sobrando.

A cadeia fecha **sem código novo**: colheita, produção genérica (F15a), tarefa de insumo
(F15b), a gaveta de duas saídas da Malhada (F19). O que se entrega é o GUARDA.

## O KaM (conferido no fonte, clone 731a8a4)

- Curtume: `Input wtSkin → Output wtLeather` (`KM_ResHouses.pas:483`); o preço de mercado
  divide o couro por 2 (`KM_ResWares.pas:301`: `(1/2)*Wares[wtSkin]`), isto é, 1 couro cru dá
  2 curtidos. O dado daqui (`tannery: skins 0.5 → leather 1.0`) dá a mesma razão.
- Casa do Gibão (`htArmorWorkshop`): `Input (wtLeather, wtTimber)`, `Output (wtWoodenShield,
  wtLeatherArmor)` (`KM_ResHouses.pas:251-252`), e o custo de cada peça é UM insumo:
  escudo = 1 madeira, gibão = 1 couro (`WARFARE_COSTS`, `KM_ResWares.pas:73-75`). A casa
  escolhe UMA peça por ciclo pela encomenda, como as ferrarias.

## Divergência (não se corrige aqui: vai para decisão do operador)

A receita daqui (`armory_workshop: leather 1 + timber 1 → leather_armor 1 + wooden_shield
1`) faz **as duas peças no mesmo ciclo, comendo os dois insumos**. Com a encomenda da 03a,
a Casa do Gibão é a única oficina de guerra que produz sem ninguém pedir, e sem madeira não
faz gibão nenhum, mesmo com couro sobrando. Alinhar ao KaM pede **insumo por saída** na
receita com `escolheSaida` (hoje o `entra` é um só para todas as saídas, `sim/producao.ts`):
é mudança de modelo da sim, e o total de insumo por peça não muda. Fica registrada no
BUILD_PLAN como **F24c, proposta**, esperando o operador.

## Aceite da F24b

`tests/F24b-cadeia-do-couro.test.ts`, pelo `step`, na fixture nova
`cenarioDaCadeiaDoCouro` (a sonda, promovida a helper, com `ligarPorRua` extraída da cadeia
do ferro):

1. Linha de base: nenhum couro cru, couro curtido, gibão ou escudo no mundo no tick 0.
2. A Malhada faz couro cru junto com o bode.
3. O couro curtido nasce no Curtume, depois de o couro cru chegar a ele, e só lá.
4. O couro curtido chega à Casa do Gibão; gibão e escudo nascem lá depois disso e chegam
   ao armazém pelo caminho real.
5. Contra-exemplo sem o Curtume: o couro cru sai, e nenhum couro curtido, gibão ou escudo
   aparece na mesma janela (a Casa do Gibão tem madeira, falta o couro).
6. Sem violar invariante do JobBoard nem da FSM do especialista.

Sem screenshot: não muda a tela.

## PARA REVISÃO

- Sigla: `F24b`, sub-item da série F24 aberta, como a F24a. A série não entrou na tabela de
  migração de `docs/siglas.md`; se o operador quiser sigla nova, a troca é só de nome.
- A divergência da Casa do Gibão fica como proposta F24c, sem código.
