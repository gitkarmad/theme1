import Alpine from "alpinejs";
import CTFd from "../index";
import { colorHash } from "@ctfdio/ctfd-js/ui";
import { getOption as getUserScoreOption } from "../utils/graphs/echarts/userscore";
import { embed } from "../utils/graphs/echarts";
import { renderRadar } from "../utils/graphs/chartjs/radar";
import {
  getRank,
  getRpgTitle,
  computeBadges,
  computeAdvancedBadges,
  computeCategoryCrests,
  maybeToastBadges,
} from "../gamification";

window.Alpine = Alpine;

// Phase 7 gamification: tiny standalone component so the RPG title can sit
// next to the profile name, outside the larger UserGraphs scope below.
Alpine.data("RpgTitle", () => ({
  score: 0,
  getTitle() {
    return getRpgTitle(this.score);
  },
}));

Alpine.data("UserGraphs", () => ({
  score: 0,
  solves: null,
  fails: null,
  awards: null,
  solveCount: 0,
  failCount: 0,
  awardCount: 0,

  // --- Phase 6 gamification (view-side only) ----------------------------
  categoryTotals: [], // Phase 7: [{name, total}] across the whole board

  getRank() {
    return getRank(this.score);
  },

  getRpgTitle() {
    return getRpgTitle(this.score);
  },

  getBadges() {
    const base = computeBadges({
      solveCount: this.solveCount,
      failCount: this.failCount,
      categoryCount: this.solves ? this.getCategoryBreakdown().length : 0,
      values: this.solves ? this.solves.data.map(s => s.challenge.value) : [],
    });
    const advanced = this.solves
      ? computeAdvancedBadges({
          solves: this.solves.data,
          categories: this.categoryTotals,
          ctfStart: CTFd.config.start,
        })
      : [];
    return [...base, ...advanced];
  },

  getCrests() {
    return computeCategoryCrests(this.getCategoryBreakdown());
  },

  getRadarData() {
    // Proficiency = solved / total challenges in that category.
    return this.categoryTotals
      .map(({ name, total }) => {
        const breakdown = this.getCategoryBreakdown().find(b => b.name === name);
        const solved = breakdown ? breakdown.count : 0;
        return { name, value: total ? (solved / total) * 100 : 0 };
      })
      .filter(d => d.value > 0);
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
      const percent = Number((breakdown[property] / categories.length) * 100).toFixed(
        2,
      );

      data.push({
        name: property,
        count: breakdown[property],
        color: colorHash(property),
        percent,
      });
    }

    return data;
  },

  async init() {
    this.solves = await CTFd.pages.users.userSolves("me");
    this.fails = await CTFd.pages.users.userFails("me");
    this.awards = await CTFd.pages.users.userAwards("me");

    this.solveCount = this.solves.meta.count;
    this.failCount = this.fails.meta.count;
    this.awardCount = this.awards.meta.count;

    // Phase 7 gamification: category totals (for the radar chart +
    // Category Specialist / Jack of All Trades badges), from the public
    // challenges list CTFd already exposes.
    try {
      const challenges = await CTFd.pages.challenges.getChallenges();
      const totals = {};
      challenges.forEach(c => {
        totals[c.category] = (totals[c.category] || 0) + 1;
      });
      this.categoryTotals = Object.entries(totals).map(([name, total]) => ({
        name,
        total,
      }));
    } catch (e) {
      this.categoryTotals = [];
    }

    Alpine.nextTick(() => renderRadar(this.$refs.radarChart, this.getRadarData()));

    let optionMerge = window.userScoreGraphChartOptions;

    embed(
      this.$refs.scoregraph,
      getUserScoreOption(
        CTFd.user.id,
        CTFd.user.name,
        this.solves.data,
        this.awards.data,
        optionMerge,
      ),
    );

    maybeToastBadges(this.getBadges());
  },
}));

Alpine.start();
