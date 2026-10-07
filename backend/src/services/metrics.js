// Speech metrics are counted with plain code, not the AI model, so they are exact and repeatable.

const FILLERS = {
  English: [
    ['um / uh', 'um+|uh+|erm|er|hmm+'],
    ['like', 'like'],
    ['you know', 'you know'],
    ['basically', 'basically|literally'],
    ['sort of', 'sort of|kind of'],
  ],
  German: [
    ['äh / ähm', 'äh+m?|ähm+|ehm+'],
    ['halt', 'halt'],
    ['sozusagen', 'sozusagen|quasi'],
  ],
  Japanese: [
    ['えーと / えっと', 'えーと|えっと|えーっと|えー|えぇと'],
    ['あのー', 'あのー|あのう|あの(?=[、,])'],
    ['まあ', 'まあ|まぁ|なんか'],
  ],
  Dutch: [
    ['eh / uhm', 'eh+|ehm+|uhm+|uh+'],
    ['nou ja', 'nou ja|nou'],
  ],
  French: [
    ['euh', 'euh+'],
    ['du coup', 'du coup|genre|ben|bah'],
  ],
  Spanish: [
    ['eh / este', 'eh+|este|em+'],
    ['o sea', 'o sea|pues|digamos'],
  ],
};

// \b does not work for letters like ä or Japanese, so use Unicode-aware boundaries.
function countMatches(text, pattern) {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'giu');
  return (text.match(re) ?? []).length;
}

export function computeSpeechMetrics(transcript, language) {
  const candidate = transcript.filter((t) => t.speaker === 'candidate');
  const text = candidate.map((t) => t.text).join(' ');
  const isJapanese = language === 'Japanese';

  const units = isJapanese ? text.replace(/[\s\p{P}]/gu, '').length : text.split(/\s+/).filter(Boolean).length;

  const speakingMs = candidate.reduce((sum, t) => sum + (t.durationMs ?? 0), 0);
  const speakingMinutes = speakingMs / 60000;
  const pace = speakingMinutes >= 1 / 12 ? Math.round(units / speakingMinutes) : null; // need at least 5 seconds of speech

  const fillers = [];
  for (const [label, pattern] of FILLERS[language] ?? FILLERS.English) {
    const count = countMatches(text, pattern);
    if (count > 0) fillers.push({ label, count });
  }
  fillers.sort((a, b) => b.count - a.count);

  return {
    paceUnit: isJapanese ? 'characters per minute' : 'words per minute',
    pace,
    totalUnits: units,
    speakingSec: Math.round(speakingMs / 1000),
    fillers,
    totalFillers: fillers.reduce((sum, f) => sum + f.count, 0),
  };
}
