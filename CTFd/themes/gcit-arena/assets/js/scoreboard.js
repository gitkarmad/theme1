import Alpine from "alpinejs";
import CTFd from "./index";
import { getOption } from "./utils/graphs/echarts/scoreboard";
import { embed } from "./utils/graphs/echarts";

window.Alpine = Alpine;
window.CTFd = CTFd;

// Default scoreboard polling interval to every 5 minutes
const scoreboardUpdateInterval = window.scoreboardUpdateInterval || 300000;

Alpine.data("ScoreboardDetail", () => ({
  data: {},
  show: true,
  activeBracket: null,
  rivalId: null, // Phase 7 gamification: picked from ScoreboardList via "rival-select"

  async update() {
    this.data = await CTFd.pages.scoreboard.getScoreboardDetail(10, this.activeBracket);

    let optionMerge = window.scoreboardChartOptions;
    let option = getOption(
      CTFd.config.userMode,
      this.data,
      optionMerge,
      this.rivalId,
      myAccountId(),
    );

    embed(this.$refs.scoregraph, option);
    this.show = Object.keys(this.data).length > 0;
  },

  async init() {
    this.update();

    setInterval(() => {
      this.update();
    }, scoreboardUpdateInterval);
  },
}));

// Phase 6 gamification: browser-local snapshot of the last standings we
// rendered, used only to compute rank-delta arrows between polls. This is
// never sent anywhere — it just lives in this tab's memory + localStorage.
const PREV_STANDINGS_KEY = "gcit_prev_standings";

function loadPrevStandings() {
  try {
    return JSON.parse(localStorage.getItem(PREV_STANDINGS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function savePrevStandings(map) {
  try {
    localStorage.setItem(PREV_STANDINGS_KEY, JSON.stringify(map));
  } catch (e) {
    // ignore storage errors (e.g. private browsing quota)
  }
}

// GCIT Arena — colors + crown for the 3D podium, keyed by 1st/2nd/3rd place.
const PODIUM_STYLE = {
  1: { tier: "gold", crown: true, height: "9rem" },
  2: { tier: "silver", crown: false, height: "6.5rem" },
  3: { tier: "bronze", crown: false, height: "5rem" },
};

function myAccountId() {
  const mine = CTFd.config.userMode === "teams" ? window.init.teamId : window.init.userId;
  return mine == null ? null : Number(mine);
}

function initialsFor(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();
}

Alpine.data("ScoreboardList", () => ({
  standings: [],
  brackets: [],
  activeBracket: null,
  deltas: {},
  rivalId: null,

  async update() {
    this.brackets = await CTFd.pages.scoreboard.getBrackets(CTFd.config.userMode);
    this.standings = await CTFd.pages.scoreboard.getScoreboard();
    this.computeDeltas();
  },

  // --- Phase 7 gamification: 3D podium ----------------------------------
  getPodium() {
    // Display order left-to-right: 2nd, 1st, 3rd (classic podium layout).
    return [2, 1, 3]
      .map(place => {
        const standing = this.standings[place - 1];
        if (!standing) return null;
        return {
          standing,
          place,
          ...PODIUM_STYLE[place],
          initials: initialsFor(standing.name),
        };
      })
      .filter(Boolean);
  },
  // -----------------------------------------------------------------------

  // --- Phase 7 gamification: rivalry tracker ------------------------------
  selectRival(standing) {
    // A player is not their own rival — clicking your own row/podium is a no-op.
    if (this.isMe(standing)) return;
    const next = this.isRivalSelected(standing) ? null : standing.account_id;
    this.rivalId = next;
    this.$dispatch("rival-select", next);
  },

  isRivalSelected(standing) {
    return this.rivalId != null && this.rivalId === standing.account_id;
  },
  // -----------------------------------------------------------------------

  // --- Phase 6 gamification (view-side only) ---------------------------
  computeDeltas() {
    const prev = loadPrevStandings();
    const next = {};
    const deltas = {};

    this.standings.forEach((standing, idx) => {
      const pos = idx + 1;
      next[standing.account_id] = pos;

      const prevPos = prev[standing.account_id];
      if (prevPos && prevPos !== pos) {
        deltas[standing.account_id] = prevPos - pos; // positive = moved up
      }
    });

    this.deltas = deltas;
    savePrevStandings(next);
  },

  getDelta(standing) {
    return this.deltas[standing.account_id] || 0;
  },

  isMe(standing) {
    const mine = myAccountId();
    return mine != null && Number(standing.account_id) === mine;
  },

  getMyStanding() {
    return this.standings.find(s => this.isMe(s)) || null;
  },

  getRival() {
    const mine = this.getMyStanding();
    if (!mine) return null;
    const myIndex = this.standings.indexOf(mine);
    if (myIndex <= 0) return null; // already in first place
    const rival = this.standings[myIndex - 1];
    return { rival, gap: rival.score - mine.score };
  },
  // -----------------------------------------------------------------------

  async init() {
    this.$watch("activeBracket", value => {
      this.$dispatch("bracket-change", value);
    });

    this.update();

    setInterval(() => {
      this.update();
    }, scoreboardUpdateInterval);
  },
}));

Alpine.start();
