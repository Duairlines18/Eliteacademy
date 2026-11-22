(function (root) {
  const visitDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  });

  function create({ entry, send, now = Date.now }) {
    let active;
    return async function observe({ retry = false } = {}) {
      const identity = entry();
      if (!identity) return;
      const day = visitDay.format(now());
      if (active?.identity !== identity || active.day !== day) {
        active = { identity, day, pending: false, done: false, retryRequested: false, retryAt: 0 };
      }
      const attempt = active;
      if (attempt.done) return;
      if (attempt.pending) {
        if (retry) attempt.retryRequested = true;
        return;
      }
      if (!retry && now() < attempt.retryAt) return;
      attempt.pending = true;
      try {
        const result = await send(identity);
        attempt.done = typeof result?.recorded === 'boolean';
      } catch {
        // Delivery and feedback never wait for engagement tracking.
      } finally {
        attempt.pending = false;
        if (!attempt.done) attempt.retryAt = now() + 60_000;
        const retryRequested = attempt.retryRequested;
        attempt.retryRequested = false;
        if (retryRequested && !attempt.done && active === attempt && entry() === identity) {
          await observe({ retry: true });
        }
      }
    };
  }

  const api = { create };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DuHubVisits = api;
})(globalThis);
