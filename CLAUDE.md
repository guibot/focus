# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal project management dashboard. Three-column layout: project list → task/subtask manager → notes editor. All data lives in `projects/` inside the app folder.

## Running

```bash
npm start   # → http://localhost:5000
```

No build step. `index.html` is served as a static file. `projects/` is gitignored.

`focus.service` — systemd unit. Install:

```bash
sudo cp focus.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable focus && sudo systemctl start focus
```

`PROJECTS_ROOT` defaults to `./projects`. Service pins it to `/home/g/focus/projects`.

## Architecture

**`server.js`** — Express API + static file server

| Route | Purpose |
|---|---|
| `GET /api/projects` | List project directories in `PROJECTS_ROOT` |
| `POST /api/projects` | Create new project directory |
| `DELETE /api/project` | Delete project directory (path traversal guarded) |
| `GET /api/data?path=` | Read `data.json` for a project |
| `POST /api/data` | Write `data.json` for a project |
| `GET/POST /api/config` | Persist `~/.focus_config.json` (selected path + project order) |

`PROJECTS_ROOT` defaults to `./projects` (relative to app). Override via env var.

On startup, `migrateNotes()` absorbs any legacy `notes_*.md` files into `data.json`.

**`projects/<name>/data.json`** — single file per project, all data:

```json
{
  "status": "brainstorm|developing|released|null",
  "notes": "project-level notes",
  "tasks": [
    {
      "id": "abc123",
      "title": "Task title",
      "status": "brainstorm|developing|released|null",
      "notes": "task notes",
      "subtasks": [
        { "id": "def456", "title": "Sub title", "status": null, "notes": "" }
      ]
    }
  ]
}
```

**`index.html`** — vanilla JS/CSS, no dependencies, all inline

Key JS state:
- `projects` — array from `/api/projects`
- `selectedPath` — filesystem path of selected project
- `selectedTaskId` — selected task id (null = project level)
- `selectedSubId` — selected subtask id (null = task/project level)
- `tasks` — task array for current project (includes subtasks + notes)
- `projectStatus` / `projectNotes` — top-level project fields
- `projectOrder` — persisted drag order for project list
- `unlocked` — edit mode (controlled by `LOCK_ENABLED` flag)
- `dragInfo` — active drag state for reorder

Key behaviors:
- **Status toggles** — 3 dots per item: brainstorm (blue), developing (red), released (green). Click active = deselect.
- **Drag reorder** — projects, tasks, subtasks all draggable. Project order saved to config, task order saved to `data.json`.
- **Notes** — per project/task/subtask, all embedded in `data.json`. Auto-save 1.2s after last keystroke. Only saved if `notesDirty` flag set (prevents empty file creation).
- **Lock flag** — `LOCK_ENABLED = false` in JS hides lock button and keeps app always in edit mode. Set `true` to restore lock/unlock UI.
- **Breadcrumb** — notes panel header shows `Project › Task › Subtask` for selected item.

## Design tokens

```
--bg: #111111   --accent: #d4ff4e   --accent2: #4effd4
--blue: #4e9fff   --red: #ff6b4e   --green: #4eff91
--font-ui: DM Sans   --font-mono: JetBrains Mono
```
