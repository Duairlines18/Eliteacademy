/* Shared by Control Room publication checks and offline delivery QA. No writes. */
function workoutDeliveryIssues(blocks, library) {
  const issues = [];
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const exercises = Array.isArray(library) ? library : [];
  const byCode = new Map(exercises.map(exercise => [exercise.code, exercise]));
  // Match the Hub player: only supported HTTPS YouTube URLs with 11-character video IDs.
  const playableUrl = (value, id) => {
    const raw = typeof value === 'string' && value.trim()
      ? value.trim()
      : typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id)
        ? 'https://www.youtube.com/watch?v=' + id : '';
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
      const host = url.hostname.toLowerCase();
      let key = '';
      if (['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)) {
        if (url.pathname === '/watch') key = url.searchParams.get('v') || '';
        else key = (url.pathname.match(/^\\/(?:shorts|embed)\\/([A-Za-z0-9_-]+)\\/?$/) || [])[1] || '';
      } else if (host === 'youtu.be' || host === 'www.youtu.be') {
        key = url.pathname.slice(1).replace(/\\/$/, '');
      }
      return /^[A-Za-z0-9_-]{11}$/.test(key);
    } catch { return false; }
  };
  const hasDemo = exercise => exercise && exercise.active !== false &&
    playableUrl(exercise.video_url || exercise.videoUrl, exercise.video_id || exercise.videoId);
  for (const block of blocks) {
    const content = block?.content || {}, label = block.title || 'Workout';
    const prescriptions = Array.isArray(content.prescriptions) ? content.prescriptions : [];
    const items = Array.isArray(content.items) ? content.items : [];
    const links = Array.isArray(content.video_links) ? content.video_links : [];
    for (const [index, prescription] of prescriptions.entries()) {
      if (!prescription?.exerciseCode && typeof prescription?.instruction === 'string' && prescription.instruction.trim()) continue;
      if (!prescription?.exerciseCode || !String(prescription.dosage || '').trim()) issues.push(label + ': dosage/exercise missing at row ' + (index + 1));
      for (const code of [prescription?.exerciseCode, prescription?.alternativeExerciseCode].filter(Boolean)) {
        if (!hasDemo(byCode.get(code))) issues.push(label + ': approved active demo missing for ' + code);
      }
    }
    for (const code of (Array.isArray(content.exerciseCodes) ? content.exerciseCodes : [])) {
      if (!hasDemo(byCode.get(code))) issues.push(label + ': approved active demo missing for ' + code);
    }
    for (const link of links) {
      if (!Number.isInteger(link?.item_index) || link.item_index < 0 || typeof items[link.item_index] !== 'string') {
        issues.push(label + ': demo points to a missing instruction row'); continue;
      }
      const linkedExercise = exercises.find(exercise => (exercise.name || exercise.title) === link.exercise);
      if (!hasDemo(linkedExercise)) {
        issues.push(label + ': approved active demo missing for ' + link.exercise);
        continue;
      }
      const canonicalUrl = linkedExercise.video_url || linkedExercise.videoUrl || '';
      const suppliedUrl = link.video_url || link.videoUrl || '';
      if (canonicalUrl && suppliedUrl && suppliedUrl !== canonicalUrl) issues.push(label + ': demo URL differs from library for ' + link.exercise);
      const prescription = prescriptions[link.item_index];
      if (prescription?.exerciseCode && typeof items[link.item_index] === 'string' && !items[link.item_index].includes(';') && ![prescription.exerciseCode, prescription.alternativeExerciseCode].filter(Boolean).includes(linkedExercise.code)) {
        issues.push(label + ': demo exercise does not match prescribed code at row ' + (link.item_index + 1));
      }
    }
    for (const [index, item] of items.entries()) {
      if (typeof item !== 'string' || !item.trim()) {issues.push(label + ': empty instruction row ' + (index + 1)); continue;}
      // Only require mappings for recognized prescribed movements. Runs/rest/notes
      // do not acquire unrelated demos through substring matching.
      const text = ' ' + normalize(item) + ' ';
      const movement = [...exercises].sort((a,b) => normalize(b.name || b.title).length - normalize(a.name || a.title).length).find(exercise => {
        const name = normalize(exercise.name || exercise.title);
        return name && (text.startsWith(' ' + name + ' ') || new RegExp('^\\s*\\d+(?:\\s+[x×]\\s*\\d+)?\\s+' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(item));
      });
      if (movement && !prescriptions.length && !links.some(link => link.item_index === index && link.exercise === (movement.name || movement.title))) issues.push(label + ': reviewed demo selection missing at row ' + (index + 1));
      if (content.requiresDemo === true && !links.some(link => link.item_index === index)) issues.push(label + ': required demo missing at row ' + (index + 1));
    }
  }
  return [...new Set(issues)];
}
