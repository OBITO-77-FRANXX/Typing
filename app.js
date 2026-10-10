import { calculateMetrics, EXERCISES, getExercise, PASSAGES } from "./engine.mjs";

const KEYS = {
  sessions: "keystroke-practice-sessions",
  settings: "keystroke-settings",
  custom: "keystroke-custom-sets"
};
const LEVELS = Object.keys(PASSAGES);
const THEMES = [
  { name: "Dark", bg: "#0b1020", surface: "#121a2d", accent: "#a391ff", text: "#f2f4fb" },
  { name: "Light", bg: "#edf0f7", surface: "#ffffff", accent: "#6752cb", text: "#22243a" },
  { name: "Midnight", bg: "#090b18", surface: "#111328", accent: "#8f9dff", text: "#edf0ff" },
  { name: "Ocean", bg: "#0a1720", surface: "#10232e", accent: "#69d6d0", text: "#e9f7f7" },
  { name: "Forest", bg: "#101a15", surface: "#19271e", accent: "#9cdb9b", text: "#eff7ec" },
  { name: "Purple", bg: "#171024", surface: "#211733", accent: "#cb9dff", text: "#f5edff" },
  { name: "Cyberpunk", bg: "#100d1a", surface: "#1b1428", accent: "#ff72d2", text: "#fff1fd" },
  { name: "AMOLED", bg: "#000000", surface: "#080808", accent: "#c2aaff", text: "#f5f5f5" },
  { name: "Minimal", bg: "#17191c", surface: "#202328", accent: "#dadde2", text: "#f5f5f5" },
  { name: "Custom", bg: "#0b1020", surface: "#121a2d", accent: "#a391ff", text: "#f2f4fb" }
];
const RANKS = [
  { name: "Beginner", xp: 0 },
  { name: "Learner", xp: 100 },
  { name: "Typist", xp: 300 },
  { name: "Fast Typist", xp: 650 },
  { name: "Advanced Typist", xp: 1100 },
  { name: "Master", xp: 1800 }
];
const SHIFTED_KEYS = {
  "~": "`", "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6",
  "&": "7", "*": "8", "(": "9", ")": "0", "_": "-", "+": "=", "{": "[",
  "}": "]", "|": "\\", ":": ";", "\"": "'", "<": ",", ">": ".", "?": "/"
};
const DEFAULT_SETTINGS = {
  theme: "Dark", font: "DM Mono", typingFontSize: 17, keyboardSize: 100,
  keyboardSpacing: 5, keyboardOpacity: 100, cardRadius: 11, keyboardVisible: true,
  keyLabels: true, reduceMotion: false, sound: false, backgroundOpacity: 16,
  backgroundBlur: 0, backgroundBrightness: 100, backgroundImage: "", profileImage: "",
  backgroundPosition: "center", backgroundSize: "cover",
  keyboardStyle: "classic", highlightStyle: "glow",
  accent: "", background: "", level: "Easy", duration: 30, countdown: false, mode: "Passage"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const elements = {
  date: $("#today-label"), pageTitle: $("#page-title"), views: $$(".view"),
  navItems: $$(".nav-item"), levelButtons: $$(".level-button"),
  durationButtons: $$(".duration-button"), passage: $("#typing-text"), input: $("#typing-input"),
  startPrompt: $("#typing-start"), timer: $("#timer-value"), wpm: $("#wpm-value"),
  accuracy: $("#accuracy-value"), status: $("#session-status"),
  characterCount: $("#characters-count"), keyboard: $("#keyboard")
};

const state = {
  view: "dashboard", level: "Easy", mode: "Passage", duration: 30, customPassage: "",
  trendRange: 7,
  customTitle: "", customFontSize: null, customDisplayStyle: "wrap",
  passageIndex: Object.fromEntries(LEVELS.map((level) => [level, 0])),
  passage: "", startedAt: null, pausedAt: null, pausedSeconds: 0,
  remaining: 30, elapsed: 0, timerId: null, countdownId: null, countdownUntil: null,
  finished: false, paused: false, typedText: "", errorKeystrokes: 0,
  totalTypedChars: 0, pressedKeys: new Set(),
  shiftOn: false, restartArmed: false, savedResult: false
};
const raceState = {
  level: "Easy", passage: "", typedText: "", errorKeystrokes: 0, totalTypedChars: 0,
  startedAt: null, timerId: null, elapsed: 0, botProgress: 0, botWpm: 32,
  finished: false, savedResult: false,
  passageIndex: Object.fromEntries(LEVELS.map((level) => [level, 0]))
};
const RACE_BOT_SPEEDS = { Easy: 32, Medium: 40, Advanced: 48, Hard: 56 };

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.error(`Could not read ${key}.`, error);
    return [];
  }
}

function readSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(KEYS.settings) || "{}");
    return { ...DEFAULT_SETTINGS, ...(value && typeof value === "object" ? value : {}) };
  } catch (error) {
    console.error("Could not read saved settings.", error);
    return { ...DEFAULT_SETTINGS };
  }
}

let sessions = readArray(KEYS.sessions).filter((item) => item && typeof item === "object" &&
  Number.isFinite(item.wpm) && Number.isFinite(item.accuracy) && typeof item.date === "string");
let settings = readSettings();
if (LEVELS.includes(settings.level)) state.level = settings.level;
if (Number.isInteger(settings.duration) && settings.duration >= 0 && settings.duration <= 5999) {
  state.duration = settings.duration;
  state.remaining = settings.duration;
}
if (typeof settings.mode === "string") state.mode = settings.mode;
let customSets = readArray(KEYS.custom).filter((item) => item && typeof item.id === "string" &&
  typeof item.title === "string" && typeof item.text === "string");

function persist(key, value, message = "Could not save your changes in this browser.") {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(message, error);
    showNotice(`${message} Free up some browser storage and try again.`);
    return false;
  }
}

function showNotice(message) {
  const notice = $("#app-notice");
  if (!notice) return;
  notice.textContent = message;
  notice.hidden = false;
  window.clearTimeout(showNotice.timeout);
  showNotice.timeout = window.setTimeout(() => { notice.hidden = true; }, 5000);
}

