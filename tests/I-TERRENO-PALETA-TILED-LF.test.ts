import { expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
it('checkout com autocrlf=true preserva os bytes LF da paleta canônica', () => {
  const dir=mkdtempSync(join(tmpdir(),'pianco-paleta-checkout-'));
  const parent=resolve(tmpdir()), target=resolve(dir);
  if(!target.startsWith(parent+'\\') && !target.startsWith(parent+'/')) throw new Error('temp fora do diretório autorizado');
  try {
    const git=(...args:string[])=>execFileSync('git',['-C',dir,...args],{encoding:'utf8'});
    git('init','-q'); git('config','core.autocrlf','true');
    mkdirSync(join(dir,'tools','tiled'),{recursive:true});
    const relative='tools/tiled/paleta.tsj', path=join(dir,relative);
    const canonical=readFileSync(relative,'utf8'); expect(canonical.includes('\r')).toBe(false);
    writeFileSync(path,canonical); writeFileSync(join(dir,'.gitattributes'),readFileSync('.gitattributes'));
    git('add','.gitattributes',relative); git('-c','user.name=Pianco teste','-c','user.email=teste@example.invalid','commit','-qm','paleta');
    unlinkSync(path); git('checkout','HEAD','--',relative);
    expect(readFileSync(path,'utf8')).toBe(canonical);
    expect(git('check-attr','eol','--',relative).trim()).toBe(`${relative}: eol: lf`);
  } finally {
    rmSync(target,{recursive:true,force:true});
  }
});
