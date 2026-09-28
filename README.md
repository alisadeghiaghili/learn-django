# LearnDjango

Interactive Django architecture visualizer and tutorial — same product shape as
[learnGitBranching](https://github.com/pcottle/learnGitBranching): a client-side
sandbox, live graph, leveled challenges, and command golf.

**Live:** https://alisadeghiaghili.github.io/learn-django/

Type Django-shaped commands in the terminal. The multi-lane graph rewires as the
project grows. Run `request /blog/` and watch a pulse travel URL → View → Model → Template.

## Quick start

Open `index.html` in a browser. No build step, no backend.

```text
startproject mysite
startapp blog
model blog Post title:CharField body:TextField
makemigrations
migrate
url /blog/ blog.post_list
view blog post_list template:blog/post_list.html
template blog post_list.html
middleware Common
request /blog/
```

## Modes

| Mode | What it is |
| --- | --- |
| Sandbox | Free playground with `undo` / `reset` |
| Levels | Guided challenges with goals and par scores |

Type `levels` (or click the button) to browse the catalog. Type `hint` / `goal`
inside a level. After a clear, your command count is compared to par.

## Command reference

```text
help
startproject NAME
startapp APP
model APP Model field:Type [field:FK.Other]
field APP Model name:Type
makemigrations
migrate
url /path/ APP.view_name
view APP name [template:APP/name.html]
template APP name.html
admin APP Model
middleware Name
form APP Name field:Type
request /path/
create APP.Model field=value
filter APP.Model field=value
related APP.Model field
showsql
levels | hint | goal | undo | reset | clear | state
level <id>
```

## Levels

| Series | IDs | Teaches |
| --- | --- | --- |
| Foundations | `found-01` … `found-07` | project, app, models, migrate, URL, view, template, request |
| ORM | `orm-01` … `orm-03` | create, filter, related (N+1) |
| Request cycle | `req-01` … `req-03` | middleware, auth, forms |
| Admin & polish | `admin-01` … `admin-02` | admin registration, full loop |

## Permalinks

```text
index.html?NODEMO&level=found-01
index.html?NODEMO&command=startproject%20mysite;startapp%20blog
```

## Tests

```bash
node tests/engine.test.js
```

Engine tests cover command parsing, migrations, request routing, goal checking,
graph emission, and that every shipped level is solvable from its hint.

## Design

See [DESIGN.md](DESIGN.md) for palette, typography, layout, and the mapping to
learnGitBranching concepts.

## Project layout

```text
index.html          App shell
css/styles.css      Tokens and layout
js/engine.js        Virtual Django project + commands + goals + graph data
js/levels.js        Curriculum
js/viz.js           SVG architecture renderer
js/app.js           Terminal loop, dialogs, golf, persistence
tests/engine.test.js
```
