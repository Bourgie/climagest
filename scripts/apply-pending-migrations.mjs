// Aplica migraciones pendientes directo a Postgres (sin `supabase link`, ver D5).
// Uso: node --env-file=.env.local scripts/apply-pending-migrations.mjs
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const dir = path.join(process.cwd(), "supabase", "migrations");

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
await client.connect();

const { rows: done } = await client.query(
  "select version from supabase_migrations.schema_migrations",
);
const applied = new Set(done.map((r) => r.version));

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
let count = 0;

for (const f of files) {
  const version = f.split("_")[0];
  if (applied.has(version)) continue;
  const sql = fs.readFileSync(path.join(dir, f), "utf8");
  console.log(`[migrate] aplicando ${f}...`);
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "insert into supabase_migrations.schema_migrations (version) values ($1)",
      [version],
    );
    await client.query("COMMIT");
    console.log(`[migrate] ${f} OK`);
    count++;
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`[migrate] ${f} FALLO: ${e.message}`);
    process.exitCode = 1;
    break;
  }
}

console.log(`[migrate] listo, ${count} migraciones aplicadas.`);
await client.end();
