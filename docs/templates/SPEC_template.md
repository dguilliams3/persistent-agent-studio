# SPEC_v1: [Task Title]

**RUN_ID:** RUN-YYYYMMDD-HHMM
**Created:** YYYY-MM-DD HH:MM EST
**Status:** Active | Superseded (see SPEC_v2.md)

---

## Objective

[Clear goal statement - what success looks like]

---

## Scope

### In Scope
- [Specific deliverable 1]
- [Specific deliverable 2]
- [Specific deliverable 3]

### Out of Scope
- [What is NOT being done and why]
- [Deferred items - may become future tasks]

---

## Constraints

### Technical Constraints
- [Platform limitations (e.g., Cloudflare Workers 10ms CPU limit)]
- [Dependency constraints (e.g., must use existing embedding service)]
- [Compatibility requirements]

### Time/Resource Constraints
- [Budget limits]
- [Timeline requirements]
- [Available APIs/services]

### Known Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk description] | LOW/MED/HIGH | LOW/MED/HIGH | [How to handle] |

---

## Approach

### High-Level Strategy
[Brief description of the chosen approach]

### Implementation Phases

#### Phase 1: [Name]
**Effort:** ~Xh
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

#### Phase 2: [Name]
**Effort:** ~Xh
- [ ] Task 1
- [ ] Task 2

### Key Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `path/to/file.js` | NEW | [Purpose] |
| `path/to/existing.js` | MODIFY | [What changes] |

---

## Decisions Made

### Decision 1: [Title]
**Date:** YYYY-MM-DD
**Options considered:**
1. Option A - [pros/cons]
2. Option B - [pros/cons]

**Choice:** Option X
**Rationale:** [Why this was chosen]

### Decision 2: [Title]
[Same format]

---

## Don't Retry (Anti-Patterns)

**Critical:** If this SPEC is superseded, document failed approaches here before creating SPEC_v2.

### Anti-Pattern 1: [Name/Description]
**Attempted in:** SPEC_v1 (or earlier)
**Why it fails:**
[Technical explanation of why this approach doesn't work]

**Evidence:**
```
[Error messages, test failures, performance data]
```

**Alternative:** [What to do instead]

---

### Anti-Pattern 2: [Name/Description]
**Attempted in:** SPEC_vN
**Why it fails:**
[Explanation]

**Evidence:**
[Data/errors]

**Alternative:** [What works]

---

## Success Criteria

### Must Have (MVP)
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]

### Should Have
- [ ] [Nice-to-have feature]
- [ ] [Polish item]

### Verification Method
- [ ] Unit tests pass
- [ ] Integration test: [describe]
- [ ] Manual verification: [describe]
- [ ] Build succeeds: `npm run build`
- [ ] Deployment succeeds (if applicable)

---

## Related Items

### Existing Code References
- `path/to/related.js` - [How it relates]
- `docs/ai_native/RELEVANT.md` - [Background info]

### Tech Debt Items
- `tech_debt.md#section-name` - [If this addresses existing debt]

### Previous Runs
- `runs/RUN-YYYYMMDD-HHMM-related/` - [If building on previous work]

---

## Notes

[Any additional context, research findings, or considerations]

---

## Revision History

| Version | Date | Status | Key Changes |
|---------|------|--------|-------------|
| v1 | YYYY-MM-DD | Active | Initial specification |
| v2 | | | (When superseded, add row) |
