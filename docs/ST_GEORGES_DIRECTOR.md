# St. George’s Sports Director addition

Approved October 24, 2026. No public deployment or credential distribution performed.

Mr Chivandire has staff UUID eaafd18b-da82-4efd-a338-cd2f8479f781, one membership in St. George’s cohort and one paused cryptographic credential reservation. No plaintext reservation code exists; issue one through the authenticated admin generator after release verification.

Migration `staff_sports_director_access_profile` adds `staff_profiles.access_profile`, default `coach`, constrained to `coach` or `sports_director`. Existing RLS stays administrator-only; no new grants. Existing Coach Dube behavior remains coach access. The deployed old backend cannot admit the director while his code remains paused.

The School Overview shows the assigned school roster, published current programme, start-date status and counts of recorded completed workout items in that assigned programme/week. It makes no claim about attendance, video viewing or improvement. No private health/admin notes are included in the completion summary. The director cannot submit coach feedback, upload school review clips or select detailed individual Journey sources; checks run on the server, not only the UI. Logout and individual revocation reuse the existing protected code flow.

Validation: 111 website unit/static tests passed; homepage preservation and synthetic HTTP integration passed. New director test verifies overview capability and feedback denial. Actual signed-in director browser testing and Supabase integration remain outstanding. This is staged implementation, not a live release.

Rollback: pause credentials for this staff UUID, revoke their sessions, archive this profile, and revert the director feature commit. Keep the added access_profile column to avoid disrupting deployed functions; after every dependent function is rolled back it can be dropped in a separately reviewed migration. Do not remove Coach Dube or athlete records. Do not grant this profile admin membership.
