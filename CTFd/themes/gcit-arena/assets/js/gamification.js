/**
 * GCIT Arena — Phase 6 gamification helpers.
 *
 * Everything in this module is view-side only: it derives cosmetic state
 * from data already rendered by CTFd (score, solves, standings) or from
 * localStorage in the visitor's own browser. Nothing here calls a new
 * backend endpoint or persists anything server-side.
 *
 * Streak / "seen achievement" state can *optionally* sync across a
 * visitor's devices via `./utils/profileSync`, which only talks to
 * CTFd's existing `/api/v1/users/me` custom-fields API — see that file
 * for the (admin-console-only, no code) setup step. If sync isn't
 * configured, everything below behaves exactly as it did before.
 */

import { readSyncedProfile, writeSyncedProfile } from "./utils/profileSync";
import { fireConfetti } from "./utils/fx";

// ---------------------------------------------------------------------------
// Operator rank tiers (derived purely from an existing score value)
// ---------------------------------------------------------------------------
export const RANK_TIERS = [
  { tier: 1, min: 0, name: "Script Kid" },
  { tier: 2, min: 100, name: "Initiate" },
  { tier: 3, min: 300, name: "Operator" },
  { tier: 4, min: 600, name: "Specialist" },
  { tier: 5, min: 1000, name: "Ghost" },
  { tier: 6, min: 1500, name: "Architect" },
];

export function getRank(score = 0) {
  let current = RANK_TIERS[0];
  let next = RANK_TIERS[1] || null;

  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (score >= RANK_TIERS[i].min) {
      current = RANK_TIERS[i];
      next = RANK_TIERS[i + 1] || null;
    }
  }

  let progress = 100;
  if (next) {
    const span = next.min - current.min;
    progress = Math.min(100, Math.max(0, ((score - current.min) / span) * 100));
  }

  return { ...current, next, progress: Number(progress.toFixed(1)), score };
}

// ---------------------------------------------------------------------------
// Derived achievement badges (computed fresh on every load, never persisted)
// ---------------------------------------------------------------------------
export function computeBadges({
  solveCount = 0,
  failCount = 0,
  categoryCount = 0,
  values = [],
} = {}) {
  const badges = [];

  if (solveCount > 0 && failCount === 0) {
    badges.push({
      id: "perfect-aim",
      icon: "fa-bullseye",
      label: "Perfect Aim",
      hint: "No incorrect submissions yet",
    });
  }

  if (categoryCount >= 3) {
    badges.push({
      id: "explorer",
      icon: "fa-compass",
      label: "Category Explorer",
      hint: `Active in ${categoryCount} categories`,
    });
  }

  if (values.length >= 3) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    if (avg > 0 && max >= avg * 2) {
      badges.push({
        id: "high-roller",
        icon: "fa-crosshairs",
        label: "High Roller",
        hint: "Solved a challenge well above your average value",
      });
    }
  }

  if (solveCount >= 10) {
    badges.push({
      id: "veteran",
      icon: "fa-shield-halved",
      label: "Veteran",
      hint: `${solveCount} challenges solved`,
    });
  }

  return badges;
}

// ---------------------------------------------------------------------------
// Category crests — cosmetic tier derived from how many solves you have in
// a category (bronze/silver/gold thresholds), no completion data required
// ---------------------------------------------------------------------------
export function computeCategoryCrests(breakdown = []) {
  return breakdown.map(cat => {
    let tier = "bronze";
    if (cat.count >= 5) tier = "gold";
    else if (cat.count >= 3) tier = "silver";
    return { ...cat, tier };
  });
}

