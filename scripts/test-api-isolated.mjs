import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
const root=resolve(import.meta.dirname,'..');
const npm=process.platform==='win32'?'npm.cmd':'npm';
const run=(cmd,args,env=process.env)=>{
 const r=spawnSync(cmd,args,{cwd:root,env,stdio:'inherit',shell:process.platform==='win32'&&cmd===npm});
 if(r.error)throw r.error;
 if(r.status!==0)throw new Error(`Falló ${cmd}: ${r.status}`);
};
let dir,started=false;
const bin=process.env.PG_BIN??(process.platform==='win32'?'C:/Program Files/PostgreSQL/17/bin':'/usr/lib/postgresql/16/bin');
const exe=name=>join(bin,name+(process.platform==='win32'?'.exe':''));
try {
 run(npm,['run','build','-w','@atlas/motor']);
 let url=process.env.TEST_DATABASE_URL;
 if(!url){
  if(!existsSync(exe('initdb')))throw new Error('Configura PG_BIN o TEST_DATABASE_URL. Las pruebas crean un esquema aislado, nunca usan DATABASE_URL de desarrollo.');
  dir=mkdtempSync(join(tmpdir(),'atlas-pg-'));
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
  run(exe('initdb'),['-D',join(dir,'db'),'-U','atlas_test','-A','trust','--encoding=UTF8','--locale=C']);
  run(exe('pg_ctl'),['-D',join(dir,'db'),'-l',join(dir,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
  url=`postgresql://atlas_test@127.0.0.1:${port}/postgres`;
 }
 run(npm,['run','test','-w','@atlas/backend'],{...process.env,TEST_DATABASE_URL:url,NODE_ENV:'test',AI_PROVIDER:'fake'});
}finally{
 if(started)spawnSync(exe('pg_ctl'),['-D',join(dir,'db'),'-m','immediate','-w','stop'],{stdio:'inherit'});
 if(dir)rmSync(dir,{recursive:true,force:true});
}
