const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {spawnSync} = require('node:child_process');

const hash = text => createHash('sha256').update(text).digest('hex');
const moduleReady = import('./assemble-video-release.mjs').catch(() => null);
const sourceCommit = '1'.repeat(40);
function fixture() {
  const auth = "export const validateLoginInput = () => 'original-auth';\n";
  const oldShape = "export function shapeBootstrap() { return 'old-demo'; }\n";
  const newShape = "export function shapeBootstrap() { return 'reviewed-demo'; }\n";
  const oldLoader = "export const loader = 'old';\n";
  const newLoader = "export const loader = 'reviewed';\n";
  const entrypoint = "import {shapeBootstrap} from '../_shared/hub-core.ts';\n";
  const baseline = {'hub-data/index.ts':entrypoint,'_shared/hub-core.ts':auth+oldShape,'_shared/workout-delivery.ts':oldLoader};
  return {
    sourceCommit,
    captures:[{slug:'hub-data',version:12,verify_jwt:false,import_map:false,entrypoint_path:'/capture/source/hub-data/index.ts',files:Object.entries(baseline).map(([name,content])=>({name,content}))}],
    reference:{project:'hiktwkdfvlujszczthdu',source_commit:'2'.repeat(40),functions:[{slug:'hub-data',baseline_version:12,verify_jwt:false,entrypoint:'hub-data/index.ts',changed_files:[{file:'_shared/hub-core.ts',baseline_sha256:hash(auth+oldShape),candidate_sha256:hash(auth+newShape)},{file:'_shared/workout-delivery.ts',baseline_sha256:hash(oldLoader),candidate_sha256:hash(newLoader)}],preserved_files:[{file:'hub-data/index.ts',sha256:hash(entrypoint)}]}]},
    sources:{'_shared/hub-core.ts':"export const validateLoginInput = () => 'unrelated-new-auth';\n"+newShape,'_shared/workout-delivery.ts':newLoader},
  };
}
async function assembler() {const m=await moduleReady;assert.equal(typeof m?.assembleVideoRelease,'function','approved release assembler is missing');return m;}

test('assembled delivery code retains live authentication and untouched entrypoint bytes',async()=>{
  const {assembleVideoRelease}=await assembler(),input=fixture(),release=assembleVideoRelease(input);
  const bundle=release.bundles[0];
  assert.equal(bundle.files.find(f=>f.name==='_shared/hub-core.ts').content,"export const validateLoginInput = () => 'original-auth';\nexport function shapeBootstrap() { return 'reviewed-demo'; }\n");
  assert.deepEqual(bundle.files.find(f=>f.name==='hub-data/index.ts'),input.captures[0].files[0]);
  assert.equal(bundle.verify_jwt,false);assert.equal(bundle.entrypoint,'hub-data/index.ts');
  assert.equal(release.manifest.status,'prepared_only_not_deployed');
  assert.equal(JSON.stringify(release),JSON.stringify(assembleVideoRelease(input)));
  assert.equal(input.captures[0].files[1].content.includes('old-demo'),true,'input capture is immutable');
});
for(const [label,mutate] of [
  ['changed baseline',x=>x.captures[0].files[1].content+='// drift'],
  ['untouched dependency drift',x=>x.captures[0].files[0].content+='// drift'],
  ['JWT configuration drift',x=>x.captures[0].verify_jwt=true],
  ['entrypoint drift',x=>x.captures[0].entrypoint_path='/capture/source/other/index.ts'],
  ['version drift',x=>x.captures[0].version=13],
  ['import map drift',x=>x.captures[0].import_map=true],
  ['unapproved new candidate source',x=>x.sources['_shared/workout-delivery.ts']+='// unreviewed'],
  ['unexpected bundled dependency',x=>x.captures[0].files.push({name:'unreviewed.ts',content:''})],
  ['duplicate file',x=>x.captures[0].files.push(x.captures[0].files[0])],
  ['missing endpoint',x=>x.captures=[]],
  ['duplicate endpoint',x=>x.captures.push(x.captures[0])],
  ['path escape',x=>x.reference.functions[0].preserved_files[0].file='../../outside.ts'],
]) test('assembly refuses '+label,async()=>{const {assembleVideoRelease}=await assembler(),x=fixture();mutate(x);assert.throws(()=>assembleVideoRelease(x));});

