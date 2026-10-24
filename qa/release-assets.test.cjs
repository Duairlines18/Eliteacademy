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
test('source HTML equals the established Pages preparation output',()=>{
 const os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'du-pages-parity-'));
 try{
  const prior=execFileSync('git',['show','096c63b394ef0b184e1e5550b795ee85aacd3dc5:index.html'],{encoding:'utf8',maxBuffer:10*1024*1024});
  fs.writeFileSync(path.join(dir,'index.html'),prior);
  const workflow=fs.readFileSync('.github/workflows/static.yml','utf8');
  const start=workflow.indexOf("          python3 - <<'PY'\n")+"          python3 - <<'PY'\n".length;
  const end=workflow.indexOf('\n          PY',start);
  assert.ok(start>0&&end>start,'existing preparation script remains available');
  const script=workflow.slice(start,end).split('\n').map(line=>line.slice(10)).join('\n');
  execFileSync('python3',['-c',script],{cwd:dir});
  const expected=fs.readFileSync(path.join(dir,'index.html'),'utf8');
  assert.ok(fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n')===expected,'source matches established preparation output');
  execFileSync('python3',['-c',script],{cwd:dir});
  assert.equal(fs.readFileSync(path.join(dir,'index.html'),'utf8'),expected,'preparation is idempotent');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
