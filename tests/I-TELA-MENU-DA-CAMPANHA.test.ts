/**
 * I-TELA-MENU-DA-CAMPANHA — as regras puras da campanha no laco externo (aceite 1, e o que os aceites 3
 * e 4 do roteiro pedem do save): o progresso, a escolha pela URL, o save de uma fase que abre com o
 * mapa dela, o texto do fim e a linha do objetivo. A tela em si e o roteiro
 * `tools/shots/I-TELA-MENU-DA-CAMPANHA.js`, que carrega a partida gravada aqui.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHAVE_DO_PROGRESSO, faseAberta, gravarVitoria, lerProgresso, objetivoEmTexto, proximaFase, resumoDasFases } from '../src/campanha';
import { chaveDaGaveta, lerGaveta, mapaDaGaveta } from '../src/arquivo-da-partida';
import type { Gaveta } from '../src/arquivo-da-partida';
import { escolhaDaUrl, estadoDaEscolha } from '../src/escolha-da-partida';
import { gameData } from '../src/sim/data';
import { criarFase, dadosDaFase } from '../src/sim/fase';
import { salvar } from '../src/sim/save';
import type { GameState } from '../src/sim/state';
import { textoDoFim } from '../src/ui/fim-de-partida';
import { gravarEvidencia } from './helpers/evidence';

const ID = 'fase-01-pianco';

/** Um `localStorage` de mentira. */
function gavetaFalsa(inicial: Record<string, string> = {}): Gaveta & { readonly itens: Map<string, string> } {
  const itens = new Map(Object.entries(inicial));
  return {
    itens,
    getItem: (k: string) => itens.get(k) ?? null,
    setItem: (k: string, v: string) => { itens.set(k, v); },
    removeItem: (k: string) => { itens.delete(k); },
  } as Gaveta & { readonly itens: Map<string, string> };
}

describe('I-TELA-MENU-DA-CAMPANHA', () => {
  it('aceite 1: o progresso por tabela — sem nada so a fase 1 abre; a N vencida abre a N+1; ilegivel e nada', () => {
    const casos: [string, Record<string, string>, number[]][] = [
      ['sem gravacao', {}, []],
      ['a fase 1 vencida', { [CHAVE_DO_PROGRESSO]: '{"vencidas":[1]}' }, [1]],
      ['fora de ordem e com lixo', { [CHAVE_DO_PROGRESSO]: '{"vencidas":[3,"x",1,0,2.5]}' }, [1, 3]],
      ['ilegivel', { [CHAVE_DO_PROGRESSO]: 'nao e json' }, []],
      ['sem a lista', { [CHAVE_DO_PROGRESSO]: '{"outra":1}' }, []],
    ];
    for (const [nome, inicial, esperado] of casos) expect(lerProgresso(gavetaFalsa(inicial)), nome).toEqual(esperado);
    expect(lerProgresso(null)).toEqual([]);
    const abertas = (v: number[]): number[] => [1, 2, 3, 4].filter((n) => faseAberta(v, n));
    expect(abertas([])).toEqual([1]);
    expect(abertas([1])).toEqual([1, 2]);
    expect(abertas([1, 2])).toEqual([1, 2, 3]);
    // gravar e idempotente e mantem a ordem
    const g = gavetaFalsa();
    gravarVitoria(g, 2);
    gravarVitoria(g, 1);
    gravarVitoria(g, 2);
    expect(lerProgresso(g)).toEqual([1, 2]);
    expect(() => { gravarVitoria(null, 1); }).not.toThrow();
  });

  it('a lista das fases, a seguinte e a escolha pela URL', () => {
    const fases = resumoDasFases();
    expect(fases.map((f) => f.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(fases[0]).toMatchObject({ id: ID, local: 'Piancó' });
    expect(proximaFase(ID)).toBe('fase-02-patos');
    expect(proximaFase('fase-10-cabedelo')).toBe(null);
    expect(escolhaDaUrl(`?campanha=${ID}&pausado`)).toEqual({ modo: 'campanha', fase: ID });
    expect(escolhaDaUrl('?gaveta=2&pausado')).toEqual({ modo: 'carregar', gaveta: 2 });
    expect(escolhaDaUrl('?gaveta=9')).toEqual({ modo: 'livre' });
    const r = estadoDaEscolha({ modo: 'campanha', fase: ID }, null);
    expect(r.ok && r.estado.fase?.id).toBe(ID);
  });

  it('aceite 4: o save de uma fase abre com o mapa dela, mesmo lido por uma pagina do sertao', () => {
    const dados = dadosDaFase(ID);
    const s = criarFase(ID, dados);
    const g = gavetaFalsa({ [chaveDaGaveta(1)]: salvar(s, dados) });
    expect(mapaDaGaveta(g, 1)).toBe(ID);
    const lido = lerGaveta(g, 1, gameData);
    expect(lido.ok).toBe(true);
    if (lido.ok) expect(JSON.stringify(lido.estado)).toBe(JSON.stringify(s));
    // um save do sertao continua abrindo com o sertao
    const doSertao = gavetaFalsa({ [chaveDaGaveta(2)]: salvar(estadoDaEscolha({ modo: 'livre' }, null).ok ? (estadoDaEscolha({ modo: 'livre' }, null) as { estado: GameState }).estado : s) });
    expect(mapaDaGaveta(doSertao, 2)).toBe(gameData.mapa.id);
    expect(lerGaveta(doSertao, 2, gameData).ok).toBe(true);
  });

  it('o texto do fim de uma fase e a linha do objetivo', () => {
    const dados = dadosDaFase(ID);
    const s = criarFase(ID, dados);
    const vitoria: GameState = { ...s, partida: { fim: 'vitoria', tick: 1 } };
    const derrota: GameState = { ...s, partida: { fim: 'derrota', tick: 1 } };
    const fase = { numero: 1, local: 'Piancó', proxima: 'fase-02-patos' };
    expect(textoDoFim(vitoria, undefined, fase)?.titulo).toContain('Piancó');
    expect(textoDoFim(derrota, undefined, fase)?.titulo).toContain('Piancó');
    expect(textoDoFim(vitoria, undefined, { ...fase, proxima: null })?.descricao).not.toBe(textoDoFim(vitoria, undefined, fase)?.descricao);
    expect(textoDoFim(s, undefined, fase)).toBe(null);
    const objetivo = objetivoEmTexto(s, dados);
    expect(objetivo).toContain('Cabo Branco');
    expect(objetivoEmTexto(estadoDaEscolha({ modo: 'livre' }, null).ok ? (estadoDaEscolha({ modo: 'livre' }, null) as { estado: GameState }).estado : s, gameData)).toBe(null);
    gravarEvidencia('I-TELA-MENU-DA-CAMPANHA', { objetivo, vitoria: textoDoFim(vitoria, undefined, fase) });
  });

  it('grava a partida do roteiro: a fase 1 a um tick da vitoria (o Cabo Branco ja sem predios)', () => {
    const dados = dadosDaFase(ID);
    const s = criarFase(ID, dados);
    const ordem = s.predios.ordem.filter((id) => s.predios.porId[id]?.lado !== 1);
    const quase: GameState = { ...s, predios: { porId: Object.fromEntries(ordem.map((id) => [id, s.predios.porId[id]])), ordem } } as GameState;
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/I-TELA-MENU-DA-CAMPANHA.save.txt`, salvar(quase, dados));
  });
});
