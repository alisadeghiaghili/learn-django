/**
 * LearnDjango virtual project engine.
 *
 * Mutates an in-memory Django-shaped project from shell-like commands and
 * exposes declarative facts used by level goal checkers and the graph view.
 */

const FIELD_TYPES = new Set([
  "CharField",
  "TextField",
  "IntegerField",
  "BooleanField",
  "DateField",
  "DateTimeField",
  "EmailField",
  "SlugField",
  "URLField",
  "FloatField",
  "DecimalField",
  "FileField",
  "ImageField",
  "JSONField",
  "AutoField",
  "BigAutoField",
  "UUIDField",
  "ForeignKey",
  "OneToOneField",
  "ManyToManyField",
]);

const KNOWN_MIDDLEWARE = new Set([
  "SecurityMiddleware",
  "SessionMiddleware",
  "CommonMiddleware",
  "CsrfViewMiddleware",
  "AuthenticationMiddleware",
  "MessageMiddleware",
  "XFrameOptionsMiddleware",
]);

/**
 * Create an empty project state.
 *
 * @returns {object} Root project state.
 */
function createState() {
  return {
    projectName: null,
    apps: {},
    urls: [],
    views: [],
    templates: [],
    migrations: [],
    migratedApps: new Set(),
    middleware: [],
    admin: [],
    forms: [],
    queries: [],
    lastRequest: null,
    commandCount: 0,
    history: [],
  };
}

/**
 * Deep-clone project state (Set-safe).
 *
 * @param {object} state - Source state.
 * @returns {object} Cloned state.
 */
function cloneState(state) {
  const next = JSON.parse(
    JSON.stringify(state, (_k, v) => (v instanceof Set ? { __set: [...v] } : v)),
    (_k, v) => (v && v.__set ? new Set(v.__set) : v)
  );
  return next;
}

/**
 * Ensure an app exists in state.
 *
 * @param {object} state - Project state.
 * @param {string} name - App label.
 * @returns {object} App record.
 */
function ensureApp(state, name) {
  if (!state.apps[name]) {
    state.apps[name] = {
      name,
      models: [],
      views: [],
      templates: [],
      urls: [],
      admin: [],
      forms: [],
    };
  }
  return state.apps[name];
}

/**
 * Parse `name:Type` or `name:FK.Other` field specs.
 *
 * @param {string} token - Field token.
 * @returns {object|null} Parsed field or null.
 */
function parseFieldToken(token) {
  const raw = token.trim();
  if (!raw.includes(":")) return null;
  const [name, typeRaw] = raw.split(":");
  const type = typeRaw.trim();
  if (!name.trim() || !type) return null;

  if (type.startsWith("FK.") || type.startsWith("FK(")) {
    const ref = type.replace(/^FK[.(]/, "").replace(/\)$/, "");
    const [app, model] = ref.includes(".")
      ? ref.split(".")
      : [null, ref];
    return {
      name: name.trim(),
      type: "ForeignKey",
      refApp: app,
      refModel: model,
    };
  }
  if (!FIELD_TYPES.has(type)) return null;
  return { name: name.trim(), type, refApp: null, refModel: null };
}

/**
 * Normalize a URL path to always start with `/`.
 *
 * @param {string} path - Raw path.
 * @returns {string} Normalized path.
 */
function normalizePath(path) {
  const p = path.trim();
  return p.startsWith("/") ? p : `/${p}`;
}

/**
 * Match a simple Django-style path against a pattern.
 *
 * @param {string} pattern - Pattern like `/blog/` or `/post/<id>/`.
 * @param {string} path - Concrete path.
 * @returns {boolean} Whether path matches.
 */
function pathMatches(pattern, path) {
  const a = normalizePath(pattern);
  const b = normalizePath(path);
  if (a === b) return true;
  const re = new RegExp(
    "^" +
      a
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/<[^>]+>/g, "[^/]+") +
      "$"
  );
  return re.test(b);
}

