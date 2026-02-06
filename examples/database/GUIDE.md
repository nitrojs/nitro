Nitro provides a built-in database layer that uses SQL template literals for safe, parameterized queries. This example creates a users table, inserts a record, and queries it back.

## Querying the Database

```ts [server.ts]
import { defineHandler } from "nitro/h3";
import { useDatabase } from "nitro/database";

export default defineHandler(async () => {
  const db = useDatabase();

  // Create users table
  await db.sql`DROP TABLE IF EXISTS users`;
  await db.sql`CREATE TABLE IF NOT EXISTS users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;

  // Add a new user
  const userId = String(Math.round(Math.random() * 10_000));
  await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;

  // Query for users
  const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;

  return {
    rows,
  };
});
```

Retrieve the database instance using `useDatabase()`. The database can be queried using `db.sql`, and variables like `${userId}` are automatically escaped to prevent SQL injection.

## Running Migrations with Tasks

Nitro tasks let you run operations outside of request handlers. For database migrations, create a task file in `tasks/` and run it via the CLI. This keeps schema changes separate from your application code.

```ts [tasks/db/migrate.ts]
import { defineTask } from "nitro/task";
import { useDatabase } from "nitro/database";

export default defineTask({
  meta: {
    description: "Run database migrations",
  },
  async run() {
    const db = useDatabase();

    console.log("Running database migrations...");

    // Create users table
    await db.sql`DROP TABLE IF EXISTS users`;
    await db.sql`CREATE TABLE IF NOT EXISTS users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;

    return {
      result: "Database migrations complete!",
    };
  },
});
```
