---
description: Generate realistic print shop jobs, or clear all existing jobs
---

# Generate Jobs

Generate realistic print shop jobs using the `app:jobs:generate` console command, or clear all existing jobs.

## Modes

Detect the user's intent from their message:

### 1. Clear / Purge only

If the user asks to "clear", "purge", "delete", or "remove" jobs (without generating new ones), run:

```bash
cd services/php-api && bin/console dbal:run-sql "SET FOREIGN_KEY_CHECKS=0; TRUNCATE tasks; TRUNCATE elements; TRUNCATE job_comments; TRUNCATE jobs; UPDATE schedules SET assignments='[]', version=version+1; SET FOREIGN_KEY_CHECKS=1;"
```

Report that all jobs, elements, tasks, and comments have been cleared.

### 2. Generate (default)

Use sensible defaults if not specified:
- **count**: default 50
- **from**: default today (YYYY-MM-DD)
- **to**: default 1 month from today (YYYY-MM-DD)
- **purge**: default yes (include `--purge` flag)

```bash
cd services/php-api && bin/console app:jobs:generate --count={count} --from={from} --to={to} --purge -n
```

Report the output — the command prints a database configuration summary, progress bar, and summary table with job type breakdown and totals.
