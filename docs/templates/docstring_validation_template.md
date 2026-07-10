# Docstring Validation Report

**Run ID:** RUN-YYYYMMDD-HHMM-slug
**Validated:** YYYY-MM-DD HH:MM EST
**Validator:** Claude Code

---

## Validation Criteria

1. **Accuracy:** Docstring matches actual code behavior
2. **Completeness:** New functions have all required tags
3. **Cross-references:** @upstream/@downstream tags are accurate
4. **Types:** @param and @returns types match implementation

---

## Scope

**Only validate files you MODIFIED or CREATED. Do NOT validate:**
- Files you only read
- Entire modules if you changed one function
- Unrelated code in same file

---

## Files Inventory

### Created (New Files)
- `path/to/new_file.js` - [description]

### Modified (Changed Files)
- `path/to/existing.js` - [lines X-Y changed]

### Deleted
- None (or list removed files)

---

## Validation Results

### filename.js (CREATED/MODIFIED)

#### functionName()
- Signature match: OK | ISSUE
- @param types correct: OK | ISSUE
- @returns accurate: OK | ISSUE
- @upstream/@downstream: OK | ISSUE

[Repeat for each function in modified files]

---

## Issues Found & Resolved

### Issue 1: filename.js:123 - functionName()
**Problem:** [description]
**Before:** [original docstring snippet]
**After:** [fixed docstring snippet]
**Status:** Fixed

[Repeat for each issue]

---

## Summary

| Category | Count |
|----------|-------|
| Files validated | X |
| Functions checked | X |
| Issues found | X |
| Issues resolved | X |

---

## Certification

- [ ] All docstrings validated for modified files
- [ ] All discrepancies resolved
- [ ] @upstream/@downstream tags accurate
- [ ] Ready for archive

**Validator:** Claude Code
**Completed:** YYYY-MM-DD HH:MM EST

---

## Notes for Future Validators

1. Focus on **accuracy** not **style**
2. Only validate files you **modified** (not just read)
3. Check @upstream/@downstream tags match actual call graph
4. Verify @param/@returns types match implementation