// ---------------------------------------------------------------------------
// One-time (per-browser) achievement toast the first time a badge appears
// ---------------------------------------------------------------------------
export async function maybeToastBadges(badges = []) {
  if (!badges.length) return;

  let localSeen = [];
  try {
    localSeen = JSON.parse(localStorage.getItem("gcit_seen_badges")) || [];
  } catch (e) {
    localSeen = [];
  }

  // Merge in whatever this visitor already "saw" on another device
  // (no-op if sync isn't configured — remote is just null then).
  const remote = await readSyncedProfile();
  const remoteSeen = (remote && remote.seenBadges) || [];
  const seen = Array.from(new Set([...localSeen, ...remoteSeen]));

  const fresh = badges.filter(b => !seen.includes(b.id));
  if (!fresh.length) return;

  const { Toast } = await import("bootstrap");

  let container = document.getElementById("gcit-achievement-toasts");
  if (!container) {
    container = document.createElement("div");
    container.id = "gcit-achievement-toasts";
    container.className =
      "toast-container position-fixed top-0 end-0 p-3 gcit-achievement-toasts";
    container.style.zIndex = "1080";
    document.body.appendChild(container);
  }

  fresh.forEach((badge, i) => {
    const el = document.createElement("div");
    el.className = "toast gcit-achievement-toast";
    el.setAttribute("role", "alert");
    el.innerHTML = `
      <div class="toast-body d-flex align-items-center gap-2">
        <i class="fas ${badge.icon}"></i>
        <div>
          <strong>Achievement unlocked</strong><br>
          <span>${badge.label}</span>
        </div>
      </div>
    `;
    container.appendChild(el);
    setTimeout(() => new Toast(el, { delay: 4500 }).show(), i * 350);
  });

  const nextSeen = [...seen, ...fresh.map(b => b.id)];
  localStorage.setItem("gcit_seen_badges", JSON.stringify(nextSeen));

  // Best-effort push so the next device doesn't re-show these toasts.
  writeSyncedProfile({ ...(remote || {}), seenBadges: nextSeen });
}

// ---------------------------------------------------------------------------
// Challenge card tiers, derived from point value relative to the board's max
// ---------------------------------------------------------------------------
export function tierForValue(value, referenceMax) {
  if (!referenceMax || referenceMax <= 0) return "standard";
  if (value >= referenceMax) return "boss";
  if (value >= referenceMax * 0.6) return "elusive";
  return "standard";
}

// ---------------------------------------------------------------------------
// Sitewide countdown pressure bar (uses window.init.start / window.init.end)
// ---------------------------------------------------------------------------
export function initCountdownBar() {
  const el = document.getElementById("gcit-countdown-bar");
  if (!el) return;

  const start = window.init && window.init.start;
  const end = window.init && window.init.end;
  if (!start && !end) {
    el.style.display = "none";
    return;
  }

  document.body.classList.add("gcit-has-countdown");

  function render() {
    const now = Date.now() / 1000;
    let label;
    let percent = 100;
    let urgent = false;
    let ended = false;

    if (start && now < start) {
      const total = end ? end - start : 3600;
      const remaining = start - now;
      label = `STARTS IN ${formatDuration(remaining)}`;
      percent = 0;
    } else if (end && now < end) {
      const total = start ? end - start : end - now;
      const remaining = end - now;
      percent = Math.min(100, Math.max(0, 100 - (remaining / total) * 100));
      urgent = remaining < 3600;
      label = `ENDS IN ${formatDuration(remaining)}`;
    } else if (end && now >= end) {
      percent = 100;
      ended = true;
      label = "EVENT ENDED";
    } else {
      el.style.display = "none";
      document.body.classList.remove("gcit-has-countdown");
      return;
    }

    el.innerHTML = `
      <div class="gcit-countdown-bar__track">
        <div class="gcit-countdown-bar__fill" style="width:${percent}%"></div>
      </div>
      <span class="gcit-countdown-bar__label">${label}</span>
    `;
    el.classList.toggle("gcit-countdown-bar--urgent", urgent);
    el.classList.toggle("gcit-countdown-bar--ended", ended);
  }

  function formatDuration(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  render();
  setInterval(render, 1000);
}

// ---------------------------------------------------------------------------
// Terminal-style action log + synthesized flag-submit sound stings
// ---------------------------------------------------------------------------
let audioCtx = null;
function getAudioCtx() {
  if (localStorage.getItem("gcit_sound_muted") === "1") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(kind) {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const notes = kind === "success" ? [660, 990] : [220, 160];
  let t = ctx.currentTime;

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === "success" ? "triangle" : "sawtooth";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
    t += 0.09 * (i + 1);
  });
}