function switchView(name) {
  const titles = {
    dashboard: "Overview", practice: "Practice", progress: "Statistics",
    race: "Typing race", custom: "Custom practice", achievements: "Achievements", customization: "Customize"
  };
  if (!titles[name]) return;
  state.view = name;
  elements.views.forEach((view) => {
    const active = view.id === `${name}-view`;
    view.hidden = !active;
    view.classList.toggle("active", active);
  });
  $("#keyboard-style").addEventListener("change", (event) => {
    settings.keyboardStyle = event.target.value;
    applySettings();
    saveSettings();
  });
  $("#highlight-style").addEventListener("change", (event) => {
    settings.highlightStyle = event.target.value;
    applySettings();
    saveSettings();
  });
  elements.navItems.forEach((item) => {
    const active = item.dataset.view === name;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  elements.pageTitle.textContent = titles[name];
  if (name === "dashboard") renderDashboard();
  if (name === "progress") renderProgress();
  if (name === "custom") renderCustomSets();
  if (name === "achievements") renderAchievements();
  if (name === "customization") renderThemes();
  if (name === "practice") requestAnimationFrame(() => elements.input.focus());
  if (name === "race") {
    renderRace();
    requestAnimationFrame(() => $("#race-input").focus());
  }
}

function setSelected(buttons, selectedButton) {
  buttons.forEach((button) => {
    const selected = button === selectedButton;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function currentElapsed() {
  if (state.startedAt === null) return state.elapsed;
  const stop = state.paused ? state.pausedAt : Date.now();
  return Math.max(0, (stop - state.startedAt) / 1000 - state.pausedSeconds);
}

function loadPassage() {
  state.passage = state.customPassage || getExercise(state.level, state.mode, state.passageIndex[state.level]);
  renderPassage();
}

function renderExerciseOptions() {
  const select = $("#practice-mode");
  const modes = ["Passage", ...Object.keys(EXERCISES[state.level])];
  select.replaceChildren(...modes.map((mode) => {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = mode;
    return option;
  }));
  select.value = modes.includes(state.mode) ? state.mode : "Passage";
  state.mode = select.value;
  settings.mode = state.mode;
}

function renderPassage() {
  const typed = Array.from(state.typedText);
  const target = Array.from(state.passage);
  const typingArea = $("#typing-area");
  typingArea.classList.toggle("long-passage", target.length > 180);
  const fragment = document.createDocumentFragment();
  target.forEach((character, index) => {
    const span = document.createElement("span");
    span.className = "character";
    span.textContent = character;
    if (index < typed.length) span.classList.add(typed[index] === character ? "correct" : "incorrect");
    else if (index === typed.length && !state.finished) span.classList.add("current");
    fragment.append(span);
  });
  if (typed.length > target.length) {
    typed.slice(target.length).forEach((character) => {
      const span = document.createElement("span");
      span.className = "character incorrect extra-character";
      span.textContent = character;
      fragment.append(span);
    });
  }
  elements.passage.replaceChildren(fragment);
  typingArea.classList.toggle("single-line", state.customDisplayStyle === "line");
  elements.characterCount.textContent = `${Math.min(typed.length, target.length)} / ${target.length} characters`;
  const progress = target.length === 0 ? 0 : Math.min(100, Math.round(typed.length / target.length * 100));
  $("#typing-area").parentElement.querySelector(".typing-progress").setAttribute("aria-valuenow", String(progress));
  $("#typing-progress-fill").style.width = `${progress}%`;
  elements.startPrompt.hidden = Array.from(state.typedText).length > 0 || state.finished;
  const expected = target[typed.length];
  const activeKey = expected === undefined ? null : SHIFTED_KEYS[expected] || expected.toLowerCase();
  elements.keyboard.querySelectorAll(".key").forEach((button) => {
    button.classList.toggle("key-target", button.dataset.key.toLowerCase() === activeKey);
  });
  if (expected && (expected !== expected.toLowerCase() || SHIFTED_KEYS[expected])) {
    elements.keyboard.querySelectorAll('[data-key="Shift"]').forEach((button) => button.classList.add("key-target"));
  }
  if (target.length > 180 && !state.finished) {
    const current = elements.passage.querySelector(".character.current");
    if (current) {
      const areaRect = typingArea.getBoundingClientRect();
      const currentRect = current.getBoundingClientRect();
      if (currentRect.bottom > areaRect.bottom - 16) typingArea.scrollTop += currentRect.bottom - areaRect.bottom + 16;
      else if (currentRect.top < areaRect.top + 12) typingArea.scrollTop -= areaRect.top + 12 - currentRect.top;
    }
  } else typingArea.scrollTop = 0;
}

function prepareRace({ advance = false } = {}) {
  window.clearInterval(raceState.timerId);
  raceState.timerId = null;
  raceState.startedAt = null;
  raceState.elapsed = 0;
  raceState.botProgress = 0;
  raceState.typedText = "";
  raceState.errorKeystrokes = 0;
  raceState.totalTypedChars = 0;
  raceState.finished = false;
  raceState.savedResult = false;
  if (advance) {
    raceState.passageIndex[raceState.level] = (raceState.passageIndex[raceState.level] + 1) % PASSAGES[raceState.level].length;
  }
  raceState.passage = getExercise(raceState.level, "Passage", raceState.passageIndex[raceState.level]);
  raceState.botWpm = RACE_BOT_SPEEDS[raceState.level];
  $("#race-input").value = "";
  $("#race-start").disabled = false;
  $("#race-start").textContent = "Start race";
  renderRace();
}

function updateRaceView() {
  const targetLength = Array.from(raceState.passage).length;
  const playerProgress = Math.min(targetLength, Array.from(raceState.typedText).length);
  const botProgress = Math.min(targetLength, Math.floor(raceState.elapsed * raceState.botWpm * 5 / 60));
  const playerRatio = targetLength ? playerProgress / targetLength : 0;
  const botRatio = targetLength ? botProgress / targetLength : 0;
  const playerPercent = Math.round(playerRatio * 100);
  const botPercent = Math.round(botRatio * 100);
  $("#race-player-progress").style.width = `${playerRatio * 92}%`;
  $("#race-player-runner").style.left = `${2 + playerRatio * 92}%`;
  $("#race-bot-progress").style.width = `${botRatio * 92}%`;
  $("#race-bot-runner").style.left = `${2 + botRatio * 92}%`;
  $("#race-player-percent").textContent = `${playerPercent}%`;
  $("#race-bot-percent").textContent = `${botPercent}%`;
  if (!raceState.finished) {
    $("#race-player-caption").textContent = raceState.startedAt === null ? "Ready at the start" : `${playerProgress} characters typed`;
    $("#race-bot-caption").textContent = raceState.startedAt === null ? "Ready at the start" : `${raceState.botWpm} WPM pace`;
  }
  $("#race-time").textContent = `${String(Math.floor(raceState.elapsed / 60)).padStart(2, "0")}:${String(Math.floor(raceState.elapsed % 60)).padStart(2, "0")}`;
  $("#race-bot-wpm").textContent = String(raceState.botWpm);
  const metrics = calculateMetrics(raceState.typedText, raceState.passage, raceState.elapsed, {
    errors: raceState.errorKeystrokes, totalTypedChars: raceState.totalTypedChars
  });
  $("#race-wpm").textContent = String(metrics.wpm);
  $("#race-accuracy").textContent = String(metrics.accuracy);
  $("#race-character-count").textContent = `${playerProgress} / ${targetLength} characters`;
  if (!raceState.finished) {
    $("#race-status").textContent = raceState.startedAt === null
      ? "Choose a level, then start typing when you're ready."
      : `Race on! Nova is typing at ${raceState.botWpm} WPM.`;
  }
  if (!raceState.finished && raceState.startedAt !== null && botProgress >= targetLength) finishRace("Nova");
}

function renderRace() {
  const typed = Array.from(raceState.typedText);
  const target = Array.from(raceState.passage);
  const fragment = document.createDocumentFragment();
  target.forEach((character, index) => {
    const span = document.createElement("span");
    span.className = "character";
    span.textContent = character;
    if (index < typed.length) span.classList.add(typed[index] === character ? "correct" : "incorrect");
    else if (index === typed.length && !raceState.finished) span.classList.add("current");
    fragment.append(span);
  });
  $("#race-text").replaceChildren(fragment);
  $("#race-focus").hidden = typed.length > 0 || raceState.startedAt !== null || raceState.finished;
  updateRaceView();
}

function startRace() {
  if (raceState.startedAt !== null || raceState.finished) return;
  raceState.startedAt = Date.now();
  $("#race-start").disabled = true;
  $("#race-start").textContent = "Race in progress";
  raceState.timerId = window.setInterval(() => {
    raceState.elapsed = Math.max(0, (Date.now() - raceState.startedAt) / 1000);
    updateRaceView();
  }, 100);
  updateRaceView();
}

function trackRaceInput(nextText) {
  const previous = Array.from(raceState.typedText);
  const next = Array.from(nextText);
  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < next.length - prefix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) suffix += 1;
  const inserted = next.slice(prefix, next.length - suffix);
  const target = Array.from(raceState.passage);
  inserted.forEach((character, index) => {
    raceState.totalTypedChars += 1;
    if (character !== target[prefix + index]) raceState.errorKeystrokes += 1;
  });
  raceState.typedText = nextText;
}

function finishRace(winner) {
  if (raceState.finished) return;
  raceState.elapsed = raceState.startedAt === null
    ? 0 : Math.max(1, (Date.now() - raceState.startedAt) / 1000);
  raceState.finished = true;
  window.clearInterval(raceState.timerId);
  raceState.timerId = null;
  $("#race-start").disabled = true;
  $("#race-status").textContent = winner === "You" ? "You win! A brilliant run against Nova." : "Nova wins this round. Ready for a rematch?";
  $("#race-player-caption").textContent = winner === "You" ? "First across the finish line!" : "Race complete";
  $("#race-bot-caption").textContent = winner === "Nova" ? "First across the finish line!" : "Race complete";
  $("#race-focus").hidden = true;
  updateRaceView();
  const typedChars = Array.from(raceState.typedText).length;
  if (!raceState.savedResult && typedChars > 0) {
    const metrics = calculateMetrics(raceState.typedText, raceState.passage, raceState.elapsed, {
      errors: raceState.errorKeystrokes, totalTypedChars: raceState.totalTypedChars
    });
    sessions.unshift({
      ...metrics, level: raceState.level, mode: "Race", duration: Math.round(raceState.elapsed),
      elapsedSeconds: Math.round(raceState.elapsed), title: `Typing race vs Nova · ${winner}`,
      date: new Date().toISOString()
    });
    sessions = sessions.slice(0, 2000);
    raceState.savedResult = persist(KEYS.sessions, sessions, "Could not save your race result.");
    updateProgression(metrics);
    renderDashboard();
  }
}

function updateMetrics() {
  const metrics = calculateMetrics(state.typedText, state.passage, currentElapsed(), {
    errors: state.errorKeystrokes, totalTypedChars: state.totalTypedChars
  });
  elements.wpm.textContent = String(metrics.wpm);
  $("#accuracy-value").innerHTML = `${metrics.accuracy}<span>%</span>`;
  $("#errors-value").textContent = String(metrics.errors);
  $("#cpm-value").textContent = String(metrics.cpm);
  $("#correct-value").textContent = String(metrics.correctChars);
  $("#wrong-value").textContent = String(metrics.incorrectChars);
  return metrics;
}

function trackInput(nextText) {
  const previous = Array.from(state.typedText);
  const next = Array.from(nextText);
  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < next.length - prefix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) suffix += 1;
  const inserted = next.slice(prefix, next.length - suffix);
  const target = Array.from(state.passage);
  inserted.forEach((character, index) => {
    const expected = target[prefix + index];
    state.totalTypedChars += 1;
    if (character !== expected) state.errorKeystrokes += 1;
  });
  state.typedText = nextText;
}

function updateTimer() {
  if (state.duration === 0) elements.timer.innerHTML = "∞";
  else elements.timer.innerHTML = `${Math.max(0, Math.ceil(state.remaining))}<span>s</span>`;
  elements.timer.classList.toggle("timer-low", state.remaining <= 5 && state.startedAt !== null && state.duration > 0);
}

function playBeep(frequency = 620, duration = 0.035) {
  if (!settings.sound) return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.035;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.onended = () => context.close();
  } catch (error) {
    console.error("Could not play the optional typing sound.", error);
  }
}

function startClock() {
  if (state.startedAt !== null || state.finished) return;
  state.startedAt = Date.now();
  state.paused = false;
  $("#pause-button").disabled = false;
  $("#pause-button").textContent = "Pause";
  elements.status.textContent = "SESSION IN PROGRESS";
  elements.status.parentElement.classList.add("is-running");
  state.timerId = window.setInterval(() => {
    state.elapsed = currentElapsed();
    if (state.duration > 0) state.remaining = Math.max(0, state.duration - state.elapsed);
    updateTimer();
    updateMetrics();
    if (state.duration > 0 && state.remaining <= 0) finishSession();
  }, 100);
}

function startCountdown() {
  if (state.countdownId || state.startedAt !== null || state.finished) return;
  state.countdownUntil = Date.now() + 3000;
  const overlay = $("#countdown-overlay");
  overlay.hidden = false;
  const tick = () => {
    const seconds = Math.ceil((state.countdownUntil - Date.now()) / 1000);
    if (seconds <= 0) {
      window.clearInterval(state.countdownId);
      state.countdownId = null;
      overlay.hidden = true;
      startClock();
      elements.input.focus();
      return;
    }
    $("#countdown-number").textContent = String(seconds);
  };
  tick();
  state.countdownId = window.setInterval(tick, 100);
}

function beginSession() {
  if (state.finished || state.startedAt !== null || state.countdownId) return;
  if ($("#countdown-toggle").checked) {
    state.typedText = "";
    state.errorKeystrokes = 0;
    state.totalTypedChars = 0;
    elements.input.value = "";
    renderPassage();
    startCountdown();
  } else startClock();
}

function pauseSession() {
  if (state.startedAt === null || state.paused || state.finished) return;
  state.paused = true;
  state.pausedAt = Date.now();
  state.elapsed = currentElapsed();
  window.clearInterval(state.timerId);
  state.timerId = null;
  elements.status.textContent = "PAUSED";
  elements.status.parentElement.classList.remove("is-running");
  $("#pause-button").textContent = "Resume";
}

function resumeSession() {
  if (!state.paused || state.finished) return;
  state.pausedSeconds += (Date.now() - state.pausedAt) / 1000;
  state.pausedAt = null;
  state.paused = false;
  elements.status.textContent = "SESSION IN PROGRESS";
  elements.status.parentElement.classList.add("is-running");
  $("#pause-button").textContent = "Pause";
  state.timerId = window.setInterval(() => {
    state.elapsed = currentElapsed();
    if (state.duration > 0) state.remaining = Math.max(0, state.duration - state.elapsed);
    updateTimer();
    updateMetrics();
    if (state.duration > 0 && state.remaining <= 0) finishSession();
  }, 100);
}

function ratingFor(metrics) {
  if (metrics.wpm >= 100 && metrics.accuracy >= 97) return "Lightning fast";
  if (metrics.wpm >= 70 && metrics.accuracy >= 95) return "Brilliant rhythm";
  if (metrics.wpm >= 40 && metrics.accuracy >= 90) return "Great progress";
  if (metrics.accuracy >= 85) return "Steady and focused";
  return "Every practice counts";
}

function fillResults(metrics) {
  $("#result-wpm").textContent = String(metrics.wpm);
  $("#result-accuracy").textContent = `${metrics.accuracy}%`;
  $("#result-cpm").textContent = String(metrics.cpm);
  $("#result-errors").textContent = String(metrics.errors);
  $("#result-characters").textContent = String(metrics.totalTypedChars);
  $("#result-correct").textContent = String(metrics.correctChars);
  $("#result-wrong").textContent = String(metrics.incorrectChars);
  $("#result-words").textContent = String(metrics.completedWords);
  $("#result-time").textContent = `${Math.round(state.elapsed)} sec`;
  $("#result-rating").textContent = ratingFor(metrics);
}

function finishSession() {
  if (state.finished) return;
  state.elapsed = Math.min(state.duration > 0 ? state.duration : Infinity, currentElapsed());
  if (Array.from(state.typedText).length > 0) state.elapsed = Math.max(1, state.elapsed);
  if (state.duration > 0) state.remaining = 0;
  state.finished = true;
  state.paused = false;
  window.clearInterval(state.timerId);
  window.clearInterval(state.countdownId);
  state.timerId = null;
  state.countdownId = null;
  $("#countdown-overlay").hidden = true;
  $("#pause-button").disabled = true;
  updateTimer();
  const metrics = calculateMetrics(state.typedText, state.passage, state.elapsed, {
    errors: state.errorKeystrokes, totalTypedChars: state.totalTypedChars
  });
  elements.wpm.textContent = String(metrics.wpm);
  $("#accuracy-value").innerHTML = `${metrics.accuracy}<span>%</span>`;
  elements.status.textContent = "SESSION COMPLETE";
  elements.status.parentElement.classList.remove("is-running");
  elements.status.parentElement.classList.add("is-complete");
  renderPassage();
  fillResults(metrics);
  if (!state.savedResult && Array.from(state.typedText).length > 0) {
    const previous = sessions[0];
    sessions.unshift({
      ...metrics, level: state.level, mode: state.mode, duration: state.duration,
      elapsedSeconds: Math.round(state.elapsed),
      title: state.customTitle || (state.mode !== "Passage" ? state.mode : ""),
      date: new Date().toISOString()
    });
    sessions = sessions.slice(0, 2000);
    state.savedResult = persist(KEYS.sessions, sessions, "Could not save your practice history.");
    state.savedResult = true;
    updateProgression(metrics);
    renderDashboard();
    if (previous && metrics.wpm > previous.wpm) $("#result-rating").textContent += " · New personal best!";
  }
  $("#result-modal").hidden = false;
  $("#result-restart").focus();
  playBeep(880, 0.12);
}

function resetSession({ advance = false } = {}) {
  if (advance) {
    if (state.customPassage) {
      state.customPassage = "";
      state.customTitle = "";
      state.customFontSize = null;
      state.customDisplayStyle = "wrap";
      state.mode = "Passage";
      renderExerciseOptions();
    } else {
      state.passageIndex[state.level] = (state.passageIndex[state.level] + 1) % PASSAGES[state.level].length;
    }
  }
  window.clearInterval(state.timerId);
  window.clearInterval(state.countdownId);
  state.timerId = null;
  state.countdownId = null;
  state.countdownUntil = null;
  state.startedAt = null;
  state.pausedAt = null;
  state.pausedSeconds = 0;
  state.elapsed = 0;
  state.remaining = state.duration;
  state.finished = false;
  state.paused = false;
  state.typedText = "";
  state.errorKeystrokes = 0;
  state.totalTypedChars = 0;
  state.restartArmed = false;
  state.savedResult = false;
  elements.input.value = "";
  elements.status.textContent = "READY WHEN YOU ARE";
  elements.status.parentElement.classList.remove("is-running", "is-complete");
  $("#pause-button").disabled = true;
  $("#pause-button").textContent = "Pause";
  $("#result-modal").hidden = true;
  $("#countdown-overlay").hidden = true;
  elements.wpm.textContent = "0";
  $("#accuracy-value").innerHTML = "100<span>%</span>";
  $("#errors-value").textContent = "0";
  $("#cpm-value").textContent = "0";
  $("#correct-value").textContent = "0";
  $("#wrong-value").textContent = "0";
  updateTimer();
  renderExerciseOptions();
  loadPassage();
  elements.passage.style.fontSize = `${state.customFontSize || settings.typingFontSize}px`;
  elements.input.focus();
}

function setLevel(level, button) {
  if (state.level === level) return;
  state.level = level;
  state.mode = "Passage";
  state.customPassage = "";
  state.customTitle = "";
  state.customFontSize = null;
  state.customDisplayStyle = "wrap";
  settings.level = level;
  settings.mode = "Passage";
  saveSettings();
  renderExerciseOptions();
  setSelected(elements.levelButtons, button);
  resetSession();
}

function setDuration(duration, button) {
  state.duration = duration;
  state.remaining = duration;
  settings.duration = duration;
  saveSettings();
  if (button) setSelected($$(".duration-button"), button);
  else {
    $$(".duration-button").forEach((item) => {
      item.classList.remove("selected");
      item.setAttribute("aria-pressed", "false");
    });
  }
  $("#untimed-toggle").checked = duration === 0;
  resetSession();
}

function normalizeKey(key) {
  if (key === " ") return " ";
  if (key === "Escape") return "Esc";
  return key.length === 1 ? key.toLowerCase() : key;
}

function highlightKey(key, active) {
  const normalized = normalizeKey(key);
  if (active) state.pressedKeys.add(normalized);
  else state.pressedKeys.delete(normalized);
  elements.keyboard.querySelectorAll(".key").forEach((button) => {
    const isActive = state.pressedKeys.has(button.dataset.key.toLowerCase()) ||
      state.pressedKeys.has(button.dataset.key);
    button.classList.toggle("key-active", isActive);
  });
}

function makeSessionRow(session, compact = false) {
  const row = document.createElement("div");
  row.className = compact ? "recent-row" : "history-row";
  const level = document.createElement("span");
  level.className = `level-pill level-${String(session.level || "Easy").toLowerCase()}`;
  level.textContent = session.title || session.level || "Practice";
  const date = document.createElement("span");
  date.className = "session-date";
  date.textContent = new Date(session.date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const speed = document.createElement("strong");
  speed.className = "session-speed";
  speed.textContent = `${session.wpm} WPM`;
  const accuracy = document.createElement("span");
  accuracy.className = "session-accuracy";
  accuracy.textContent = `${session.accuracy}% accuracy`;
  row.append(level, date, speed, accuracy);
  return row;
}

function getTotals() {
  const words = sessions.reduce((sum, session) => sum + (session.completedWords || 0), 0);
  const characters = sessions.reduce((sum, session) => sum + (session.totalTypedChars || session.typedChars || 0), 0);
  const seconds = sessions.reduce((sum, session) => sum + (session.elapsedSeconds || session.duration || 0), 0);
  const errors = sessions.reduce((sum, session) => sum + (session.errors || 0), 0);
  return { words, characters, seconds, errors };
}

function currentStreak() {
  const dates = new Set(sessions.map((session) => new Date(session.date).toLocaleDateString("en-CA")));
  let cursor = new Date();
  const today = cursor.toLocaleDateString("en-CA");
  if (!dates.has(today)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(cursor.toLocaleDateString("en-CA"))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function setText(id, value) {
  const node = $(`#${id}`);
  if (node) node.textContent = String(value);
}

function renderStats() {
  const bestWpm = sessions.length ? Math.max(...sessions.map((session) => session.wpm)) : null;
  const bestAccuracy = sessions.length ? Math.max(...sessions.map((session) => session.accuracy)) : null;
  const averageWpm = sessions.length ? Math.round(sessions.reduce((sum, session) => sum + session.wpm, 0) / sessions.length) : null;
  const totals = getTotals();
  const streak = currentStreak();
  setText("dashboard-wpm", bestWpm ?? "—");
  setText("dashboard-accuracy", bestAccuracy ?? "—");
  setText("dashboard-sessions", sessions.length);
  setText("dashboard-words", totals.words.toLocaleString());
  setText("dashboard-characters", totals.characters.toLocaleString());
  setText("dashboard-time", `${Math.floor(totals.seconds / 60)} min`);
  setText("dashboard-average", averageWpm ?? "—");
  setText("dashboard-streak", `${streak} ${streak === 1 ? "day" : "days"}`);
  setText("progress-wpm", bestWpm ?? "—");
  setText("progress-accuracy", bestAccuracy ?? "—");
  setText("progress-sessions", sessions.length);
  setText("progress-words", totals.words.toLocaleString());
  setText("progress-time", Math.floor(totals.seconds / 60));
  setText("progress-streak", streak);
  const todaysSessions = sessions.filter((session) => new Date(session.date).toDateString() === new Date().toDateString());
  const todaySeconds = todaysSessions.reduce((sum, session) => sum + (session.elapsedSeconds || 0), 0);
  $("#daily-challenge-progress").textContent = todaySeconds >= 60 ? "Challenge complete — you showed up today!" : `${Math.min(60, todaySeconds)} / 60 seconds practiced today`;
}

function renderDashboard() {
  renderStats();
  const recent = $("#dashboard-recent");
  recent.replaceChildren();
  if (sessions.length === 0) {
    recent.innerHTML = '<div class="empty-state">Your completed sessions will show up here.</div>';
    return;
  }
  sessions.slice(0, 3).forEach((session) => recent.append(makeSessionRow(session, true)));
}

function renderProgress() {
  renderStats();
  const history = $("#session-history");
  history.replaceChildren();
  if (sessions.length === 0) {
    history.innerHTML = '<div class="empty-state">Your finished practice sessions will appear here.</div>';
  } else sessions.forEach((session) => history.append(makeSessionRow(session)));
  renderTrend();
  renderXp();
}

function renderTrend() {
  const chart = $("#trend-chart");
  chart.replaceChildren();
  const now = new Date();
  const groups = [];
  if (state.trendRange === 7) {
    for (let ago = 6; ago >= 0; ago -= 1) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - ago);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      groups.push({ start, end, label: start.toLocaleDateString(undefined, { weekday: "short" }) });
    }
    $("#trend-eyebrow").textContent = "LAST SEVEN DAYS";
    $("#trend-title").textContent = "Daily practice";
  } else if (state.trendRange === 30) {
    const currentWeekStart = new Date(now);
    currentWeekStart.setHours(0, 0, 0, 0);
    currentWeekStart.setDate(currentWeekStart.getDate() - 27);
    for (let week = 0; week < 4; week += 1) {
      const start = new Date(currentWeekStart);
      start.setDate(start.getDate() + week * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      groups.push({ start, end, label: `Week ${week + 1}` });
    }
    $("#trend-eyebrow").textContent = "LAST FOUR WEEKS";
    $("#trend-title").textContent = "Weekly practice";
  } else {
    for (let ago = 2; ago >= 0; ago -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - ago, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - ago + 1, 1);
      groups.push({ start, end, label: start.toLocaleDateString(undefined, { month: "short" }) });
    }
    $("#trend-eyebrow").textContent = "LAST THREE MONTHS";
    $("#trend-title").textContent = "Monthly practice";
  }
  const minutes = groups.map((group) => sessions.filter((session) => {
    const date = new Date(session.date);
    return date >= group.start && date < group.end;
  }).reduce((sum, session) => sum + (session.elapsedSeconds || 0), 0) / 60);
  const max = Math.max(1, ...minutes);
  groups.forEach((group, index) => {
    const column = document.createElement("div");
    column.className = "trend-day";
    const value = document.createElement("span");
    value.className = "trend-value";
    value.textContent = `${Math.round(minutes[index])}m`;
    const bar = document.createElement("i");
    bar.style.height = `${Math.max(5, minutes[index] / max * 100)}%`;
    const label = document.createElement("small");
    label.textContent = group.label;
    column.append(value, bar, label);
    chart.append(column);
  });
}

function calculateXp() {
  return sessions.reduce((sum, session) => sum + 10 +
    Math.min(40, Math.floor((session.wpm || 0) / 5)) +
    (session.accuracy >= 95 ? 10 : 0) +
    Math.floor((session.elapsedSeconds || 0) / 30), 0);
}

function renderXp() {
  const xp = calculateXp();
  let rankIndex = 0;
  while (rankIndex + 1 < RANKS.length && xp >= RANKS[rankIndex + 1].xp) rankIndex += 1;
  const rank = RANKS[rankIndex];
  const next = RANKS[rankIndex + 1];
  setText("progress-rank", rank.name);
  setText("xp-label", next ? `${xp} XP · ${Math.max(0, next.xp - xp)} XP to ${next.name}` : `${xp} XP · Top rank`);
  $("#xp-bar").style.width = `${next ? Math.min(100, (xp - rank.xp) / (next.xp - rank.xp) * 100) : 100}%`;
}

const ACHIEVEMENTS = [
  ["first", "First steps", "Complete your first practice session.", () => sessions.length >= 1],
  ["ten", "Finding a rhythm", "Complete 10 practice sessions.", () => sessions.length >= 10],
  ["50wpm", "Quick fingers", "Reach 50 WPM in a session.", () => sessions.some((session) => session.wpm >= 50)],
  ["75wpm", "Fast typist", "Reach 75 WPM in a session.", () => sessions.some((session) => session.wpm >= 75)],
  ["100wpm", "Lightning", "Reach 100 WPM in a session.", () => sessions.some((session) => session.wpm >= 100)],
  ["95accuracy", "Careful craft", "Reach 95% accuracy in a session.", () => sessions.some((session) => session.accuracy >= 95)],
  ["perfect", "Nailed it", "Finish a session with 100% accuracy.", () => sessions.some((session) => session.accuracy === 100 && session.typedChars > 0)],
  ["hour", "Time well spent", "Practice for one hour in total.", () => getTotals().seconds >= 3600],
  ["master", "Typing master", "Reach the Master rank.", () => calculateXp() >= RANKS.at(-1).xp]
];

function renderAchievements() {
  const grid = $("#achievement-grid");
  grid.replaceChildren();
  ACHIEVEMENTS.forEach(([id, title, description, unlocked]) => {
    const card = document.createElement("article");
    card.className = `achievement-card${unlocked() ? " unlocked" : ""}`;
    card.dataset.achievement = id;
    const icon = document.createElement("span");
    icon.className = "achievement-icon";
    icon.textContent = unlocked() ? "✳" : "◇";
    const heading = document.createElement("h2");
    heading.textContent = title;
    const copy = document.createElement("p");
    copy.textContent = description;
    const status = document.createElement("span");
    status.className = "achievement-status";
    status.textContent = unlocked() ? "UNLOCKED" : "LOCKED";
    card.append(icon, heading, copy, status);
    grid.append(card);
  });
}

function renderCustomSets() {
  const list = $("#custom-list");
  list.replaceChildren();
  if (!customSets.length) {
    list.innerHTML = '<div class="empty-state">Save a passage above and it will be ready here.</div>';
    return;
  }
  customSets.forEach((set) => {
    const card = document.createElement("article");
    card.className = "custom-set-card";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = set.title;
    const description = document.createElement("p");
    description.textContent = `${set.level} · ${set.duration === 0 ? "No timer" : `${set.duration}s`} · ${set.text.slice(0, 95)}${set.text.length > 95 ? "…" : ""}`;
    info.append(title, description);
    const actions = document.createElement("div");
    actions.className = "custom-set-actions";
    [["Practice", "practice"], ["Edit", "edit"], ["Delete", "delete"]].forEach(([label, action]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = action === "delete" ? "text-button danger-text" : "text-button";
      button.dataset.action = action;
      button.dataset.id = set.id;
      actions.append(button);
    });
    card.append(info, actions);
    list.append(card);
  });
}

function renderThemes() {
  const grid = $("#theme-grid");
  grid.replaceChildren();
  THEMES.forEach((theme) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `theme-swatch${settings.theme === theme.name ? " selected" : ""}`;
    button.setAttribute("aria-pressed", String(settings.theme === theme.name));
    button.style.setProperty("--preview-bg", theme.bg);
    button.style.setProperty("--preview-surface", theme.surface);
    button.style.setProperty("--preview-accent", theme.accent);
    button.innerHTML = `<span class="theme-preview"><i></i><i></i></span><strong>${theme.name}</strong>`;
    button.addEventListener("click", () => {
      settings.theme = theme.name;
      if (theme.name !== "Custom") {
        settings.background = theme.bg;
        settings.accent = theme.accent;
      }
      applySettings();
      renderThemes();
      saveSettings();
    });
    grid.append(button);
  });
}

function saveSettings() {
  persist(KEYS.settings, settings, "Could not save your preferences.");
}

function applySettings() {
  const theme = THEMES.find((item) => item.name === settings.theme) || THEMES[0];
  const root = document.documentElement;
  root.style.setProperty("--bg", settings.background || theme.bg);
  root.style.setProperty("--surface", theme.surface);
  root.style.setProperty("--surface-raised", theme.surface);
  root.style.setProperty("--text", theme.text);
  root.style.setProperty("--violet", settings.accent || theme.accent);
  root.style.setProperty("--typing-font-size", `${settings.typingFontSize}px`);
  root.style.setProperty("--keyboard-scale", `${settings.keyboardSize / 100}`);
  root.style.setProperty("--keyboard-gap", `${settings.keyboardSpacing}px`);
  root.style.setProperty("--keyboard-opacity", `${settings.keyboardOpacity / 100}`);
  root.style.setProperty("--card-radius", `${settings.cardRadius}px`);
  root.style.setProperty("--background-opacity", `${settings.backgroundOpacity / 100}`);
  root.style.setProperty("--background-blur", `${settings.backgroundBlur}px`);
  root.style.setProperty("--background-brightness", `${settings.backgroundBrightness / 100}`);
  root.style.setProperty("--background-position", settings.backgroundPosition);
  root.style.setProperty("--background-size", settings.backgroundSize);
  root.style.setProperty("--typing-font", `"${settings.font}", "DM Mono", monospace`);
  document.body.classList.toggle("keyboard-flat", settings.keyboardStyle === "flat");
  document.body.classList.toggle("keyboard-glass", settings.keyboardStyle === "glass");
  document.body.classList.toggle("highlight-outline", settings.highlightStyle === "outline");
  document.body.classList.toggle("highlight-fill", settings.highlightStyle === "fill");
  document.body.classList.toggle("hide-keyboard", !settings.keyboardVisible);
  document.body.classList.toggle("hide-key-labels", !settings.keyLabels);
  document.body.classList.toggle("reduce-motion", settings.reduceMotion);
  document.body.classList.toggle("has-background-image", Boolean(settings.backgroundImage));
  document.body.style.setProperty("--user-background", settings.backgroundImage ? `url("${settings.backgroundImage}")` : "none");
  document.body.classList.toggle("light-theme", settings.theme === "Light");
  if (settings.profileImage) {
    $$(".avatar, .topbar-avatar").forEach((avatar) => {
      avatar.style.backgroundImage = `url("${settings.profileImage}")`;
      avatar.classList.add("has-profile-image");
    });
  } else {
    $$(".avatar, .topbar-avatar").forEach((avatar) => {
      avatar.style.backgroundImage = "";
      avatar.classList.remove("has-profile-image");
    });
  }
  const values = {
    "typing-font-size": settings.typingFontSize, "keyboard-size": settings.keyboardSize,
    "keyboard-spacing": settings.keyboardSpacing, "keyboard-opacity": settings.keyboardOpacity,
    "card-radius": settings.cardRadius, "keyboard-visible": settings.keyboardVisible,
    "key-labels": settings.keyLabels, "reduce-motion": settings.reduceMotion,
    "sound-enabled": settings.sound, "background-opacity": settings.backgroundOpacity,
    "background-blur": settings.backgroundBlur, "background-brightness": settings.backgroundBrightness,
    "accent-color": settings.accent || theme.accent, "background-color": settings.background || theme.bg,
    "font-choice": settings.font, "keyboard-style": settings.keyboardStyle, "highlight-style": settings.highlightStyle
  };
  Object.entries(values).forEach(([id, value]) => { if ($(`#${id}`)) $(`#${id}`).value = String(value); });
}

function updateProgression(metrics) {
  const next = [...sessions];
  renderXp();
  renderAchievements();
  if (metrics.accuracy === 100 && metrics.typedChars > 0) playBeep(1040, 0.08);
  persist(KEYS.sessions, next);
}

async function resizeImage(file, maxWidth = 1280, maxHeight = 900) {
  if (!file.type.startsWith("image/")) throw new TypeError("Choose an image file.");
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
  } finally {
    URL.revokeObjectURL(source);
  }
}

function bindImageUpload(inputId, settingName, maxWidth, maxHeight) {
  $(`#${inputId}`).addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      settings[settingName] = await resizeImage(file, maxWidth, maxHeight);
      applySettings();
      saveSettings();
    } catch (error) {
      console.error("Could not load the selected image.", error);
      showNotice(error instanceof TypeError ? error.message : "Could not open that image. Try another file.");
    } finally {
      event.target.value = "";
    }
  });
}

