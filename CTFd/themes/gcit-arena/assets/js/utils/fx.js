/**
 * GCIT Arena — confetti bursts (Phase 7 gamification). Purely a visual
 * flourish layered on top of existing UI events; never touches the API.
 */
import confetti from "canvas-confetti";

const COLORS = ["#74b444", "#f68218", "#1280b0", "#ffd76a", "#a4cf6b"];

export function fireConfetti(big = false) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  confetti({
    particleCount: big ? 150 : 60,
    spread: big ? 100 : 60,
    startVelocity: big ? 55 : 35,
    origin: { y: 0.7 },
    colors: COLORS,
  });

  if (big) {
    setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 120,
        startVelocity: 45,
        origin: { y: 0.6 },
        colors: COLORS,
      });
    }, 200);
  }
}
