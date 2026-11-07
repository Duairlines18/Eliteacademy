// Offline preparation only. This module never authenticates, deploys or writes to Supabase.
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const PROJECT = 'hiktwkdfvlujszczthdu';
const SLUGS = new Set(['hub-data', 'parent-hub-data', 'private-athlete-hub-data']);
const CHANGES = new Set(['_shared/hub-core.ts', '_shared/workout-delivery.ts', '_shared/account-adjustments.ts']);
const digest = text => createHash('sha256').update(text).digest('hex');
const fail = message => {throw new Error(message);};
function safeName(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_./-]+\.ts$/.test(name)
      || name.startsWith('/') || name.split('/').some(x => !x || x === '.' || x === '..')) fail('Unsafe bundled file path');
  return name;
}
function uniqueMap(items, key, label) {
  if (!Array.isArray(items)) fail('Missing '+label);
  const result = new Map();
  for (const item of items) {
    if (!item || typeof item[key] !== 'string' || result.has(item[key])) fail('Duplicate or invalid '+label);
    result.set(item[key], item);
  }
  return result;
}
function splitOnce(text, anchor) {
  const index = text.indexOf(anchor);
  if (index < 0 || text.indexOf(anchor, index + anchor.length) >= 0) fail('Missing or ambiguous approved section: '+anchor);
  return [text.slice(0,index), text.slice(index)];
}
function replaceApprovedSection(name, baseline, candidate) {
  if (typeof candidate !== 'string') fail('Missing reviewed source: '+name);
  if (name === '_shared/hub-core.ts') {
    // All auth, expiry and helper definitions precede the renderer. Preserve those exact live bytes.
    const [prefix] = splitOnce(baseline,'export function shapeBootstrap(');
    const [,renderer] = splitOnce(candidate,'export function shapeBootstrap(');
    return prefix + renderer;
  }
  if (name === '_shared/account-adjustments.ts') {
    const start = 'export function applyAccountAdjustments(';
    const end = 'export async function prepareAccountAdjustments(';
    const [prefix, oldTail] = splitOnce(baseline,start);
    const [,suffix] = splitOnce(oldTail,end);
    const [,newTail] = splitOnce(candidate,start);
    const [replacement] = splitOnce(newTail,end);
    return prefix + replacement + suffix;
  }
  if (name === '_shared/workout-delivery.ts') return candidate;
  fail('Unapproved replacement file: '+name);
}
function verifyImports(files) {
  const names = new Set(files.map(f => f.name));
  for (const {name,content} of files) {
    // These pinned bundles use literal static imports. Both from-imports and side-effect imports count.
    const imports = [...content.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g)];
    for (const [,specifier] of imports) {
      if (!specifier.startsWith('.')) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(name),specifier));
      if (!names.has(resolved)) fail('Unresolved relative import in '+name+': '+specifier);
    }
  }
}