function saveCustomSet() {
  const title = $("#custom-title-input").value.trim();
  const text = $("#custom-text-input").value.trim();
  const error = $("#custom-error");
  if (!title || text.length < 10) {
    error.textContent = "Add a title and at least 10 characters of practice text.";
    error.hidden = false;
    return null;
  }
  error.hidden = true;
  const editingId = $("#save-custom").dataset.editingId;
  const existing = editingId ? customSets.find((item) => item.id === editingId) : null;
  const set = {
    id: existing?.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    title, text, level: $("#custom-level").value,
    duration: Number($("#custom-timer").value),
    fontSize: Number($("#custom-font-size").value),
    displayStyle: $("#custom-display-style").value,
    updatedAt: new Date().toISOString()
  };
  customSets = existing
    ? customSets.map((item) => item.id === existing.id ? set : item)
    : [set, ...customSets];
  if (persist(KEYS.custom, customSets, "Could not save this practice set.")) {
    $("#save-custom").dataset.editingId = "";
    $("#save-custom").textContent = "Save practice set";
    renderCustomSets();
    showNotice("Practice set saved.");
  }
  return set;
}

function useCustomSet(set) {
  state.customPassage = set.text;
  state.customTitle = set.title;
  state.level = set.level;
  state.mode = "Passage";
  state.duration = set.duration;
  state.customFontSize = set.fontSize;
  state.customDisplayStyle = set.displayStyle || "wrap";
  renderExerciseOptions();
  setSelected(elements.levelButtons, elements.levelButtons.find((button) => button.dataset.level === set.level));
  setSelected($$(".duration-button"), $$(".duration-button").find((button) => Number(button.dataset.duration) === set.duration));
  resetSession();
  switchView("practice");
  elements.passage.style.fontSize = `${set.fontSize || settings.typingFontSize}px`;
  $("#untimed-toggle").checked = set.duration === 0;
}

