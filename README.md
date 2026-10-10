# Daylist

Daylist is a focused, single-user task manager with a PostgreSQL backend. It keeps the everyday workflow small: capture a task, give it context, and finish it.

## Features

- Create tasks with notes, priority, and an optional due date
- Mark tasks complete and delete them
- Filter by all, open, or completed tasks
- Search task titles and notes
- Progress summary and overdue indicators
- Health, readiness, and Prometheus metrics endpoints

## Run locally

Requirements: Node.js 18+ and PostgreSQL 14+.

```bash
cd todo-app-dev
npm install
createdb todo
npm run migrate
npm start
```

Open [http://localhost:3000](http://localhost:3000).

If PostgreSQL uses a different connection, set `DATABASE_URL` before running migrations or the server:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/todo"
```

Useful commands:

```bash
npm test
npm run migrate -- --validate
```

`--validate` runs pending migrations in a transaction and rolls them back.
