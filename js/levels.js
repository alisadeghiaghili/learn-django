/**
 * Level catalog for LearnDjango.
 *
 * Each level defines a start snapshot (optional), teaching copy, goals,
 * a command par (golf), and a short hint.
 */

/**
 * @typedef {object} Level
 * @property {string} id
 * @property {string} series
 * @property {string} title
 * @property {string} intro
 * @property {Array<object>} goals
 * @property {number} par
 * @property {string} hint
 * @property {string} [start] - Optional command script run before the level.
 */

/** @type {Level[]} */
const LEVELS = [
  // ——— Foundations ———
  {
    id: "found-01",
    series: "Foundations",
    title: "Bootstrap a project",
    intro:
      "Every Django site starts as a project. Create one named mysite, then create an app called blog. Apps hold your models, views, and templates.",
    goals: [
      { type: "hasProject", name: "mysite" },
      { type: "hasApp", name: "blog" },
    ],
    par: 2,
    hint: "startproject mysite  ·  startapp blog",
  },
  {
    id: "found-02",
    series: "Foundations",
    title: "Your first model",
    intro:
      "Models describe data. Define blog.Post with a title (CharField) and a body (TextField). Fields are name:Type pairs.",
    goals: [
      { type: "hasModel", app: "blog", name: "Post" },
      { type: "hasField", app: "blog", model: "Post", field: "title", fieldType: "CharField" },
      { type: "hasField", app: "blog", model: "Post", field: "body", fieldType: "TextField" },
    ],
    par: 1,
    hint: "model blog Post title:CharField body:TextField",
    start: ["startproject mysite", "startapp blog"],
  },
  {
    id: "found-03",
    series: "Foundations",
    title: "Relate models",
    intro:
      "ForeignKeys wire models together. Add an Author model, then give Post an author field that points at it with FK.blog.Author.",
    goals: [
      { type: "hasModel", app: "blog", name: "Author" },
      { type: "hasField", app: "blog", model: "Post", field: "author", fieldType: "ForeignKey", refModel: "Author" },
    ],
    par: 2,
    hint: "model blog Author name:CharField  ·  field blog Post author:FK.blog.Author",
    start: [
      "startproject mysite",
      "startapp blog",
      "model blog Post title:CharField body:TextField",
    ],
  },
  {
    id: "found-04",
    series: "Foundations",
    title: "Migrate the schema",
    intro:
      "Models are Python. Tables are SQL. makemigrations writes the change script; migrate applies it. Do both.",
    goals: [{ type: "migrated", app: "blog" }],
    par: 2,
    hint: "makemigrations  ·  migrate",
    start: [
      "startproject mysite",
      "startapp blog",
      "model blog Post title:CharField body:TextField",
    ],
  },
  {
    id: "found-05",
    series: "Foundations",
    title: "Route a request",
    intro:
      "URLs map paths to views. Route /blog/ to blog.post_list, then define that view. The graph should show a URL lane edge to a view node.",
    goals: [
      { type: "hasUrl", path: "/blog/" },
      { type: "hasView", app: "blog", name: "post_list" },
    ],
    par: 2,
    hint: "url /blog/ blog.post_list  ·  view blog post_list",
    start: [
      "startproject mysite",
      "startapp blog",
    ],
  },
  {
    id: "found-06",
    series: "Foundations",
    title: "Render a template",
    intro:
      "Views return HTML. Create blog/post_list.html and attach it to the view with template:blog/post_list.html.",
    goals: [
      { type: "hasTemplate", path: "blog/post_list.html" },
      { type: "hasView", app: "blog", name: "post_list" },
    ],
    par: 2,
    hint: "template blog post_list.html  ·  view blog post_list template:blog/post_list.html",
    start: [
      "startproject mysite",
      "startapp blog",
    ],
  },
  {
    id: "found-07",
    series: "Foundations",
    title: "Serve the page",
    intro:
      "A request walks the stack. Enable CommonMiddleware, wire URL + view + template, then request /blog/. Watch the pulse travel the graph.",
    goals: [
      { type: "hasMiddleware", name: "CommonMiddleware" },
      { type: "requestOk", path: "/blog/" },
    ],
    par: 6,
    hint:
      "middleware Common  ·  url /blog/ blog.post_list  ·  view blog post_list template:blog/post_list.html  ·  template blog post_list.html  ·  request /blog/",
    start: ["startproject mysite", "startapp blog"],
  },

  // ——— ORM ———
  {
    id: "orm-01",
    series: "ORM",
    title: "Insert a row",
    intro:
      "ORM writes are objects. After migrating, create a Post row. Then showsql to see the INSERT Django would send.",
    goals: [
      { type: "migrated", app: "blog" },
      { type: "hasQuery", kind: "create" },
    ],
    par: 3,
    hint: "makemigrations  ·  migrate  ·  create blog.Post title=Hello body=World",
    start: [
      "startproject mysite",
      "startapp blog",
      "model blog Post title:CharField body:TextField",
    ],
  },
  {
    id: "orm-02",
    series: "ORM",
    title: "Filter a queryset",
    intro:
      "Queries return querysets. Create two posts with different titles, then filter blog.Post title=Hello. Only one row should match.",
    goals: [
      { type: "hasQuery", kind: "create" },
      { type: "hasQuery", kind: "filter" },
    ],
    par: 4,
    hint: "create blog.Post title=Hello  ·  create blog.Post title=World  ·  filter blog.Post title=Hello",
    start: [
      "startproject mysite",
      "startapp blog",
      "model blog Post title:CharField body:TextField",
      "makemigrations",
      "migrate",
    ],
  },
  {
    id: "orm-03",
    series: "ORM",
    title: "Beat the N+1 trap",
    intro:
      "Following FKs in a loop is the classic N+1 bug. After defining author, follow it with related blog.Post author — that is the join Django should emit.",
    goals: [
      { type: "hasField", app: "blog", model: "Post", field: "author", fieldType: "ForeignKey" },
      { type: "hasRelated" },
    ],
    par: 2,
    hint: "field blog Post author:FK.blog.Author  ·  related blog.Post author",
    start: [
      "startproject mysite",
      "startapp blog",
      "model blog Author name:CharField",
      "model blog Post title:CharField",
    ],
  },

  // ——— Request cycle ———
  {
    id: "req-01",
    series: "Request cycle",
    title: "Security headers",
    intro:
      "Middleware sits between the request and your view. Enable SecurityMiddleware and CommonMiddleware so the stack can serve traffic.",
    goals: [
      { type: "hasMiddleware", name: "SecurityMiddleware" },
      { type: "hasMiddleware", name: "CommonMiddleware" },
    ],
    par: 2,
    hint: "middleware Security  ·  middleware Common",
  },
  {
    id: "req-02",
    series: "Request cycle",
    title: "Auth gate",
    intro:
      "Protected pages need AuthenticationMiddleware and a view. Wire /secret/ to blog.secret with a template, enable auth middleware, then request it.",
    goals: [
      { type: "hasMiddleware", name: "AuthenticationMiddleware" },
      { type: "hasMiddleware", name: "CommonMiddleware" },
      { type: "requestOk", path: "/secret/" },
    ],
    par: 7,
    hint:
      "middleware Authentication  ·  middleware Common  ·  url /secret/ blog.secret  ·  view blog secret template:blog/secret.html  ·  template blog secret.html  ·  request /secret/",
    start: ["startproject mysite", "startapp blog"],
  },
  {
    id: "req-03",
    series: "Request cycle",
    title: "POST a form",
    intro:
      "Forms validate input before you touch the database. Define blog.ContactForm with name and email fields, then POST is ready to be cleaned.",
    goals: [
      { type: "hasForm", app: "blog", name: "ContactForm" },
    ],
    par: 1,
    hint: "form blog ContactForm name:CharField email:EmailField",
    start: ["startproject mysite", "startapp blog"],
  },

  // ——— Admin & polish ———
  {
    id: "admin-01",
    series: "Admin & polish",
    title: "Register the admin",
    intro:
      "admin.site.register is how staff edit data without writing CRUD. Register blog.Post after the model exists.",
    goals: [{ type: "hasAdmin", app: "blog", model: "Post" }],
    par: 1,
    hint: "admin blog Post",
    start: [
      "startproject mysite",
      "startapp blog",
      "model blog Post title:CharField body:TextField",
    ],
  },
  {
    id: "admin-02",
    series: "Admin & polish",
    title: "Ship a listing page",
    intro:
      "Finish the feature: model → migrate → url → view → template → request /blog/. Match par if you can. This is the whole Django loop.",
    goals: [
      { type: "migrated", app: "blog" },
      { type: "hasUrl", path: "/blog/" },
      { type: "hasTemplate", path: "blog/post_list.html" },
      { type: "hasMiddleware", name: "CommonMiddleware" },
      { type: "requestOk", path: "/blog/" },
    ],
    par: 8,
    hint:
      "model blog Post title:CharField  ·  makemigrations  ·  migrate  ·  url /blog/ blog.post_list  ·  view blog post_list template:blog/post_list.html  ·  template blog post_list.html  ·  middleware Common  ·  request /blog/",
    start: ["startproject mysite", "startapp blog"],
  },
];

