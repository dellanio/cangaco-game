// Instrumenta o Vite real no processo do CLI; nao substitui seus modulos.
const Module = require('node:module');
const { writeFileSync } = require('node:fs');
const carregar = Module._load;
Module._load = function (...args) {
  const modulo = carregar.apply(this, args);
  if (args[0] !== 'vite') return modulo;
  return new Proxy(modulo, { get(target, key) {
    if (key !== 'createServer') return Reflect.get(target, key);
    return async (opcoes) => {
      writeFileSync(process.env.CANGACO_CLI_OBSERVADO, JSON.stringify({watch: opcoes.server.watch ?? 'padrao', semWatch: opcoes.server.watch === null}));
      const server = await target.createServer(opcoes);
      const fechar = server.close.bind(server);
      server.close = async () => {
        writeFileSync(process.env.CANGACO_CLI_OBSERVADO, JSON.stringify({semWatch: opcoes.server.watch === null, diretoriosObservados: Object.keys(server.watcher.getWatched()).length}));
        await fechar();
      };
      return server;
    };
  }});
};
