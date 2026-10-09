# I-TERRENO-LAJEDO-TRES-TILES — lajedo da vila tres tiles ao norte

Pedido e esclarecimento do operador: aprovou as artes e quer mover o lajedo inteiro da pedreira inicial, mantendo os tres tiles do pedido original. Nao deslocar apenas os sprites. As demais serras ficam no lugar.

## Aceite antes do codigo

### Emenda adicional do operador de 2026-10-09 — cenarios restantes

O operador autorizou corrigir os cenarios restantes de abertura, posicionamento e pesca, preservando regras e rigor das verificacoes. Antes do codigo, fica registrado:

- F06 conserva a precedencia de recurso sobre espacamento por um tile bloqueante explicito na fixture de encosto; os testes de lote livre e espacamento continuam com as mesmas assercoes. O mapa do jogo nao recebe esse tile.
- A guarda de geometria da F-T4b usa um bloqueio controlado em lote calculado para provar que remover somente o predicado altera a geometria. As comparacoes entre headless e roteiro no mapa real permanecem integrais.
- O lenhador so encerra antes do teto existente quando comprovou ambas as entregas (tronco e tabua); nenhum teto de ticks aumenta. Cenarios de vila e pesca continuam por comandos reais, com lotes validos e expectativas integrais de ocupacao, colheita e esgotamento.
- A autorizacao anterior sobre testes de prazo e clima permanece: se o diagnostico comprovar interferencia da estacao em teste de mecanica, apenas o dado desse teste usa clima.ligado=false, com registro da causa. Nenhuma penalidade do jogo muda.
- Timeouts nao aumentam; nao se excluem testes nem verificacoes. Se necessario, agregar violacoes ao longo de todos os mesmos ticks conserva a cobertura, com sondas que comprovem a recusa do caso invalido. Otimizacao e somente do harness/teste; src/sim, GameState, rendimentos, terrenos e demais recursos permanecem intactos.
- Rodar os testes afetados dirigidos normais e transladados, capturas de nao regressao e verify:rapido antes do commit de implementacao; depois verify completo. Merge depende do verify completo com saida 0 e main limpa, conforme autorizacao vigente. Registrar separado o que passou e o que ainda nao foi verificado.

### Emenda do operador de 2026-10-09 — pedreira dos cenarios

Antes de alterar o codigo, o operador autoriza reposicionar a pedreira dos cenarios de teste em lote valido depois da translacao do lajedo, respeitando o espacamento do dado, os recursos e as portas. Esta emenda substitui a conservacao dos deslocamentos exatos do item 3 somente onde a nova geometria os altera: as expectativas exatas de deslocamento acompanham o trajeto novo, comprovado pelo step. Ciclo de producao, regras da simulacao e rigor das assercoes permanecem iguais. A pedreira continua derivada da feicao do mapa e a ligacao da rua, das portas reais, inclusive na suite transladada. Nao deslocar outros predios para esconder sobreposicoes; se houver outro contrato incompativel, reportar.

1. Os 13 tiles do lajedo da vila passam de (gx,gy) para (gx,gy-3), conservando forma, quantidade/rendimento, desgaste e conexoes. Centro anterior (24,31), centro novo (24,28), raio 2. Numeros de autoria em data/terrain.json, consumidos por tools/gerar-mapa.js. Terrenos, relevo, outros recursos e vila inicial permanecem exatamente iguais. Nada em src/sim, GameState, formato de save, PNGs ou manifesto muda.
2. Em cada um dos 13 tiles novos, canPlaceRoad recusa por recurso. Pelo step, PlaceRoad em um desses tiles nao escreve estrada nem canteiro e emite rejeicao. Depois da extracao total, a regra existente permite rua. Teste permanente tests/I-TERRENO-LAJEDO-TRES-TILES.test.ts cobre o mapa real e a traducao do mundo, sem coordenada absoluta para as sondas da sim.
3. Testes existentes de geografia/obstaculo/producao/transporte rodam dirigidos antes do portao. Nenhuma assercao, limite ou src/sim sera alterado para ocultar uma regressao. Emenda autorizada pelo operador: a rua dos cenarios acompanha a porta da pedreira deslocada, por geometria derivada, conservando a ligacao ao armazem e todas as assercoes e prazos atuais. Nao deslocar outros predios para esconder sobreposicoes; se houver outro contrato incompativel, reportar.
4. Roteiro I-TERRENO-LAJEDO-TRES-TILES abre o mapa novo na vila, afirma a posicao desenhada e captura. Preservar F-SPR/F-TR. verify:rapido0 antes do commit de implementacao; verify completo no fechamento, com saida e evidencias no PROGRESS da branch.
5. Esta mudanca autoriza a translacao do recurso da vila e seus dados/ferramenta de autoria. Emenda autorizada pelo operador: regenerar somente saves/teste-operador-vila-pronta.txt pelo montador oficial existente (CANGACO_GRAVAR_SAVE_DO_OPERADOR=1), preservando o teste de identidade byte a byte, hash do mapa e carregar/salvar. Nenhum formato, guarda ou save pessoal sera alterado; nao reaplicar o rio.