const SERIES_ORDER = ["Foundations", "ORM", "Request cycle", "Admin & polish"];

/**
 * Group levels by series for the browser dialog.
 *
 * @param {Array<Level>} levels - Level list.
 * @returns {Array<{series: string, levels: Level[]}>} Grouped series.
 */
function groupBySeries(levels) {
  return SERIES_ORDER.map((series) => ({
    series,
    levels: levels.filter((l) => l.series === series),
  })).filter((g) => g.levels.length > 0);
}

/**
 * Find a level by id.
 *
 * @param {string} id - Level id.
 * @returns {Level|undefined} Level or undefined.
 */
function findLevel(id) {
  return LEVELS.find((l) => l.id === id);
}

/**
 * Goal label for the checklist UI.
 *
 * @param {object} goal - Goal descriptor.
 * @returns {string} Human label.
 */
function goalLabel(goal) {
  switch (goal.type) {
    case "hasProject":
      return `project ${goal.name}`;
    case "hasApp":
      return `app ${goal.name}`;
    case "hasModel":
      return `model ${goal.app}.${goal.name}`;
    case "hasField":
      return `${goal.model}.${goal.field}: ${goal.fieldType || "field"}`;
    case "migrated":
      return `migrate ${goal.app}`;
    case "hasUrl":
      return `url ${goal.path}`;
    case "hasView":
      return `view ${goal.app}.${goal.name}`;
    case "hasTemplate":
      return `template ${goal.path}`;
    case "requestOk":
      return `GET ${goal.path} → 200`;
    case "hasMiddleware":
      return `middleware ${goal.name}`;
    case "hasAdmin":
      return `admin ${goal.model}`;
    case "hasForm":
      return `form ${goal.app}.${goal.name}`;
    case "hasQuery":
      return goal.kind === "create" ? "create a row" : "run a filter";
    case "hasRelated":
      return "follow a ForeignKey (related)";
    default:
      return goal.type;
  }
}

// Browser + Node export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { LEVELS, SERIES_ORDER, groupBySeries, findLevel, goalLabel };
} else {
  window.LearnDjangoLevels = {
    LEVELS,
    SERIES_ORDER,
    groupBySeries,
    findLevel,
    goalLabel,
  };
}
