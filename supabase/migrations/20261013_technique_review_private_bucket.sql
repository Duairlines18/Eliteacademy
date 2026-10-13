-- Technique Review storage: additive and PRIVATE, for staged deployment only.
-- Apply after safeguarding approval, video validation tests and migration v1.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('technique-review','technique-review',false,26214400,array['video/mp4','video/quicktime'])
on conflict (id) do update set
 public=false,
 file_size_limit=26214400,
 allowed_mime_types=array['video/mp4','video/quicktime'];
-- Do not create public storage.objects policies.
-- Signed upload URLs are issued by scoped Edge Functions after auth.
-- Playback URLs are short-lived and require re-authorization.
