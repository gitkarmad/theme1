import { colorHash } from "@ctfdio/ctfd-js/ui";
import { mergeObjects } from "../../objects";
import { cumulativeSum } from "../../math";
import dayjs from "dayjs";

// GCIT Arena — `rivalId` (optional) is the account id of a team/user the
// visitor picked from the standings table to compare against. Its series
// gets bolded/glowing while every other series is dimmed, purely as a
// view-side chart style tweak — no data changes. `selfId` is the logged-in
// account; that series stays in brand green and is never treated as a rival.
export function getOption(mode, places, optionMerge, rivalId = null, selfId = null) {
  let option = {
    title: {
      left: "center",
      text: "Top 10 " + (mode === "teams" ? "Teams" : "Users"),
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
    },
    legend: {
      type: "scroll",
      orient: "horizontal",
      align: "left",
      bottom: 35,
      data: [],
    },
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: "none",
        },
        saveAsImage: {},
      },
    },
    grid: {
      containLabel: true,
    },
    xAxis: [
      {
        type: "time",
        boundaryGap: false,
        data: [],
      },
    ],
    yAxis: [
      {
        type: "value",
      },
    ],
    dataZoom: [
      {
        id: "dataZoomX",
        type: "slider",
        xAxisIndex: [0],
        filterMode: "filter",
        height: 20,
        top: 35,
        fillerColor: "rgba(233, 236, 241, 0.4)",
      },
    ],
    // Smooth entrance animation + hover emphasis (Phase 7 gamification).
    animation: true,
    animationDuration: 900,
    animationDurationUpdate: 500,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut",
    emphasis: {
      focus: "series",
    },
    series: [],
  };

  const teams = Object.keys(places);
  const self = selfId == null ? null : Number(selfId);
  const rival = rivalId == null || Number(rivalId) === self ? null : Number(rivalId);
  const hasRival = rival != null && teams.some(t => Number(places[t].id) === rival);

  for (let i = 0; i < teams.length; i++) {
    const place = places[teams[i]];
    const team_score = [];
    const times = [];
    for (let j = 0; j < place["solves"].length; j++) {
      team_score.push(place["solves"][j].value);
      const date = dayjs(place["solves"][j].date);
      times.push(date.toDate());
    }

    const total_scores = cumulativeSum(team_score);
    let scores = times.map(function (e, i) {
      return [e, total_scores[i]];
    });

    const isSelf = self != null && Number(place.id) === self;
    const isRival = hasRival && Number(place.id) === rival;
    const isDimmed = hasRival && !isRival && !isSelf;
    const label = isSelf ? `${place["name"]} (you)` : place["name"];
    option.legend.data.push(label);

    const baseColor = isSelf ? "#74b444" : colorHash(place["name"] + place["id"]);

    const data = {
      name: label,
      type: "line",
      smooth: true,
      symbolSize: isRival || isSelf ? 8 : 6,
      lineStyle: {
        width: isRival || isSelf ? 4 : 2,
        opacity: isDimmed ? 0.25 : 1,
      },
      itemStyle: {
        color: baseColor,
        opacity: isDimmed ? 0.25 : 1,
        shadowBlur: isRival || isSelf ? 12 : 0,
        shadowColor: isRival || isSelf ? baseColor : "transparent",
      },
      label: {
        show: false,
        position: "top",
      },
      emphasis: {
        focus: "series",
        lineStyle: { width: isRival || isSelf ? 5 : 3 },
      },
      z: isSelf ? 11 : isRival ? 10 : 1,
      data: scores,
    };
    option.series.push(data);
  }

  if (optionMerge) {
    option = mergeObjects(option, optionMerge);
  }
  return option;
}
