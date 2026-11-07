---
name: migrations
description: Create, review, or run database/schema migrations. Use when the user mentions migrations, schema changes, or altering tables.
---

# Migration Procedure

1. Inspect the current schema with the project's CLI (for example `supabase db diff`), not by reading large dump files.
2. Write one migration per logical change. Name it `YYYYMMDDHHMM_<short_description>`.
3. Every migration must be reversible, or explicitly document why it is not.
4. For large tables: avoid locking operations, add columns as nullable first, and backfill in batches.
5. Run the migration on a local or staging database first and run `npm test`.
6. Never edit a migration that has already been applied. Add a new one instead.
