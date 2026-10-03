/**
 * F-SPR — o carregamento de sprite de terreno, recurso, vegetacao e unidade.
 *
 * Prova os DOIS lados do §9, como a F17f: com a textura declarada E carregada, o
 * resolvedor devolve a chave; sem entrada, sem estado ou sem arquivo, devolve o
 * placeholder de hoje (`null` ou `marcador`). Nenhum arquivo de arte existe nesta
 * feature — os casos com arte usam manifesto sintetico, e o `carregada` do teste
 * faz o papel do loader do Phaser.
 *
 * Os guardas do manifesto REAL valem para as entradas que o Codex (ou quem for)
 * acrescentar depois, e cada um prova que acusa com uma entrada sintetica errada.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  assetDoPredio, chaveDaPose, chaveDaTextura, chaveDeTextura, desenhoDoRecurso, direcaoDoPasso,
  ehEntradaDePredio, spriteDaUnidade, texturaDaCamada, DIRECOES, DIRECOES_DE_QUATRO,
  ESTADO_DO_TERRENO, ESTADO_PRESENTE, POSE_PARADO, TIPOS_DE_CAMADA,
} from '../src/render/manifesto';
import type {
  Direcao, EntradaDeAsset, EntradaDeCamada, Manifesto, TexturaCarregada, TipoDeCamada,
} from '../src/render/manifesto';
import { direcoesDoTipo, direcoesPorTipo } from '../src/render/direcoes-de-sprite';
import { prediosSemArteDaBusca, texturasParaCarregar } from '../src/render/sprites';
import { recursosDeRender, terrenoDeRender } from '../src/render/mapa';
import { CHAO_DA_CANA } from '../src/render/chao-da-roca';
import { gravarEvidencia } from './helpers/evidence';

const manifestoReal = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;
const unidadesJson = JSON.parse(readFileSync('data/units.json', 'utf8')) as Record<string, unknown>;

function camada(tipo: TipoDeCamada, id: string, estados: Record<string, string>): EntradaDeCamada {
  return {
    id, tipo, footprint: [1, 1], tamanho: [64, 96], anchor: [0.5, 1], estados,
    licenca: 'sintetica, so no teste', origem: { base: `base/${id}/${id}.png`, semente: null },
  };
}

function predio(id: string): EntradaDeAsset {
  return {
    id, tipo: 'predio', footprint: [3, 3], tamanho: [192, 128], anchor: [0.5, 1],
    estados: { completo: `sprites/${id}/completo.png` },
    licenca: 'sintetica, so no teste', origem: { base: `base/${id}/${id}.png`, semente: null },
  };
}

/** O loader sintetico: carregou tudo o que o manifesto declara. */
function tudoCarregado(m: Manifesto): TexturaCarregada {
  const chaves = new Set(m.assets.flatMap((e) => Object.keys(e.estados).map((s) => chaveDeTextura(e.tipo, e.id, s))));
  return (chave) => chaves.has(chave);
}
const nadaCarregado: TexturaCarregada = () => false;

/**
 * O que o manifesto real nao pode ter numa entrada de camada. Cada item e uma frase
 * com o id, para a reprovacao dizer onde olhar:
 * - id de terreno que o mapa nao conhece, ou de recurso/vegetacao que nao e recurso;
 * - o mesmo id como `recurso` E `vegetacao` (a vegetacao vence e a textura vira arte morta);
 * - unidade de tipo sem `direcoesDeSprite` no dado, ou estado que nao e
 *   `<pose>:<direcao>` com direcao do conjunto do tipo.
 */
