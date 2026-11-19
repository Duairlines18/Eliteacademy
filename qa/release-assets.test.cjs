const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('either Pages publisher serves the existing parent and performance assets',()=>{
 const html=fs.readFileSync('index.html','utf8');
 for(const asset of ['/parent-qa/session-card-polish.css','/parent-qa/session-card-polish.js','/performance/coachdu-hub-bridge.js'])assert.ok(html.includes(asset),asset);
});
test('repeated Pages workflow attempts use matching unique artifact names',()=>{
 const source=fs.readFileSync('.github/workflows/static.yml','utf8');
 assert.match(source,/name: github-pages-\$\{\{ github.run_attempt \}\}/);
 assert.match(source,/artifact_name: github-pages-\$\{\{ github.run_attempt \}\}/);
});
test('Pages preparation preserves the current source and remains idempotent',()=>{
 const os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
 const {createHash}=require('node:crypto');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'du-pages-parity-'));
 try{
  const prior=fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n');
  fs.writeFileSync(path.join(dir,'index.html'),prior);
  const coachScript='coach-command/coach-command.js';
  const scriptBytes=fs.readFileSync(coachScript);
  fs.mkdirSync(path.join(dir,'coach-command'));
  fs.writeFileSync(path.join(dir,coachScript),scriptBytes);
  const version=createHash('sha256').update(scriptBytes).digest('hex').slice(0,12);
  const workflow=fs.readFileSync('.github/workflows/static.yml','utf8');
  const start=workflow.indexOf("          python3 - <<'PY'\n")+"          python3 - <<'PY'\n".length;
  const end=workflow.indexOf('\n          PY',start);
  assert.ok(start>0&&end>start,'existing preparation script remains available');
  const script=workflow.slice(start,end).split('\n').map(line=>line.slice(10)).join('\n');
  execFileSync('python3',['-c',script],{cwd:dir});
  const expected=prior.replace(/(<script src="\/coach-command\/coach-command\.js)(?:\?[^"]*)?">/, `$1?v=${version}">`);
  assert.notEqual(expected,prior,'production uses the script content hash for its version');
  assert.equal(fs.readFileSync(path.join(dir,'index.html'),'utf8'),expected,'preparation only changes the script version');
  execFileSync('python3',['-c',script],{cwd:dir});
  assert.equal(fs.readFileSync(path.join(dir,'index.html'),'utf8'),expected,'preparation is idempotent');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