function exportData() {
  const blob = new Blob([JSON.stringify({ version: 1, sessions, settings, customSets }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = "keystroke-data.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!data || !Array.isArray(data.sessions) || !Array.isArray(data.customSets) || typeof data.settings !== "object") {
        throw new TypeError("This file does not contain a valid Keystroke backup.");
      }
      const importedSessions = data.sessions.filter((item) => item && Number.isFinite(item.wpm) && Number.isFinite(item.accuracy) && typeof item.date === "string");
      const importedSets = data.customSets.filter((item) => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.text === "string");
      if (importedSessions.length !== data.sessions.length || importedSets.length !== data.customSets.length) {
        throw new TypeError("The backup contains invalid session or practice set entries.");
      }
      sessions = importedSessions.slice(0, 2000);
      customSets = importedSets;
      settings = { ...DEFAULT_SETTINGS, ...data.settings };
      persist(KEYS.sessions, sessions);
      persist(KEYS.custom, customSets);
      saveSettings();
      applySettings();
      renderDashboard();
      renderCustomSets();
      showNotice("Your backup was imported.");
    } catch (error) {
      console.error("Could not import data.", error);
      showNotice(error.message || "That backup file could not be imported.");
    }
  };
  reader.onerror = () => showNotice("Could not read that backup file.");
  reader.readAsText(file);
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
$("#challenge-button").addEventListener("click", () => {
  const easy = elements.levelButtons.find((button) => button.dataset.level === "Easy");
  if (state.level !== "Easy") easy.click();
  $("#practice-mode").value = "Random letters";
  $("#practice-mode").dispatchEvent(new Event("change", { bubbles: true }));
  const oneMinute = $$(".duration-button").find((button) => Number(button.dataset.duration) === 60);
  $("#countdown-toggle").checked = true;
  settings.countdown = true;
  saveSettings();
  setDuration(60, oneMinute);
  $("#untimed-toggle").checked = false;
  switchView("practice");
});
$$(".trend-ranges button").forEach((button) => button.addEventListener("click", () => {
  state.trendRange = Number(button.dataset.range);
  setSelected($$(".trend-ranges button"), button);
  renderTrend();
}));
document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.go)));
$("#race-level").addEventListener("change", (event) => {
  raceState.level = event.target.value;
  prepareRace();
});
$("#race-start").addEventListener("click", () => {
  startRace();
  $("#race-input").focus();
});
$("#race-new").addEventListener("click", () => prepareRace({ advance: true }));
$("#race-focus").addEventListener("click", () => {
  startRace();
  $("#race-input").focus();
});
$("#race-typing-area").addEventListener("click", () => $("#race-input").focus());
$("#race-input").addEventListener("input", () => {
  if (raceState.finished) {
    $("#race-input").value = raceState.typedText;
    return;
  }
  const targetLength = Array.from(raceState.passage).length;
  const nextText = Array.from($("#race-input").value).slice(0, targetLength).join("");
  $("#race-input").value = nextText;
  trackRaceInput(nextText);
  if (nextText.length > 0) startRace();
  renderRace();
  if (Array.from(raceState.typedText).length >= targetLength) {
    finishRace("You");
    renderRace();
  }
});
$("#race-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") event.preventDefault();
});
$("#race-input").addEventListener("paste", (event) => event.preventDefault());
elements.levelButtons.forEach((button) => button.addEventListener("click", () => setLevel(button.dataset.level, button)));
$("#practice-mode").addEventListener("change", (event) => {
  state.mode = event.target.value;
  settings.mode = state.mode;
  saveSettings();
  state.customPassage = "";
  state.customTitle = "";
  state.customFontSize = null;
  state.customDisplayStyle = "wrap";
  resetSession();
});
elements.durationButtons.forEach((button) => button.addEventListener("click", () => setDuration(Number(button.dataset.duration), button)));
$("#restart-button").addEventListener("click", () => resetSession({ advance: state.finished }));
elements.startPrompt.addEventListener("click", beginSession);
$("#typing-area").addEventListener("click", () => { if (!state.startedAt && !state.typedText) beginSession(); elements.input.focus(); });
$(".brand").addEventListener("click", (event) => { event.preventDefault(); switchView("dashboard"); });
$("#pause-button").addEventListener("click", () => state.paused ? resumeSession() : pauseSession());
$("#untimed-toggle").addEventListener("change", (event) => {
  if (event.target.checked) setDuration(0);
  else setDuration(30, elements.durationButtons.find((button) => Number(button.dataset.duration) === 30));
});
$("#countdown-toggle").checked = Boolean(settings.countdown);
$("#countdown-toggle").addEventListener("change", (event) => {
  settings.countdown = event.target.checked;
  saveSettings();
});
$("#apply-custom-duration").addEventListener("click", () => {
  const minutes = Number($("#custom-minutes").value);
  const seconds = Number($("#custom-seconds").value);
  if (!Number.isInteger(minutes) || !Number.isInteger(seconds) || minutes < 0 || minutes > 99 || seconds < 0 || seconds > 59 || minutes * 60 + seconds < 1) {
    showNotice("Choose a custom duration from 1 second to 99 minutes 59 seconds.");
    return;
  }
  setDuration(minutes * 60 + seconds);
  $("#untimed-toggle").checked = false;
});
elements.input.addEventListener("input", () => {
  if (state.finished || state.paused || state.countdownId) {
    elements.input.value = state.typedText;
    return;
  }
  if (state.startedAt === null && !state.typedText && $("#countdown-toggle").checked) {
    elements.input.value = "";
    startCountdown();
    return;
  }
  trackInput(elements.input.value);
  if (Array.from(state.typedText).length > 0) beginSession();
  if (state.countdownId) return;
  renderPassage();
  updateMetrics();
  playBeep();
  if (Array.from(state.typedText).length >= Array.from(state.passage).length) finishSession();
});
elements.input.addEventListener("keydown", (event) => {
  highlightKey(event.key, true);
  if (event.key === "Tab") {
    event.preventDefault();
    state.restartArmed = !event.shiftKey;
    return;
  }
  if (event.key === "Enter" && (state.restartArmed || state.finished)) {
    event.preventDefault();
    if ($("#result-modal").hidden) resetSession({ advance: state.finished });
    else if (state.finished) resetSession({ advance: true });
    return;
  }
  state.restartArmed = false;
  if (event.key === "Enter") event.preventDefault();
  if (event.key === "Escape" && !$("#result-modal").hidden) $("#result-modal").hidden = true;
});
elements.input.addEventListener("keyup", (event) => highlightKey(event.key, false));
elements.input.addEventListener("blur", () => {
  state.pressedKeys.clear();
  elements.keyboard.querySelectorAll(".key-active").forEach((key) => key.classList.remove("key-active"));
});
elements.input.addEventListener("paste", (event) => event.preventDefault());