function logEntry(kind, message) {
  const panel = document.getElementById("gcit-terminal-log");
  if (!panel) return;
  const list = panel.querySelector(".gcit-terminal-log__list");
  if (!list) return;

  panel.classList.add("gcit-terminal-log--active");

  const time = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const li = document.createElement("li");
  li.className = `gcit-terminal-log__entry gcit-terminal-log__entry--${kind}`;
  li.innerHTML = `<span class="gcit-terminal-log__time">${time}</span> ${message}`;
  list.appendChild(li);

  while (list.children.length > 12) {
    list.removeChild(list.firstChild);
  }
  list.scrollTop = list.scrollHeight;
}

// Sound & FX toggle — shared by every element carrying the
// `.gcit-sound-toggle` class (the terminal log's mute button AND the
// navbar's retro speaker icon), all synced off one localStorage key.
export function initSoundToggle() {
  const buttons = document.querySelectorAll(".gcit-sound-toggle");
  if (!buttons.length) return;

  const setIcons = () => {
    const muted = localStorage.getItem("gcit_sound_muted") === "1";
    buttons.forEach(btn => {
      btn.innerHTML = muted
        ? '<i class="fas fa-volume-mute"></i>'
        : '<i class="fas fa-volume-up"></i>';
      btn.setAttribute("aria-pressed", muted);
    });
  };

  setIcons();
  buttons.forEach(btn => {
    btn.addEventListener("click", event => {
      event.stopPropagation();
      const muted = localStorage.getItem("gcit_sound_muted") === "1";
      localStorage.setItem("gcit_sound_muted", muted ? "0" : "1");
      setIcons();
    });
  });
}