/**
 * Build the output lines for one command.
 *
 * @param {object} state - Project state (mutated in place).
 * @param {string} line - Raw command line.
 * @returns {{ok: boolean, lines: string[], error?: string}} Result.
 */
function runCommand(state, line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return { ok: true, lines: [] };
  }

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Meta/help never counts toward command golf.
  const isMeta = ["help", "levels", "hint", "goal", "undo", "reset", "clear", "state"].includes(cmd);
  if (!isMeta) {
    state.commandCount += 1;
    state.history.push(trimmed);
  }

  switch (cmd) {
    case "help":
      return {
        ok: true,
        lines: [
          "Commands",
          "  startproject NAME",
          "  startapp APP",
          "  model APP Model field:Type [field:FK.Other]",
          "  field APP Model name:Type",
          "  makemigrations",
          "  migrate",
          "  url /path/ APP.view_name",
          "  view APP name  [template:APP/name.html]",
          "  template APP name.html",
          "  admin APP Model",
          "  middleware Name",
          "  form APP Name field:Type",
          "  request /path/",
          "  create APP.Model field=value",
          "  filter APP.Model field=value",
          "  related APP.Model field",
          "  showsql",
          "  levels | hint | goal | undo | reset | clear | state",
        ],
      };

    case "startproject": {
      if (!args[0]) {
        return { ok: false, lines: [], error: "usage: startproject NAME" };
      }
      if (state.projectName) {
        return {
          ok: false,
          lines: [],
          error: `project '${state.projectName}' already exists (reset first)`,
        };
      }
      state.projectName = args[0];
      return {
        ok: true,
        lines: [`Created project '${args[0]}'`, "Next: startapp blog"],
      };
    }

    case "startapp": {
      if (!state.projectName) {
        return {
          ok: false,
          lines: [],
          error: "create a project first: startproject mysite",
        };
      }
      if (!args[0]) {
        return { ok: false, lines: [], error: "usage: startapp APP" };
      }
      if (state.apps[args[0]]) {
        return {
          ok: false,
          lines: [],
          error: `app '${args[0]}' already exists`,
        };
      }
      ensureApp(state, args[0]);
      return {
        ok: true,
        lines: [
          `Created app '${args[0]}'`,
          "Files: models.py views.py urls.py admin.py",
        ],
      };
    }

    case "model": {
      const [appName, modelName, ...fieldTokens] = args;
      if (!appName || !modelName) {
        return {
          ok: false,
          lines: [],
          error: "usage: model APP Model field:Type [field:FK.Other]",
        };
      }
      const app = state.apps[appName];
      if (!app) {
        return {
          ok: false,
          lines: [],
          error: `unknown app '${appName}' (startapp ${appName})`,
        };
      }
      if (app.models.some((m) => m.name === modelName)) {
        return {
          ok: false,
          lines: [],
          error: `model '${appName}.${modelName}' already exists`,
        };
      }
      const fields = [];
      for (const token of fieldTokens) {
        const field = parseFieldToken(token);
        if (!field) {
          return {
            ok: false,
            lines: [],
            error: `bad field '${token}' (use name:CharField or name:FK.App.Model)`,
          };
        }
        fields.push(field);
      }
      app.models.push({ name: modelName, fields });
      markDirty(state, appName);
      return {
        ok: true,
        lines: [
          `Defined ${appName}.${modelName}`,
          ...fields.map((f) => `  ${f.name}: ${f.type}`),
          "Next: makemigrations && migrate",
        ],
      };
    }

    case "field": {
      const [appName, modelName, ...fieldTokens] = args;
      if (!appName || !modelName || fieldTokens.length === 0) {
        return {
          ok: false,
          lines: [],
          error: "usage: field APP Model name:Type [name:FK.Other]",
        };
      }
      const app = state.apps[appName];
      if (!app) {
        return { ok: false, lines: [], error: `unknown app '${appName}'` };
      }
      const model = app.models.find((m) => m.name === modelName);
      if (!model) {
        return {
          ok: false,
          lines: [],
          error: `unknown model '${appName}.${modelName}'`,
        };
      }
      for (const token of fieldTokens) {
        const field = parseFieldToken(token);
        if (!field) {
          return {
            ok: false,
            lines: [],
            error: `bad field '${token}'`,
          };
        }
        if (model.fields.some((f) => f.name === field.name)) {
          return {
            ok: false,
            lines: [],
            error: `field '${field.name}' already exists on ${modelName}`,
          };
        }
        model.fields.push(field);
      }
      markDirty(state, appName);
      return {
        ok: true,
        lines: [`Updated ${appName}.${modelName}`, "Run makemigrations to capture the change."],
      };
    }

    case "makemigrations": {
      if (!state.projectName) {
        return { ok: false, lines: [], error: "no project (startproject)" };
      }
      const pending = [];
      for (const app of Object.values(state.apps)) {
        const hasModels = app.models.length > 0;
        const already = state.migrations.some((m) => m.app === app.name);
        if (hasModels && (!already || appDirty(state, app.name))) {
          const idx =
            state.migrations.filter((m) => m.app === app.name).length + 1;
          const name = `${app.name}/000${idx}_auto`;
          state.migrations.push({ app: app.name, name, applied: false });
          pending.push(name);
          clearDirty(state, app.name);
        }
      }
      if (pending.length === 0) {
        return { ok: true, lines: ["No changes detected"] };
      }
      return {
        ok: true,
        lines: pending.map((n) => `Migrations for ...: ${n}`),
      };
    }

    case "migrate": {
      if (!state.projectName) {
        return { ok: false, lines: [], error: "no project (startproject)" };
      }
      const unapplied = state.migrations.filter((m) => !m.applied);
      if (unapplied.length === 0) {
        return { ok: true, lines: ["No migrations to apply."] };
      }
      for (const m of unapplied) {
        m.applied = true;
        state.migratedApps.add(m.app);
      }
      return {
        ok: true,
        lines: unapplied.map((m) => `Applying ${m.name}... OK`),
      };
    }

    case "url": {
      const [path, viewRef] = args;
      if (!path || !viewRef) {
        return {
          ok: false,
          lines: [],
          error: "usage: url /path/ APP.view_name",
        };
      }
      const [appPart, ...rest] = viewRef.split(".");
      const viewName = rest.join(".") || appPart;
      const appName = rest.length ? appPart : null;
      const p = normalizePath(path);
      if (state.urls.some((u) => u.pattern === p)) {
        return {
          ok: false,
          lines: [],
          error: `pattern '${p}' is already routed`,
        };
      }
      const entry = {
        pattern: p,
        app: appName,
        view: viewName,
        viewRef: viewRef.includes(".") ? viewRef : `${appName}.${viewName}`,
      };
      state.urls.push(entry);
      if (appName) {
        ensureApp(state, appName).urls.push(entry);
      }
      return {
        ok: true,
        lines: [`Routed ${p} → ${entry.viewRef}`, "Next: view + template, then request " + p],
      };
    }

    case "view": {
      const [appName, name, ...opts] = args;
      if (!appName || !name) {
        return {
          ok: false,
          lines: [],
          error: "usage: view APP name [template:APP/name.html]",
        };
      }
      const app = ensureApp(state, appName);
      let template = null;
      for (const opt of opts) {
        if (opt.startsWith("template:")) template = opt.slice("template:".length);
      }
      if (app.views.some((v) => v.name === name)) {
        return {
          ok: false,
          lines: [],
          error: `view '${appName}.${name}' already exists`,
        };
      }
      const view = { app: appName, name, template };
      app.views.push(view);
      state.views.push(view);
      return {
        ok: true,
        lines: [`Defined view ${appName}.${name}${template ? ` → ${template}` : ""}`],
      };
    }

    case "template": {
      const [appName, fileName] = args;
      if (!appName || !fileName) {
        return {
          ok: false,
          lines: [],
          error: "usage: template APP name.html",
        };
      }
      const app = ensureApp(state, appName);
      const path = `${appName}/${fileName}`;
      if (app.templates.some((t) => t.path === path)) {
        return {
          ok: false,
          lines: [],
          error: `template '${path}' already exists`,
        };
      }
      const tpl = { app: appName, name: fileName, path };
      app.templates.push(tpl);
      state.templates.push(tpl);
      return { ok: true, lines: [`Created template ${path}`] };
    }

    case "admin": {
      const [appName, modelName] = args;
      if (!appName || !modelName) {
        return {
          ok: false,
          lines: [],
          error: "usage: admin APP Model",
        };
      }
      const app = state.apps[appName];
      if (!app || !app.models.some((m) => m.name === modelName)) {
        return {
          ok: false,
          lines: [],
          error: `unknown model '${appName}.${modelName}'`,
        };
      }
      if (state.admin.some((a) => a.app === appName && a.model === modelName)) {
        return {
          ok: false,
          lines: [],
          error: `${modelName} is already registered`,
        };
      }
      const entry = { app: appName, model: modelName };
      state.admin.push(entry);
      app.admin.push(entry);
      return {
        ok: true,
        lines: [`Registered ${modelName} with admin.site`],
      };
    }

    case "middleware": {
      const name = args[0];
      if (!name) {
        return { ok: false, lines: [], error: "usage: middleware Name" };
      }
      const label = name.endsWith("Middleware") ? name : `${name}Middleware`;
      if (state.middleware.includes(label)) {
        return { ok: false, lines: [], error: `${label} is already enabled` };
      }
      state.middleware.push(label);
      return {
        ok: true,
        lines: [
          `Enabled ${label}${
            KNOWN_MIDDLEWARE.has(label) ? "" : " (custom)"
          }`,
        ],
      };
    }

    case "form": {
      const [appName, formName, ...fieldTokens] = args;
      if (!appName || !formName) {
        return {
          ok: false,
          lines: [],
          error: "usage: form APP Name field:Type",
        };
      }
      const app = ensureApp(state, appName);
      const fields = [];
      for (const token of fieldTokens) {
        const field = parseFieldToken(token);
        if (!field) {
          return { ok: false, lines: [], error: `bad field '${token}'` };
        }
        fields.push(field);
      }
      if (app.forms.some((f) => f.name === formName)) {
        return {
          ok: false,
          lines: [],
          error: `form '${formName}' already exists`,
        };
      }
      const form = { app: appName, name: formName, fields };
      app.forms.push(form);
      state.forms.push(form);
      return {
        ok: true,
        lines: [`Defined form ${appName}.${formName}`, ...fields.map((f) => `  ${f.name}: ${f.type}`)],
      };
    }

    case "create": {
      const [target, ...pairs] = args;
      if (!target || !target.includes(".")) {
        return {
          ok: false,
          lines: [],
          error: "usage: create APP.Model field=value",
        };
      }
      const [appName, modelName] = target.split(".");
      const model = state.apps[appName]?.models.find((m) => m.name === modelName);
      if (!model) {
        return {
          ok: false,
          lines: [],
          error: `unknown model '${target}'`,
        };
      }
      if (!state.migratedApps.has(appName)) {
        return {
          ok: false,
          lines: [],
          error: `table for ${target} does not exist (migrate first)`,
        };
      }
      const values = {};
      for (const pair of pairs) {
        const eq = pair.indexOf("=");
        if (eq === -1) {
          return { ok: false, lines: [], error: `bad assignment '${pair}'` };
        }
        values[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
      const row = { model: target, values };
      state.queries.push({ kind: "create", target, values, row });
      return {
        ok: true,
        lines: [`<${target}: ${JSON.stringify(values)}> created`],
      };
    }

    case "filter": {
      const [target, ...pairs] = args;
      if (!target || !target.includes(".")) {
        return {
          ok: false,
          lines: [],
          error: "usage: filter APP.Model field=value",
        };
      }
      const [appName, modelName] = target.split(".");
      const model = state.apps[appName]?.models.find((m) => m.name === modelName);
      if (!model) {
        return { ok: false, lines: [], error: `unknown model '${target}'` };
      }
      if (!state.migratedApps.has(appName)) {
        return {
          ok: false,
          lines: [],
          error: `table for ${target} does not exist (migrate first)`,
        };
      }
      const values = {};
      for (const pair of pairs) {
        const eq = pair.indexOf("=");
        if (eq === -1) {
          return { ok: false, lines: [], error: `bad assignment '${pair}'` };
        }
        values[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
      const rows = state.queries
        .filter((q) => q.kind === "create" && q.target === target)
        .map((q) => q.row)
        .filter((row) =>
          Object.entries(values).every(([k, v]) => String(row.values[k]) === v)
        );
      state.queries.push({ kind: "filter", target, values, rows });
      return {
        ok: true,
        lines: [
          `<QuerySet [<${modelName}: ${rows.length} row${rows.length === 1 ? "" : "s"}>>]`,
          ...rows.map((r) => `  ${JSON.stringify(r.values)}`),
        ],
      };
    }

    case "related": {
      const [target, field] = args;
      if (!target || !field) {
        return {
          ok: false,
          lines: [],
          error: "usage: related APP.Model field",
        };
      }
      const [appName, modelName] = target.split(".");
      const model = state.apps[appName]?.models.find((m) => m.name === modelName);
      const f = model?.fields.find((x) => x.name === field);
      if (!f || f.type !== "ForeignKey") {
        return {
          ok: false,
          lines: [],
          error: `no ForeignKey named '${field}' on ${target}`,
        };
      }
      state.queries.push({
        kind: "related",
        target,
        field,
        sql: `SELECT ... FROM ${target.replace(".", "_")} INNER JOIN ${f.refModel} ...`,
      });
      return {
        ok: true,
        lines: [
          `Followed ${target}.${field} → ${f.refApp || "?"}.${f.refModel}`,
          "Tip: related() avoids N+1 queries.",
        ],
      };
    }

    case "showsql": {
      const last = [...state.queries].reverse().find((q) => q.kind !== "related");
      if (!last) {
        return { ok: true, lines: ["No queries yet. Try create or filter."] };
      }
      const table = last.target.replace(".", "_").toLowerCase();
      const sql =
        last.kind === "create"
          ? `INSERT INTO ${table} (${Object.keys(last.values).join(", ")}) VALUES (${Object.values(last.values)
              .map((v) => `'${v}'`)
              .join(", ")});`
          : `SELECT * FROM ${table} WHERE ${Object.entries(last.values)
              .map(([k, v]) => `${k} = '${v}'`)
              .join(" AND ")};`;
      return { ok: true, lines: [`sql> ${sql}`, `(${last.rows ? last.rows.length : 1} row(s))`] };
    }

    case "request": {
      const path = args[0];
      if (!path) {
        return { ok: false, lines: [], error: "usage: request /path/" };
      }
      const p = normalizePath(path);
      const route = state.urls.find((u) => pathMatches(u.pattern, p));
      if (!route) {
        state.lastRequest = { path: p, ok: false, stage: "url", reason: "404 Not Found" };
        return {
          ok: false,
          lines: [],
          error: `404 Not Found — no url() matches ${p}`,
        };
      }
      const app = state.apps[route.app];
      const view = app?.views.find(
        (v) => v.name === route.view || `${v.app}.${v.name}` === route.viewRef
      );
      if (!view) {
        state.lastRequest = {
          path: p,
          ok: false,
          stage: "view",
          reason: "500 — view missing",
          route,
        };
        return {
          ok: false,
          lines: [],
          error: `500 — route ${p} points at missing view ${route.viewRef}`,
        };
      }
      let template = view.template;
      if (!template) {
        const guess = state.templates.find(
          (t) => t.app === view.app && t.name === `${view.name}.html`
        );
        template = guess ? guess.path : null;
      }
      if (!template) {
        state.lastRequest = {
          path: p,
          ok: false,
          stage: "template",
          reason: "500 — template missing",
          route,
          view,
        };
        return {
          ok: false,
          lines: [],
          error: `500 — view ${view.app}.${view.name} renders a missing template`,
        };
      }
      if (!state.middleware.includes("CommonMiddleware")) {
        state.lastRequest = {
          path: p,
          ok: false,
          stage: "middleware",
          reason: "middleware stack incomplete",
          route,
          view,
        };
        return {
          ok: false,
          lines: [],
          error: "request blocked — enable CommonMiddleware first",
        };
      }
      state.lastRequest = {
        path: p,
        ok: true,
        stage: "response",
        status: 200,
        route,
        view,
        template,
        middleware: [...state.middleware],
      };
      return {
        ok: true,
        lines: [
          `GET ${p} 200`,
          `  url      ${route.pattern} → ${route.viewRef}`,
          `  view     ${view.app}.${view.name}`,
          `  template ${template}`,
          `  middleware ${state.middleware.join(" → ") || "(none)"}`,
        ],
      };
    }

    case "state": {
      return {
        ok: true,
        lines: [
          `project: ${state.projectName || "(none)"}`,
          `apps: ${Object.keys(state.apps).join(", ") || "(none)"}`,
          `models: ${Object.values(state.apps)
            .flatMap((a) => a.models.map((m) => `${a.name}.${m.name}`))
            .join(", ") || "(none)"}`,
          `urls: ${state.urls.map((u) => u.pattern).join(", ") || "(none)"}`,
          `migrations: ${state.migrations.length} (${state.migrations.filter((m) => m.applied).length} applied)`,
          `commands: ${state.commandCount}`,
        ],
      };
    }

    case "levels":
    case "hint":
    case "goal":
    case "undo":
    case "reset":
    case "clear":
      // Handled by the app shell (need level context / history stack).
      return { ok: true, lines: [], __meta: cmd };

    default:
      return {
        ok: false,
        lines: [],
        error: `unknown command '${cmd}' — type help`,
      };
  }
}

/** Track model changes that need a new migration. */
function appDirty(state, appName) {
  state._dirty = state._dirty || new Set();
  return state._dirty.has(appName);
}

function clearDirty(state, appName) {
  if (state._dirty) state._dirty.delete(appName);
}

function markDirty(state, appName) {
  state._dirty = state._dirty || new Set();
  state._dirty.add(appName);
}

/**
 * Evaluate a goal predicate against project state.
 *
 * @param {object} state - Project state.
 * @param {object} goal - Goal descriptor from levels.js.
 * @returns {boolean} Whether the goal is satisfied.
 */
function goalMet(state, goal) {
  switch (goal.type) {
    case "hasProject":
      return state.projectName === goal.name;
    case "hasApp":
      return Boolean(state.apps[goal.name]);
    case "hasModel": {
      const app = state.apps[goal.app];
      return Boolean(app?.models.some((m) => m.name === goal.name));
    }
    case "hasField": {
      const model = state.apps[goal.app]?.models.find((m) => m.name === goal.model);
      const field = model?.fields.find((f) => f.name === goal.field);
      if (!field) return false;
      if (goal.fieldType && field.type !== goal.fieldType) return false;
      if (goal.refModel && field.refModel !== goal.refModel) return false;
      return true;
    }
    case "migrated":
      return state.migratedApps.has(goal.app);
    case "hasUrl": {
      return state.urls.some((u) => pathMatches(u.pattern, goal.path));
    }
    case "hasView": {
      return state.views.some(
        (v) => v.app === goal.app && v.name === goal.name
      );
    }
    case "hasTemplate": {
      return state.templates.some((t) => t.path === goal.path);
    }
    case "requestOk": {
      return Boolean(
        state.lastRequest &&
          state.lastRequest.ok &&
          pathMatches(goal.path, state.lastRequest.path)
      );
    }
    case "hasMiddleware":
      return state.middleware.includes(goal.name);
    case "hasAdmin":
      return state.admin.some(
        (a) => a.app === goal.app && a.model === goal.model
      );
    case "hasForm":
      return state.forms.some(
        (f) => f.app === goal.app && f.name === goal.name
      );
    case "hasQuery":
      return state.queries.some((q) => q.kind === goal.kind);
    case "hasRelated":
      return state.queries.some((q) => q.kind === "related");
    default:
      return false;
  }
}

/**
 * Evaluate all goals for a level.
 *
 * @param {object} state - Project state.
 * @param {Array<object>} goals - Goal list.
 * @returns {{passed: boolean, results: Array<{goal: object, done: boolean}>}} Result.
 */
function checkGoals(state, goals) {
  const results = goals.map((goal) => ({ goal, done: goalMet(state, goal) }));
  return { passed: results.every((r) => r.done), results };
}

/**
 * Build the architecture nodes/edges for the graph view.
 *
 * @param {object} state - Project state.
 * @returns {{nodes: Array<object>, edges: Array<object>}} Graph data.
 */
function buildGraph(state) {
  const nodes = [];
  const edges = [];

  nodes.push({
    id: "project",
    lane: "meta",
    kind: "project",
    label: state.projectName || "no project",
  });

  for (const app of Object.values(state.apps)) {
    const appId = `app:${app.name}`;
    nodes.push({
      id: appId,
      lane: "app",
      kind: "app",
      label: app.name,
    });
    edges.push({ from: "project", to: appId, kind: "contains" });

    for (const model of app.models) {
      const id = `model:${app.name}.${model.name}`;
      nodes.push({
        id,
        lane: "model",
        kind: "model",
        label: model.name,
        detail: model.fields.map((f) => `${f.name}: ${f.type}`),
        app: app.name,
      });
      edges.push({ from: appId, to: id, kind: "contains" });
      for (const f of model.fields) {
        if (f.type === "ForeignKey" && f.refModel) {
          edges.push({
            from: id,
            to: `model:${f.refApp || app.name}.${f.refModel}`,
            kind: "fk",
            label: f.name,
          });
        }
      }
    }

    for (const view of app.views) {
      const id = `view:${app.name}.${view.name}`;
      nodes.push({
        id,
        lane: "view",
        kind: "view",
        label: view.name,
        app: app.name,
      });
      edges.push({ from: appId, to: id, kind: "contains" });
      if (view.template) {
        edges.push({
          from: id,
          to: `template:${view.template}`,
          kind: "renders",
        });
      }
    }

    for (const tpl of app.templates) {
      nodes.push({
        id: `template:${tpl.path}`,
        lane: "template",
        kind: "template",
        label: tpl.path,
        app: app.name,
      });
      edges.push({ from: appId, to: `template:${tpl.path}`, kind: "contains" });
    }
  }

  for (const route of state.urls) {
    const id = `url:${route.pattern}`;
    nodes.push({
      id,
      lane: "url",
      kind: "url",
      label: route.pattern,
    });
    edges.push({
      from: id,
      to: `view:${route.viewRef}`,
      kind: "dispatch",
    });
  }

  for (const mid of state.middleware) {
    nodes.push({
      id: `mw:${mid}`,
      lane: "middleware",
      kind: "middleware",
      label: mid,
    });
  }

  if (state.lastRequest?.ok) {
    const req = state.lastRequest;
    edges.push({
      from: `url:${req.route.pattern}`,
      to: `view:${req.view.app}.${req.view.name}`,
      kind: "active",
    });
  }

  return { nodes, edges };
}

const LearnDjangoEngine = {
  FIELD_TYPES,
  createState,
  cloneState,
  runCommand,
  goalMet,
  checkGoals,
  buildGraph,
  pathMatches,
  parseFieldToken,
  markDirty,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = LearnDjangoEngine;
}
if (typeof window !== "undefined") {
  window.LearnDjangoEngine = LearnDjangoEngine;
}