elements.keyboard.addEventListener("click", (event) => {
  const button = event.target.closest(".key");
  if (!button || state.finished || state.paused) return;
  const key = button.dataset.key;
  if (key === "Shift") {
    state.shiftOn = !state.shiftOn;
    button.classList.toggle("key-active", state.shiftOn);
    elements.input.focus();
    return;
  }
  if (["Tab", "CapsLock", "Control", "Alt", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) {
    elements.input.focus();
    return;
  }
  if (state.countdownId) return;
  if (state.startedAt === null && !state.typedText && $("#countdown-toggle").checked) {
    startCountdown();
    elements.input.focus();
    return;
  }
  const start = elements.input.selectionStart;
  const end = elements.input.selectionEnd;
  if (key === "Backspace") {
    if (start === end && start > 0) elements.input.setRangeText("", start - 1, end, "end");
    else elements.input.setRangeText("", start, end, "end");
  } else {
    elements.input.setRangeText(state.shiftOn ? key.toUpperCase() : key, start, end, "end");
    state.shiftOn = false;
    elements.keyboard.querySelectorAll('[data-key="Shift"]').forEach((shift) => shift.classList.remove("key-active"));
  }
  trackInput(elements.input.value);
  if (Array.from(state.typedText).length > 0) beginSession();
  if (state.countdownId) return;
  renderPassage();
  updateMetrics();
  if (Array.from(state.typedText).length >= Array.from(state.passage).length) finishSession();
  elements.input.focus();
});

$("#save-custom").addEventListener("click", saveCustomSet);
$("#start-custom").addEventListener("click", () => {
  const text = $("#custom-text-input").value.trim();
  if (text.length < 10) {
    $("#custom-error").textContent = "Add at least 10 characters of text before starting.";
    $("#custom-error").hidden = false;
    return;
  }
  useCustomSet({
    title: $("#custom-title-input").value.trim() || "Quick practice",
    text, level: $("#custom-level").value,
    duration: Number($("#custom-timer").value),
    fontSize: Number($("#custom-font-size").value),
    displayStyle: $("#custom-display-style").value
  });
});
$("#clear-custom").addEventListener("click", () => {
  $("#custom-title-input").value = "";
  $("#custom-text-input").value = "";
  $("#custom-error").hidden = true;
  $("#save-custom").dataset.editingId = "";
  $("#save-custom").textContent = "Save practice set";
});
$("#custom-list").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const set = customSets.find((item) => item.id === button.dataset.id);
  if (!set) return;
  if (button.dataset.action === "practice") useCustomSet(set);
  if (button.dataset.action === "edit") {
    $("#custom-title-input").value = set.title;
    $("#custom-text-input").value = set.text;
    $("#custom-level").value = set.level;
    $("#custom-timer").value = String(set.duration);
    $("#custom-font-size").value = String(set.fontSize || 17);
    $("#custom-display-style").value = set.displayStyle || "wrap";
    $("#save-custom").dataset.editingId = set.id;
    $("#save-custom").textContent = "Update practice set";
    $("#custom-title-input").focus();
  }
  if (button.dataset.action === "delete") {
    customSets = customSets.filter((item) => item.id !== set.id);
    if (persist(KEYS.custom, customSets, "Could not delete this practice set.")) renderCustomSets();
  }
});

