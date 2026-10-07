# I-TELA-CLIMA-VISUAL — camada do clima cobre a vista em todo zoom

Pedido do operador: no zoom out, película e chuva aparecem num quadrado central.
Somente render e roteiro; nenhuma mudança na simulação, balanceamento ou arte.

Aceite antes do código:
1. inverno e seca cobrem a vista inteira nos zooms 0,5, 1 e 2, com câmera deslocada;
2. compensar o zoom da câmera no objeto Graphics; partículas continuam em pixels de tela;
3. trocar zoom pausado redesenha corretamente, sem depender de avanço de tick;
4. roteiro verifica limites projetados da camada e abre capturas de inverno/seca
   nos zooms extremos; preservar as asserções anteriores de estação e jornal;
5. testes do clima, typecheck, lint e validate:data verdes, e npm run verify no fechamento.