function problemasDasCamadas(m: Manifesto, direcoes: ReadonlyMap<string, 4 | 8 | null>): string[] {
  const problemas: string[] = [];
  const camadas = m.assets.filter((e): e is EntradaDeCamada => !ehEntradaDePredio(e));
  for (const e of camadas) {
    // D-ARTE-CHAO-DE-ROCA: o chao da cana e terreno so de render (camada sob a cultura), e nao
    // tipo do mapa. Vale o id que o proprio render declara, e nenhum outro.
    const ehTerrenoDoMapa = (terrenoDeRender.tipos as readonly string[]).includes(e.id);
    if (e.tipo === 'terreno' && !ehTerrenoDoMapa && e.id !== CHAO_DA_CANA) {
      problemas.push(`terreno '${e.id}' nao existe no mapa`);
    }
    if ((e.tipo === 'recurso' || e.tipo === 'vegetacao') && !recursosDeRender.tipos.includes(e.id)) {
      problemas.push(`${e.tipo} '${e.id}' nao e um recurso do mapa`);
    }
    // D-ARTE-SOLO-CAATINGA: decalque e arte independente, sem recurso na sim.
    if (e.tipo === 'decalque') {
      if (e.anchor.length !== 2 || e.anchor[0] !== 0.5 || e.anchor[1] !== 1) {
        problemas.push(`decalque '${e.id}' precisa de anchor [0.5, 1]`);
      }
      for (const [estado, arquivo] of Object.entries(e.estados)) {
        if (!arquivo.endsWith('.png') || !existsSync(`assets/${arquivo}`)) {
          problemas.push(`decalque '${e.id}/${estado}' precisa de PNG existente`);
        }
      }
    }
    if (e.tipo === 'vegetacao' && camadas.some((o) => o.tipo === 'recurso' && o.id === e.id)) {
      problemas.push(`'${e.id}' e recurso E vegetacao`);
    }
    if (e.tipo === 'unidade') {
      const n = direcoes.get(e.id) ?? null;
      if (n === null) {
        problemas.push(`unidade '${e.id}' nao declara direcoesDeSprite em units.json`);
        continue;
      }
      const validas: readonly string[] = n === 4 ? DIRECOES_DE_QUATRO : DIRECOES;
      for (const estado of Object.keys(e.estados)) {
        const [pose, direcao, ...resto] = estado.split(':');
        if (!pose || direcao === undefined || resto.length > 0 || !validas.includes(direcao)) {
          problemas.push(`unidade '${e.id}': estado '${estado}' nao e <pose>:<direcao> de ${n} direcoes`);
        }
      }
    }
  }
  return problemas;
}

describe('F-SPR — o manifesto aceita as camadas novas sem mudar a entrada de predio', () => {
  it('a chave de predio e a mesma de antes, e a de camada tem o tipo na frente', () => {
    expect(chaveDaTextura('storehouse', 'completo')).toBe('predio:storehouse:completo');
    expect(chaveDeTextura('predio', 'storehouse', 'completo')).toBe(chaveDaTextura('storehouse', 'completo'));
    expect(chaveDeTextura('terreno', 'grama', ESTADO_DO_TERRENO)).toBe('terreno:grama:padrao');
    expect(chaveDeTextura('unidade', 'serf', chaveDaPose(POSE_PARADO, 'l'))).toBe('unidade:serf:parado:l');
  });

  it('predio e camada com o MESMO id nao se confundem', () => {
    const m: Manifesto = { versao: 1, assets: [predio('tree'), camada('vegetacao', 'tree', { presente: 'x.png' })] };
    expect(assetDoPredio(m, 'tree')?.tipo).toBe('predio');
    expect(texturaDaCamada(m, 'vegetacao', 'tree', ESTADO_PRESENTE, tudoCarregado(m))).toBe('vegetacao:tree:presente');
    expect(texturaDaCamada(m, 'recurso', 'tree', ESTADO_PRESENTE, tudoCarregado(m))).toBeNull();
    // e o predio sozinho num manifesto nao da arte a camada nenhuma
    const soPredio: Manifesto = { versao: 1, assets: [predio('tree')] };
    expect(desenhoDoRecurso(soPredio, 'tree', tudoCarregado(soPredio))).toEqual({ como: 'marcador' });
  });

  it('texturasParaCarregar enfileira todo tipo e so o que tem URL', () => {
    const m: Manifesto = {
      versao: 1,
      assets: [
        predio('storehouse'),
        camada('terreno', 'grama', { padrao: 'sprites/grama/padrao.png' }),
        camada('unidade', 'serf', { 'parado:s': 'sprites/serf/s.png', 'parado:l': 'sprites/serf/l.png' }),
      ],
    };
    const urls = {
      'sprites/storehouse/completo.png': '/u/1.png',
      'sprites/grama/padrao.png': '/u/2.png',
      'sprites/serf/s.png': '/u/3.png',
      // `sprites/serf/l.png` falta: nao entra na fila, e nao vira 404
    };
    expect(texturasParaCarregar(m, urls)).toEqual([
      { chave: 'predio:storehouse:completo', url: '/u/1.png' },
      { chave: 'terreno:grama:padrao', url: '/u/2.png' },
      { chave: 'unidade:serf:parado:s', url: '/u/3.png' },
    ]);
    expect(texturasParaCarregar(m, {})).toEqual([]);
  });

  it('`?semArte=` tira do loader so o predio pedido, e nenhuma outra camada', () => {
    const m: Manifesto = {
      versao: 1,
      assets: [predio('storehouse'), predio('quarry'), camada('terreno', 'quarry', { padrao: 'sprites/q/padrao.png' })],
    };
    const urls = {
      'sprites/storehouse/completo.png': '/u/1.png',
      'sprites/quarry/completo.png': '/u/2.png',
      'sprites/q/padrao.png': '/u/3.png',
    };
    expect(texturasParaCarregar(m, urls, prediosSemArteDaBusca('?pausado&semArte=quarry'))).toEqual([
      { chave: 'predio:storehouse:completo', url: '/u/1.png' },
      { chave: 'terreno:quarry:padrao', url: '/u/3.png' },
    ]);
    expect([...prediosSemArteDaBusca('?semArte=quarry, watchtower')]).toEqual(['quarry', 'watchtower']);
    expect(prediosSemArteDaBusca('?pausado').size).toBe(0);
    expect(prediosSemArteDaBusca('?semArte=').size).toBe(0);
  });
});

