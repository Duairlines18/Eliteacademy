# Professional member feedback hotfix source

The deployed `member-hub-data` (version 4 before this fix) has a separate shared feedback service and repository from the three other Hub functions. The two files here are full copies of those deployed sources with only the owner/context-aware retry check and current-plus-history lookup patched. They are **deployment parity fixtures** for targeted regression tests and review, not an independently deployed Supabase function.

For release: fetch the currently deployed `member-hub-data` bundle; confirm its two shared files still match the known unpatched baseline; replace exactly those two files with the versions here, preserving its entrypoint, all other files and `verify_jwt=true`. Deploy only after CI passes. Verify the new version via `get_edge_function`, and preserve the original bundle for immediate rollback.

This does not alter professional onboarding, payments, programme assignments, session handling, the existing payload validation, or training content. Historical revision lookup is supported by migration `feedback_revision_history`, already applied in production. The change does not implement athlete-visible replies.
