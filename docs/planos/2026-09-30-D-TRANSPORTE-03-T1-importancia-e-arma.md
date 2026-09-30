# D-TRANSPORTE-03 T1 — classes de importância no lugar da escada + arma prefere o quartel

Autorização do operador (2026-09-30): "T1 — classes de importância no lugar da escada + arma
prefere o quartel. Aceites 1, 2, 7, 8, 10. Rode o cenário longo e me traga o delta contra a
base." Decisões D1 (Inn acima da tropa, divergência no `_doc`), D2 (escola primeiro), D3
(pedra do canteiro na importância 4, com a obra). Ordem final: escola > Inn > tropa >
obra/canteiro > resto. Nenhum número de balanceamento muda antes do lote pós-T2.

Proposta de origem: `docs/planos/2026-09-30-D-TRANSPORTE-03-logistica-kam.md`.

## O que o T1 NÃO faz (fica para o T2)

Casamento oferta×demanda casa→casa para insumo, multa do armazém (+1000) e +20 por unidade.
No T1 o insumo continua saindo só do armazém, e a saída das casas continua indo só ao armazém
— exceto a arma (abaixo).

## Tarefa 1 — importância no dado, no lugar do nível

- `data/delivery.json`: `nivel` sai, entra `importancia` (1 a 5). Os 12 ids ficam (o código e
  os testes se referem a eles). Tabela:
  - 1 `ouro-para-escola` (`diHigh1`, `KM_HandLogistics.pas:1163-1166`);
  - 2 `comida-para-inn` (`diHigh3`, `HL:1168-1171`; acima da tropa por D1, divergência no `_doc`);
  - 3 `comida-para-tropa` (`diHigh2`, `KM_UnitWarrior.pas:294`);
  - 4 `material-para-obra` (`diHigh4`, `KM_UnitTaskBuild.pas:637-638`), `pedra-para-canteiro`
    (`diHigh4`, `UTB:241`; D3);
  - 5 `insumo-producao-parada`, `insumo-producao-baixa`, `saida-cheia-para-armazem`,
    `excedente-para-armazem`, `arma-para-quartel` (`diNorm`, `HL:28-35`, `KM_Houses.pas:659`).
    Excedente: decisão do operador, divergência do KaM (lá não existe automático).
  - `assentar-estrada` e `arar`: `importancia: null` — não são entrega; a linha fica só pelo
    `modo`.
- `src/sim/jobs.ts`: `nivelDoTipo` vira `importanciaDoTipo(tipo: TipoComOrigem)`; falha alto se
  o id não existe ou se a importância é `null`. `ordenarTarefasDoSerf` ordena por
  `(importancia, custo, vez, numero)`.
- `tools/data-rules.js` (`validarEscadaDePrioridade`): importância inteira ≥ 1 ou `null`; as
  não nulas cobrem 1..máx sem buraco (classe vazia no meio faria "menor = mais urgente"
  enganar); ids únicos; `modo` em toda linha (como hoje).
- Testes que afirmam nível: trocam para a importância nova, com a razão de cada troca no
  comentário (D1/D2/D3). Não se afrouxa asserção: onde afirmava "a < b" estrito entre dois
  que agora estão na mesma classe, passa a afirmar a igualdade.

## Tarefa 2 — arma prefere o quartel

KaM, `HL:1238-1258`: arma não vai ao armazém enquanto algum quartel do dono tem
`dmDelivery` e não bloqueou aquela arma. O filtro não olha estrada nem quantidade; a entrega em
si (oficina→quartel) exige estrada, como toda casa→casa (`HL:1218-1221`). O quartel do KaM não
tem teto (`dtAlways`, `KM_Houses.pas:659`; o +10000 de `HL:1631-1637` é multa só para
armazém→quartel acima de 50); o nosso tem (C3, decisão do operador). Interpretação
conservadora, registrada no PROGRESS:

