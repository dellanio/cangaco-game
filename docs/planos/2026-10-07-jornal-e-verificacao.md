# Jornal do game e bloqueios da verificação

Operador autorizou prosseguir em 07/10/2026. Aceite registrado antes do código.

## Task J — roteiro do clima compatível com a última notícia

Diagnóstico: `data/jornal.json` limita a lista a 1; a decisão
I-TELA-JORNAL-SO-A-ULTIMA (jornal mostra só a última notícia), em BUILD_PLAN.md,
é de 06/10. A asserção antiga de duas manchetes simultâneas é incompatível.
Não mudar capacidade, texto ou funcionamento do jornal para satisfazê-la.

Aceite:
1. No começo de transicaoSeca, abrir jornal e afirmar exatamente uma notícia,
   com chave e manchete dessa estação. Captura aberta.
2. No meio da seca, abrir de novo e afirmar exatamente uma notícia, agora de
   seca. A anterior não permanece. Captura aberta.
3. Ao fechar, ícone some; chegada da próxima notícia volta a mostrá-lo.
4. Preservar estação, partículas, relógio, cobertura nos zooms 0,5/1/2 e
   imobilidade do tick durante zoom; roteiros do clima e jornal passam.
5. Testes do clima/jornal passam e nenhuma capacidade é ampliada, nenhuma
   asserção é eliminada sem substituição mais específica.

## Task V — mundo transladado

Diagnosticar e corrigir saves de fixtures e minas, mantendo o mundo versionado
intacto. Acrescentar especificação técnica antes da implementação: carregar
fixtures no mesmo mundo de dados importados; gerador e leitor devem concordar;
posições relativas de minas/recursos conservadas. Nenhum skip novo, exclusão,
mudança de hashes publicados ou afrouxamento. Suítes normal e transladada passam.

### Especificação técnica da task V (antes do código)

- O setup da transladada adapta somente a fixture `teste-operador-vila-pronta`:
  valida id/hash contra o mapa versionado antes de deslocar coordenadas gx/gy,
  chaves e referências de tile e bits de descoberto. Hash de destino corresponde
  ao mapa realmente transladado. Save incompatível continua recusado; fixture
  e mapa no disco permanecem intactos. Testar conservação de tick, RNG, estoques,
  ids, posições relativas, caminhos e conhecimento do mapa, incluindo bit 31.
- O teste das minas deriva posições dos veios, não de gy=32/36/38. Região e
  minas andam pelo deslocamento real do mapa. Produção e extração continuam
  estritamente maiores que zero para os três recursos nas duas corridas.
- Contrato do gerador publicado é executado em subprocesso de Node sobre dados
  versionados, sem escrever arquivos. Seu resultado é transladado pela mesma
  função pura de mapa usada na infraestrutura e comparado integralmente com o
  mapa lido pelos testes. Não gerar outro mapa aleatório de 160x160 e compará-lo
  ao mapa de 128x128 deslocado: são operações diferentes.
- Teste dirigido prova também que a transformação não altera seu argumento e
  que a correspondência espacial entre recurso/terreno/fixture é preservada.
- Manter todos os testes existentes; zero skip/exclusão novos; não alterar
  carregar/salvar de produção nem regravar hashes no save versionado.

## Varredura ampliada solicitada durante a execução

Inventário e plano de todo o backlog, com prioridade para artes ausentes ou
provisórias, vegetação e cenário, serão entregues nesta worktree. Não autoriza
inventar regras de jogo ou tratar candidatas como arte homologada. A task V
continua na fila; não será declarada concluída por este documento.
