import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { DIRECOES } from '../src/render/manifesto';
import type { Manifesto } from '../src/render/manifesto';
import { direcaoMilitar, alvoDaDirecao } from '../src/render/direcao-de-unidade';
import { mesclarManifestos, tiposDeDepuracao, spriteDoAtlas } from '../src/render/animacao-de-unidade';
import { atlasesParaCarregar } from '../src/render/sprites';
import { createInitialState } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { step } from '../src/sim/tick';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';
describe('D-TELA-05b — direção e atlas militar', () => {
  it('militar usa os oito octantes da sim, inclusive parado; civil mantém vetor do passo', () => {
    for (const [d, nome] of DIRECOES.entries()) {
      expect(direcaoMilitar(d)).toBe(nome);
      expect(alvoDaDirecao('militia', d, -1, 0, 8)).toBe(nome);
      expect(alvoDaDirecao('warrior', d, 0, 0, 8)).toBe(nome);
    }
    expect(direcaoMilitar(undefined)).toBe('s');
    for (const d of [-1,8,1.5,NaN]) expect(() => direcaoMilitar(d)).toThrow();
    expect(alvoDaDirecao('serf', 0, 1, 1, 8)).toBe('se');
    expect(alvoDaDirecao('serf', 0, 0, 0, 8)).toBeNull();
  });
  it('isola os tipos de depuração e preserva outros assets ao mesclar', () => {
    expect(tiposDeDepuracao('')).toEqual([]);
    expect(tiposDeDepuracao('?depuracao')).toEqual(['serf']);
    expect(tiposDeDepuracao('?depuracao=militia,militia,inventado')).toEqual(['militia']);
    expect(tiposDeDepuracao('?vitrine=militia')).toEqual(['militia']);
    const real = JSON.parse(readFileSync('assets/manifest.json','utf8')) as Manifesto;
    const dep = JSON.parse(readFileSync('assets/depuracao/manifesto.json','utf8')) as Manifesto;
    const m = mesclarManifestos(real, { ...dep, assets: dep.assets.filter((a) => a.id === 'militia') });
    expect(m.assets.find((a) => a.id === 'storehouse')).toEqual(real.assets.find((a) => a.id === 'storehouse'));
    expect(m.assets.filter((a) => a.id === 'militia')).toHaveLength(1);
    expect(mesclarManifestos(real)).toBe(real);
    const dados = JSON.parse(readFileSync('assets/depuracao/militia/militia.json','utf8'));
    const urls = {'depuracao/militia/militia.png':'/militia.png'};
    expect(atlasesParaCarregar(m, urls, {'depuracao/militia/militia.json':dados})).toHaveLength(1);
    expect(atlasesParaCarregar(m, {}, {'depuracao/militia/militia.json':dados})).toEqual([]);
    expect(atlasesParaCarregar(m, urls, {})).toEqual([]);
    const quadro = 'militia/parado/o/0000';
    expect(spriteDoAtlas(dep,'militia','parado','o',0,(_k, f) => f === quadro)?.espelhar).toBe(false);
  });
  it('ordem real termina na orientação final; salva abertura e marcha do roteiro', () => {
    const u: Unidade = {id:'piloto',tipo:'militia',lado:0,...naVila(8,8),fsm:'ocioso',fsmData:{},
      condicao:condicaoCheiaDoTipo('militia'),direcao:2};
    const s: GameState = {...createInitialState(1),unidades:{porId:{piloto:u},ordem:['piloto']}};
    const inicio = step(s,[{type:'MoveUnits',unidades:['piloto'],destino:naVila(8,12),direcao:0}]);
    let fim = inicio;
    for (let i=0;i<600 && fim.unidades.porId.piloto?.fsm !== 'ocioso';i++) fim=step(fim,[]);
    expect(fim.unidades.porId.piloto?.fsm).toBe('ocioso');
    expect(fim.unidades.porId.piloto?.direcao).toBe(0);
    const dir=process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output'; mkdirSync(dir,{recursive:true});
    writeFileSync(`${dir}/D-TELA-05b-inicio.save.txt`,salvar(s));
    writeFileSync(`${dir}/D-TELA-05b-marcha.save.txt`,salvar(inicio));
    gravarEvidencia('D-TELA-05b',{inicio:s.tick,marcha:inicio.tick,fim:fim.tick,direcao:0});
  });
});
