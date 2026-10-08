# Ajustes 7 a 16 e integracao autorizada pelo operador

Aceites anteriores ao codigo. Pedido de 2026-10-07 com oito imagens.
Executar um item de cada vez, com teste dirigido, captura aberta e
verify:rapido verde antes do commit. Nunca excluir, pular ou afrouxar um teste.
Mudancas deliberadas de comportamento substituem os respectivos aceites
antigos por verificacoes especificas do novo comportamento, preservando as
garantias de simulacao. Nao tocar em test-results.json, AGENTS.md ou .claude/.

## Pre-requisitos e escopo adicional autorizado

O operador autorizou corrigir saves/mapa e ampliar mapa/simulacao para o rio
atravessavel e a serra com desgaste. A autorizacao do ajuste 12 inclui a
penalidade real de movimento na sim. Arte/render nunca escreve no GameState.
Reaproveitar a correcao de fixtures ja existente em fix/fechamento-projeto,
com seus aceites e testes, sem modificar o save publicado para esconder erros.
Corrigir a fixture de ARTE-VILA para satisfazer o cenario escrito de vizinhanca,
mantendo todas as assercoes. Retomar os enfeites e a caatinga do pacote original.

## 7 - I-TELA-PEDRA-ESTOQUE-MAIOR

A pedra em estoque na casa do pedreiro (quarry) tem largura e altura 30%
maiores, mesmo ponto de contato com o estoque. Escala em dado de tela por
predio/mercadoria, sem mudar o estoque, a carga dos carregadores ou outras
pedras. Aceite: dimensoes desenhadas em razao 1,30, quantidades e ancoras
conservadas, teste puro e captura da pedreira com estoque positivo.

## 8 - I-TELA-ARMAZEM-SEM-PILHAS-EXTERNAS

storehouse completo nao desenha mercadorias diante da fachada. Seus estoques,
painel e logistica permanecem intactos; materiais de obra continuam visiveis.
Aceite: nenhum objeto de mercadoria externa no armazem completo com estoques
positivos, painel conserva quantidades; outros predios continuam desenhando
pilhas. Regressao de F-VIVO deve afirmar essa nova excecao explicitamente.

## 9 - I-TELA-QUARTEL-MAIS-IMPONENTE

barracks com largura e altura de exibicao 20% maiores; footprint, custo,
passagem e origem nos pes conservados. Mesmo fator na obra e no completo.
Aceite: teste geometrico compara dimensoes antes/depois em razao 1,20 e
captura mostra quartel ao lado da igreja, com profundidade coerente.

## 10 - I-TELA-OBRAS-COM-ARTE-ATUAL

Aplicar a todos os predios a revelacao por partes que o operador observou no
quartel dos mercenarios. Nao usar a cortina uniforme de baixo para cima.
Investigar primeiro o caminho de desenho atual e registrar o comportamento
real, sem presumir qual predio usa qual regra. Substituir madeira intermediaria
antiga de quarry por derivado coerente com a base atual do completo.
Aceite: mesma regra deterministica por partes para cada predio com arte;
progresso crescente nao remove partes ja construidas; quadro final coincide
com o completo. Prancha da pedreira intermediaria/completa e capturas de obras
representativas abertas. Nova base/derivado/procedencia conforme skill.

## 11 - I-TELA-SELECAO-NO-PE

Anel de selecao militar centrado no contato dos pes do sprite, em vez do
deslocamento visual para o sul. Dimensoes/deslocamento em dado de tela.
Aceite: teste de geometria e captura em zoom 0,5/1/2 com unidades nas direcoes
disponiveis; anel acompanha interpolacao e relevo, sem mudar hitbox ou ordem.

## 12 - I-CLIMA-PENALIDADE-DE-MARCHA

Durante a seca, todas as unidades vivas em movimento usam 80% da velocidade
normal. Parametrizar penalidades e bonus sazonais em dados, com controle
explicito de movimento e preservacao do crescimento sazonal ja existente.
Aceite: civis e militares, em estrada/solo e direcoes reta/diagonal, percorrem
a mesma distancia com a velocidade efetiva de 0,80 na seca, dentro do
arredondamento de ticks documentado. Sem clima, movimento identico ao anterior;
alterar parametro altera resultado sem novo numero em TypeScript. Testar
determinismo, troca de fase durante marcha e ausencia de dupla penalizacao.

