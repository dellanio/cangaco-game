/** Adapta a fixture de teste ao mundo deslocado; não migra saves de produção. */
interface MundoDaFixture {
  readonly id: string;
  readonly hash: string;
  readonly largura: number;
  readonly altura: number;
}

function deslocar(valor: unknown, k: number): unknown {
  if (Array.isArray(valor)) return valor.map((v: unknown) => deslocar(v, k));
  if (typeof valor === 'string' && /^\d+,\d+$/.test(valor)) {
    const [x, y] = valor.split(',').map(Number);
    return `${x! + k},${y! + k}`;
  }
  if (valor === null || typeof valor !== 'object') return valor;
  return Object.fromEntries(Object.entries(valor).map(([chave, v]) => {
    const chaveNova = /^\d+,\d+$/.test(chave) ? deslocar(chave, k) as string : chave;
    return [chaveNova, (chave === 'gx' || chave === 'gy') && typeof v === 'number' ? v + k : deslocar(v, k)];
  }));
}

export function fixtureSaveTransladado(texto: string, origem: MundoDaFixture, destino: MundoDaFixture, k: number): string {
  const envelope = JSON.parse(texto) as { mapa: string; hashDoMapa: string; estado: Record<string, unknown> };
  if (envelope.mapa !== origem.id || envelope.hashDoMapa !== origem.hash) {
    throw new Error('fixture transladada: save incompatível com o mapa versionado');
  }
  if (!Number.isInteger(k) || k < 0 || destino.id !== origem.id
    || destino.largura !== origem.largura + k || destino.altura !== origem.altura + k) {
    throw new Error('fixture transladada: deslocamento ou dimensões incompatíveis');
  }
  const descoberto = envelope.estado['descoberto'] as Record<string, number[]> | undefined;
  const estado = deslocar(envelope.estado, k) as Record<string, unknown>;
  if (descoberto !== undefined) {
    estado['descoberto'] = Object.fromEntries(Object.entries(descoberto).map(([lado, palavras]) => {
      const novas = Array<number>(Math.ceil(destino.largura * destino.altura / 32)).fill(0);
      for (let i = 0; i < origem.largura * origem.altura; i++) {
        if (((palavras[i >>> 5] ?? 0) & (1 << (i & 31))) === 0) continue;
        const x = i % origem.largura + k;
        const y = Math.floor(i / origem.largura) + k;
        const indice = y * destino.largura + x;
        novas[indice >>> 5] = (novas[indice >>> 5]! | (1 << (indice & 31))) >>> 0;
      }
      return [lado, novas];
    }));
  }
  return JSON.stringify({ ...envelope, hashDoMapa: destino.hash, estado });
}
