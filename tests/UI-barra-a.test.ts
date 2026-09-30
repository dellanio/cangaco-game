/**
 * UI-barra-a (docs/propostas/barra-lateral-unica.md): a regra do corpo da aba,
 * as abas contra o tema, o rotulo curto do engajar e o corte da faixa de alertas.
 *
 * As regras sao puras e moram em `ui/barra.ts` e `ui/alertas.ts`. A montagem no
 * DOM e a geometria (canvas (W-260) x H, so o corpo rola, a dica no topo) sao
 * provadas pelo roteiro de tela: `npm run shot -- UI-barra-a`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ABAS, ABAS_TRANCADAS, corpoDaAba, haConteudoAbaixo, rotuloCurtoDoCivil } from '../src/ui/barra';
import { LINHAS_NA_FAIXA, causasNaFaixa } from '../src/ui/alertas';
import { CAUSAS_DE_ALERTA, type CausaDeAlerta } from '../src/sim/selectors';
import temaSertao from '../data/theme-sertao.json';
import { gravarEvidencia } from './helpers/evidence';

const zeradas = (): Record<CausaDeAlerta, number> =>
  Object.fromEntries(CAUSAS_DE_ALERTA.map((c) => [c, 0])) as Record<CausaDeAlerta, number>;

describe('UI-barra-a — a barra lateral unica', () => {
  it('o corpo mostra UMA coisa: grade sem selecao, painel com selecao, opcoes na aba dela', () => {
    expect(corpoDaAba('construir', false)).toBe('grade');
    expect(corpoDaAba('construir', true)).toBe('painel');
    expect(corpoDaAba('opcoes', false)).toBe('opcoes');
    expect(corpoDaAba('estatisticas', false)).toBe('estatisticas');
    expect(corpoDaAba('opcoes', true)).toBe('opcoes');
  });

  it('as abas sao as chaves do tema, na ida e na volta; so as sem conteudo tem cadeado', () => {
    expect([...ABAS]).toEqual(Object.keys(temaSertao.barra.abas));
    // D-TRANSPORTE-02b deu conteudo a Distribuicao, a ultima trancada, e ela abre o proprio corpo
    expect([...ABAS_TRANCADAS]).toEqual([]);
    expect(corpoDaAba('distribuicao', false)).toBe('distribuicao');
    expect(corpoDaAba('distribuicao', true)).toBe('distribuicao');
    for (const aba of ABAS_TRANCADAS) expect(ABAS).toContain(aba);
    for (const texto of [temaSertao.barra.trancada, temaSertao.barra.lema, temaSertao.barra.logo]) {
      expect(texto.trim().length).toBeGreaterThan(0);
    }
  });

  it('o engajar usa o `curto` do tema e cai no nome quando nao ha', () => {
    expect(rotuloCurtoDoCivil('stonemason')).toBe(temaSertao.civis.stonemason.curto);
    expect(rotuloCurtoDoCivil('serf')).toBe(temaSertao.civis.serf.nome);
    expect(rotuloCurtoDoCivil('id-que-nao-existe')).toBe('id-que-nao-existe');
  });

  it('a sombra do pe acende com conteudo abaixo e apaga no fim da rolagem', () => {
    // corpo de 256 px sobre 463 de conteudo: o engajar da escola a 720, medido
    expect(haConteudoAbaixo(0, 256, 463)).toBe(true);
    expect(haConteudoAbaixo(205, 256, 463)).toBe(true);
    // fim da rolagem: scrollTop maximo = 463 - 256 = 207
    expect(haConteudoAbaixo(207, 256, 463)).toBe(false);
    // o scrollTop fracionario do zoom (a 1 px do fim) nao deixa a sombra acesa
    expect(haConteudoAbaixo(206.5, 256, 463)).toBe(false);
    // conteudo que cabe: nunca acende
    expect(haConteudoAbaixo(0, 256, 200)).toBe(false);
    expect(haConteudoAbaixo(0, 256, 256)).toBe(false);
  });

  it('a faixa mostra no maximo LINHAS_NA_FAIXA causas, na ordem fixa, e conta o resto', () => {
    const nenhuma = causasNaFaixa(zeradas());
    expect(nenhuma).toEqual({ visiveis: [], sobram: 0 });

    const todas = zeradas();
    for (const c of CAUSAS_DE_ALERTA) todas[c] = 1;
    const cheia = causasNaFaixa(todas);
    expect(cheia.visiveis).toEqual(CAUSAS_DE_ALERTA.slice(0, LINHAS_NA_FAIXA));
    expect(cheia.sobram).toBe(CAUSAS_DE_ALERTA.length - LINHAS_NA_FAIXA);

    // a ordem e a de CAUSAS_DE_ALERTA, nunca a da contagem
    const ultima = CAUSAS_DE_ALERTA[CAUSAS_DE_ALERTA.length - 1] as CausaDeAlerta;
    const umaSo = zeradas();
    umaSo[ultima] = 9;
    expect(causasNaFaixa(umaSo)).toEqual({ visiveis: [ultima], sobram: 0 });
  });

  it('a barra nao le sim/data nem phaser; prancha e balcao sairam', () => {
    const fonte = readFileSync(join('src/ui', 'barra.ts'), 'utf-8');
    expect(/from\s+['"].*sim\/data['"]/.test(fonte)).toBe(false);
    expect(/from\s+['"]phaser['"]/.test(fonte)).toBe(false);
    const nomes = readdirSync('src/ui');
    expect(nomes).not.toContain('prancha.ts');
    expect(nomes).not.toContain('balcao.ts');

    gravarEvidencia('UI-barra-a', {
      corpo: {
        construirSemSelecao: corpoDaAba('construir', false),
        construirComSelecao: corpoDaAba('construir', true),
        opcoes: corpoDaAba('opcoes', true),
      },
      abas: ABAS,
      trancadas: ABAS_TRANCADAS,
      rotuloCurto: { stonemason: rotuloCurtoDoCivil('stonemason'), serf: rotuloCurtoDoCivil('serf') },
      linhasNaFaixa: LINHAS_NA_FAIXA,
      verificacaoVisual: 'fora deste arquivo: npm run shot -- UI-barra-a',
    });
  });
});
