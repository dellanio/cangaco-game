# Playtest — roteiro para quem testa

Este papel é para quem vai jogar **Piancó** pela primeira vez, a pedido de quem fez o jogo. Ele não
ensina a jogar: diz o que tentar e o que perguntar depois. O que o jogo não conseguir explicar
sozinho é exatamente o que precisamos saber.

## Antes de começar

- Abra o link que você recebeu, num navegador de computador (mouse e teclado).
- Não leia nada sobre o jogo antes. Não pergunte a quem fez. Se travar, anote onde travou e siga.
- Reserve uns 40 minutos. Pode parar antes, e parar também é resposta.

## O que tentar

Faça na ordem, no seu ritmo. Não há resposta certa.

1. **Abra o jogo e escolha por onde começar.** Note qual botão você escolheu primeiro, e por quê.
2. **Faça a sua vila funcionar.** O objetivo é a vila produzir tábua e pedra sozinha, sem você
   mandar cada pessoa. Note quanto tempo levou até entender que você não manda nas pessoas, só
   nas casas e nas estradas.
3. **Dê comida ao povo.** Note se você percebeu quando faltou comida, e como percebeu.
4. **Comece uma escaramuça** (contra outro bando) e jogue até ganhar, perder ou desistir.
5. **Se algo parecer quebrado, mande o relato na hora** (veja abaixo), e depois continue.

## Como mandar o relato

No jogo, aperte **H** (a ajuda). No fim do papel está **Relato para quem fez o jogo**: escreva o
que quiser no campo e aperte **Enviar relato**. O navegador baixa um arquivo `relato-...json`.
**Nada é enviado sozinho**: mande esse arquivo para quem pediu o teste, por onde vocês combinaram.

O arquivo leva só o que a tela diz: a partida como está naquele instante, a versão do jogo, o nível
do adversário e o que você escreveu. Nenhum dado seu, nenhum endereço, nada do seu computador.

## Depois da partida

Responda com as suas palavras, curto. "Não sei" é resposta.

1. Em que momento você entendeu o que o jogo queria de você? Teve um momento em que quase desistiu?
2. Qual foi a primeira coisa que você não entendeu? O jogo explicou depois, ou você descobriu
   sozinho, ou ficou sem saber?
3. Você usou o **Aprender a jogar**? Os passos ajudaram, atrapalharam, ou você os escondeu?
4. Apareceram dicas no canto da tela? Alguma veio na hora errada, ou repetiu o que você já sabia?
5. Você abriu a aba **Cadeias** da ajuda? Ela respondeu o que você procurava?
6. O que pareceu lento demais? E rápido demais?
7. Na escaramuça: você entendeu por que ganhou ou perdeu?
8. Se fosse jogar de novo amanhã, o que faria diferente na abertura?
9. Uma coisa para mudar antes de qualquer outra.

## Para quem fez o jogo (o operador)

- O playtest é seu: você escolhe quem joga e recolhe os relatos.
- Cada relato abre de volta no jogo: **H → Abrir relato**, e a partida volta ao instante em que a
  pessoa apertou Enviar, na mesma versão (o commit vai no arquivo; abra no build desse commit).
- O que os relatos trouxerem vai para `BUGS.md` (quebra de regra escrita) e `BALANCE_LOG.md`
  (número que parece errado), como sempre (CLAUDE.md §12).
- A Fase I fecha com os relatos registrados e a página do itch.io aberta para outras pessoas.
