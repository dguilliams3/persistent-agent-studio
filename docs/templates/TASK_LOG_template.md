# Task Log: RUN-YYYYMMDD-HHMM - [Task Title]

**Created:** YYYY-MM-DD HH:MM EST
**Status:** PLANNED | IN_PROGRESS | COMPLETED | BLOCKED
**Working Directory:** runs/RUN-YYYYMMDD-HHMM-slug/

---

## Objective

[Clear statement of what needs to be accomplished]

---

## Progress Timeline

### YYYY-MM-DD HH:MM EST - Task Started
- Generated Run ID: RUN-YYYYMMDD-HHMM
- Created working directory
- Initial context: [brief description]

### YYYY-MM-DD HH:MM EST - [Milestone]
- What was done
- Files created/modified
- Verification performed
- Deployment ID (if applicable)

---

## Files Created/Modified

- `path/to/file.js` - [NEW|MODIFIED] - [brief description]

---

## Docstring Validation

**Report:** `docstring_validation.md` (in this directory)
**Status:** PENDING | PASSED | ISSUES_RESOLVED

| Files Validated | Issues Found | Issues Resolved |
|-----------------|--------------|-----------------|
| X               | X            | X               |

---

## Code Removed

- `path/to/file.js` - [lines X-Y] - [what was removed and why]

---

## Proposed Code Removal (Pre-Archive Review)

**Status:** PENDING_REVIEW | APPROVED | DECLINED | N/A

| File | Lines/Functions | What to Remove | Reason | Risk |
|------|-----------------|----------------|--------|------|
| `path/to/file.js` | `functionName()` or lines X-Y | Description | Why it's safe to remove | LOW/MED/HIGH |

**Notes:** [Any context about removal decisions, dependencies, or rollback considerations]

---

## Blockers (Tech Debt Discovered)

Track issues discovered during work that block progress or require future attention.

**Format:** Use TD codes for issues that need tracking beyond this task.

| TD Code | Issue | Impact | Workaround Used | Follow-up Needed |
|---------|-------|--------|-----------------|------------------|
| TD-YYYYMMDD-01 | [Description] | [What it blocks/affects] | [How you worked around it] | [YES/NO - create RUN if YES] |

**Example:**
| TD Code | Issue | Impact | Workaround Used | Follow-up Needed |
|---------|-------|--------|-----------------|------------------|
| TD-20260121-01 | D1 BLOB storage returns Array not ArrayBuffer | RAG queries fail silently | Added blobToEmbedding() converter | NO - fixed in this task |
| TD-20260121-02 | buildSystemPrompt() has 800+ lines | Hard to test/maintain | None - out of scope | YES - create extraction task |

### Blocker Details

#### TD-YYYYMMDD-NN - [Short Title]
**Discovered:** YYYY-MM-DD HH:MM EST
**Severity:** BLOCKING | HIGH | MEDIUM | LOW
**Category:** BUG | ARCHITECTURE | DEPENDENCY | PERFORMANCE | SECURITY

**Problem:**
[Detailed description of the issue]

**Impact:**
[What this blocks or affects]

**Workaround (if any):**
[How you worked around it for this task]

**Proposed Fix:**
[If known, how to properly fix it]

**Related:**
- Files: `path/to/affected.js`
- Existing debt: tech_debt.md#section-name (if applicable)
- RUN directory: (if follow-up task created)

---

## Don't Retry (Failed Approaches)

Document approaches that were tried and failed. This prevents future agents from wasting time on the same dead ends.

### Approach 1: [Name/Description]
**Tried:** YYYY-MM-DD HH:MM EST
**Outcome:** FAILED

**What was attempted:**
[Description of the approach]

**Why it failed:**
[Root cause analysis]

**Error/Evidence:**
```
[Error messages, unexpected behavior, or other evidence]
```

**Lesson learned:**
[Key takeaway for future reference]

---

### Approach 2: [Name/Description]
**Tried:** YYYY-MM-DD HH:MM EST
**Outcome:** PARTIALLY WORKED | FAILED

**What was attempted:**
[Description]

**Why it didn't work:**
[Analysis]

**What DID work (if partial):**
[Salvageable parts]

---

## Summary

[Final summary when task is complete]

---

## Archive Checklist

Before archiving, ensure:

- [ ] All tests pass (`npm run test:coverage`)
- [ ] Code duplication check passes (`npx jscpd ...`)
- [ ] Data consistency check passes (if applicable)
- [ ] Docstring validation completed
- [ ] Blockers section filled out (or marked N/A)
- [ ] Don't Retry section filled out (or marked N/A)
- [ ] Proposed Code Removal reviewed
- [ ] Follow-up tasks created for any TD codes marked "Follow-up Needed: YES"