## 13 - I-TELA-MILHO-E-FUBA-NO-MOINHO

No mill, milho de estoque 30% maior e fuba 100% maior nos dois eixos,
mantendo contato com as mesas. Fatores separados por mercadoria em dado de
tela. Aceite: dimensoes efetivas 1,30 e 2,00, estoque dinamico preservado,
capturas com ambos os produtos, sem mudanca de receita/carga ou cultivo.

## 14 - I-ARTE-FARDOS-DE-CANA-NO-CANAVIAL

wineyard mostra a saida grapes como fardos amarrados de cana, lado a lado na
area de estoque. Arte original transparente, base e derivado versionados,
manifesto e origem completos. Tamanho proporcional ao predio.
Aceite: estoque 0 nao mostra fardo; estoques 1 ate teto visual mostram a
quantidade correspondente, sem empilhar verticalmente como milho. Prancha e
capturas de estoque minimo/maximo abertas; quantidade nao e pintada na base.

## 15 - I-TELA-MILHO-MADURO-MAIS-ALTO

Interpretacao conservadora de aumentar vertical em 50%: aumentar a ALTURA
visual do pe de milho maduro em 1,50 mantendo os pes no solo, e nao desloca-lo
para cima. Largura e estagios anteriores conservados, fator em data/.
Aceite: altura 1,50, largura 1,00, contato com solo identico; lavoura matura
capturada, sem alterar maturacao, quantidade colhida ou passagem.

## 16 - I-ARTE-PEIXES-PENDURADOS-NA-BODEGA

Peixe de estoque maior, vertical, pendurado em pequenas cordas nas laterais
da Bodega. Usar estoque real, distribuir entre esquerda/direita com diferenca
maxima de um quando quantidade impar. Ate seis visiveis: tres de cada lado;
se teto visual autorizado/configurado maior, dividir igualmente entre lados.
Demais comidas ficam nas mesas do ajuste 6, sem retornar ao telhado.
Aceite: estoque 0/1/2/5/6 e acima do teto respeita contagem, ordem, equilibrio e
visibilidade, sem peixe permanente na base. Arte original com base/derivado e
origem. Capturas abertas de dois lados e comida com estoque maximo.

## Integracao e encerramento das worktrees

Operador autorizou merge de todo o trabalho na main e encerramento de todas
as worktrees do projeto, desde que seu trabalho esteja antes na main.
Inventariar commits, arquivos modificados e nao rastreados de cada worktree.
Preservar alteracoes de sessoes concorrentes; nao commitar, reverter ou apagar
trabalho alheio em curso. Resolver conflitos sem sobrescrever entregas atuais.
Nao integrar arte historica/candidata como se fosse homologada sem verificar
origem, compatibilidade e status real. Nao fazer push.

Ao fim: verify completo verde e evidencias dos itens; main limpa para merge.
Conferir que os commits entregues estao alcancaveis por main e arquivos novos
relevantes foram preservados. So entao remover worktrees entregues, sem force.
Nao remover a checkout principal nem atravessar junction de node_modules.
Se sessao concorrente, arte nao homologada ou verificacao impedir isso,
registrar bloqueio concreto e manter worktree/trabalho intactos.

### Detalhamento do aceite 12 — custo sazonal compartilhado
O carregador converte os custos retos/diagonais de estrada/solo para cada fase uma unica vez, com round(custo / multiplicadorVelocidade). A investida conserva seu bonus, com round(custo / (bonus * multiplicadorVelocidade)), sem aplicar a seca duas vezes. Simulacao, troca de vagas, colisao e interpolacao usam a mesma consulta. Na mudanca de fase, o passo em curso passa a usar o custo da fase atual; os ticks ja acumulados permanecem, chegando no proximo tick se o novo custo ja foi vencido. A velocidade efetiva por passo difere de 0,80 apenas pelo arredondamento de ate meio tick no custo. Todos os efeitos existentes de crescimento permanecem em data/clima.json, junto do novo multiplicador de velocidade por fase.
