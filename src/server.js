const path = require('path');
const express = require('express');
const client = require('prom-client');
const { pool } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

client.collectDefaultMetrics();
const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
});
app.use((req, res, next) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => end({ method: req.method, route: req.route ? req.route.path : req.path, status: res.statusCode }));
  next();
});

app.get('/health', (_req, res) => res.status(500).json({ status: 'SIMULATED_FAILURE' }));
app.get('/ready', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ready' }); }
  catch { res.status(503).json({ status: 'db unavailable' }); }
});
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.get('/api/todos', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, title, notes, priority, due_date, done, created_at FROM todos ORDER BY done, due_date NULLS LAST, id');
  res.json(rows);
});
app.post('/api/todos', async (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title required' });
  const priority = req.body.priority || 'medium';
  if (!['low', 'medium', 'high'].includes(priority)) {
    return res.status(400).json({ error: 'invalid priority' });
  }
  const { rows } = await pool.query(
    `INSERT INTO todos (title, notes, priority, due_date)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, notes, priority, due_date, done, created_at`,
    [title, (req.body.notes || '').trim(), priority, req.body.due_date || null]);
  res.status(201).json(rows[0]);
});
app.put('/api/todos/:id', async (req, res) => {
  const priority = req.body.priority;
  if (priority !== undefined && !['low', 'medium', 'high'].includes(priority)) {
    return res.status(400).json({ error: 'invalid priority' });
  }
  const { rows } = await pool.query(
    `UPDATE todos
     SET done = COALESCE($1, done), title = COALESCE($2, title),
         notes = COALESCE($3, notes), priority = COALESCE($4, priority),
         due_date = COALESCE($5, due_date)
     WHERE id = $6
     RETURNING id, title, notes, priority, due_date, done, created_at`,
    [req.body.done, req.body.title && req.body.title.trim(), req.body.notes,
      priority, req.body.due_date, req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});
app.delete('/api/todos/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM todos WHERE id = $1', [req.params.id]);
  res.status(rowCount ? 204 : 404).end();
});

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'internal error' }); });

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`todo-app listening on ${port}`));
}
module.exports = app;