test('assembly refuses unresolved relative imports even when hashes are explicitly approved',async()=>{
  const {assembleVideoRelease}=await assembler(),x=fixture();
  const content="import '../missing.ts';\n";x.captures[0].files[0].content=content;x.reference.functions[0].preserved_files[0].sha256=hash(content);
  assert.throws(()=>assembleVideoRelease(x),/Unresolved relative import/);
});
test('output creation refuses an existing directory and preserves its files',async()=>{
  const {assembleVideoRelease,writeVideoRelease}=await assembler(),dir=await fs.mkdtemp(path.join(os.tmpdir(),'du-assembly-test-'));
  try {await fs.writeFile(path.join(dir,'keep.txt'),'keep');await assert.rejects(()=>writeVideoRelease(assembleVideoRelease(fixture()),dir),/exist/i);assert.equal(await fs.readFile(path.join(dir,'keep.txt'),'utf8'),'keep');}
  finally {await fs.rm(dir,{recursive:true,force:true});}
});
test('written bundles import as TypeScript and execute original auth with the reviewed renderer',async()=>{
  const {assembleVideoRelease,writeVideoRelease}=await assembler(),parent=await fs.mkdtemp(path.join(os.tmpdir(),'du-assembly-test-')),dir=path.join(parent,'release');
  try {
    await writeVideoRelease(assembleVideoRelease(fixture()),dir);
    const loaded=await import(pathToFileURL(path.join(dir,'hub-data/_shared/hub-core.ts')));
    assert.equal(loaded.validateLoginInput(),'original-auth');assert.equal(loaded.shapeBootstrap(),'reviewed-demo');
    const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
    assert.equal(manifest.source_commit,sourceCommit);assert.equal(manifest.functions[0].verify_jwt,false);
    assert.equal(manifest.functions[0].files.length,3);
  } finally {await fs.rm(parent,{recursive:true,force:true});}
});

test('account assembly preserves validation helpers and the original preparation wrapper',async()=>{
  const {assembleVideoRelease}=await assembler(),x=fixture();
  const baseline="export const limit=20;\nexport function applyAccountAdjustments() {return 'old';}\nexport async function prepareAccountAdjustments() {return 'original-wrapper';}\n";
  const candidate="export const limit=99;\nexport function applyAccountAdjustments() {return 'reviewed';}\nexport async function prepareAccountAdjustments() {return 'unapproved-wrapper';}\n";
  const expected="export const limit=20;\nexport function applyAccountAdjustments() {return 'reviewed';}\nexport async function prepareAccountAdjustments() {return 'original-wrapper';}\n";
  x.captures[0].files.push({name:'_shared/account-adjustments.ts',content:baseline});
  x.reference.functions[0].changed_files.push({file:'_shared/account-adjustments.ts',baseline_sha256:hash(baseline),candidate_sha256:hash(expected)});
  x.sources['_shared/account-adjustments.ts']=candidate;
  assert.equal(assembleVideoRelease(x).bundles[0].files.find(f=>f.name==='_shared/account-adjustments.ts').content,expected);
});

test('CLI prepares a committed candidate and refuses uncommitted input changes without writing output',async()=>{
  await assembler();
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'du-cli-test-')),x=fixture();
  const run=(cmd,args)=>{const r=spawnSync(cmd,args,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r;};
  try {
    await fs.mkdir(path.join(root,'qa'));await fs.mkdir(path.join(root,'docs'));
    await fs.mkdir(path.join(root,'supabase/functions/_shared'),{recursive:true});await fs.mkdir(path.join(root,'captures'));
    await fs.copyFile(path.join(__dirname,'assemble-video-release.mjs'),path.join(root,'qa/assemble-video-release.mjs'));
    await fs.writeFile(path.join(root,'docs/VIDEO_RELEASE_PARITY_2026-11-07.json'),JSON.stringify(x.reference));
    for(const [name,content] of Object.entries({...x.sources,'_shared/account-adjustments.ts':''}))await fs.writeFile(path.join(root,'supabase/functions',name),content);
    await fs.writeFile(path.join(root,'captures/hub-data.json'),JSON.stringify(x.captures[0]));
    run('git',['init','-q']);run('git',['add','.']);run('git',['-c','user.name=QA','-c','user.email=qa@example.invalid','commit','-qm','Synthetic fixture']);
    const cli=['qa/assemble-video-release.mjs','--capture-dir','captures','--output','release'];
    run(process.execPath,cli);
    const manifest=JSON.parse(await fs.readFile(path.join(root,'release/manifest.json'),'utf8'));
    assert.equal(manifest.functions[0].verify_jwt,false);
    assert.equal(JSON.parse(await fs.readFile(path.join(root,'release/hub-data/settings.json'),'utf8')).entrypoint,'hub-data/index.ts');
    await fs.appendFile(path.join(root,'supabase/functions/_shared/hub-core.ts'),'// uncommitted');
    const r=spawnSync(process.execPath,[...cli.slice(0,-1),'must-not-exist'],{cwd:root,encoding:'utf8'});
    assert.equal(r.status,1);assert.match(r.stderr,/Commit reviewed assembly inputs/);
    await assert.rejects(()=>fs.access(path.join(root,'must-not-exist')));
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