describe('F-SPR — terreno e recurso: textura de tile, ou o placeholder', () => {
  it('terreno com textura carregada resolve a chave; sem entrada, sem estado ou sem arquivo, null', () => {
    const m: Manifesto = { versao: 1, assets: [camada('terreno', 'agua', { padrao: 'sprites/agua.png' })] };
    expect(texturaDaCamada(m, 'terreno', 'agua', ESTADO_DO_TERRENO, tudoCarregado(m))).toBe('terreno:agua:padrao');
    expect(texturaDaCamada(m, 'terreno', 'grama', ESTADO_DO_TERRENO, tudoCarregado(m))).toBeNull();
    expect(texturaDaCamada(m, 'terreno', 'agua', 'estado_que_nao_existe', tudoCarregado(m))).toBeNull();
    expect(texturaDaCamada(m, 'terreno', 'agua', ESTADO_DO_TERRENO, nadaCarregado)).toBeNull();
  });

  it('recurso: textura > marcador; vegetacao vence textura; nada carregado e marcador', () => {
    const m: Manifesto = {
      versao: 1,
      assets: [
        camada('recurso', 'rock', { presente: 'sprites/rock.png' }),
        camada('vegetacao', 'tree', { presente: 'sprites/tree.png' }),
      ],
    };
    const c = tudoCarregado(m);
    expect(desenhoDoRecurso(m, 'rock', c)).toEqual({ como: 'textura', chave: 'recurso:rock:presente' });
    const arvore = desenhoDoRecurso(m, 'tree', c);
    expect(arvore.como).toBe('vegetacao');
    expect(arvore.como === 'vegetacao' && arvore.chave).toBe('vegetacao:tree:presente');
    expect(arvore.como === 'vegetacao' && arvore.entrada.anchor).toEqual([0.5, 1]);
    expect(desenhoDoRecurso(m, 'fish', c)).toEqual({ como: 'marcador' });
    expect(desenhoDoRecurso(m, 'rock', nadaCarregado)).toEqual({ como: 'marcador' });
    expect(desenhoDoRecurso(m, 'tree', nadaCarregado)).toEqual({ como: 'marcador' });
  });
});

