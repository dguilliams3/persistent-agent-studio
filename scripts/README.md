# Scripts Directory

Utility scripts for the Persistent Claude project.

## Available Scripts

### new-run.sh

Creates a new RUN directory for task tracking according to the Task Tracking Protocol documented in CLAUDE.md.

**Usage:**
```bash
./scripts/new-run.sh <description-slug>
```

**Examples:**
```bash
./scripts/new-run.sh add-telegram-commands
./scripts/new-run.sh fix-image-compression
./scripts/new-run.sh refactor-action-parser
```

**What it does:**
1. Creates a timestamped directory in `runs/` with format: `RUN-YYYYMMDD-HHMM-<description-slug>/`
2. Generates a `TASK_LOG.md` file with the proper template
3. Automatically timestamps everything in Eastern Time
4. Validates slug format (lowercase, hyphens only)

**Rules for description slugs:**
- Use lowercase letters and hyphens only (no spaces, uppercase, or special characters)
- Keep it to 3-5 words max
- Be descriptive but concise

**Created structure:**
```
runs/RUN-YYYYMMDD-HHMM-<slug>/
└── TASK_LOG.md          # Pre-populated with template
```

**See also:** CLAUDE.md "Task Tracking Protocol" section for complete documentation on task management.
