#!/bin/bash
# =============================================================================
# health-pulse.sh — Compute codebase health metrics for archival
# =============================================================================
#
# Usage: bash scripts/health-pulse.sh
#
# Outputs all metrics for the Codebase Health Pulse table.
# Run this before archiving any RUN and paste output into the archive entry.
#
# See: docs/ARCHITECTURE_CONSTRAINTS.md → "Codebase Health Pulse"
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== Codebase Health Pulse ==="
echo ""

# 1. Code duplication
echo "--- Code Duplication (jscpd 5/50) ---"
npx jscpd packages/ platforms/ apps/ \
  --ignore "**/.venv/**,**/node_modules/**,**/runs/**,**/.git/**,**/dist/**,**/build/**,**/coverage/**" \
  --min-lines 5 --min-tokens 50 \
  --reporters console 2>/dev/null | grep -E "^(Format|Total)" || echo "jscpd not available"
echo ""

# 2. Source statements (executable lines excluding docs/comments/blanks)
echo "--- Source Statements ---"
SOURCE_STATEMENTS=$(find packages/ platforms/cloudflare/src/ -name "*.ts" -not -name "*.test.ts" -not -name "*.d.ts" \
  -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/__tests__/*" \
  | xargs grep -v '^\s*$' | grep -v '^\s*//' | grep -v '^\s*\*' | grep -v '^\s*/\*' | wc -l 2>/dev/null)
echo "Source statements (approx): $SOURCE_STATEMENTS"

# 3. Test statements
echo "--- Test Statements ---"
TEST_STATEMENTS=$(find packages/ platforms/cloudflare/src/ -name "*.test.ts" -o -name "*.test.tsx" \
  -not -path "*/node_modules/*" -not -path "*/dist/*" \
  | xargs grep -v '^\s*$' | grep -v '^\s*//' | grep -v '^\s*\*' | grep -v '^\s*/\*' | wc -l 2>/dev/null)
echo "Test statements (approx): $TEST_STATEMENTS"

# 4. Test:source ratio
if [ "$SOURCE_STATEMENTS" -gt 0 ] 2>/dev/null; then
  RATIO=$(echo "scale=2; $TEST_STATEMENTS / $SOURCE_STATEMENTS" | bc 2>/dev/null || echo "N/A")
  echo "Test:source ratio: $RATIO"
fi
echo ""

# 5. Docstring/comment lines
echo "--- Docstring:Code Ratio ---"
DOC_LINES=$(find packages/ platforms/cloudflare/src/ apps/web/ -name "*.ts" -o -name "*.tsx" \
  -not -path "*/node_modules/*" -not -path "*/dist/*" \
  | xargs grep -c '^\s*\*\|^\s*//\|^\s*/\*' 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
echo "Doc/comment lines: $DOC_LINES"
if [ "$SOURCE_STATEMENTS" -gt 0 ] 2>/dev/null; then
  DOC_RATIO=$(echo "scale=2; $DOC_LINES / $SOURCE_STATEMENTS" | bc 2>/dev/null || echo "N/A")
  echo "Docstring:code ratio: $DOC_RATIO"
fi
echo ""

# 6. Cross-reference density
echo "--- Cross-Reference Tags ---"
DOWNSTREAM=$(grep -r "@downstream" packages/ platforms/ apps/ --include="*.ts" --include="*.tsx" -l 2>/dev/null | wc -l)
UPSTREAM=$(grep -r "@upstream" packages/ platforms/ apps/ --include="*.ts" --include="*.tsx" -l 2>/dev/null | wc -l)
TESTED_BY=$(grep -r "@tested_by" packages/ platforms/ apps/ --include="*.ts" --include="*.tsx" -l 2>/dev/null | wc -l)
PATTERN=$(grep -r "@pattern" packages/ platforms/ apps/ --include="*.ts" --include="*.tsx" -l 2>/dev/null | wc -l)
TOTAL_TAGS=$((DOWNSTREAM + UPSTREAM + TESTED_BY + PATTERN))
echo "Cross-reference tags: $TOTAL_TAGS (@downstream: $DOWNSTREAM, @upstream: $UPSTREAM, @tested_by: $TESTED_BY, @pattern: $PATTERN)"
echo ""

# 7. TypeScript errors
echo "--- TypeScript Errors ---"
TS_ERRORS=$(npx tsc --noEmit -p platforms/cloudflare/tsconfig.json 2>&1 | grep "error TS" | wc -l)
echo "TS errors: $TS_ERRORS"
echo ""

# 8. Platform line count
echo "--- Platform Lines ---"
PLATFORM_LINES=$(find platforms/cloudflare/src/ -name "*.ts" -not -path "*/node_modules/*" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
echo "Platform lines: $PLATFORM_LINES"
echo ""

# 9. Circular deps (basic check)
echo "--- @ts-nocheck / Suppressions ---"
TS_NOCHECK=$(grep -rl "@ts-nocheck" packages/ platforms/ apps/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
echo "@ts-nocheck files: $TS_NOCHECK"
echo ""

echo "=== End Health Pulse ==="
