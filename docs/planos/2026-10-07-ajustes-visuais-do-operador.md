# Ajustes visuais solicitados pelo operador

Pedido pelas cinco imagens do operador. Os oito enfeites foram homologados visualmente; sua distribuicao existe somente nesta worktree e permanece sem commit por ARTE-VILA. Nao anunciar integracao na main.

Os ajustes abaixo precedem a retomada dos itens da caatinga. Cada aceite entra antes de seu codigo, neste commit documental. Sem push/merge, sem alterar verificacoes ou src/sim/ enquanto a restricao nao for expressamente revista pelo operador.

## I-TELA-CLIMA-COBERTURA-ZOOM

Corrigir o veu e as particulas para ocupar todo o viewport em todos os niveis de zoom configurados. Aceite: roteiro pausado mede os quatro cantos e centro da pelicula na seca, na chuva e nas transicoes, inclusive 0,5/1/2 e resize; a cobertura independe de scroll e zoom e nao aparece um retangulo central. Screenshot aberta. Nenhuma alteracao na estacao da sim.

## I-ARTE-MENU-PREDIOS-ATUAL

Derivar icones de woodcutters, quarry e church do PNG completo ATUAL do manifesto. Aceite: entrada de icone declara o arquivo completo de origem e seu hash, PNG existe com dimensoes de icone preservadas, menu usa os tres arquivos, roteiro abre as abas correspondentes e captura. Nao mudar preco ou desbloqueio.

## I-ARTE-PAPEL-DO-JORNAL

Gerar textura original de papel antigo, amarelado, com fibras, manchas suaves e vincos discretos, sem letras embutidas. Base/derivado/procedencia versionados, manifesto com oito campos. Aplicar ao painel e fontes serifadas no cabecalho e corpo. Aceite: jornal aberto usa o asset carregado e fonte serifada, continua legivel no tamanho minimo suportado; captura aberta; roteiro original do jornal continua passando, mantida a regra de uma noticia.

## I-TELA-PILHAS-NAS-MESAS-DA-BODEGA

Corrigir somente as ancoras das mercadorias da Bodega para as mesas, mantendo pilhas dinamicas e sua profundidade junto ao predio. Aceite: coordenadas normalizadas no manifesto coincidem com superficies das duas mesas e ficam abaixo do telhado no PNG completo; roteiro com estoque real mostra comida nas mesas, captura aberta; testes de manifesto/pilhas preservados. Nao pintar comida permanente na base.

## I-TELA-RIO-E-PONTE-MATA-BURRO

Substituir lago por rio continuo atravessando o mapa, bordas organicas e vegetacao de margem em tons secos, com travessia visual de madeira estilo mata-burro. Aceite: rio atravessa o mapa, margens sem degraus quadrados evidentes, ponte original com base/derivado/manifesto; unidades cruzam somente onde a travessia e valida. Escopo dependente: alterar terreno, conectividade e caminho exige revisar a restricao de sim/mapa. Nao desenhar ponte transitavel de mentira sobre agua intransponivel. A decisao de escopo foi perguntada ao operador; aguardar resposta para trabalho dependente.

## I-ARTE-SERRA-DESGASTADA

Substituir bolinhas por formacao rochosa conectada (serra/morro), permitida pixel art, com arte que diminui conforme a extracao. Aceite: conjunto inteiro tem continuidade, patamares de desgaste ordenados por quantidade extraida e capturas antes/depois; nenhuma celula isolada vira mini-montanha repetida. Conferir contrato ja existente de lajedos e identidade de tiles esgotados. Parar e reportar se o estado atual nao preservar a identidade necessaria; nao mudar a sim sem revisao explicita de escopo.

## Estado da base

ARTE-VILA falha tambem no a4ec16b limpo por vizinhanca da Bodega na fixture. Verify normal verde e transladado vermelho nas fixtures/gerador. Nao afrouxar esses portoes nem confundir correcoes visuais com solucao desses bloqueios.
