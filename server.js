import express from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECTS_ROOT = process.env.PROJECTS_ROOT || path.join(__dirname, 'projects')
const CONFIG_FILE   = path.join(os.homedir(), '.focus_config.json')

fs.mkdirSync(PROJECTS_ROOT, { recursive: true })

const app = express()
app.use(express.json())
app.use(express.static(__dirname))

// ── helpers ────────────────────────────────────────────────────────────────

function isDir(p) {
  try { return fs.statSync(p).isDirectory() } catch { return false }
}

function scanDir(dirPath) {
  try { return fs.readdirSync(dirPath) } catch { return [] }
}

function getProjects() {
  return scanDir(PROJECTS_ROOT)
    .filter(name => !name.startsWith('.'))
    .map(name => ({ name, path: path.join(PROJECTS_ROOT, name) }))
    .filter(p => isDir(p.path))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function safeProjectPath(dir) {
  if (!dir) return null
  const resolved = path.resolve(dir)
  const root = path.resolve(PROJECTS_ROOT)
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null
  return resolved
}

function readData(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8')) }
  catch { return { status: null, notes: '', tasks: [] } }
}

// ── migration: absorb legacy notes_*.md files into data.json ───────────────

function migrateNotes() {
  for (const { path: projPath } of getProjects()) {
    const dataFile = path.join(projPath, 'data.json')
    const data = readData(projPath)
    let changed = false

    const absorb = (filePath) => {
      if (!fs.existsSync(filePath)) return ''
      const content = fs.readFileSync(filePath, 'utf8')
      fs.unlinkSync(filePath)
      changed = true
      return content
    }

    const projNotes = absorb(path.join(projPath, 'notes.md'))
    if (projNotes) data.notes = projNotes

    for (const task of (data.tasks || [])) {
      const tn = absorb(path.join(projPath, `notes_task_${task.id}.md`))
      if (tn) { task.notes = tn }
      for (const sub of (task.subtasks || [])) {
        const sn = absorb(path.join(projPath, `notes_sub_${sub.id}.md`))
        if (sn) { sub.notes = sn }
      }
    }

    if (changed) fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8')
  }
}

migrateNotes()

// ── routes ─────────────────────────────────────────────────────────────────

app.get('/api/projects', (_req, res) => {
  res.json(getProjects())
})

app.post('/api/projects', (req, res) => {
  const { name } = req.body
  const n = (name || '').trim()
  if (!n || n.startsWith('.') || /[/\\\x00]/.test(n)) return res.json({ ok: false, error: 'invalid name' })
  const dir = path.join(PROJECTS_ROOT, n)
  try {
    fs.mkdirSync(dir, { recursive: true })
    res.json({ ok: true, path: dir })
  } catch (e) { res.json({ ok: false, error: e.message }) }
})

app.delete('/api/project', (req, res) => {
  const dir = safeProjectPath(req.body.path)
  if (!dir) return res.json({ ok: false, error: 'forbidden' })
  try {
    fs.rmSync(dir, { recursive: true, force: true })
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: e.message }) }
})

app.get('/api/data', (req, res) => {
  const dir = safeProjectPath(req.query.path)
  if (!dir) return res.json({ status: null, notes: '', tasks: [] })
  res.json(readData(dir))
})

app.post('/api/data', (req, res) => {
  const { path: rawPath, status, notes, tasks } = req.body
  const dir = safeProjectPath(rawPath)
  if (!dir) return res.json({ ok: false })
  try {
    fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ status, notes: notes || '', tasks: tasks || [] }, null, 2), 'utf8')
    res.json({ ok: true })
  } catch (e) { res.json({ ok: false, error: e.message }) }
})

app.get('/api/config', (_req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))) }
  catch { res.json({}) }
})

app.post('/api/config', (req, res) => {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(req.body, null, 2), 'utf8')
    res.json({ ok: true })
  } catch { res.json({ ok: false }) }
})

// ── start ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000
app.listen(PORT, '0.0.0.0', () =>
  console.log(`focus running → http://localhost:${PORT}`)
)
