# I-TELA-SERRA-DESGASTE-LOCAL — serra com retirada localizada

Decisao do operador em 2026-10-08: desgaste localizado. Esta emenda substitui
a selecao pela soma de todo o lajedo do D-TELA-SERRA-POR-LAJEDO (opcao A de
2026-10-03). Nao substitui os portoes de arte, apoio, luz ou nao-regressao.

## Aceite anterior ao codigo

- A quantidade de cada tile rock escolhe somente seu volume: cinco patamares
  desenhados, equivalentes a 15/12/9/6/3 do rendimento atual. Zero nao tem sprite.
  Rendimento vem do funil mapa.ts, e proporcoes/escala ficam em data/serra.json.
  Nenhuma mudanca de sim, mapa, extracao, passagem, save ou GameState.
- A serra e uma massa geologica conectada: modulos sao trechos de bancadas e
  faces, nunca uma montanha inteira repetida por tile. As 16 vizinhancas
  cardinais possuem juncoes; alturas diferentes revelam faces naturais.
- Cinco volumes nativos por vizinhanca, canvas e anchor comuns [0.5,1]. Cristas
  baixam, base permanece apoiada enquanto houver volume; nada de recortar,
  encolher, desvanecer ou recolorir a intacta para fabricar esgotamento.
- Bases, prompts, id da geracao e hashes versionados; derivados e os oito
  campos do manifesto. Preservar estados existentes de rock, acrescentando
  estados de volume. Placeholder anterior funciona quando faltar PNG novo.
- Regra pura testada em tests/I-TELA-SERRA-DESGASTE-LOCAL.test.ts: cinco
  intervalos e limites, zero, retirada local sem mudar volume de vizinhos,
  todas as 16 mascaras, vizinho esgotado, mesmo estado mesma selecao,
  fallback. Prova de extracao pelo step, mantendo sim intacta.
- Debug publica volume/mascara/textura por tile e contagem de trocas. A camada
  troca apenas quando volume ou vizinhanca muda, nao a cada quadro. O roteiro
  I-TELA-SERRA-DESGASTE-LOCAL captura extracao e mosaicos 15/9,12/6,6/3 em duas
  frentes, sobre solo e areia, sem grade/numeros; zooms 0.5/1/2 e RGBx0.8.
  Capturas abertas, revisao independente e homologacao do operador distintas.
- Teste dirigido sob trava, F-TR, F-SPR, ARTE-VILA, D-SAVE-VILA-PRONTA e F-T1
  permanecem obrigatorios, sem afrouxar suas assercoes. verify:rapido sai 0
  antes do commit. Fechamento completo conforme contrato do operador.

## Ordem de trabalho

1. Preservar o rio bloqueado em stash identificado, sem reaplica-lo nesta tarefa.
2. Registrar esta emenda em commit so de docs.
3. Gerar e revisar cinco folhas nativas (uma por volume, 16 vizinhancas cada),
   sem usar sprites atuais como referencia. Orçamento inicial: cinco chamadas.
   Se as juncoes ou os volumes reprovaram, preservar candidatas e reportar;
   nao registrar arte reprovada nem fabricar o volume por recortes.
4. Integrar regra pura e render, validar extracao e evidencias, commit da feature.

O rio segue aguardando a decisao propria de testes/mapa. Main e noru intocadas.

## Implementacao das juncoes — 2026-10-09, antes do consumo pelo render

A prova externa com rampas alfa FIXAS nas bordas de encaixe passou pela revisao
independente. O tratamento se aplica somente a juncoes, nunca a quantidade,
tempo ou interpolacao entre volumes. Cada volume menor nasce de desenho nativo.
Os primeiros dois atlas usaram duas chamadas para o volume intacto; com os
quatro volumes menores o total previsto passa a seis chamadas, incluindo a
correcao reprovada. Sem aprovar candidatos antigos por causa desse custo.

Ha duas mascaras: `m` descreve vizinhos presentes no chao; `h` descreve os
vizinhos cuja altura e pelo menos a do tile. A face alta fica exposta diante
de um vizinho mais baixo, com apoio nativo. `h` e sempre subconjunto de `m`.
O estado `v<volume>:h<h>:m<m>` aponta ao desenho nativo da mascara de altura.
Aliases no manifesto compartilham arquivos, preservando as 16 conexoes do
chao e os estados antigos; a guarda F-TR continua lendo o sufixo `m` da
textura REAL, e a guarda nova confere tambem `h` e seu arquivo correspondente.
Nenhuma assercao antiga e removida ou afrouxada.