- `quartelAceitaArma(state, origem, mercadoria)`: existe quartel completo do lado da origem,
  ligado a ela por estrada (modo de `arma-para-quartel`), com vaga para aquela arma (demanda
  menos reservado > 0). Divergência: o KaM não pede estrada nem vaga; sem as duas, arma
  ficaria presa na oficina com o quartel cheio ou isolado — e a produção pararia.
- `ORIGEM_ESPERADA_POR_TIPO['arma-para-quartel']` passa a `'qualquer'`: armazém ou produtor.
- `gerarTarefasDoQuartel`: a origem é a de menor caminho entre armazéns com a arma livre E
  predios completos (não armazém) do lado com a arma na `saida`. Armazém→quartel é isento da
  multa no KaM, então "o mais perto" continua certo no T2.
- `gerarTarefasParaArmazem`: não cria `saida-cheia` de arma enquanto `quartelAceitaArma`.
- `abertaVale`: `saida-cheia` de arma aberta deixa de valer enquanto `quartelAceitaArma`
  (aberta não reserva; o gerador refaz quando o quartel encher).

## Aceite (`tests/D-TRANSPORTE-03-logistica-kam.test.ts`)

1. Corrida B do BUG-U pelo `step` (sonda de 2026-09-30 recuperada: oficina e quartel pelo
   `PlaceBlueprint`, carpinteiro e dois recrutas, cota 5/5/5, 40 pedras na saída da escola a
   cada 200 ticks): 15 armas no quartel e 2 soldados antes do teto de segurança.
2. Nenhuma arma entra no armazém com o quartel aceitando; sem quartel, as 15 vão ao armazém.
7. Ordem por classe lida do dado (e de uma cópia adulterada); dentro da classe 5, pelo `step`,
   a saída perto ganha do insumo parado longe.
8. Guarda estrutural: todo `TipoComOrigem` (as chaves de `GAVETA_DE_ORIGEM_POR_TIPO`) tem
   importância inteira no dado; validate:data reprova importância com buraco e não inteira.
10. Invariantes do JobBoard em todo tick do cenário 1; determinismo byte a byte (duas corridas
    iguais).

## O que a implementação achou (2026-09-30)

- **Aceite 1 com carga: 12/15 armas, não 15.** Na corrida B (40 pedras repostas na saída da
  escola), a `saida-cheia` de pedra e a `arma-para-quartel` estão na mesma classe (5); a
  pedra fica mais perto e ganha toda vez, e as três últimas armas ficam como tarefa aberta.
  Diagnóstico no tick 8000: todos os serfs em `saida-cheia-para-armazem:stone`, e as armas
  abertas com `reclamar` dizendo `unidade-ocupada`. Quem resolve é a multa do armazém do T2;
  puxá-la para o T1 seria adiantar o T2. O T1 afirma o 15/15 e os 2 soldados na corrida sem
  carga, e na corrida B só "nenhuma arma ao armazém" e as invariantes (PARA REVISÃO).
- **A saída passou a ser origem de dois tipos.** A `arma-para-quartel` agora reserva na saída
  da oficina, e `gerarTarefasParaArmazem` contava a oferta pela saída bruta: com o quartel
  cheio, nascia uma `saida-cheia` de arma a mais por tick (22 na corrida sem carga), logo
  desfeita. A oferta desconta agora o que outro tipo já reservou naquela saída.
- **A arma que sai antes de o quartel ficar pronto passa pelo armazém**, e o quartel a busca lá
  depois (a origem da `arma-para-quartel` é a mais perto entre armazém e produtor). A contagem
  do aceite 2 é "ao armazém com quartel completo".
- **7b pede estrada entre a escola e o armazém**: sem ela não nasce `saida-cheia` (o modo é
  estrada). A cena usa a rua da abertura, e ganhou contraprova (com o insumo parado numa classe
  acima, numa cópia do dado, o mesmo serf leva o insumo).

## Medida (para o operador, antes do T2)

Cenário longo (F-CAL-a e F17 fase A), base = `main` antes do T1, contra T1: produção total,
entregas por tipo, e ticks-produtor parados por falta de insumo (soma sobre produtores de
`produtorParado`). Relógio nunca é asserção.
