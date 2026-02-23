---
name: Reflexion
description: Error learning and prevention through cross-session pattern matching. Records errors and solutions to prevent recurrence. Use when a test fails or a bug is found to look up known solutions and document new ones for future sessions.
allowed-tools: Read, Write, Grep, Glob, Bash
---

# Reflexion Skill

## Purpose

Prevents **error recurrence** by learning from past mistakes and applying known solutions instantly.

**Core Insight**: The same class of error recurs repeatedly. Recognizing and resolving it in seconds instead of minutes has compounding ROI.

**Performance**:
- Error recurrence rate: <10%
- Solution reuse rate: >90%
- Cache hit cost: ~0 tokens (instant lookup)
- Cache miss cost: 1–2K tokens (investigate once, never again)

## When to Use

Use this skill when:
- A test fails — check if this error was seen before
- A bug is found — look up root cause and solution
- An investigation is complete — document findings to prevent recurrence
- Starting work on a known-problematic area — preload relevant lessons

## How It Works

```
Error occurs
     │
     ▼
Check solutions_learned.jsonl   ──hit──▶  Apply known solution (0 tokens)
     │
    miss
     │
     ▼
Investigate root cause
     │
     ▼
Document solution → append to solutions_learned.jsonl
                 → create docs/mistakes/[name]-[date].md
```

## Storage

| Location | Format | Purpose |
|---|---|---|
| `docs/memory/solutions_learned.jsonl` | Newline-delimited JSON | Fast append-only log, grep-searchable |
| `docs/mistakes/[feature]-YYYY-MM-DD.md` | Markdown | Detailed analysis for significant errors |

## Lookup: Check for Known Solution

Before investigating a new error, search the solutions log:

```bash
# Search by error type
grep -i "AssertionError" docs/memory/solutions_learned.jsonl | tail -5

# Search by test name
grep -i "test_my_feature" docs/memory/solutions_learned.jsonl | tail -5

# Search by keyword in error message
grep -i "connection refused" docs/memory/solutions_learned.jsonl | tail -5
```

If a match is found, apply the documented solution immediately.

## Recording: Document a New Solution

After investigating a new error, record it:

```json
{
  "timestamp": "2025-11-12T10:30:00",
  "test_name": "test_api_connection",
  "error_type": "ConnectionRefusedError",
  "error_message": "Connection refused to localhost:5432",
  "root_cause": "PostgreSQL not running in test environment",
  "solution": "Run `docker-compose up -d postgres` before tests",
  "prevention": "Add postgres health-check to conftest.py fixture",
  "lesson": "Always verify external services are up in CI before test run"
}
```

Append to log:
```bash
echo '{"timestamp": "...", ...}' >> docs/memory/solutions_learned.jsonl
```

## Error Signature Matching

Two errors are considered **similar** when their signatures share ≥70% word overlap:

```
Signature = error_type + key_words(error_message) + test_name
```

Numbers are normalized (`42` → `N`) to improve match rate across different inputs.

Example:
- Stored: `AssertionError | Expected N got N | test_calculation`
- New:    `AssertionError | Expected N got N | test_math`
- Overlap: 75% → MATCH → apply stored solution

## Mistake Document Format

For significant errors with full root-cause analysis, create `docs/mistakes/[feature]-YYYY-MM-DD.md`:

```markdown
# Mistake Record: test_api_connection

**Date**: 2025-11-12
**Error Type**: ConnectionRefusedError

---

## ❌ What Happened
Connection refused to localhost:5432 during test run.

## 🔍 Root Cause
PostgreSQL container not started before test suite.

## 🤔 Why Missed
conftest.py assumed database always running.

## ✅ Fix Applied
Added `docker-compose up -d postgres` to session-init.sh.

## 🛡️ Prevention Checklist
- [ ] Add postgres health-check fixture to conftest.py
- [ ] Document required services in README

## 💡 Lesson Learned
External services must be explicitly started; never assume they are available.
```

## Output Format

**Cache hit** (known error):
```
🔍 Reflexion Lookup: AssertionError | Expected N got N
✅ Known error found (2025-10-15)
   Root Cause: Off-by-one in slice indexing
   Solution: Use end+1 when slicing inclusive ranges
   Applying solution...
```

**Cache miss** (new error):
```
🔍 Reflexion Lookup: ImportError | No module named 'redis'
⚠️  No prior record found — investigating root cause...
   [investigation happens]
📝 Recording solution to docs/memory/solutions_learned.jsonl
✅ Solution documented for future sessions
```

## Implementation Details

The Python implementation is in `src/superclaude/pm_agent/reflexion.py`.
The TypeScript reference is in `reflexion.ts`, containing:

- `lookupSolution(errorInfo)` — Search solutions log for match
- `recordSolution(errorInfo)` — Append new solution to log
- `createMistakeDoc(errorInfo)` — Write detailed mistake markdown
- `matchSignatures(sig1, sig2, threshold)` — Fuzzy signature matching
- `createErrorSignature(errorInfo)` — Normalize error into matchable string
