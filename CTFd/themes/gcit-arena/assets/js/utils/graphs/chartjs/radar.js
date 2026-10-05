/**
 * GCIT Arena — RPG Skill Radar Chart (Phase 7 gamification), built with
 * Chart.js. Purely a view-side visualization of category solve
 * proficiency already derivable from a user/team's own solves + the
 * public challenges list.
 */
import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";

Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
);

let instance = null;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{name: string, value: number}[]} data - value is 0-100 proficiency
 */
export function renderRadar(canvas, data = []) {
  if (!canvas) return null;
  if (instance) {
    instance.destroy();
    instance = null;
  }
  if (data.length < 3) return null; // radar needs at least 3 axes to look meaningful

  instance = new Chart(canvas, {
    type: "radar",
    data: {
      labels: data.map(d => d.name),
      datasets: [
        {
          label: "Proficiency",
          data: data.map(d => Math.round(d.value)),
          backgroundColor: "rgba(116, 180, 68, 0.22)",
          borderColor: "#74b444",
          pointBackgroundColor: "#74b444",
          pointBorderColor: "#0b0e14",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: {
        duration: 800,
        easing: "easeOutQuart",
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false, stepSize: 25 },
          grid: { color: "rgba(196, 223, 249, 0.15)" },
          angleLines: { color: "rgba(196, 223, 249, 0.15)" },
          pointLabels: {
            color: "#c4dff9",
            font: { family: "JetBrains Mono", size: 11 },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.r}% proficiency`,
          },
        },
      },
    },
  });

  return instance;
}
