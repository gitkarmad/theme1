/**
 * GCIT Arena — Skill Tree / Node Map view (Phase 7 gamification).
 *
 * A lightweight, dependency-free radial node graph rendered as inline SVG:
 * a central hub, categories as parent nodes on an inner ring, and their
 * challenges as connected branch nodes on an outer ring. Solved nodes glow
 * green; unsolved nodes stay blue/grey. Purely a client-side alternate
 * view of data the Challenges page already has — no new API calls.
 */

const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/**
 * @param {SVGSVGElement} svg - target <svg> to render into (cleared first)
 * @param {string[]} categories - ordered category names
 * @param {Function} getChallenges - (category) => challenge[]
 * @param {Function} getTier - (value) => "standard"|"elusive"|"boss"
 * @param {Object} callbacks - { onSelect(challengeId) }
 */
export function renderNodeMap(svg, categories, getChallenges, getTier, callbacks = {}) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (!categories.length) return;

  const size = 720;
  const cx = size / 2;
  const cy = size / 2;
  const catRadius = size * 0.24;
  const chalRadius = size * 0.42;

  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const linesLayer = el("g", { class: "gcit-node-map__lines" });
  const nodesLayer = el("g", { class: "gcit-node-map__nodes" });
  svg.appendChild(linesLayer);
  svg.appendChild(nodesLayer);

  // Central hub
  nodesLayer.appendChild(el("circle", { cx, cy, r: 26, class: "gcit-node-map__hub" }));
  const hubLabel = el("text", { x: cx, y: cy + 4, class: "gcit-node-map__hub-label" });
  hubLabel.textContent = "ARENA";
  nodesLayer.appendChild(hubLabel);

  const arcPerCategory = 360 / categories.length;

  categories.forEach((category, i) => {
    const angle = i * arcPerCategory - 90;
    const [catX, catY] = polar(cx, cy, catRadius, angle);

    // Hub -> category line
    linesLayer.appendChild(
      el("line", { x1: cx, y1: cy, x2: catX, y2: catY, class: "gcit-node-map__link" }),
    );

    const challenges = getChallenges(category);
    const spread = Math.min(arcPerCategory * 0.82, challenges.length * 20 || 1);

    const catGroup = el("g", {
      class: "gcit-node-map__cat",
      transform: `translate(${catX}, ${catY})`,
    });
    catGroup.appendChild(el("circle", { r: 20, class: "gcit-node-map__cat-circle" }));
    const catLabel = el("text", { y: 34, class: "gcit-node-map__cat-label" });
    catLabel.textContent = category;
    catGroup.appendChild(catLabel);
    catGroup.appendChild(el("title")).textContent = category;
    nodesLayer.appendChild(catGroup);

    challenges.forEach((challenge, j) => {
      const offset =
        challenges.length > 1
          ? (j - (challenges.length - 1) / 2) * (spread / challenges.length)
          : 0;
      const [chalX, chalY] = polar(cx, cy, chalRadius, angle + offset);

      linesLayer.appendChild(
        el("line", {
          x1: catX,
          y1: catY,
          x2: chalX,
          y2: chalY,
          class: "gcit-node-map__link gcit-node-map__link--branch",
        }),
      );

      const solved = challenge.solved_by_me;
      const tier = getTier(challenge.value);
      const chalGroup = el("g", {
        class: [
          "gcit-node-map__chal",
          solved ? "gcit-node-map__chal--solved" : "gcit-node-map__chal--unsolved",
          `gcit-node-map__chal--${tier}`,
        ].join(" "),
        transform: `translate(${chalX}, ${chalY})`,
        role: "button",
        tabindex: "0",
      });
      chalGroup.appendChild(el("circle", { r: 12 }));
      const title = el("title");
      title.textContent = `${challenge.name} (${challenge.value} pts)${solved ? " — solved" : ""}`;
      chalGroup.appendChild(title);

      const onActivate = () => callbacks.onSelect && callbacks.onSelect(challenge.id);
      chalGroup.addEventListener("click", onActivate);
      chalGroup.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") onActivate();
      });

      nodesLayer.appendChild(chalGroup);
    });
  });
}
