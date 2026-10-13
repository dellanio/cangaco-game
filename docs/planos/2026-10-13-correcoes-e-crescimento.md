# Correções e crescimento — 2026-10-13

Execução isolada em codex-correcoes, originada de main 04863eff. Uma tarefa por vez, aceite antes de código/arte; sem push nem merge automático desta nova branch.

## Bloqueios preservados

- I-MOVIMENTO-PEDREIRO-FORA-DO-LAJEDO: o aceite atual exige rock bloqueando passagem e proíbe mudar sim; F-T3/F-T2b exigem rocha atravessável. Não mudar dado, sim ou guardas para contornar o contrato.
- BUG-CARGA-INFINITA-SEM-VEZ: envelhecimento versus teto de atendimento continua sendo decisão expressamente reservada ao operador. Não presumir escolha.
- Montanhas minerais: duas tentativas já reprovadas; não reiniciar orçamento nem instalar candidatas reprovadas.
- Homologações e som de vitória dependem da avaliação humana; organizar evidências não equivale a aprovar.

## I-ARTE-MILHO-CRESCENDO — A09, os três estágios do milho

Aceite, antes da arte/código:

1. A entrada recurso/corn recebe exatamente semeado, muda e verde. Presente continua apontando ao mesmo arquivo maduro, com os mesmos bytes; origem.base, tamanho 64x64, footprint 1x1 e anchor [0.5,1] são preservados. Cada estágio tem original, master 128x128, derivado 64x64 e origem/hash versionados em assets/base/corn/crescimento/; derivados em assets/sprites/resources/.
2. Semeado mostra marcas discretas da semeadura, muda tem folhas pequenas, verde tem folhas alongadas sem espigas maduras. Os três desenhos têm a mesma linha dos pés do PNG presente; altura opaca aumenta estritamente, abaixo da madura. Arte pintada, luz única superior ligeiramente sul, fundo transparente, sem chão quadrado embutido. Até duas gerações por estágio; reprovação após duas fica registrada e a candidata não é instalada.
3. O render escolhe o PNG pela função existente estagioDaCultura, no mesmo tick da simulação. Ausência do PNG usa o comportamento anterior (marcador e alfa); culturas outras que corn não mudam. Milho pronto conserva a ampliação madura atual de 50%. Os três juvenis são imagens de 64x64 ancoradas ao mesmo tile; não recebem a ampliação madura.
4. Teste novo tests/I-ARTE-MILHO-CRESCENDO.test.ts mede canvas/pés/porte/hashes/estados/preservação da madura e seleção de textura, incluindo fallback. BUG-W continua provando equivalência de maturidade e sim pelo tick. Debug informa estágio, fonte PNG/fallback, textura e dimensões de cada cultura na vista.
5. Roteiro tools/shots/I-ARTE-MILHO-CRESCENDO.js carrega o cenário real semeado pelo step (fixture BUG-W), afirma os quatro estágios e suas fontes, captura nos zooms 0.5/1/2. Prancha dos quatro estágios sobre grama/areia/rocha, normal e RGBx0.8, nos três zooms; capturas/pranchas abertas. Validador original e revisão independente; homologação do operador permanece separada.
6. Testes/roteiros pela trava; verify rápido verde antes de commits; verify completo ao final da entrega. Nenhum arquivo de src/sim, GameState, teste de prazo, AGENTS.md, .claude ou test-results.json muda.

Depois de A09: A10 cana, A11 cavalos e retoques de ataque, na ordem do CSV. Bloqueios ficam registrados e não são considerados entregas.

## I-ARTE-CANA-CRESCENDO — A10, cana-de-açúcar em três estágios

Aceite antes da arte/código:

1. A entrada recurso/grapes recebe exatamente semeado, muda e verde. Presente, bytes da arte madura, origem.base, canvas64x64, footprint1x1 e anchor[0.5,1] são preservados. Originais/masters128x128/metadados de geração e hashes em assets/base/grapes/crescimento/; derivados em assets/sprites/resources/. É cana-de-açúcar: nenhuma uva ou videira.
2. Semeado mostra toletes parcialmente enterrados e marcas locais pequenas, sem chão quadrado fundido; muda mostra brotos de cana com folhas estreitas; verde mostra colmos segmentados e folhas alongadas. Desenhos próprios, não madura encolhida. Mesmo pé alfa>0 da madura; altura opaca crescente, menor que a madura. Luz única superior/sul, sem componente leste-oeste, fundo transparente, pintura no estilo dos prédios aprovados. Duas tentativas no máximo por estágio; candidata reprovada não é instalada.
3. O seletor puro de textura de culturas passa a admitir grapes além de corn, só quando o PNG do estágio existe. O tick da maturidade, as dimensões e a textura madura não mudam. Falta de PNG conserva fallback anterior; outras culturas não ganham arte por engano.
4. Emenda explícita da guarda de A09: o teste de que a cana fica no fallback passa a afirmar isso quando o PNG está ausente. Uma espécie desconhecida continua no fallback mesmo se o callback disser que há textura. Novos testes A10 afirmam, caminho por caminho, escolha dos três PNGs de cana, fallback sem PNG, preservação da madura e de todos os arquivos corn de A09 por hash. Nenhuma verificação é excluída ou desativada.
5. Novo tests/I-ARTE-CANA-CRESCENDO.test.ts mede tamanho, linha dos pés, porte crescente, transparência, masters, estados do manifesto, geração/hash e seleção; cenário real semeado pelo step usa cenarioDeCanavial, sem editar sim/GameState. Roteiro tools/shots/I-ARTE-CANA-CRESCENDO.js avança pela maturação existente, afirma fontes PNG, texturas, quatro estágios e captura nos zooms0.5/1/2. Antes e depois usam a mesma partida. Prancha quatro estágios/três solos/normal e RGBx0.8, nos três zooms, aberta; validador original e revisão independente. Homologação do operador separada.
6. Reutilizar as ferramentas técnicas de A09 por parâmetro de id, preservando comportamento padrão do milho; não regenerar nem substituir seus PNGs. Testes/roteiros sempre pela trava, verify rápido verde antes do commit e verify completo ao terminar. Nenhum src/sim, prazo, GameState, .claude, AGENTS.md ou test-results.json muda. Sem merge/push.
