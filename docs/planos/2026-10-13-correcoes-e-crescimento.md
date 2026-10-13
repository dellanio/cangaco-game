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
