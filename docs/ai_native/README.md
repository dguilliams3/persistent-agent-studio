# AI-Native Reference Documentation
======================================

This directory contains documentation specifically optimized for AI/LLM consumption.
These files are designed for:

1. **Rapid context loading** - Structured sections with clear headers
2. **Minimal token usage** - ASCII diagrams, no external dependencies
3. **Pattern matching** - Consistent formats AI can learn from
4. **Code generation** - Examples that can be directly adapted

## Files in This Directory

| File | Purpose | When to Read |
|------|---------|--------------|
| `VISUAL_DIAGRAMS.md` | ASCII architecture flows | Understanding system structure |
| `CODE_PATTERNS.md` | Implementation examples | Writing new handlers/actions |
| `ACTIONS_REFERENCE.md` | Action format + pointer to the live `/tool-registry` | Implementing action handlers |
| `DOCSTRING_CONVENTIONS.md` | Code documentation standards | Writing/reviewing docstrings |
| `SUMMARIZATION.md` | Two-tier buffer system | Working on summarization |
| `CONTEXT_ASSEMBLY.md` | Context window & caching | Modifying prompt assembly |
| `RAG_SYSTEM.md` | Embeddings & retrieval | Working on semantic search |
| `BATCH_MODE.md` | Batch API (50% savings) | Working on batch processing |
| `FEATURE_CHECKLIST.md` | New feature checklist | Adding new features |
| `EMERGENCY_DEBUGGING.md` | Quick fixes | When things break |

## Design Philosophy

These docs follow patterns from production AI agent systems:

- **Titled sections** with `===` underlines for major headers
- **Enumerated lists** for AI parsing
- **ASCII art** instead of images (no external deps)
- **Code blocks** with clear "GOOD" vs "BAD" examples
- **Explicit callouts** like `CRITICAL:` or `NOTE:`

## Usage

When working on this codebase, prefer these docs over inline comments for:
- Understanding overall architecture
- Implementing new features
- Debugging flow issues
- Adding new actions

For specific implementation details, read the source files directly.