describe('F-SPR — unidade: um arquivo por direcao, oeste espelhado', () => {
  const serf = camada('unidade', 'serf', {
    'parado:n': 'n.png', 'parado:l': 'l.png', 'parado:s': 's.png',
  });
  const militia = camada('unidade', 'militia', {
    'parado:n': 'n.png', 'parado:ne': 'ne.png', 'parado:l': 'l.png', 'parado:se': 'se.png', 'parado:s': 's.png',
  });
  const m: Manifesto = { versao: 1, assets: [serf, militia] };
  const c = tudoCarregado(m);

  it('4 direcoes custam 3 arquivos: o oeste e o leste virado', () => {
    for (const d of ['n', 'l', 's'] as const) {
      expect(spriteDaUnidade(m, 'serf', POSE_PARADO, d, 4, c)).toMatchObject({ chave: `unidade:serf:parado:${d}`, espelhar: false });
    }
    expect(spriteDaUnidade(m, 'serf', POSE_PARADO, 'o', 4, c)).toMatchObject({ chave: 'unidade:serf:parado:l', espelhar: true });
  });

  it('8 direcoes custam 5 arquivos: no, so e o sao espelho de ne, se e l', () => {
    expect(spriteDaUnidade(m, 'militia', POSE_PARADO, 'no', 8, c)).toMatchObject({ chave: 'unidade:militia:parado:ne', espelhar: true });
    expect(spriteDaUnidade(m, 'militia', POSE_PARADO, 'so', 8, c)).toMatchObject({ chave: 'unidade:militia:parado:se', espelhar: true });
    expect(spriteDaUnidade(m, 'militia', POSE_PARADO, 'o', 8, c)).toMatchObject({ chave: 'unidade:militia:parado:l', espelhar: true });
  });

  it('diagonal sem quadro cai na horizontal: o civil de 8 com arte de 3 desenha como o de 4', () => {
    // a arte civil de hoje e `n l s`; o dado passou a 8 (decisao do operador, 2026-09-30)
    for (const [d, passo] of [['ne', [1, -1]], ['se', [1, 1]], ['no', [-1, -1]], ['so', [-1, 1]]] as const) {
      const com8 = spriteDaUnidade(m, 'serf', POSE_PARADO, d, 8, c);
      const com4 = spriteDaUnidade(m, 'serf', POSE_PARADO, direcaoDoPasso(passo[0], passo[1], 4) as Direcao, 4, c);
      expect(com8, d).not.toBeNull();
      expect(com8, d).toEqual(com4);
    }
    // com o quadro diagonal, ele vence a horizontal
    expect(spriteDaUnidade(m, 'militia', POSE_PARADO, 'se', 8, c)).toMatchObject({ chave: 'unidade:militia:parado:se', espelhar: false });
  });

  it('a direcao declarada vence o espelho', () => {
    const comOeste: Manifesto = { versao: 1, assets: [camada('unidade', 'serf', { 'parado:l': 'l.png', 'parado:o': 'o.png' })] };
    expect(spriteDaUnidade(comOeste, 'serf', POSE_PARADO, 'o', 4, tudoCarregado(comOeste)))
      .toMatchObject({ chave: 'unidade:serf:parado:o', espelhar: false });
  });

  it('o outro lado: sem entrada, sem direcao, sem arquivo ou fora do conjunto do tipo, placeholder', () => {
    expect(spriteDaUnidade(m, 'stonemason', POSE_PARADO, 's', 4, c)).toBeNull();
    expect(spriteDaUnidade(m, 'serf', POSE_PARADO, 'ne', 4, c)).toBeNull(); // civil nao tem diagonal
    expect(spriteDaUnidade(m, 'serf', POSE_PARADO, 's', null, c)).toBeNull(); // tipo sem direcoes no dado
    expect(spriteDaUnidade(m, 'serf', POSE_PARADO, 's', 4, nadaCarregado)).toBeNull();
    expect(spriteDaUnidade(m, 'serf', 'andando', 's', 4, c)).toBeNull(); // pose sem arte
    const soLeste: Manifesto = { versao: 1, assets: [camada('unidade', 'serf', { 'parado:l': 'l.png' })] };
    expect(spriteDaUnidade(soLeste, 'serf', POSE_PARADO, 'o', 4, nadaCarregado)).toBeNull();
  });

  it('a direcao do passo: 4 cai nos eixos, 8 separa a diagonal', () => {
    expect(direcaoDoPasso(0, 0, 8)).toBeNull();
    expect(direcaoDoPasso(1, 0, 4)).toBe('l');
    expect(direcaoDoPasso(-1, 0, 4)).toBe('o');
    expect(direcaoDoPasso(0, 1, 4)).toBe('s');
    expect(direcaoDoPasso(0, -1, 4)).toBe('n');
    expect(direcaoDoPasso(1, 1, 4)).toBe('l'); // empate na diagonal cai na horizontal
    expect(direcaoDoPasso(-1, -1, 4)).toBe('o');
    const oito: Record<string, Direcao> = {
      '0,-1': 'n', '1,-1': 'ne', '1,0': 'l', '1,1': 'se', '0,1': 's', '-1,1': 'so', '-1,0': 'o', '-1,-1': 'no',
    };
    for (const [passo, esperada] of Object.entries(oito)) {
      const [dx, dy] = passo.split(',').map(Number) as [number, number];
      expect(direcaoDoPasso(dx * 0.2, dy * 0.2, 8), passo).toBe(esperada);
    }
    expect(direcaoDoPasso(1, 0.3, 8)).toBe('l'); // eixo menor que metade conta como zero
    // toda direcao de 4 esta no conjunto de 4: o sprite do civil sempre tem para onde olhar
    for (const [dx, dy] of [[1, 0.9], [-0.2, 1], [0.5, -0.5], [-3, 2]] as const) {
      expect(DIRECOES_DE_QUATRO).toContain(direcaoDoPasso(dx, dy, 4));
    }
  });

  it('as direcoes vem de units.json: os 28 tipos, nos tres grupos, todos 8', () => {
    // civis 4 -> 8: decisao do operador, 2026-09-30 (BUILD_PLAN, nota da F-SPR); os mercenarios
    // entraram na D-TELA-05e (antes, `null`)
    const grupos = unidadesJson as Record<string, { tipos: { id: string }[] }>;
    const porGrupo = { civis: grupos.civis!.tipos, militares: grupos.militares!.tipos, mercenarios: grupos.mercenarios!.tipos };
    for (const [nome, tipos] of Object.entries(porGrupo)) {
      expect(tipos.length, nome).toBeGreaterThan(0);
      for (const t of tipos) expect(direcoesDoTipo(t.id), `${nome}/${t.id}`).toBe(8);
    }
    expect(Object.values(porGrupo).reduce((n, tipos) => n + tipos.length, 0)).toBe(28);
    expect(direcoesDoTipo('tipo_que_nao_existe')).toBeNull();
    // override por tipo vence o _comum; numero fora de 4 e 8 reprova alto
    const dado = { civis: { _comum: { direcoesDeSprite: 4 }, tipos: [{ id: 'a' }, { id: 'b', direcoesDeSprite: 8 }] } };
    expect([...direcoesPorTipo(dado)]).toEqual([['a', 4], ['b', 8]]);
    expect(() => direcoesPorTipo({ civis: { _comum: { direcoesDeSprite: 6 }, tipos: [{ id: 'a' }] } })).toThrow(/6 direcoes/);
  });
});

