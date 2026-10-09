# Pacote do operador de 2026-10-09: icone da serraria e relato de travamento

## I-ARTE-ICONE-SERRARIA-ATUAL — icone da serraria atualizado

Aceite antes do codigo:
- Derivar somente o icone da serraria do estado completo atual no manifesto, com o pipeline existente tools/atualizar-icones-completos.mjs. Nao gerar outro edificio, nao alterar as bases nem os sprites completos.
- Preservar o tamanho do icone, transparencia, proporcao, licenca e origem; registrar fonte completa e SHA-256 no manifesto. Nenhum outro icone muda.
- Guarda permanente afirma que a origem e o hash coincidem com a arte completa atual, que o PNG tem o tamanho declarado e que o resolvedor da UI usa o novo arquivo.
- Roteiro abre Mato e Pedra com o jogo andando, verifica a imagem carregada no botao da serraria, captura o menu e abre a captura. verify:rapido antes de cada commit; verify completo ao terminar. Nao escrever test-results.json nem fazer push.

## Relato de travamento com canal de mensagem assincrono

- Investigar o texto informado: "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received". Nao assumir que a mensagem e a causa do travamento, nem esconder erros/rejeicoes com um listener global.
- Procurar uso de mensageria de extensoes no jogo e exercitar uma partida em Chromium sem extensoes, com os guardas normais de console/pageerror ativos e prova de avanco do tick pelo laco real.
- Se houver falha reproduzida e localizada, registrar seu aceite especifico antes de alterar o codigo correspondente. Sem reproducao, registrar claramente o diagnostico e os dados que faltam (navegador, acao, stack/save); o travamento permanece pendente e nao recebe uma correcao ficticia.
- Trabalhar em codex-pacote-serraria, isolada da main e da noru-novos-sprites. A autorizacao de merge/encerramento da antiga codex-sertao-mapa nao se estende automaticamente a esta branch nova.
