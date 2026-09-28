/**
 * LearnDjango app shell: terminal loop, level flow, golf score, persistence.
 */

(function () {
  "use strict";

  const engine =
    typeof module !== "undefined" && module.exports
      ? require("./engine.js")
      : window.LearnDjangoEngine;
  const levelsApi =
    typeof module !== "undefined" && module.exports
      ? require("./levels.js")
      : window.LearnDjangoLevels;
  const vizApi =
    typeof module !== "undefined" && module.exports
      ? require("./viz.js")
      : window.LearnDjangoViz;

  const STORAGE_KEY = "learndjango:v1";

  /** @type {ReturnType<typeof engine.createState>} */
  let state = engine.createState();
  /** @type {ReturnType<typeof engine.createState>[]} */
  const undoStack = [];
  /** @type {string[]} */
  const cmdHistory = [];
  let historyIndex = -1;
  let currentLevel = null;
  let mode = "sandbox"; // sandbox | level
  let solved = loadSolved();

  const el = {
    terminal: null,
    input: null,
    graph: null,
    goalPanel: null,
    status: null,
    golf: null,
    dialog: null,
    levelTitle: null,
  };

  let graphRenderer = null;

  function loadSolved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveSolved() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(solved));
    } catch {
      /* ignore */
    }
  }

  function boot() {
    el.terminal = document.getElementById("terminal-log");
    el.input = document.getElementById("terminal-input");
    el.graph = document.getElementById("graph");
    el.goalPanel = document.getElementById("goal-panel");
    el.status = document.getElementById("status-line");
    el.golf = document.getElementById("golf");
    el.dialog = document.getElementById("dialog");
    el.levelTitle = document.getElementById("level-title");

    graphRenderer = vizApi.createGraph(el.graph);
    wireChrome();
    renderAll();

    print("LearnDjango — interactive Django architecture lab");
    print("Type help for commands, levels to start learning.");
    print("");
    el.input.focus();

    maybeIntro();
  }

  function wireChrome() {
    document.getElementById("btn-levels").addEventListener("click", openLevels);
    document.getElementById("btn-sandbox").addEventListener("click", () => {
      exitLevel();
      print("Sandbox mode. Mess with the project freely.");
    });
    document.getElementById("btn-hint").addEventListener("click", () => {
      if (currentLevel) print(currentLevel.hint);
      else print("No active level. Open levels first.");
    });
    document.getElementById("btn-reset").addEventListener("click", () => {
      runMeta("reset");
    });
    document.getElementById("btn-undo").addEventListener("click", () => {
      runMeta("undo");
    });

    el.input.addEventListener("keydown", onInputKey);
    el.terminal.addEventListener("click", () => el.input.focus());
  }

  function onInputKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const line = el.input.value;
      el.input.value = "";
      submit(line);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      historyIndex = Math.min(
        cmdHistory.length - 1,
        (historyIndex < 0 ? cmdHistory.length : historyIndex) - 1
      );
      el.input.value = cmdHistory[historyIndex] || "";
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex < 0) return;
      historyIndex += 1;
      if (historyIndex >= cmdHistory.length) {
        historyIndex = -1;
        el.input.value = "";
      } else {
        el.input.value = cmdHistory[historyIndex];
      }
    }
  }

  function print(text, cls) {
    const line = document.createElement("div");
    line.className = "term-line" + (cls ? ` ${cls}` : "");
    line.textContent = text;
    el.terminal.appendChild(line);
    el.terminal.scrollTop = el.terminal.scrollHeight;
  }

  function printError(text) {
    print(text, "error");
  }

  function submit(raw) {
    const line = raw.trim();
    if (!line) return;
    cmdHistory.push(line);
    historyIndex = -1;
    print(`$ ${line}`, "cmd");

    const head = line.split(/\s+/)[0].toLowerCase();
    if (["levels", "hint", "goal", "undo", "reset", "clear"].includes(head)) {
      runMeta(head, line);
      return;
    }

    if (head === "level") {
      const id = line.split(/\s+/)[1];
      const level = levelsApi.findLevel(id);
      if (!level) {
        printError(`unknown level '${id || ""}' — type levels`);
        return;
      }
      startLevel(level);
      return;
    }

    pushUndo();
    const result = engine.runCommand(state, line);
    if (result.__meta) {
      // defensive: should not reach here
      undoStack.pop();
      return;
    }
    if (!result.ok) {
      // keep undo only for successful mutations; drop failed attempt
      undoStack.pop();
      // commandCount still increments on attempt — that's intentional golf pressure
      printError(result.error || "command failed");
    } else {
      for (const l of result.lines) print(l);
    }
    renderAll();
    checkLevelWin();
  }

  function runMeta(cmd, fullLine) {
    switch (cmd) {
      case "levels":
        openLevels();
        break;
      case "hint":
        if (currentLevel) print(currentLevel.hint);
        else print("No active level. Type levels.");
        break;
      case "goal":
        if (!currentLevel) {
          print("Sandbox has no goals.");
          break;
        }
        print(currentLevel.intro);
        for (const g of currentLevel.goals) {
          print(`  · ${levelsApi.goalLabel(g)}`);
        }
        break;
      case "undo":
        undo();
        break;
      case "reset":
        doReset();
        break;
      case "clear":
        el.terminal.innerHTML = "";
        break;
      default:
        printError(`unhandled meta '${cmd}'`);
    }
    void fullLine;
  }

  function pushUndo() {
    undoStack.push(engine.cloneState(state));
    if (undoStack.length > 40) undoStack.shift();
  }

  function undo() {
    const prev = undoStack.pop();
    if (!prev) {
      print("Nothing to undo.");
      return;
    }
    state = prev;
    print("Reverted last command.");
    renderAll();
    checkLevelWin();
  }

  function doReset() {
    if (mode === "level" && currentLevel) {
      const golf = state.commandCount;
      startLevel(currentLevel, { silent: true });
      print(`Level reset. Commands used: ${golf} (par ${currentLevel.par}).`);
    } else {
      state = engine.createState();
      undoStack.length = 0;
      print("Sandbox cleared.");
    }
    renderAll();
  }

  function openLevels() {
    const groups = levelsApi.groupBySeries(levelsApi.LEVELS);
    let html = `<div class="dialog-panel">
      <div class="dialog-head">
        <h2>Levels</h2>
        <button type="button" class="ghost" data-close>Close</button>
      </div>
      <p class="dialog-lede">Each series teaches one slice of Django. Solve with the fewest commands.</p>`;
    for (const group of groups) {
      html += `<section class="series"><h3>${group.series}</h3><div class="level-grid">`;
      for (const level of group.levels) {
        const rec = solved[level.id];
        const badge = rec
          ? `<span class="badge ok">${rec.commands}/${level.par}</span>`
          : `<span class="badge">par ${level.par}</span>`;
        html += `<button type="button" class="level-card" data-level="${level.id}">
          <span class="level-id">${level.id}</span>
          <span class="level-name">${level.title}</span>
          ${badge}
        </button>`;
      }
      html += `</div></section>`;
    }
    html += `</div>`;
    el.dialog.innerHTML = html;
    el.dialog.hidden = false;
    el.dialog.querySelector("[data-close]").addEventListener("click", closeDialog);
    el.dialog.querySelectorAll("[data-level]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const level = levelsApi.findLevel(btn.dataset.level);
        closeDialog();
        if (level) startLevel(level);
      });
    });
  }

  function closeDialog() {
    el.dialog.hidden = true;
    el.dialog.innerHTML = "";
    el.input.focus();
  }

  function startLevel(level, opts = {}) {
    mode = "level";
    currentLevel = level;
    undoStack.length = 0;
    state = engine.createState();
    state.commandCount = 0;

    for (const line of level.start || []) {
      engine.runCommand(state, line);
    }
    // start script should not count toward golf
    state.commandCount = 0;
    state.history = [];

    el.levelTitle.textContent = level.title;
    document.body.dataset.mode = "level";

    if (!opts.silent) {
      print(`— ${level.series} · ${level.title} —`, "level");
      print(level.intro);
      print(`Par: ${level.par} commands. Type goal to list targets, hint if stuck.`);
      print("");
    }
    renderAll();
  }

  function exitLevel() {
    mode = "sandbox";
    currentLevel = null;
    state = engine.createState();
    undoStack.length = 0;
    el.levelTitle.textContent = "Sandbox";
    document.body.dataset.mode = "sandbox";
    renderAll();
  }

  function checkLevelWin() {
    if (mode !== "level" || !currentLevel) return;
    const { passed, results } = engine.checkGoals(state, currentLevel.goals);
    renderGoals(results);
    if (!passed) return;

    const cmds = state.commandCount;
    const par = currentLevel.par;
    const prev = solved[currentLevel.id];
    if (!prev || cmds < prev.commands) {
      solved[currentLevel.id] = { commands: cmds, at: Date.now() };
      saveSolved();
    }
    print("");
    print("LEVEL CLEAR", "win");
    print(`par ${par} · you ${cmds}${cmds < par ? "  (under par)" : cmds === par ? "  (matched par)" : ""}`);
    const idx = levelsApi.LEVELS.findIndex((l) => l.id === currentLevel.id);
    const next = levelsApi.LEVELS[idx + 1];
    if (next) {
      print(`Next: level ${next.id} — ${next.title}`);
      print(`Run: level ${next.id}`);
    } else {
      print("All levels cleared. Sandbox is yours.");
    }
  }

  function renderAll() {
    const graph = engine.buildGraph(state);
    graphRenderer.render(graph, state.lastRequest);
    if (state.lastRequest?.ok) {
      graphRenderer.pulseRequest(state.lastRequest);
    }

    if (mode === "level" && currentLevel) {
      const { results } = engine.checkGoals(state, currentLevel.goals);
      renderGoals(results);
    } else {
      el.goalPanel.innerHTML = `<p class="goal-empty">Sandbox — build anything. Open <strong>levels</strong> for challenges.</p>`;
    }

    const total = mode === "level" && currentLevel ? currentLevel.par : null;
    el.golf.textContent = total
      ? `commands ${state.commandCount} / par ${total}`
      : `commands ${state.commandCount}`;

    el.status.textContent = state.projectName
      ? `${state.projectName} · ${Object.keys(state.apps).length} app(s)`
      : "no project";
  }

  function renderGoals(results) {
    el.goalPanel.innerHTML = "";
    for (const { goal, done } of results) {
      const row = document.createElement("div");
      row.className = "goal-item" + (done ? " done" : "");
      row.innerHTML = `<span class="goal-mark">${done ? "✓" : "○"}</span><span>${levelsApi.goalLabel(goal)}</span>`;
      el.goalPanel.appendChild(row);
    }
  }

  function maybeIntro() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("NODEMO")) {
      const lvl = params.get("level");
      if (lvl) {
        const level = levelsApi.findLevel(lvl);
        if (level) startLevel(level);
      }
      const cmd = params.get("command");
      if (cmd) {
        for (const line of cmd.split(";")) submit(line);
      }
      return;
    }
    el.dialog.innerHTML = `<div class="dialog-panel intro">
      <div class="dialog-head">
        <h2>LearnDjango</h2>
        <button type="button" class="ghost" data-close>Close</button>
      </div>
      <p class="dialog-lede">
        An interactive Django architecture visualizer and tutorial.
        Type commands in the terminal; the graph rewires as the project grows.
      </p>
      <ul class="intro-list">
        <li><strong>levels</strong> — guided challenges with command golf</li>
        <li><strong>request /path/</strong> — pulse a request through the stack</li>
        <li><strong>undo / reset</strong> — fix mistakes, restart cleanly</li>
      </ul>
      <div class="dialog-actions">
        <button type="button" class="primary" data-start>Start first level</button>
        <button type="button" class="ghost" data-sandbox>Just sandbox</button>
      </div>
    </div>`;
    el.dialog.hidden = false;
    el.dialog.querySelector("[data-close]").addEventListener("click", closeDialog);
    el.dialog.querySelector("[data-start]").addEventListener("click", () => {
      closeDialog();
      startLevel(levelsApi.LEVELS[0]);
    });
    el.dialog.querySelector("[data-sandbox]").addEventListener("click", closeDialog);
  }

  // Node test hook
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { STORAGE_KEY };
  }

  if (typeof document !== "undefined" && document.readyState !== "loading") {
    boot();
  } else if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", boot);
  }
})();