describe('F-SPR — o manifesto real', () => {
  it('decalque dispensa recurso do mapa, mas exige PNG existente e anchor no pe', () => {
    const direcoes = direcoesPorTipo();
    const png = 'sprites/terrain/areia.png';
    const verificar = (entrada: EntradaDeCamada): string[] =>
      problemasDasCamadas({ versao: 1, assets: [entrada] }, direcoes);
    const valido = camada('decalque', 'capim', { 'palha-1': png });
    expect(TIPOS_DE_CAMADA).toContain('decalque');
    expect(recursosDeRender.tipos).not.toContain('capim');
    expect(verificar(valido)).toEqual([]);
    expect(verificar(camada('vegetacao', 'capim', { 'palha-1': png }))).toEqual([
      "vegetacao 'capim' nao e um recurso do mapa",
    ]);
    expect(verificar({ ...valido, anchor: [0.5, 0.5] })).toEqual([
      "decalque 'capim' precisa de anchor [0.5, 1]",
    ]);
    expect(verificar({ ...valido, estados: { 'palha-1': 'sprites/capim/inexistente.png' } })).toEqual([
      "decalque 'capim/palha-1' precisa de PNG existente",
    ]);
    // Existe no disco, mas nao e PNG: existencia sozinha nao basta.
    expect(verificar({ ...valido, estados: { 'palha-1': 'manifest.json' } })).toEqual([
      "decalque 'capim/palha-1' precisa de PNG existente",
    ]);
  });
  it('nenhuma entrada de camada tem problema — e o guarda acusa cada um', () => {
    const direcoes = direcoesPorTipo();
    expect(problemasDasCamadas(manifestoReal, direcoes)).toEqual([]);
    const errado: Manifesto = {
      versao: 1,
      assets: [
        camada('terreno', 'lava', { padrao: 'x.png' }),
        camada('vegetacao', 'cacto', { presente: 'x.png' }),
        camada('recurso', 'tree', { presente: 'x.png' }),
        camada('vegetacao', 'tree', { presente: 'x.png' }),
        // um tipo que o dado nao conhece: desde a D-TELA-05e todo tipo do dado declara direcoes
        camada('unidade', 'tipo_sem_direcao', { 'parado:s': 'x.png' }),
        camada('unidade', 'serf', { 'parado:ne': 'x.png', parado: 'x.png', 'parado:s': 'x.png' }),
      ],
    };
    expect(problemasDasCamadas(errado, direcoes)).toEqual([
      "terreno 'lava' nao existe no mapa",
      "vegetacao 'cacto' nao e um recurso do mapa",
      "'tree' e recurso E vegetacao",
      "unidade 'tipo_sem_direcao' nao declara direcoesDeSprite em units.json",
      "unidade 'serf': estado 'parado' nao e <pose>:<direcao> de 8 direcoes",
    ]);
    // o guarda da diagonal num tipo de 4 continua acusando (o serf era 4 ate 2026-10-01)
    expect(problemasDasCamadas(errado, new Map([...direcoes, ['serf', 4]]))).toContain(
      "unidade 'serf': estado 'parado:ne' nao e <pose>:<direcao> de 4 direcoes",
    );
  });

  // A regra, nao o retrato do dia (licao da F17f): cada id resolve arte se e so se o
  // manifesto declara a entrada E a textura esta na fila do loader.
  it('cada camada resolve arte se e so se o manifesto declara e o loader carrega', () => {
    const naFila = new Set(texturasParaCarregar().map((t) => t.chave));
    const carregada: TexturaCarregada = (chave) => naFila.has(chave);
    for (const id of terrenoDeRender.tipos) {
      const declarada = manifestoReal.assets.some((e) => e.tipo === 'terreno' && e.id === id);
      const chave = texturaDaCamada(manifestoReal, 'terreno', id, ESTADO_DO_TERRENO, carregada);
      if (!declarada) expect(chave, id).toBeNull();
      else expect(chave === null || naFila.has(chave), id).toBe(true);
    }
    for (const id of recursosDeRender.tipos) {
      const declarada = manifestoReal.assets.some((e) => (e.tipo === 'recurso' || e.tipo === 'vegetacao') && e.id === id);
      const desenho = desenhoDoRecurso(manifestoReal, id, carregada);
      if (!declarada) expect(desenho, id).toEqual({ como: 'marcador' });
      else if (desenho.como !== 'marcador') expect(naFila.has(desenho.chave), id).toBe(true);
    }
  });

  it('grava a evidencia', () => {
    const naFila = new Set(texturasParaCarregar().map((t) => t.chave));
    const carregada: TexturaCarregada = (chave) => naFila.has(chave);
    const direcoes = direcoesPorTipo();
    gravarEvidencia('F-SPR-carregamento', {
      feature: 'F-SPR-carregamento',
      tiposDoManifesto: ['predio', ...TIPOS_DE_CAMADA],
      entradasNoManifestoReal: manifestoReal.assets.reduce<Record<string, number>>((acc, e) => {
        acc[e.tipo] = (acc[e.tipo] ?? 0) + 1;
        return acc;
      }, {}),
      terrenoComArte: terrenoDeRender.tipos.filter(
        (id) => texturaDaCamada(manifestoReal, 'terreno', id, ESTADO_DO_TERRENO, carregada) !== null,
      ),
      recursos: Object.fromEntries(recursosDeRender.tipos.map((id) => [id, desenhoDoRecurso(manifestoReal, id, carregada).como])),
      direcoesPorTipo: Object.fromEntries(direcoes),
      contrato: {
        chave: '<tipo>:<id>:<estado>; predio continua predio:<id>:<estagio>',
        terreno: 'estado "padrao", redimensionado para o tile',
        recursoEVegetacao: 'estado "presente"; vegetacao vence textura; esgotado continua marcador',
        unidade: 'estado "<pose>:<direcao>", direcoes n ne l se s so o no; o/no/so espelham l/ne/se',
      },
    });
  });
});
