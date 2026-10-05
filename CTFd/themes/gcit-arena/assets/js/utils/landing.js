/**
 * GCIT Arena — landing page widgets (Phase 7 gamification).
 *
 * Everything here is view-side only: it reads from CTFd's existing public
 * `/api/v1/scoreboard` + `/api/v1/challenges` endpoints (via the standard
 * CTFd JS client) and renders purely cosmetic UI. No backend route is
 * added or modified. Every widget fails soft (hides itself) if the CTF
 * hides scores/challenges or the requests error out.
 */
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { CountUp } from "countup.js";
import { getCategoryIcon } from "../gamification";

dayjs.extend(relativeTime);

/**
 * Live Activity Ticker — a scrolling marquee of recent solves, built from
 * the top-10 scoreboard's solve history plus the public challenges list
 * (for challenge names/categories).
 */
export async function initActivityTicker() {
  const el = document.getElementById("gcit-activity-ticker");
  if (!el) return;
  const track = el.querySelector("[data-ticker-track]");
  if (!track) return;

  try {
    const [detail, challenges] = await Promise.all([
      window.CTFd.pages.scoreboard.getScoreboardDetail(10),
      window.CTFd.pages.challenges.getChallenges().catch(() => []),
    ]);

    const chalMap = {};
    (challenges || []).forEach(c => {
      chalMap[c.id] = c;
    });

    const events = [];
    Object.values(detail || {}).forEach(place => {
      (place.solves || []).forEach(solve => {
        events.push({
          name: place.name,
          date: solve.date,
          challenge: solve.challenge_id ? chalMap[solve.challenge_id] : null,
        });
      });
    });

    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = events.slice(0, 15);

    if (!recent.length) {
      el.style.display = "none";
      return;
    }

    const items = recent.map(e => {
      const icon = e.challenge ? getCategoryIcon(e.challenge.category) : "🏆";
      const what = e.challenge ? `captured '${e.challenge.name}'` : "scored an award";
      return `<span class="gcit-ticker__item">${icon} <strong>${escapeHtml(e.name)}</strong> just ${escapeHtml(what)} <span class="gcit-ticker__time">• ${dayjs(e.date).fromNow()}</span></span>`;
    });

    // Duplicate the sequence so the CSS scroll animation loops seamlessly.
    track.innerHTML = items.join("") + items.join("");
    el.style.display = "flex";
  } catch (e) {
    el.style.display = "none";
  }
}

function escapeHtml(str = "") {
  return String(str).replace(
    /[&<>"']/g,
    ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

/**
 * Live Stats Counters — animated count-up numbers for Total Solves,
 * Active Players, and Challenges Unlocked, sourced from the public
 * scoreboard + challenges endpoints.
 */
export async function initLiveStats() {
  const root = document.getElementById("gcit-live-stats");
  if (!root) return;

  try {
    const [scoreboard, challenges] = await Promise.all([
      window.CTFd.pages.scoreboard.getScoreboard().catch(() => []),
      window.CTFd.pages.challenges.getChallenges().catch(() => []),
    ]);

    const totalSolves = (challenges || []).reduce((sum, c) => sum + (c.solves || 0), 0);
    const activePlayers = (scoreboard || []).length;
    const challengesUnlocked = (challenges || []).length;

    const stats = {
      "gcit-stat-solves": totalSolves,
      "gcit-stat-players": activePlayers,
      "gcit-stat-challenges": challengesUnlocked,
    };

    let any = false;
    Object.entries(stats).forEach(([id, value]) => {
      const target = document.getElementById(id);
      if (!target) return;
      any = true;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        target.textContent = value;
        return;
      }
      new CountUp(id, value, { duration: 1.8, separator: "," }).start();
    });

    if (any) root.style.display = "flex";
  } catch (e) {
    root.style.display = "none";
  }
}
