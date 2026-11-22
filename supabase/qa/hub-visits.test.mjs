import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { handleParentRequest } from '../functions/_shared/parent-handler.ts';
import { handlePrivateAthleteRequest } from '../functions/_shared/private-athlete-handler.ts';
import { recordSchoolHubVisit } from '../functions/_shared/hub-service.ts';

test('account visit handlers use the verified and role-specific identity', async () => {
  for (const [handler, method, kind] of [
    [handleParentRequest, 'findParentAthlete', 'parent'],
    [handlePrivateAthleteRequest, 'findPrivateAthlete', 'private-athlete'],
  ]) {
    const request = () => new Request('https://example.test', {
      method: 'POST',
      headers: { origin: 'https://duairlineseliteacademy.com' },
      body: JSON.stringify({ action: 'record-visit', athleteId: 'another-profile', staffId: 'another-school' }),
    });
    const calls = [];
    const ports = {
      verifyUser: async () => ({ id: 'verified-user' }),
      repository: {
        [method]: async id => ({ id: id === 'verified-user' ? 'own-profile' : 'unexpected' }),
        recordHubVisit: async (...args) => { calls.push(args); return true; },
      },
    };
    assert.deepEqual(await (await handler(request(), ports)).json(), { recorded: true });
    assert.equal((await handler(request(), { ...ports, verifyUser: async () => null })).status, 401);
    assert.deepEqual(calls, [[kind, 'own-profile', null, 'verified-user']]);
  }
});

test('school tracking follows the current named code and school assignment', async () => {
  const records = [];
  const cohort = { id: 'school-a', name: 'First School', organization_id: 'org-a', status: 'live' };
  const code = { id: 'code-a', status: 'active', code_type: 'cohort', cohort_id: cohort.id, athlete_id: 'person-a' };
  const session = { role: 'athlete', access_code_id: code.id, cohort_id: cohort.id, athlete_id: code.athlete_id, expires_at: '2099-01-01T00:00:00Z' };
  const athlete = { id: 'person-a', athlete_type: 'school', access_status: 'active', cohort_id: cohort.id, organization_id: cohort.organization_id };
  let assigned = true;
  const args = {
    token: 'school-test-token-value',
    cryptoPort: { sha256: async value => value },
    repository: {
      findSession: async () => session,
      findAccessCodeById: async () => code,
      findCohort: async () => cohort,
      findSchoolAthlete: async () => athlete,
      findSchoolStaff: async id => ({ id, access_status: 'active', access_profile: 'coach' }),
      isStaffAssigned: async () => assigned,
      recordHubVisit: async (...values) => { records.push(values); return true; },
    },
  };
  assert.deepEqual(await recordSchoolHubVisit(args), { recorded: true });
  athlete.organization_id = 'org-b';
  await assert.rejects(recordSchoolHubVisit(args), /session/i);
  code.athlete_id = session.athlete_id = null;
  assert.deepEqual(await recordSchoolHubVisit(args), { recorded: false });
  code.staff_id = session.staff_id = 'staff-a';
  code.code_type = session.role = 'staff';
  assert.deepEqual(await recordSchoolHubVisit(args), { recorded: true });
  cohort.name = 'QA School';
  assert.deepEqual(await recordSchoolHubVisit(args), { recorded: false });
  cohort.name = 'First School';
  assigned = false;
  await assert.rejects(recordSchoolHubVisit(args), /session/i);
  assert.deepEqual(records, [['school-athlete', athlete.id, null, null], ['school-staff', null, 'staff-a', null]]);
});

test('daily ledger isolates reads and writes and deduplicates each role on its Chicago day', async () => {
  const dependency = process.env.PGLITE_MODULE || '/tmp/du-checkin-qa/node_modules/@electric-sql/pglite/dist/index.js';
  const { PGlite } = await import(pathToFileURL(dependency).href);
  const db = new PGlite();
  const id = n => '11111111-1111-4111-8111-' + String(n).padStart(12, '0');
  const [athlete, privateActor, parent, other, admin, school, staff, demo, cohort] = Array.from({length:9}, (_, i) => id(i + 1));
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table admin_profiles(user_id uuid primary key);
      create table athletes(id uuid primary key, full_name text, display_name text, access_status text,
        onboarding_data jsonb, athlete_user_id uuid, parent_user_id uuid, athlete_type text, cohort_id uuid,
        programme_id uuid, access_reason text, payment_status text);
      create table staff_profiles(id uuid primary key, full_name text, display_name text, access_status text);
      create table cohorts(id uuid primary key, name text);
      grant usage on schema auth to authenticated;
      grant select on admin_profiles to authenticated, service_role;
      grant select on athletes, staff_profiles, cohorts to service_role;
      insert into admin_profiles values('${admin}');
      insert into cohorts values('${cohort}','First School');
      insert into athletes values
        ('${athlete}','Private Person','Private Person','active','{}','${privateActor}','${parent}',null,null,'${id(10)}','complimentary','not_required'),
        ('${school}','School Person','School Person','active','{}',null,null,'school','${cohort}',null,null,null),
        ('${demo}','Named Person','Named Person','active','{"testing_placeholder":true}',null,null,'school','${cohort}',null,null,null);
      insert into staff_profiles values('${staff}','School Coach','School Coach','active');
    `);
    const migration = new URL('../migrations/20261122160802_lightweight_hub_visits.sql', import.meta.url);
    await db.exec(await readFile(migration, 'utf8'));
    const count = async () => (await db.query('select count(*)::int as n from hub_daily_visits')).rows[0].n;
    const record = async (kind, athlete, staff, actor) =>
      (await db.query('select public.record_hub_visit($1,$2,$3,$4) as recorded', [kind, athlete, staff, actor])).rows[0].recorded;
    await db.exec('set role service_role');
    assert.equal(await record('private-athlete', athlete, null, other), false);
    assert.equal(await record('parent', athlete, null, privateActor), false);
    assert.equal(await record('school-athlete', demo, null, null), false);
    assert.equal(await record('school-staff', null, staff, null), true);
    assert.equal(await record('school-athlete', school, null, null), true);
    assert.equal(await record('parent', athlete, null, parent), true);
    assert.equal(await record('private-athlete', athlete, null, privateActor), true);
    assert.equal(await record('private-athlete', athlete, null, privateActor), true);
    assert.equal(await count(), 4);
    const dates = await db.query("select distinct visit_date = (last_visit_at at time zone 'America/Chicago')::date as chicago_day from hub_daily_visits");
    assert.deepEqual(dates.rows, [{ chicago_day: true }]);

    await db.exec('reset role; set role anon');
    await assert.rejects(count(), /permission denied/i);
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
    assert.equal(await count(), 0);
    assert.equal((await db.query('select * from hub_visit_summary()')).rows.length, 0);
    await assert.rejects(record('private-athlete', athlete, null, privateActor), /permission denied/i);
    await assert.rejects(db.exec('delete from hub_daily_visits'), /permission denied/i);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
    assert.equal(await count(), 4);
    const summary = (await db.query('select * from hub_visit_summary()')).rows;
    assert.equal(summary.length, 4);
    assert.ok(summary.every(row => Number(row.this_week) === 1 && Number(row.last_12_days) === 1));
  } finally {
    await db.close();
  }
});