export function initTerminalLog() {
  const panel = document.getElementById("gcit-terminal-log");
  if (!panel) return;

  const toggle = panel.querySelector(".gcit-terminal-log__toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      panel.classList.toggle("gcit-terminal-log--collapsed");
    });
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        const alert = node.matches(".notification-row .alert")
          ? node
          : node.querySelector && node.querySelector(".notification-row .alert");
        if (!alert) return;

        const text = alert.textContent.trim().slice(0, 80);
        if (alert.classList.contains("alert-success")) {
          logEntry("ok", `[OK] ${text || "flag accepted"}`);
          playTone("success");
          fireConfetti(false);
        } else if (alert.classList.contains("alert-danger")) {
          logEntry("err", `[ERR] ${text || "incorrect flag"}`);
          playTone("fail");
        } else if (alert.classList.contains("alert-info")) {
          logEntry("info", `[INFO] ${text || "already solved"}`);
        } else if (alert.classList.contains("alert-warning")) {
          logEntry("warn", `[WARN] ${text || "submission paused"}`);
        }
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ---------------------------------------------------------------------------
// Daily visit streak. Cosmetic; localStorage is always the source of truth
// for *this* browser, but if a sync field is configured (see
// ./utils/profileSync) the streak is merged with — and pushed to — the
// visitor's account, so it keeps counting when they switch devices.
// ---------------------------------------------------------------------------
export async function initStreakChip() {
  const chip = document.getElementById("gcit-streak-chip");
  if (!chip) return;
  if (!window.init || !window.init.userId) {
    chip.style.display = "none";
    return;
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterdayKey = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const remote = await readSyncedProfile();
  const remoteLastVisit = (remote && remote.lastVisit) || "";
  const remoteStreak = (remote && remote.streak) || 0;

  const localLastVisit = localStorage.getItem("gcit_last_visit") || "";
  const localStreak = parseInt(localStorage.getItem("gcit_streak") || "0", 10);

  // Whichever side (this browser vs. the synced profile) saw the more
  // recent visit wins the starting point for today's calculation.
  const useRemote = remoteLastVisit > localLastVisit;
  let lastVisit = useRemote ? remoteLastVisit : localLastVisit;
  let streak = useRemote ? remoteStreak : localStreak;

  if (lastVisit !== todayKey) {
    streak = lastVisit === yesterdayKey ? streak + 1 : 1;
    lastVisit = todayKey;
  }

  localStorage.setItem("gcit_last_visit", lastVisit);
  localStorage.setItem("gcit_streak", String(streak));

  if (streak >= 2) {
    chip.innerHTML = `<i class="fas fa-fire"></i> ${streak}`;
    chip.title = remote
      ? `${streak} day streak`
      : `${streak} day streak on this browser`;
    chip.style.display = "inline-flex";
  } else {
    chip.style.display = "none";
  }

  // Best-effort push so the next device this visitor logs in on
  // continues the streak instead of restarting it.
  writeSyncedProfile({ ...(remote || {}), streak, lastVisit });
}

// Persistent Player HUD (navbar). Polls CTFd's existing
// `/api/v1/users/me` + `/api/v1/users/me/solves` endpoints — no new
// backend surface — and fires a bigger confetti burst the first time the
// visitor's score crosses one of a few fixed milestones this page load.
const HUD_MILESTONES = [500, 1000, 2000, 3500, 5000, 10000];
let hudLastScore = null;

async function fetchHudStats() {
  const [meRes, solvesRes] = await Promise.all([
    CTFd.fetch("/api/v1/users/me"),
    CTFd.fetch("/api/v1/users/me/solves"),
  ]);
  if (!meRes.ok) return null;
  const me = await meRes.json();
  const solves = solvesRes.ok ? await solvesRes.json() : null;
  return {
    score: (me.data && me.data.score) || 0,
    solveCount: solves && solves.meta ? solves.meta.count : null,
  };
}

export async function initPlayerHud() {
  const root = document.getElementById("gcit-player-hud");
  if (!root) return;
  if (!window.init || !window.init.userId) {
    root.style.display = "none";
    return;
  }

  const rankEl = root.querySelector("[data-hud-rank]");
  const pointsEl = root.querySelector("[data-hud-points]");
  const solvesEl = root.querySelector("[data-hud-solves]");
  const fillEl = root.querySelector("[data-hud-progress]");

  async function refresh() {
    const stats = await fetchHudStats().catch(() => null);
    if (!stats) return;

    const rank = getRank(stats.score);
    if (rankEl) rankEl.textContent = rank.name;
    if (pointsEl) pointsEl.textContent = stats.score.toLocaleString();
    if (solvesEl)
      solvesEl.textContent = stats.solveCount != null ? stats.solveCount : "—";
    if (fillEl) fillEl.style.width = `${rank.progress}%`;

    if (hudLastScore != null) {
      const crossed = HUD_MILESTONES.find(m => hudLastScore < m && stats.score >= m);
      if (crossed) fireConfetti(true);
    }
    hudLastScore = stats.score;

    root.style.display = "flex";
  }

  await refresh();
  setInterval(refresh, 60000);
}

export function initGamification() {
  initCountdownBar();
  initTerminalLog();
  initSoundToggle();
  initStreakChip();
  initPlayerHud();
}

// ---------------------------------------------------------------------------
// Phase 7 — category emoji badges, RPG titles, and richer solve-history
// achievement badges. All still view-side only: derived from data CTFd
// already exposes (challenges list + a user/team's own solves).
// ---------------------------------------------------------------------------

const CATEGORY_ICONS = [
  { match: /web/i, icon: "🌐" },
  { match: /rev(erse)?/i, icon: "⚙️" },
  { match: /crypt/i, icon: "🔐" },
  { match: /forensic/i, icon: "🔍" },
  { match: /pwn|binary|exploit/i, icon: "💣" },
  { match: /network/i, icon: "📡" },
  { match: /osint/i, icon: "🕵️" },
  { match: /hardware|iot/i, icon: "🔧" },
  { match: /misc/i, icon: "🎲" },
];

export function getCategoryIcon(category = "") {
  const hit = CATEGORY_ICONS.find(({ match }) => match.test(category));
  return hit ? hit.icon : "🚩";
}

// Custom dynamic RPG titles, mapped from point totals.
const RPG_TITLES = [
  { min: 0, title: "Novice Script Kiddie" },
  { min: 501, title: "Packet Sniffer" },
  { min: 1501, title: "Byte Hacker" },
  { min: 3501, title: "Cyber Warden" },
];

export function getRpgTitle(score = 0) {
  let title = RPG_TITLES[0].title;
  for (const tier of RPG_TITLES) {
    if (score >= tier.min) title = tier.title;
  }
  return title;
}

/**
 * Achievement badges computed from a solve history. `solves` is the raw
 * array from `/api/v1/users/<id>/solves` (each with `.date` and nested
 * `.challenge.{id,category,value}`); `categories` is the list of every
 * category name currently on the challenges board.
 *
 * Speed Demon uses `ctfStart` (the event's start time) as a best-effort
 * stand-in for a challenge's "release" time, since CTFd doesn't expose a
 * per-challenge release timestamp over the API — it's a cosmetic badge,
 * so this heuristic is good enough and never touches the backend.
 */
export function computeAdvancedBadges({
  solves = [],
  categories = [],
  ctfStart = null,
} = {}) {
  const badges = [];
  if (!solves.length) return badges;

  // Speed Demon — solved within 5 minutes of the event (or challenge
  // window) opening.
  if (ctfStart) {
    const fiveMinutes = 5 * 60 * 1000;
    const startMs = ctfStart * 1000;
    const fast = solves.some(s => new Date(s.date).getTime() - startMs <= fiveMinutes);
    if (fast) {
      badges.push({
        id: "speed-demon",
        icon: "fa-bolt",
        label: "Speed Demon",
        hint: "Solved a challenge within 5 minutes of the event opening",
      });
    }
  }

  // Night Owl — submitted a flag between 1:00 AM and 5:00 AM (visitor's
  // local browser time).
  const nightOwl = solves.some(s => {
    const hour = new Date(s.date).getHours();
    return hour >= 1 && hour < 5;
  });
  if (nightOwl) {
    badges.push({
      id: "night-owl",
      icon: "fa-moon",
      label: "Night Owl",
      hint: "Submitted a flag between 1AM and 5AM",
    });
  }

  // Category Specialist — cleared every challenge in at least one
  // category (requires knowing how many challenges exist per category).
  const solvedByCategory = {};
  solves.forEach(s => {
    const cat = s.challenge.category;
    solvedByCategory[cat] = (solvedByCategory[cat] || 0) + 1;
  });

  const totalsByCategory = {};
  categories.forEach(c => {
    totalsByCategory[c.name] = c.total;
  });

  const specialistIn = Object.keys(solvedByCategory).find(
    cat => totalsByCategory[cat] && solvedByCategory[cat] >= totalsByCategory[cat],
  );
  if (specialistIn) {
    badges.push({
      id: "category-specialist",
      icon: "fa-graduation-cap",
      label: `${specialistIn} Specialist`,
      hint: `Solved every challenge in ${specialistIn}`,
    });
  }

  // Jack of All Trades — at least one solve in every category on the
  // board.
  if (categories.length && categories.every(c => solvedByCategory[c.name] > 0)) {
    badges.push({
      id: "jack-of-all-trades",
      icon: "fa-chess-king",
      label: "Jack of All Trades",
      hint: "Solved at least one challenge in every category",
    });
  }

  return badges;
}
