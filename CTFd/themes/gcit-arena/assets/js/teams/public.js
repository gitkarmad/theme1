import CTFd from "../index";

import Alpine from "alpinejs";
import { colorHash } from "@ctfdio/ctfd-js/ui";
import { getOption as getUserScoreOption } from "../utils/graphs/echarts/userscore";
import { embed } from "../utils/graphs/echarts";
import { getRank, computeBadges, computeCategoryCrests } from "../gamification";

window.Alpine = Alpine;

Alpine.data("TeamGraphs", () => ({
  score: 0,
  solves: null,
  fails: null,
  awards: null,
  solveCount: 0,
  failCount: 0,
  awardCount: 0,

  // --- Phase 6 gamification (view-side only) ----------------------------
  getRank() {
    return getRank(this.score);
  },

  getBadges() {
    return computeBadges({
      solveCount: this.solveCount,
      failCount: this.failCount,
      categoryCount: this.solves ? this.getCategoryBreakdown().length : 0,
      values: this.solves ? this.solves.data.map(s => s.challenge.value) : [],
    });
  },

  getCrests() {
    return computeCategoryCrests(this.getCategoryBreakdown());
  },
  // ------------------------------------------------------------------------

  getSolvePercentage() {
    return ((this.solveCount / (this.solveCount + this.failCount)) * 100).toFixed(2);
  },

  getFailPercentage() {
    return ((this.failCount / (this.solveCount + this.failCount)) * 100).toFixed(2);
  },

  getCategoryBreakdown() {
    const categories = [];
    const breakdown = {};

    this.solves.data.map(solve => {
      categories.push(solve.challenge.category);
    });

    categories.forEach(category => {
      if (category in breakdown) {
        breakdown[category] += 1;
      } else {
        breakdown[category] = 1;
      }
    });

    const data = [];
    for (const property in breakdown) {
      data.push({
        name: property,
        count: breakdown[property],
        percent: ((breakdown[property] / categories.length) * 100).toFixed(2),
        color: colorHash(property),
      });
    }

    return data;
  },

  async init() {
    this.solves = await CTFd.pages.teams.teamSolves(window.TEAM.id);
    this.fails = await CTFd.pages.teams.teamFails(window.TEAM.id);
    this.awards = await CTFd.pages.teams.teamAwards(window.TEAM.id);

    this.solveCount = this.solves.meta.count;
    this.failCount = this.fails.meta.count;
    this.awardCount = this.awards.meta.count;

    let optionMerge = window.teamScoreGraphChartOptions;

    embed(
      this.$refs.scoregraph,
      getUserScoreOption(
        window.TEAM.id,
        window.TEAM.name,
        this.solves.data,
        this.awards.data,
        optionMerge,
      ),
    );
  },
}));

Alpine.start();
