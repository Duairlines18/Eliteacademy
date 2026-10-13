# Technique Review upload gates

This is a staged specification, not a deployment.

- Verify current session and scoped athlete or coach access before every operation.
- Private bucket only; never expose service-role keys.
- Enforce three weekly clips atomically; release expired reservations.
- Verify media format and actual duration server-side: maximum 15 seconds.
- Limit files to 25 MiB and reject invalid objects.
- Require authorized playback and feedback access.
- Test iOS MOV and Android MP4 before enabling the pilot.
