# Plano — F17f: a lista de prédios sem arte sai do manifesto, não do teste

> Pedido do operador em 2026-09-26, antes da primeira leva de arte: o teste
> `tests/F17f-manifesto.test.ts` reprova a cada prédio novo que entra no manifesto.
> O teste deve derivar a lista em vez de fixá-la. Se ele afirma outra coisa, o
> operador decide antes de alguém mexer.

## O que foi medido antes de escrever

Num worktree descartável, com PNGs de dimensão certa gerados só para a medida:

| Entrada acrescentada ou trocada | Teste que reprova | Linha | Mensagem |
|---|---|---|---|
| `quarry`, seis estágios | predio sem arte resolve null, e e a maioria | 89 | `expected { id: 'quarry', … } to be null` |
| `woodcutters`, estrutura e completo | o mesmo | 94 | `expected 26 to be 27` |
| `storehouse` refeito, seis estágios | o armazem tem arte em tres dos seis estagios | 80 | `expected '…storehouse_estrutura…' to be '…storehouse_madeira…'` |
| o mesmo | estagio sem arte resolve null, mesmo num predio que tem arte | 102 | `expected '…storehouse_paredes…' to be null` |

A linha 90 (`schoolhouse` sem arte) reprovaria do mesmo jeito que a 89 quando a Casa
do Coronel ganhar arte.

## O que cada teste afirma

- **"predio sem arte resolve null, e e a maioria"** (linhas 88–95). Afirma que o
  resolvedor concorda com o manifesto: prédio fora dele resolve `null`, e cai no
  placeholder. As linhas 89, 90 e 94 fixam a lista de HOJE para provar isso. É o caso
  que o operador autorizou: **derivar**.
- **"o armazem tem arte em tres dos seis estagios"** (73–85) afirma outra coisa: o
  guarda da troca de nome da F17e (a chave `madeira` não pode sobrar) e os nomes dos
  arquivos do armazém atual.
- **"estagio sem arte resolve null, mesmo num predio que tem arte"** (97–105) afirma
  o placeholder POR ESTÁGIO, usando os estágios que faltam ao armazém atual.

Esses dois últimos **não são tocados por este plano**. Eles reprovam quando o armazém
for refeito (BUG-H) e a decisão sobre eles é do operador.

## Task 1 — derivar a lista

Em `tests/F17f-manifesto.test.ts`, substituir o teste das linhas 88–95 por:

1. **Derivado do manifesto real:** para todo prédio de `buildings.json`,
   `assetDoPredio` é não-nulo **se e só se** o manifesto tem entrada com aquele id.
   Nenhum id escrito à mão.
2. **Id inexistente** (`tipo_que_nao_existe`) resolve `null` — mantido.
3. **O lado `null` com manifesto sintético**, para não virar afirmação vazia quando os
   28 prédios tiverem arte: um manifesto com uma entrada só resolve aquele id e devolve
   `null` para todo outro prédio real.

A frase "e é a maioria" sai: era retrato do dia, e deixa de ser verdade de propósito
com a primeira leva. O número de prédios com e sem arte continua na evidência
(`prediosComArte`, `prediosSemArte`).

## Task 2 — provar que o teste novo acusa

No worktree de medida, não na `main`:

- os três casos da tabela de cima: o teste novo **passa** com `quarry` e com
  `woodcutters`;
- um resolvedor quebrado que ignora o id e devolve a primeira entrada: o teste novo
  **reprova**;
- um resolvedor quebrado que sempre devolve `null`: o teste novo **reprova**.

## Task 3 — verificar e commitar

`npm run verify` verde na `main`, commit `test(F17f): ...`. O brief
(`docs/BRIEF-ARTE.md`) passa a dizer que a lista é derivada e que os dois testes do
armazém esperam decisão.

## Adendo — decisão do operador, 2026-09-26

Aprovado derivar também os dois testes do armazém:

- o guarda da F17e passa a afirmar que **nenhuma entrada** tem chave de `estados` fora
  de `ORDEM_DOS_ESTAGIOS` (importada de `src/render/estagio-obra.ts`), e acusa
  `madeira` numa entrada sintética;
- o placeholder por estágio usa um **manifesto sintético** com dois estágios e afirma
  `null` nos outros quatro.

Commit `828a3d4`. Teste de fumaça a partir dele: armazém com seis estágios, depois mais
pedreira e casa do lenhador — `npm run verify` com código 0 nos dois passos.
