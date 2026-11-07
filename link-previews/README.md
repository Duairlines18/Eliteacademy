# Public share links

Share the full path URL for destination-specific previews:

- https://duairlineseliteacademy.com/
- https://duairlineseliteacademy.com/soccer/
- https://duairlineseliteacademy.com/club-registration/
- https://duairlineseliteacademy.com/track/
- https://duairlineseliteacademy.com/track/register/
- https://duairlineseliteacademy.com/track/evaluation/
- https://duairlineseliteacademy.com/track/enquire/
- https://duairlineseliteacademy.com/hub/login/
- https://duairlineseliteacademy.com/my-journey/

These static pages expose exact destination metadata to crawlers and open the existing application route. Existing `#/` routes remain compatible; fragments never reach crawlers, so old hash links use the homepage preview. Query parameters on clean links are forwarded into the application URL, preserving registration source attribution. No access codes or member identities appear in public metadata.

Regenerate committed entry pages with `node link-previews/build.cjs`; verify with `node --test link-previews/links.test.cjs`. Deployment blocks if these checks fail. Platform caches may retain previews for previously shared URLs; they are outside the website's control.
