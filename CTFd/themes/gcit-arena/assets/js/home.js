import "./page.js";
import dayjs from "dayjs";
import { initActivityTicker, initLiveStats } from "./utils/landing";

const introLines = [
  "gcit@arena:~$ ./init_ctf.sh",
  "loading modules ........ ok",
  "syncing scoreboard ..... ready",
  "waiting for operators...",
];

// Phase 7 gamification — a tiny simulated shell. Purely cosmetic/client
// side: commands answer from data already on the page (window.init),
// nothing is sent to a server.
const HELP_TEXT = [
  "available commands:",
  "  help      show this list",
  "  rules     event lore + ground rules",
  "  status    live event schedule status",
  "  clear     clear the terminal",
];

const RULES_TEXT = [
  "GCIT Arena — official CTF of Gyalpozhing College of Information Technology.",
  "Play solo or as a team. Flags follow the format set per-challenge.",
  "No attacking the platform, other teams, or sharing flags. Have fun, hack responsibly.",
];

function formatCountdown(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function statusLines() {
  const start = window.init && window.init.start;
  const end = window.init && window.init.end;
  const now = Date.now() / 1000;

  if (!start && !end) return ["status: event schedule not restricted."];
  if (start && now < start) {
    return [
      `status: NOT STARTED — begins in ${formatCountdown(start - now)}`,
      `start: ${dayjs.unix(start).format("MMM D, YYYY HH:mm")}`,
    ];
  }
  if (end && now >= end) {
    return [
      "status: EVENT ENDED",
      `ended: ${dayjs.unix(end).format("MMM D, YYYY HH:mm")}`,
    ];
  }
  if (end) {
    return [`status: LIVE — ends in ${formatCountdown(end - now)}`];
  }
  return ["status: LIVE — no scheduled end."];
}

function runCommand(raw, print) {
  const cmd = raw.trim().toLowerCase();
  switch (cmd) {
    case "":
      return;
    case "help":
      HELP_TEXT.forEach(print);
      return;
    case "rules":
      RULES_TEXT.forEach(print);
      return;
    case "status":
      statusLines().forEach(print);
      return;
    case "clear":
      return "clear";
    default:
      print(`command not found: ${cmd} (try 'help')`);
  }
}

function initInteractiveTerminal() {
  const root = document.querySelector("[data-gcit-terminal]");
  if (!root) return;

  const introText = root.querySelector("[data-term-text]");
  const log = root.querySelector("[data-term-log]");
  const input = root.querySelector("[data-term-input]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function print(line) {
    if (!log) return;
    const p = document.createElement("div");
    p.className = "gcit-hero__terminal-line";
    p.textContent = line;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function typeIntro() {
    if (reducedMotion) {
      introText.textContent = introLines[introLines.length - 1];
      revealPrompt();
      return;
    }

    let lineIdx = 0;
    let charIdx = 0;

    const tick = () => {
      const line = introLines[lineIdx];
      introText.textContent = line.slice(0, charIdx);
      charIdx += 1;

      if (charIdx > line.length) {
        lineIdx += 1;
        charIdx = 0;
        if (lineIdx >= introLines.length) {
          revealPrompt();
          return;
        }
        setTimeout(tick, 350);
        return;
      }
      setTimeout(tick, 28 + Math.random() * 40);
    };

    tick();
  }

  function revealPrompt() {
    root.classList.add("gcit-hero__terminal--ready");
    print("type 'help' for a list of commands");
    if (input) input.focus({ preventScroll: true });
  }

  if (input) {
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      const value = input.value;
      print(`gcit@arena:~$ ${value}`);
      const result = runCommand(value, print);
      input.value = "";
      if (result === "clear" && log) log.innerHTML = "";
    });
  }

  typeIntro();
}

document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.setAttribute("data-bs-theme", "dark");
  initInteractiveTerminal();
  initActivityTicker();
  initLiveStats();
});
