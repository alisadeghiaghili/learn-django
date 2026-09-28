/**
 * Node unit tests for the LearnDjango engine.
 *
 * Run: node tests/engine.test.js
 */

const assert = require("assert");
const engine = require("../js/engine.js");
const { LEVELS, goalLabel } = require("../js/levels.js");

let passed = 0;
let failed = 0;

/**
 * Run a named test.
 *
 * @param {string} name - Test name.
 * @param {() => void} fn - Test body.
 */
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(`     ${err.message}`);
  }
}

test("startproject + startapp creates structure", () => {
  const s = engine.createState();
  engine.runCommand(s, "startproject mysite");
  engine.runCommand(s, "startapp blog");
  assert.strictEqual(s.projectName, "mysite");
  assert.ok(s.apps.blog);
  assert.ok(engine.goalMet(s, { type: "hasApp", name: "blog" }));
});

test("model fields parse CharField and FK", () => {
  const s = engine.createState();
  engine.runCommand(s, "startproject mysite");
  engine.runCommand(s, "startapp blog");
  engine.runCommand(s, "model blog Author name:CharField");
  engine.runCommand(s, "model blog Post title:CharField author:FK.blog.Author");
  const post = s.apps.blog.models.find((m) => m.name === "Post");
  assert.strictEqual(post.fields[1].type, "ForeignKey");
  assert.strictEqual(post.fields[1].refModel, "Author");
  assert.ok(
    engine.goalMet(s, {
      type: "hasField",
      app: "blog",
      model: "Post",
      field: "author",
      fieldType: "ForeignKey",
      refModel: "Author",
    })
  );
});

test("migrate applies pending migrations", () => {
  const s = engine.createState();
  engine.runCommand(s, "startproject mysite");
  engine.runCommand(s, "startapp blog");
  engine.runCommand(s, "model blog Post title:CharField");
  engine.runCommand(s, "makemigrations");
  engine.runCommand(s, "migrate");
  assert.ok(engine.goalMet(s, { type: "migrated", app: "blog" }));
});

test("request succeeds when stack is complete", () => {
  const s = engine.createState();
  for (const line of [
    "startproject mysite",
    "startapp blog",
    "url /blog/ blog.post_list",
    "view blog post_list template:blog/post_list.html",
    "template blog post_list.html",
    "middleware Common",
    "request /blog/",
  ]) {
    const r = engine.runCommand(s, line);
    assert.ok(r.ok, `command failed: ${line} — ${r.error}`);
  }
  assert.ok(engine.goalMet(s, { type: "requestOk", path: "/blog/" }));
});

test("request 404 when unruled", () => {
  const s = engine.createState();
  engine.runCommand(s, "startproject mysite");
  engine.runCommand(s, "startapp blog");
  engine.runCommand(s, "middleware Common");
  const r = engine.runCommand(s, "request /nope/");
  assert.strictEqual(r.ok, false);
  assert.strictEqual(s.lastRequest.ok, false);
});

test("create requires migrate", () => {
  const s = engine.createState();
  engine.runCommand(s, "startproject mysite");
  engine.runCommand(s, "startapp blog");
  engine.runCommand(s, "model blog Post title:CharField");
  const r = engine.runCommand(s, "create blog.Post title=Hello");
  assert.strictEqual(r.ok, false);
  engine.runCommand(s, "makemigrations");
  engine.runCommand(s, "migrate");
  const r2 = engine.runCommand(s, "create blog.Post title=Hello");
  assert.ok(r2.ok);
  assert.ok(engine.goalMet(s, { type: "hasQuery", kind: "create" }));
});

test("filter matches created rows", () => {
  const s = engine.createState();
  for (const line of [
    "startproject mysite",
    "startapp blog",
    "model blog Post title:CharField",
    "makemigrations",
    "migrate",
    "create blog.Post title=Hello",
    "create blog.Post title=World",
    "filter blog.Post title=Hello",
  ]) {
    const r = engine.runCommand(s, line);
    assert.ok(r.ok, line);
  }
  const last = s.queries.filter((q) => q.kind === "filter").pop();
  assert.strictEqual(last.rows.length, 1);
});

test("pathMatches handles placeholders", () => {
  assert.ok(engine.pathMatches("/post/<id>/", "/post/12/"));
  assert.ok(!engine.pathMatches("/post/<id>/", "/post/12/edit/"));
  assert.ok(engine.pathMatches("/blog/", "/blog/"));
});

test("buildGraph emits lanes and dispatch edges", () => {
  const s = engine.createState();
  for (const line of [
    "startproject mysite",
    "startapp blog",
    "url /blog/ blog.post_list",
    "view blog post_list template:blog/post_list.html",
    "template blog post_list.html",
  ]) {
    engine.runCommand(s, line);
  }
  const g = engine.buildGraph(s);
  assert.ok(g.nodes.some((n) => n.lane === "url" && n.label === "/blog/"));
  assert.ok(g.nodes.some((n) => n.lane === "view" && n.label === "post_list"));
  assert.ok(g.edges.some((e) => e.kind === "dispatch"));
});

test("every shipped level has par, hint, and goal labels", () => {
  for (const level of LEVELS) {
    assert.ok(level.par >= 1, level.id);
    assert.ok(level.hint, level.id);
    assert.ok(level.goals.length >= 1, level.id);
    for (const goal of level.goals) {
      assert.ok(goalLabel(goal).length > 0);
    }
  }
});

test("every shipped level is solvable from its start script", () => {
  for (const level of LEVELS) {
    const s = engine.createState();
    for (const line of level.start || []) {
      engine.runCommand(s, line);
    }
    // Rebuild by applying the hint as a command sequence (whitespace-split safe)
    const hintCmds = level.hint.split("·").map((x) => x.trim()).filter(Boolean);
    for (const line of hintCmds) {
      const r = engine.runCommand(s, line);
      assert.ok(r.ok, `${level.id}: ${line} — ${r.error}`);
    }
    const { passed: won } = engine.checkGoals(s, level.goals);
    assert.ok(won, `${level.id} not solved by hint commands`);
  }
});

test("cloneState preserves Sets", () => {
  const s = engine.createState();
  engine.runCommand(s, "startproject mysite");
  engine.runCommand(s, "startapp blog");
  engine.runCommand(s, "model blog Post title:CharField");
  engine.runCommand(s, "makemigrations");
  engine.runCommand(s, "migrate");
  const c = engine.cloneState(s);
  assert.ok(c.migratedApps.has("blog"));
  c.migratedApps.delete("blog");
  assert.ok(s.migratedApps.has("blog"));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
