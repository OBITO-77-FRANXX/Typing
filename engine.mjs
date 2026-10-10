export const PASSAGES = {
  Easy: [
    "the sun is warm and the sky is wide. a quiet morning is a lovely time to begin.",
    "take a deep breath and find your pace. small steps can take you a long way.",
    "good things grow with time and care. keep going, one word at a time."
  ],
  Medium: [
    "A steady rhythm makes every sentence feel lighter. Focus on the words, and let your hands find their way.",
    "Practice is less about perfection and more about showing up. Each session is a chance to feel a little more confident.",
    "Clear thoughts deserve a comfortable pace. Relax your shoulders, look ahead, and trust the progress you are making."
  ],
  Advanced: [
    "Deliberate practice transforms scattered keystrokes into a seamless, almost musical rhythm. Accuracy builds confidence; consistency turns confidence into speed.",
    "In the quiet spaces between ideas, precision matters. Stay curious, remain patient, and let each carefully chosen word find its place.",
    "A thoughtful approach to learning creates room for experimentation. Adjust your technique, embrace the challenge, and discover what works best."
  ],
  Hard: [
    "Pack my box with five dozen liquor jugs; then, quickly assess each quirky phrase, punctuation mark, and number: 2026!",
    "Complexity rewards calm focus: alternate between symbols (#, &, %) and precise prose—don't rush; refine each keystroke.",
    "Waltz, jazz, and quickfoxes? No: mix numbers (42, 3.14), braces {like this}, and punctuation—then breathe."
  ]
};

export function getExtendedPassage(level, minimumWords = 500) {
  const passages = PASSAGES[level];
  if (!passages) throw new RangeError(`Unknown difficulty level: ${level}`);
  const parts = [];
  let wordCount = 0;
  for (let index = 0; wordCount < minimumWords; index += 1) {
    const passage = passages[index % passages.length];
    parts.push(passage);
    wordCount += passage.trim().split(/\s+/).length;
  }
  return parts.join(" ");
}

export const EXERCISES = {
  Easy: {
    "Extended passage (500+ words)": () => getExtendedPassage("Easy"),
    "A–Z alphabet": () => "abcdefghijklmnopqrstuvwxyz",
    "Individual letters": () => "a s d f j k l a s d f j k l",
    "Random letters": () => Array.from({ length: 120 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join(" "),
    "Common words": () => "hello world computer practice little steps typing rhythm",
    "Uppercase letters": () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "Letter repetition": () => "aaa sss ddd fff jjj kkk lll aaa sss ddd"
  },
  Medium: {
    "Extended passage (500+ words)": () => getExtendedPassage("Medium"),
    "Mixed letters & numbers": () => "hello123 abc123xyz computer2026 learn2type 7days a1b2c3",
    "Number row": () => "0123456789 9876543210 12345 67890",
    "Symbols & punctuation": () => "A-Z, a-z; numbers (0-9) and symbols: @ # & ! ?"
  },
  Advanced: {
    "Extended passage (500+ words)": () => getExtendedPassage("Advanced"),
    "Programming text": () => 'const score = items.filter(item => item.ready).length; if (score >= 3) return "complete";',
    "Difficult spelling": () => "Conscientious researchers analyzed extraordinary circumstances with meticulous precision.",
    "Complex punctuation": () => 'Although progress (sometimes gradual) feels rewarding, patience—plus practice—makes a difference: 42%! '
  },
  Hard: {
    "Extended passage (500+ words)": () => getExtendedPassage("Hard"),
    "Random challenge": () => {
      const characters = "Qw7!z#2@Lm9$&xP4?b*R6_";
      return Array.from({ length: 100 }, () => characters[Math.floor(Math.random() * characters.length)]).join("");
    },
    "Code challenge": () => "function map<T>(items: T[]): T[] { return items.map((item) => ({ value: item, ok: true })); }",
    "Symbols challenge": () => "[]{} <> /= +-* _?! @#$% ^& (42) ;: 'quote' \"double\""
  }
};

export function getPassage(level, index = 0) {
  const passages = PASSAGES[level];
  if (!passages) throw new RangeError(`Unknown difficulty level: ${level}`);
  return passages[index % passages.length];
}

export function getExercise(level, mode, index = 0) {
  if (mode === "Passage") return getPassage(level, index);
  const generator = EXERCISES[level]?.[mode];
  if (!generator) throw new RangeError(`Unknown ${level} exercise: ${mode}`);
  return generator();
}

export function calculateMetrics(typedText, targetText, elapsedSeconds, attemptStats = null) {
  const typed = Array.from(typedText);
  const target = Array.from(targetText);
  const correctChars = typed.reduce((count, character, index) => (
    count + (character === target[index] ? 1 : 0)
  ), 0);
  const currentErrors = typed.length - correctChars;
  const errors = Math.max(currentErrors, attemptStats?.errors || 0);
  const attemptedChars = attemptStats?.totalTypedChars ?? typed.length;
  const accuracy = attemptedChars === 0 ? 100 : Math.round((Math.max(0, attemptedChars - errors) / attemptedChars) * 100);
  const effectiveMinutes = Math.max(0, typed.length > 0 ? Math.max(elapsedSeconds, 1) : elapsedSeconds) / 60;
  const targetCharacters = Array.from(targetText);
  const completedWords = [...targetText.matchAll(/\S+/g)].filter((match, wordIndex, words) => {
    const word = match[0];
    const wordStart = Array.from(targetText.slice(0, match.index)).length;
    const wordLength = Array.from(word).length;
    const wordEnd = wordStart + wordLength;
    const wordMatches = wordEnd <= typed.length &&
      Array.from(word).every((character, offset) => typed[wordStart + offset] === character);
    const hasBoundary = typed[wordEnd] !== undefined && /\s/.test(typed[wordEnd]) ||
      (wordIndex === words.length - 1 && wordEnd === targetCharacters.length);
    return wordMatches && hasBoundary;
  }).length;
  return {
    wpm: effectiveMinutes === 0 ? 0 : Math.round((correctChars / 5) / effectiveMinutes),
    accuracy,
    correctChars,
    typedChars: typed.length,
    totalTypedChars: attemptedChars,
    errors,
    incorrectChars: errors,
    cpm: effectiveMinutes === 0 ? 0 : Math.round(correctChars / effectiveMinutes),
    completedWords
  };
}
