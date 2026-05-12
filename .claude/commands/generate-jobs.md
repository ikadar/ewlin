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
cd services/php-api && bin/console dbal:run-sql "SET FOREIGN_KEY_CHECKS=0; TRUNCATE task_assignments; TRUNCATE setup_completion_log; TRUNCATE task_walls; TRUNCATE tasks; TRUNCATE element_walls; TRUNCATE jcf_modifications; TRUNCATE logistics_notes; TRUNCATE logistics_audits; TRUNCATE job_safety_overrides; TRUNCATE job_comments; TRUNCATE console_audit_log; TRUNCATE elements; TRUNCATE jobs; UPDATE schedules SET version = version + 1; SET FOREIGN_KEY_CHECKS=1;"
```

Report that all jobs, elements, tasks, walls, assignments, setup logs, modifications, logistics data, safety overrides, comments, and audit logs have been cleared. Schedules and scenarios are preserved (schedules just get their version bumped to invalidate caches).

### 2. Generate (default)

Use sensible defaults if not specified:
- **count**: default 150
- **from**: default today (YYYY-MM-DD)
- **to**: default 1 month from today (YYYY-MM-DD)
- **purge**: default yes (include `--purge` flag)
- **outsource-pct**: default 25 (percentage of jobs with outsourced tasks, 0-100)
- **outsource-max-days**: default 2 (max outsourcing duration in open days)
- **ref-start**: default 4400 (starting number for job references)
- **ref-prefix**: default empty (prefix for job references, e.g., "JOB-")

Only include optional flags when the user specifies a non-default value:

```bash
cd services/php-api && bin/console app:jobs:generate --count={count} --from={from} --to={to} [--outsource-pct={pct}] [--outsource-max-days={days}] [--ref-start={start}] [--ref-prefix={prefix}] --purge -n
```

Report the output — the command prints a database configuration summary, progress bar, and summary table with job type breakdown and totals.
