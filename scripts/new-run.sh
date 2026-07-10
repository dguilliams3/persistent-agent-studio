#!/bin/bash

# ============================================================================
# new-run.sh - Create a new RUN directory for task tracking
# ============================================================================
#
# Usage:
#   ./scripts/new-run.sh <description-slug>
#
# Example:
#   ./scripts/new-run.sh add-telegram-commands
#   ./scripts/new-run.sh fix-image-compression
#
# Creates:
#   runs/RUN-YYYYMMDD-HHMM-<description-slug>/
#   runs/RUN-YYYYMMDD-HHMM-<description-slug>/TASK_LOG.md
#
# See CLAUDE.md "Task Tracking Protocol" for details.
# ============================================================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the project root (assumes script is in scripts/ subdirectory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNS_DIR="$PROJECT_ROOT/runs"

# Check if description slug was provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: No description slug provided${NC}"
    echo ""
    echo "Usage: $0 <description-slug>"
    echo ""
    echo "Examples:"
    echo "  $0 add-telegram-commands"
    echo "  $0 fix-image-compression"
    echo "  $0 refactor-action-parser"
    echo ""
    echo -e "${YELLOW}Rules:${NC}"
    echo "  - Use lowercase letters and hyphens only"
    echo "  - Keep it to 3-5 words max"
    echo "  - Be descriptive but concise"
    exit 1
fi

DESCRIPTION_SLUG="$1"

# Validate slug format (lowercase, hyphens, no spaces or special chars)
if [[ ! "$DESCRIPTION_SLUG" =~ ^[a-z0-9-]+$ ]]; then
    echo -e "${RED}Error: Invalid description slug format${NC}"
    echo ""
    echo "The slug must contain only:"
    echo "  - Lowercase letters (a-z)"
    echo "  - Numbers (0-9)"
    echo "  - Hyphens (-)"
    echo ""
    echo "Got: $DESCRIPTION_SLUG"
    exit 1
fi

# Get current timestamp
# Format: YYYYMMDD-HHMM for directory name
TIMESTAMP=$(date +"%Y%m%d-%H%M")

# Format: YYYY-MM-DD HH:MM EST for log entries
TIMESTAMP_READABLE=$(TZ="America/New_York" date +"%Y-%m-%d %H:%M EST")

# Create directory name
RUN_DIR_NAME="RUN-$TIMESTAMP-$DESCRIPTION_SLUG"
RUN_DIR_PATH="$RUNS_DIR/$RUN_DIR_NAME"

# Check if directory already exists
if [ -d "$RUN_DIR_PATH" ]; then
    echo -e "${RED}Error: Directory already exists: $RUN_DIR_PATH${NC}"
    exit 1
fi

# Create the run directory
echo -e "${BLUE}Creating RUN directory...${NC}"
mkdir -p "$RUN_DIR_PATH"

# Create TASK_LOG.md with template
echo -e "${BLUE}Creating TASK_LOG.md...${NC}"
cat > "$RUN_DIR_PATH/TASK_LOG.md" << EOF
# Task Log: $RUN_DIR_NAME - [Task Title]

**Created:** $TIMESTAMP_READABLE
**Status:** PLANNED
**Working Directory:** runs/$RUN_DIR_NAME/

---

## Objective

[Clear statement of what needs to be accomplished]

---

## Progress Timeline

### $TIMESTAMP_READABLE - Task Created
Task directory initialized. Ready to begin work.

---

## Files Created/Modified

- (No files modified yet)

---

## Blockers (if any)

- [ ] (No blockers currently)

---

## Summary

[Final summary when task is complete]
EOF

echo ""
echo -e "${GREEN}✓ Task directory created successfully!${NC}"
echo ""
echo -e "${BLUE}Location:${NC} $RUN_DIR_PATH"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Edit TASK_LOG.md to add task title and objective"
echo "  2. Update status to IN_PROGRESS when you start working"
echo "  3. Add progress entries as you work"
echo "  4. When complete, update status to COMPLETED and add entry to runs/ARCHIVE.md"
echo ""
echo -e "${BLUE}Quick commands:${NC}"
echo "  # Edit task log"
echo "  code \"$RUN_DIR_PATH/TASK_LOG.md\""
echo ""
echo "  # Create subagent directory (for parallel work)"
echo "  mkdir -p \"$RUN_DIR_PATH/subagents/\$(date +\"%Y%m%d-%H%M\")-subtask-name\""
echo ""
echo -e "${YELLOW}Remember:${NC}"
echo "  - Add timestamped progress entries (format: YYYY-MM-DD HH:MM EST)"
echo "  - Document all files created/modified"
echo "  - Include deployment/verification details"
echo "  - Archive to runs/ARCHIVE.md when completed"
echo ""