const settingInputs = {
  "typing-font-size": "typingFontSize", "keyboard-size": "keyboardSize",
  "keyboard-spacing": "keyboardSpacing", "keyboard-opacity": "keyboardOpacity",
  "card-radius": "cardRadius", "keyboard-visible": "keyboardVisible",
  "key-labels": "keyLabels", "reduce-motion": "reduceMotion",
  "sound-enabled": "sound", "background-opacity": "backgroundOpacity",
  "background-blur": "backgroundBlur", "background-brightness": "backgroundBrightness"
};
Object.entries(settingInputs).forEach(([id, key]) => {
  $(`#${id}`).addEventListener("input", (event) => {
    settings[key] = event.target.type === "checkbox" ? event.target.checked : Number(event.target.value);
    applySettings();
    saveSettings();
  });
});
$("#accent-color").addEventListener("input", (event) => {
  settings.theme = "Custom";
  settings.accent = event.target.value;
  applySettings();
  saveSettings();
  renderThemes();
});
$("#background-color").addEventListener("input", (event) => {
  settings.theme = "Custom";
  settings.background = event.target.value;
  applySettings();
  saveSettings();
  renderThemes();
});
$("#reset-colors").addEventListener("click", () => {
  settings.theme = "Dark";
  settings.accent = "";
  settings.background = "";
  applySettings();
  saveSettings();
  renderThemes();
});
$("#font-choice").addEventListener("change", (event) => {
  settings.font = event.target.value;
  applySettings();
  saveSettings();
});
bindImageUpload("background-upload", "backgroundImage", 1280, 900);
bindImageUpload("profile-upload", "profileImage", 500, 500);
$("#background-position").addEventListener("change", (event) => {
  settings.backgroundPosition = event.target.value;
  applySettings();
  saveSettings();
});
$("#background-size").addEventListener("change", (event) => {
  settings.backgroundSize = event.target.value;
  applySettings();
  saveSettings();
});
$("#remove-background").addEventListener("click", () => {
  settings.backgroundImage = "";
  applySettings();
  saveSettings();
});
$("#remove-profile").addEventListener("click", () => {
  settings.profileImage = "";
  applySettings();
  saveSettings();
});
$("#export-data").addEventListener("click", exportData);
$("#import-data").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importData(file);
  event.target.value = "";
});
$("#reset-data").addEventListener("click", () => {
  if (!window.confirm("Reset all saved statistics and practice history? This cannot be undone.")) return;
  sessions = [];
  persist(KEYS.sessions, sessions);
  renderDashboard();
  renderProgress();
  renderAchievements();
});
$("#reset-settings").addEventListener("click", () => {
  settings = { ...DEFAULT_SETTINGS };
  state.level = settings.level;
  state.mode = settings.mode;
  state.duration = settings.duration;
  state.remaining = settings.duration;
  setSelected(elements.levelButtons, elements.levelButtons.find((button) => button.dataset.level === state.level));
  $$(".duration-button").forEach((button) => {
    button.classList.toggle("selected", Number(button.dataset.duration) === state.duration);
    button.setAttribute("aria-pressed", String(Number(button.dataset.duration) === state.duration));
  });
  $("#untimed-toggle").checked = false;
  $("#countdown-toggle").checked = false;
  applySettings();
  saveSettings();
  renderThemes();
  $("#font-choice").value = settings.font;
  $("#keyboard-style").value = settings.keyboardStyle;
  $("#highlight-style").value = settings.highlightStyle;
  resetSession();
});
$("#result-close").addEventListener("click", () => { $("#result-modal").hidden = true; });
$("#result-restart").addEventListener("click", () => resetSession());
$("#result-next").addEventListener("click", () => resetSession({ advance: true }));
$("#result-modal").addEventListener("click", (event) => {
  if (event.target.id === "result-modal") event.currentTarget.hidden = true;
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#result-modal").hidden) $("#result-modal").hidden = true;
});
$("#custom-font-size").addEventListener("input", (event) => {
  $("#typing-text").style.fontSize = `${event.target.value}px`;
});
$("#custom-display-style").addEventListener("change", (event) => {
  state.customDisplayStyle = event.target.value;
  $("#typing-area").classList.toggle("single-line", state.customDisplayStyle === "line");
});
$("#focus-button").addEventListener("click", (event) => {
  const focused = document.body.classList.toggle("focus-mode");
  event.currentTarget.textContent = focused ? "Exit focus mode" : "Focus mode";
});

elements.date.textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const durationControls = $(".duration-options");
[[300, "5m"], [600, "10m"]].forEach(([duration, label]) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "duration-button";
  button.dataset.duration = String(duration);
  button.textContent = label;
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    $("#untimed-toggle").checked = false;
    setDuration(duration, button);
  });
  durationControls.append(button);
});
$("#font-choice").value = settings.font;
setSelected(elements.levelButtons, elements.levelButtons.find((button) => button.dataset.level === state.level));
applySettings();
renderExerciseOptions();
loadPassage();
raceState.level = state.level;
$("#race-level").value = raceState.level;
prepareRace();
if (state.duration > 0) {
  const selectedDuration = $$(".duration-button").find((button) => Number(button.dataset.duration) === state.duration);
  if (selectedDuration) setSelected($$(".duration-button"), selectedDuration);
  else {
    $("#custom-minutes").value = String(Math.floor(state.duration / 60));
    $("#custom-seconds").value = String(state.duration % 60 || 60);
  }
} else $("#untimed-toggle").checked = true;
$("#countdown-toggle").checked = Boolean(settings.countdown);
updateTimer();
renderDashboard();
renderProgress();
renderCustomSets();
renderAchievements();
renderThemes();
