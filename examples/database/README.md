---
category: integrations
---

# Database

> Built-in database support with SQL template literals.

## Project Structure

```
database/
├── server.ts             # Database operations
├── tasks/
│   └── db/
│       └── migrate.ts    # Migration task
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Access the database with `useDatabase`:

```ts [server.ts]
import { defineHandler } from "nitro/h3";
import { useDatabase } from "nitro/database";

export default defineHandler(async () => {
  const db = useDatabase();

  // Create table
  await db.sql`CREATE TABLE IF NOT EXISTS users (
    "id" TEXT PRIMARY KEY,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT
  )`;

  // Insert data
  const userId = String(Math.round(Math.random() * 10_000));
  await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;

  // Query data
  const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;

  return { rows };
});
```

## Learn More

- [Database](/docs/database)
- [Tasks](/docs/tasks)
