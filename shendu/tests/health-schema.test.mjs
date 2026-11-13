import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';

const appDir=fileURLToPath(new URL('../',import.meta.url));

for(const available of [true,false])test(`health reports stored schema when the data key is ${available?'available':'unavailable'}`,async()=>{
  const root=mkdtempSync(join(tmpdir(),'shendu-health-'));
  let child,db;
  try{
    const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
    const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
    const dataDir=join(root,'data'),keyParent=join(root,'key-parent');
    if(!available)writeFileSync(keyParent,'not a directory');
    child=spawn(process.execPath,['server.mjs'],{cwd:appDir,env:{...process.env,SHENDU_PORT:String(port),SHENDU_DATA_DIR:dataDir,SHENDU_MASTER_KEY:'',SHENDU_MASTER_KEY_PATH:join(available?dataDir:keyParent,'backup-master.key')},stdio:['ignore','pipe','pipe']});
    let logs='';child.stdout.on('data',data=>{logs+=data});child.stderr.on('data',data=>{logs+=data});
    const health=async()=>{const response=await fetch(`http://127.0.0.1:${port}/healthz`);return {status:response.status,body:await response.json()}};
    let response;
    for(let i=0;i<150&&!response;i++){
      try{response=await health()}catch{}
      if(!response)await new Promise(resolve=>setTimeout(resolve,20));
    }
    assert.ok(response,logs);
    db=new DatabaseSync(join(dataDir,'shendu.db'));
    const schema=Number(db.prepare("SELECT value FROM schema_meta WHERE key='schema_version'").get().value);
    assert.equal(response.status,available?200:503,logs);
    assert.equal(response.body.ok,available);
    assert.equal(response.body.schema,schema);
    if(!available)assert.equal(response.body.error,'data_key_unavailable');
    // The endpoint must follow stored metadata, including a database on a different migration version.
    db.prepare("UPDATE schema_meta SET value=? WHERE key='schema_version'").run(String(schema+1));
    const changed=await health();
    assert.equal(changed.status,available?200:503);
    assert.equal(changed.body.schema,schema+1);
  }finally{
    db?.close();
    if(child&&child.exitCode===null){const stopped=once(child,'exit');child.kill('SIGTERM');await stopped}
    rmSync(root,{recursive:true,force:true});
  }
});
