import test from "node:test";
import assert from "node:assert/strict";
import { calculateMetrics, getExercise, getExtendedPassage, getPassage, PASSAGES } from "../engine.mjs";

test("provides a passage for every difficulty level and cycles through passages", () => {
  for (const [level, passages] of Object.entries(PASSAGES)) {
    assert.equal(getPassage(level), passages[0]);
    assert.equal(getPassage(level, passages.length), passages[0]);
    assert.equal(getPassage(level, passages.length + 1), passages[1]);
  }
});

test("rejects unknown difficulty levels", () => {
  assert.throws(() => getPassage("Expert"), { name: "RangeError" });
  assert.throws(() => getExercise("Easy", "Missing mode"), { name: "RangeError" });
});

test("calculates speed and accuracy from correct characters", () => {
  assert.deepEqual(calculateMetrics("hello world", "hello world", 60), {
    wpm: 2, accuracy: 100, correctChars: 11, typedChars: 11, totalTypedChars: 11,
    errors: 0, incorrectChars: 0, cpm: 11, completedWords: 2
  });
  assert.deepEqual(calculateMetrics("hellx", "hello world", 30), {
    wpm: 2,
    accuracy: 80,
    correctChars: 4,
    typedChars: 5,
    totalTypedChars: 5,
    errors: 1,
    incorrectChars: 1,
    cpm: 8,
    completedWords: 0
  });
});

test("counts only correctly completed words and reports extra characters as errors", () => {
  assert.equal(calculateMetrics("hello w", "hello world", 60).completedWords, 1);
  assert.equal(calculateMetrics("hello world!", "hello world", 60).errors, 1);
  assert.equal(calculateMetrics("hello world", "hello world", 60).completedWords, 2);
});

test("preserves errors from corrected keystrokes", () => {
  const corrected = calculateMetrics("hello", "hello", 60, { errors: 1, totalTypedChars: 6 });
  assert.equal(corrected.correctChars, 5);
  assert.equal(corrected.errors, 1);
  assert.equal(corrected.accuracy, 83);
});

test("provides focused practice exercises for each level", () => {
  assert.equal(getExercise("Easy", "A–Z alphabet"), "abcdefghijklmnopqrstuvwxyz");
  assert.match(getExercise("Medium", "Mixed letters & numbers"), /\d/);
  assert.match(getExercise("Advanced", "Programming text"), /=>/);
  assert.equal(getExercise("Easy", "Passage", 0), getPassage("Easy", 0));
});

test("provides an extended passage of at least 500 words for every level", () => {
  for (const level of Object.keys(PASSAGES)) {
    const extended = getExercise(level, "Extended passage (500+ words)");
    assert.ok(extended.trim().split(/\s+/).length >= 500);
    assert.equal(extended, getExtendedPassage(level));
  }
  assert.throws(() => getExtendedPassage("Expert"), { name: "RangeError" });
});

test("calculates speed and accuracy from correct characters on partial input", () => {
  assert.deepEqual(calculateMetrics("hellx", "hello", 30), {
    wpm: 2,
    accuracy: 80,
    correctChars: 4,
    typedChars: 5,
    totalTypedChars: 5,
    errors: 1,
    incorrectChars: 1,
    cpm: 8,
    completedWords: 0
  });
});

test("handles empty input and zero elapsed time", () => {
  assert.deepEqual(calculateMetrics("", "hello", 0), {
    wpm: 0,
    accuracy: 100,
    correctChars: 0,
    typedChars: 0,
    totalTypedChars: 0,
    errors: 0,
    incorrectChars: 0,
    cpm: 0,
    completedWords: 0
  });
});

test("counts Unicode characters and never produces negative speed", () => {
  assert.deepEqual(calculateMetrics("🙂é", "🙂a", -1), {
    wpm: 12,
    accuracy: 50,
    correctChars: 1,
    typedChars: 2,
    totalTypedChars: 2,
    errors: 1,
    incorrectChars: 1,
    cpm: 60,
    completedWords: 0
  });
});