export function assembleVideoRelease({captures, reference, sources, sourceCommit}) {
  if (reference?.project !== PROJECT || !/^[a-f0-9]{40}$/.test(sourceCommit || '')) fail('Invalid project or source commit');
  const expected = uniqueMap(reference.functions,'slug','reference endpoints');
  const supplied = uniqueMap(captures,'slug','captured endpoints');
  if (!expected.size || expected.size !== supplied.size) fail('Captured endpoint set differs from approval');
  const bundles = [], functions = [];
  for (const [slug, contract] of expected) {
    const live = supplied.get(slug);
    if (!SLUGS.has(slug) || !live) fail('Missing or unapproved endpoint: '+slug);
    if (live.version !== contract.baseline_version || live.verify_jwt !== contract.verify_jwt
        || live.import_map !== false || typeof live.entrypoint_path !== 'string'
        || !live.entrypoint_path.endsWith('/source/'+contract.entrypoint)) fail('Live configuration drift: '+slug);
    const entrypoint = safeName(contract.entrypoint);
    const liveFiles = uniqueMap(live.files,'name','captured files');
    const changed = uniqueMap(contract.changed_files,'file','changed files');
    const preserved = uniqueMap(contract.preserved_files,'file','preserved files');
    if (liveFiles.size !== changed.size + preserved.size) fail('Unexpected or missing dependency: '+slug);
    for (const name of changed.keys()) if (preserved.has(name) || !CHANGES.has(name)) fail('Invalid change allowlist');
    const files = [], hashes = [];
    for (const [name,file] of [...liveFiles].sort(([a],[b])=>a.localeCompare(b,'en'))) {
      safeName(name);
      if (typeof file.content !== 'string') fail('Invalid captured content: '+name);
      const change = changed.get(name), keep = preserved.get(name);
      const baselineHash = digest(file.content);
      if (baselineHash !== (change?.baseline_sha256 || keep?.sha256)) fail('Captured baseline hash drift: '+slug+'/'+name);
      const content = change ? replaceApprovedSection(name,file.content,sources?.[name]) : file.content;
      const candidateHash = digest(content);
      if (change && candidateHash !== change.candidate_sha256) fail('Unapproved candidate hash: '+slug+'/'+name);
      files.push({name,content});
      hashes.push({name,baseline_sha256:baselineHash,sha256:candidateHash,changed:Boolean(change)});
    }
    if (!liveFiles.has(entrypoint) || changed.has(entrypoint)) fail('Entrypoint must remain unchanged');
    verifyImports(files);
    const settings = {slug,baseline_version:live.version,verify_jwt:live.verify_jwt,import_map:false,entrypoint};
    bundles.push({...settings,files});
    functions.push({...settings,files:hashes});
  }
  return {manifest:{status:'prepared_only_not_deployed',project:PROJECT,source_commit:sourceCommit,
    approval_source_commit:reference.source_commit,functions},bundles};
}

export async function writeVideoRelease(release, output) {
  // Exclusive directory creation prevents mixing releases or overwriting existing artifacts.
  await mkdir(output,{mode:0o700});
  for (const bundle of release.bundles) {
    for (const file of bundle.files) {
      const destination = path.join(output,bundle.slug,safeName(file.name));
      await mkdir(path.dirname(destination),{recursive:true,mode:0o700});
      await writeFile(destination,file.content,{flag:'wx',mode:0o600});
    }
    await writeFile(path.join(output,bundle.slug,'settings.json'),JSON.stringify({
      slug:bundle.slug,verify_jwt:bundle.verify_jwt,import_map:bundle.import_map,entrypoint:bundle.entrypoint,
    },null,2)+'\n',{flag:'wx',mode:0o600});
  }
  // Written last: its absence identifies an incomplete artifact. Never deploy a partial directory.
  await writeFile(path.join(output,'manifest.json'),JSON.stringify(release.manifest,null,2)+'\n',{flag:'wx',mode:0o600});
}

async function main(args) {
  if (args.length !== 4 || args[0] !== '--capture-dir' || args[2] !== '--output') {
    fail('Usage: node qa/assemble-video-release.mjs --capture-dir DIR --output NEW_DIR');
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const reference = JSON.parse(await readFile(path.join(root,'docs/VIDEO_RELEASE_PARITY_2026-11-07.json'),'utf8'));
  const captures = await Promise.all(reference.functions.map(f=>readFile(path.join(args[1],f.slug+'.json'),'utf8').then(JSON.parse)));
  const sources = Object.fromEntries(await Promise.all([...CHANGES].map(async name=>[
    name,await readFile(path.join(root,'supabase/functions',name),'utf8'),
  ])));
  const sourceCommit = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  // Refuse falsely labelling local uncommitted application edits as the recorded source SHA.
  const dirty = execFileSync('git',['status','--porcelain','--','supabase/functions',
    'docs/VIDEO_RELEASE_PARITY_2026-11-07.json','qa/assemble-video-release.mjs'],{cwd:root,encoding:'utf8'});
  if (dirty.trim()) fail('Commit reviewed assembly inputs before preparing a release');
  const release = assembleVideoRelease({captures,reference,sources,sourceCommit});
  await writeVideoRelease(release,args[3]);
  console.log('Prepared '+release.bundles.length+' endpoint bundles; NOT DEPLOYED. Manifest: '+path.join(args[3],'manifest.json'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
