import test from 'node:test';
import assert from 'node:assert/strict';
import {SupabaseHubRepository} from '../functions/_shared/supabase-repository.ts';

// Model the existing database default to catch omitted account classification.
function database(existing=null){
 let inserted=null;
 const client={from(table){assert.equal(table,'athletes');return {
  select(){return this;},eq(){return this;},async maybeSingle(){return {data:existing,error:null};},
  insert(payload){inserted={athlete_type:'school',...payload};return this;},
  async single(){return {data:inserted,error:null};}
 };}};
 return {repository:new SupabaseHubRepository(client),inserted:()=>inserted};
}
for(const method of ['ensureParentAthlete','ensurePrivateAthlete']){
 test(`${method} classifies new account as private and keeps activation pending`,async()=>{
  const db=database();
  const row=await db.repository[method]({id:'synthetic-user',email:'test@example.invalid',user_metadata:{first_name:'Test',last_name:'User',athlete_first_name:'Test',athlete_last_name:'Athlete'}});
  assert.equal(row.athlete_type,'private');assert.equal(row.access_status,'pending');
  assert.equal(row.programme_id,undefined);assert.equal(row.paid,undefined);
  assert.equal(row[method==='ensureParentAthlete'?'parent_user_id':'athlete_user_id'],'synthetic-user');
 });
 test(`${method} preserves an existing account without rewriting classification or assignment`,async()=>{
  const existing={id:'existing',athlete_type:'private',access_status:'active',programme_id:'assigned',current_week:1,onboarding_complete:true};
  const db=database(existing);assert.equal(await db.repository[method]({id:'synthetic-user'}),existing);assert.equal(db.inserted(),null);
 });
}
