/**
 * SVG multi-lane architecture graph for LearnDjango.
 *
 * Lanes (left → right): middleware · url · view · model · template
 * plus a slim meta rail for the project name.
 */

const LANES = [
  { key: "middleware", title: "MIDDLEWARE" },
  { key: "url", title: "URL" },
  { key: "view", title: "VIEW" },
  { key: "model", title: "MODEL" },
  { key: "template", title: "TEMPLATE" },
];

const COLORS = {
  stage: "#0B1411",
  panel: "#121C18",
  edge: "#1E2C26",
  ink: "#C7D4CD",
  mute: "#7A8F86",
  green: "#44B78B",
  deep: "#0C4B33",
  amber: "#D4A84B",
  alert: "#C45C4A",
  paper: "#E6EFEA",
};

/**
 * Create a graph renderer bound to an SVG element.
 *
 * @param {SVGElement} svg - Target SVG.
 * @returns {{render: Function, pulseRequest: Function}} Renderer API.
 */
function createGraph(svg) {
  let pulseTimer = null;

  /**
   * @param {object} graph - {nodes, edges} from engine.buildGraph
   * @param {object|null} lastRequest - engine state.lastRequest
   */
  function render(graph, lastRequest) {
    const width = Math.max(svg.clientWidth || 960, 720);
    const height = Math.max(svg.clientHeight || 420, 360);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = "";

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
      <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4"
              markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L8,4 L0,8" fill="none" stroke="${COLORS.mute}" stroke-width="1"/>
      </marker>
      <marker id="arrow-active" viewBox="0 0 8 8" refX="7" refY="4"
              markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L8,4 L0,8" fill="none" stroke="${COLORS.green}" stroke-width="1.2"/>
      </marker>
    `;
    svg.appendChild(defs);

    const padX = 36;
    const padY = 64;
    const laneW = (width - padX * 2) / LANES.length;

    // Lane backgrounds + titles
    LANES.forEach((lane, i) => {
      const x = padX + i * laneW;
      const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bg.setAttribute("x", x);
      bg.setAttribute("y", padY - 22);
      bg.setAttribute("width", laneW - 12);
      bg.setAttribute("height", height - padY * 2 + 40);
      bg.setAttribute("rx", "10");
      bg.setAttribute("fill", i % 2 ? "#0E1814" : "#0F1A15");
      bg.setAttribute("stroke", COLORS.edge);
      svg.appendChild(bg);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", x + 14);
      label.setAttribute("y", padY - 18);
      label.setAttribute("fill", COLORS.mute);
      label.setAttribute("font-size", "10");
      label.setAttribute("font-family", "Consolas, monospace");
      label.setAttribute("letter-spacing", "1.5");
      label.textContent = lane.title;
      svg.appendChild(label);

      const rule = document.createElementNS("http://www.w3.org/2000/svg", "line");
      rule.setAttribute("x1", x);
      rule.setAttribute("y1", padY - 8);
      rule.setAttribute("x2", x + laneW - 12);
      rule.setAttribute("y2", padY - 8);
      rule.setAttribute("stroke", COLORS.edge);
      svg.appendChild(rule);
    });

    // Lane stacks classification
    const byLane = Object.fromEntries(LANES.map((l) => [l.key, []]));
    for (const node of graph.nodes) {
      if (node.lane === "meta" || node.kind === "app" || node.kind === "project") {
        continue;
      }
      const key = byLane[node.lane] ? node.lane : "url";
      byLane[key].push(node);
    }

    const pos = new Map();
    // Top rail: apps + project chip (not part of request lanes)
    const railY = 18;
    const appNodes = graph.nodes.filter((n) => n.kind === "app");
    const project = graph.nodes.find((n) => n.kind === "project");
    const railItems = [project, ...appNodes].filter(Boolean);
    let railX = padX;
    for (const node of railItems) {
      const w = 88;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("transform", `translate(${railX + w / 2}, ${railY})`);
      g.dataset.nodeId = node.id;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", -w / 2);
      rect.setAttribute("y", -14);
      rect.setAttribute("width", w);
      rect.setAttribute("height", 28);
      rect.setAttribute("rx", "14");
      rect.setAttribute("fill", node.kind === "app" ? "#1A2A22" : "#0E1814");
      rect.setAttribute("stroke", node.kind === "app" ? COLORS.green : COLORS.edge);
      g.appendChild(rect);
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("y", 4);
      label.setAttribute("fill", node.kind === "app" ? COLORS.paper : COLORS.mute);
      label.setAttribute("font-size", "11");
      label.setAttribute("font-family", "Consolas, monospace");
      label.textContent = node.label;
      g.appendChild(label);
      svg.appendChild(g);
      pos.set(node.id, { x: railX + w / 2, y: railY, node });
      railX += w + 10;
    }

    // Lane stacks (url / view / model / template / middleware)
    LANES.forEach((lane, i) => {
      const list = byLane[lane.key];
      const x = padX + i * laneW + (laneW - 12) / 2;
      list.forEach((node, j) => {
        const y = padY + 36 + j * 58;
        pos.set(node.id, { x, y, node });
      });
    });

    // Edges under nodes
    const edgeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.insertBefore(edgeLayer, svg.querySelector("g[data-node-id]"));

    for (const edge of graph.edges) {
      const a = pos.get(edge.from);
      const b = pos.get(edge.to);
      if (!a || !b) continue;
      // Skip chrome edges from project/app rail into lanes — too noisy.
      if (edge.kind === "contains") continue;
      const active =
        edge.kind === "active" ||
        (lastRequest?.ok &&
          edge.kind === "dispatch" &&
          lastRequest.route &&
          `url:${lastRequest.route.pattern}` === edge.from);

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const mx = (a.x + b.x) / 2;
      const d = `M ${a.x + 48} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x - 48} ${b.y}`;
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", active ? COLORS.green : COLORS.edge);
      path.setAttribute("stroke-width", active ? "1.6" : "1");
      path.setAttribute("marker-end", active ? "url(#arrow-active)" : "url(#arrow)");
      if (edge.kind === "fk") path.setAttribute("stroke-dasharray", "3 3");
      if (active) path.dataset.active = "1";
      edgeLayer.appendChild(path);
    }

    // Nodes (lane nodes only — rail already drawn)
    for (const { x, y, node } of pos.values()) {
      if (node.kind === "app" || node.kind === "project") continue;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("transform", `translate(${x}, ${y})`);
      g.dataset.nodeId = node.id;

      const w = 96;
      const h = node.detail ? 54 : 36;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", -w / 2);
      rect.setAttribute("y", -h / 2);
      rect.setAttribute("width", w);
      rect.setAttribute("height", h);
      rect.setAttribute("rx", "8");
      const fill =
        node.kind === "model"
          ? "#0E241B"
          : node.kind === "app"
            ? "#1A2A22"
            : node.kind === "url"
              ? "#102018"
              : node.kind === "middleware"
                ? "#141C1A"
                : COLORS.deep;
      rect.setAttribute("fill", fill);
      rect.setAttribute(
        "stroke",
        node.kind === "model" || node.kind === "app"
          ? COLORS.green
          : COLORS.edge
      );
      rect.setAttribute("stroke-width", "1");
      g.appendChild(rect);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("y", node.detail ? -4 : 4);
      label.setAttribute("fill", COLORS.paper);
      label.setAttribute("font-size", "11");
      label.setAttribute("font-family", "Consolas, monospace");
      label.textContent = node.label;
      g.appendChild(label);

      if (node.detail) {
        const detail = document.createElementNS("http://www.w3.org/2000/svg", "text");
        detail.setAttribute("text-anchor", "middle");
        detail.setAttribute("y", 14);
        detail.setAttribute("fill", COLORS.mute);
        detail.setAttribute("font-size", "9");
        detail.setAttribute("font-family", "Consolas, monospace");
        detail.textContent = node.detail.slice(0, 2).join(" · ");
        g.appendChild(detail);
      }

      svg.appendChild(g);
    }

    // Empty-state caption
    if (graph.nodes.filter((n) => n.lane !== "meta").length === 0) {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", width / 2);
      text.setAttribute("y", height / 2);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", COLORS.mute);
      text.setAttribute("font-family", "Georgia, serif");
      text.setAttribute("font-size", "15");
      text.textContent = "No apps yet — type startproject mysite";
      svg.appendChild(text);
    }
  }

  /**
   * Animate a packet along the active request path.
   *
   * @param {object|null} lastRequest - engine state.lastRequest
   */
  function pulseRequest(lastRequest) {
    if (!lastRequest?.ok) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const paths = [...svg.querySelectorAll('path[data-active="1"]')];
    if (!paths.length) return;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("r", "5");
    circle.setAttribute("fill", COLORS.amber);
    svg.appendChild(circle);

    const path = paths[0];
    const len = path.getTotalLength();
    const start = performance.now();
    const dur = 900;

    function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      const pt = path.getPointAtLength(len * t);
      circle.setAttribute("cx", pt.x);
      circle.setAttribute("cy", pt.y);
      circle.setAttribute("opacity", String(1 - t * 0.3));
      if (t < 1) {
        pulseTimer = requestAnimationFrame(frame);
      } else {
        circle.remove();
      }
    }
    cancelAnimationFrame(pulseTimer);
    pulseTimer = requestAnimationFrame(frame);
  }

  return { render, pulseRequest };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createGraph, LANES, COLORS };
} else {
  window.LearnDjangoViz = { createGraph, LANES, COLORS };
}
