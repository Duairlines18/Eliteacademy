# Mandatory weekly check-ins — approved design

Coach Du approved the implementation plan on November 12, 2026. Implement two mandatory, standardized check-ins for authenticated private athletes and parent-managed athletes. Entry is between authentication/onboarding and dashboard access. Preserve programmes, branding, historical feedback, account entitlements and school/professional pathways.

Reuse the existing Edge handlers, feedback table and immutable feedback revision events. Add a small requirements ledger with one start/end requirement per athlete and assigned programme week; atomic submission links each requirement to one feedback record. Never create historical obligations. End-only rollout is November 13–15, normal start/end rollout begins November 16. Requirements survive assignment changes and logouts. Partial end reports satisfy the requirement and can be amended without erasing revisions.

Use the exact four start and four end questions/options in Coach Du's final specification. Shared stable IDs/values, parent-specific wording, explicit unknown values, optional notes. Require conditional symptom details, applicable pain severity and movement impact; activity/date for outside training; and an incomplete-training reason. Never infer healthy/completed from unknown.

Server enforcement covers bootstrap, history, programme previews and completion operations. Frontend routing revalidates on navigation, foreground and date boundaries; no stale content on failed validation. Safety information, authenticated issue reporting, coach contact and logout remain available. Save and flag safety concerns and hold training access pending an explicit coach release. Amendments and ordinary review cannot release holds. This is a coaching access decision, never medical clearance.

Provide an authenticated admin-only completed/missing/flagged review view and auditable hold release. Database changes are additive and initially disabled. Only final merge/deployment approval can activate production. Rollback disables enforcement, retaining submissions, requirements and audit records.

Implementation rulings: several current assignments have missing or stale start dates. Snapshot the current calendar Monday for first enrollment when the assignment date is absent/stale, rather than fabricate historical requirements. Preserve that snapshot thereafter. Use a configurable business timezone (America/Chicago default), with athlete overrides. Early end-of-week opening may be explicitly requested by an athlete/parent who has finished; this is a declaration, never evidence that all sessions were completed. Existing item-completion tracking remains separate.

Alternatives: dashboard-only reminders fail the mandatory/direct-URL requirement; a separate feedback system duplicates history and review infrastructure. Extend existing authenticated Edge delivery with a shared check-in gate and atomic database operations.
