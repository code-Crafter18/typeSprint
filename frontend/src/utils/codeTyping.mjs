import { MAX_SPRINT_CHARACTERS } from "./scoring.mjs";

export const CODE_LANGUAGES = {
  all: "All languages",
  javascript: "JavaScript",
  python: "Python",
  cpp: "C++",
  java: "Java",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
};

export function isCodePassage(passage) {
  return passage && passage.language !== "all" && Object.hasOwn(CODE_LANGUAGES, passage.language)
    && typeof passage.title === "string" && passage.title.trim()
    && typeof passage.text === "string" && passage.text.length <= MAX_SPRINT_CHARACTERS
    && passage.text.includes("\n") && !/[\t\r]/.test(passage.text) && !passage.text.endsWith("\n");
}

export function pickCodePassage(passages, language = "all", previousTitle = "") {
  const pool = language === "all" ? passages : passages.filter((entry) => entry.language === language);
  const alternatives = pool.filter((entry) => entry.title !== previousTitle);
  const choices = alternatives.length ? alternatives : pool;
  return choices[Math.floor(Math.random() * choices.length)];
}

export function codeTypingTarget(source) {
  return source.split("\n").map((line) => line.trimStart().trimEnd()).join("\n");
}

export function appendCodeInput(target, previous, input) {
  const expected = Array.from(target);
  let index = Array.from(previous).length;
  let typed = previous;
  const attempts = [];

  for (const character of input) {
    if (index >= expected.length) break;
    if (character === " " && (typed === "" || typed.endsWith("\n"))) continue;

    const next = expected[index];
    const correct = character === next;
    attempts.push({ correct, separator: character === "\n" || character === " " });
    if (!correct && (character === "\n" || next === "\n")) continue;

    typed += character;
    index++;
  }

  return { typed, attempts, completed: index === expected.length };
}

export function matchCodeCharacters(target, input) {
  const expected = Array.from(target);
  const typed = Array.from(input);
  let correct = 0;
  const length = Math.min(expected.length, typed.length);
  for (let i = 0; i < length; i++) {
    if (typed[i] === expected[i]) correct++;
  }
  return { correct, incorrect: length - correct, extra: Math.max(0, typed.length - length), missed: 0 };
}
