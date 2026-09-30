# BUG-Y (viagem inútil para comer) — motivo da D5 e plano de conserto

Pedido do operador (leva desatendida de 2026-10-01, tarefa 3): "traga o motivo registrado da
F20b D5 e um plano de conserto com aceite. Severidade provisória: errado. NÃO corrija."
**Só plano. Nenhum código de `src/` muda nesta entrega.**

## 1. O motivo registrado da D5 (F20b, fome e morte)

`docs/planos/F20b-fome-e-morte.md:64-70`, D5: "o assento é reservado; a comida, não". A comida
não é reservada porque uma refeição consome um **conjunto variável de tipos** (D7: cada tipo
no máximo uma vez, na ordem do dado, até a condição encher), e reservar uma unidade de um tipo
"seria uma reserva que mente sobre o que vai ser consumido". A corrida ficaria coberta por
duas coisas: o portão do gerador (a tarefa `comer` só nasce em Bodega com comida, D4) e o
consumo atômico na chegada ("quem chega e não acha comida não espera").

## 2. Onde o motivo falha (conferido no código)

- **O portão é binário.** `gerarTarefasDeComer` (`src/sim/systems/jobs.ts:721-733`) abre
  `inn.comensaisSimultaneos` tarefas sempre que `temComidaNaBodega` é verdade
  (`src/sim/bodega.ts:92-96`), ou seja, com **uma** unidade de comida na gaveta. Uma broa
  basta para N comensais reclamarem, vagarem a casa (D8) e andarem até a Bodega.
- **O portão vale no claim, não na chegada.** Entre o claim e a chegada outro comensal
  esvazia a prateleira. Na chegada, `passoIndoComer` (`src/sim/systems/fome.ts:201-206`)
  remove a tarefa e, sem refeição, faz `ficarOcioso`: o especialista volta para `indo_ocupar`
  sem ter comido.

## 3. Medida (sonda fora do repositório, apagada; vila da calibração, 20 000 ticks)

```text
árvore        refeições  indo_comer que não termina em comendo
base faf8590  37         13
T2   ebb2182  37         14
```

- Os primeiros casos, nas duas árvores: laborers u7/u8 (4 viagens cada, entre os ticks 6 871 e
  7 394), lenhadores u85/u86, pedreiro u105, carpinteiro u99.
- **Hipótese, não separada:** a sonda conta toda saída de `indo_comer` que não vai para
  `comendo`. Isso junta "chegou e a prateleira estava vazia" com "a tarefa sumiu no caminho"
  (`fome.ts:183`) e "a Bodega deixou de estar completa" (`:185`). A Tarefa 1 abaixo separa as
  causas antes de qualquer código.
- **As sementes não mudam nada aqui:** o RNG semeado só é consumido em combate (`combate.ts`,
  `cerco.ts`, `carga.ts`), e a vila da calibração dá o mesmo estado nas sementes 20260920, 21
  e 22.

## 4. Proposta de conserto (para o operador escolher; nada feito)

**(A) Recomendada — reservar a REFEIÇÃO, não a unidade de um tipo.** A D7 garante que uma
refeição tira no máximo uma unidade de cada tipo presente. Então a prateleira serve pelo menos
`max(quantidade de cada tipo)` refeições antes de esvaziar, qualquer que seja a mistura. O
número de comensais a caminho de uma Bodega (tarefas `comer` reclamadas) não passa desse
piso. Isso não mente sobre o tipo, que é a objeção da D5: reserva uma refeição garantida.
- Um predicado só, `refeicoesGarantidas(state, bodega)`, lido pelo gerador (quantas tarefas
  abrir) e pelo `reclamar` (recusa `sem-comida` quando os reclamados já cobrem o piso). Os dois
  são necessários, como no teto do quartel da C3: o gerador roda no fim do tick, e o claim
  do mesmo tick veria estado velho.
- Muda a D5 da F20b, então é decisão do operador, com emenda escrita no plano da F20b.

**(B) Alternativa — reconferir antes de vagar a casa.** O comensal só sai se a prateleira
ainda tem comida no tick do claim. Não cobre a corrida durante a caminhada, que é o caso medido.
Fica registrada como rejeitada.

## 5. Aceite (para quando o operador aprovar a (A))

1. **Tarefa 1, antes do código:** a sonda separa as 13 saídas da base por causa (prateleira
   vazia na chegada, tarefa sumida, Bodega incompleta). Se a prateleira vazia não for a
   maioria, **parar e reportar**, porque a (A) não é o conserto.
2. **Repro pelo `step`, vermelho antes do conserto:** Bodega com 1 `loaves`, 2 especialistas com
   fome em casas ligadas. Afirma que só um sai (`indo_comer`) e o outro continua ocupante.
   Guarda que o cenário aconteceu: os dois pedem comida no mesmo tick.
3. **Piso da D7:** Bodega com 3 `loaves` e 1 `sausages` aceita 3 comensais a caminho, não 4 nem 2.
4. **Vila da calibração, 20 000 ticks:** zero chegadas com prateleira vazia (eixo
   determinístico: contagem de transições), e refeições ≥ 37 (a base).
5. **Não-regressão:** F20b (fome e morte, incluindo o cenário sem comida, em que quem não come
   morre), F-CAL-a sem fome, invariantes e determinismo. O gerador e o claim importam o mesmo
   `refeicoesGarantidas` (guarda estrutural por import, não por texto).
6. **Efeito no T2 (hipótese a medir, não aceite):** o −1 de tora e o −2 de tábua do T2 contra a
   base somem, se a viagem perdida dos lenhadores for a causa (`PROGRESS.md`, leva noturna de
   2026-09-30).

## Severidade

**Provisória: `errado`** (operador, 2026-10-01). Nenhum aceite escrito quebra (a D5 prevê o
caso), mas cerca de 1 em cada 4 viagens para comer, 13 de 50, não alimenta ninguém e tira o
especialista da produção.
