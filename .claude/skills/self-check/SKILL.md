---
name: Self Check
description: Post-implementation evidence-based validation using The Four Questions. Use after completing any implementation to prevent hallucinations, verify test results, confirm requirements are met, and ensure evidence exists before claiming completion.
allowed-tools: Read, Bash, Grep, Glob
---

# Self Check Skill

## Purpose

Prevents hallucinations and incomplete implementations by running **evidence-based validation AFTER** each implementation step.

**Requirement**: All four questions must be answered with concrete evidence — not assumptions.

**Detection Rate**: 94% hallucination detection (Reflexion benchmark)

## When to Use

Use this skill AFTER implementing any task to ensure:
- All tests are actually passing (with output, not just claims)
- All requirements are met (with explicit checklist)
- No unverified assumptions remain
- Concrete evidence exists for every claim

## The Four Questions

Answer each question with **evidence**, never with assumptions.

### Question 1: Are All Tests Passing?

**Requirement**: Run tests → Show ACTUAL output

```bash
# Python
uv run pytest -v 2>&1 | tail -20

# Node.js
npm test 2>&1 | tail -20
```

✅ Pass: Show actual passing test output
❌ Fail: Any test failures → implementation NOT complete

**Anti-pattern**: Saying "tests pass" without showing output

### Question 2: Are All Requirements Met?

**Requirement**: Explicit checklist — compare implementation against each requirement

```
Requirements Checklist:
✅ Feature X implemented
✅ Error handling added
❌ Unit tests written  ← STOP: requirement not met
✅ Documentation updated
```

✅ Pass: Every requirement checked off with evidence
❌ Fail: Any unchecked requirement → NOT complete

### Question 3: No Assumptions Without Verification?

**Requirement**: Every assumption must be checked against official docs or code

```
Assumptions Verified:
✅ API endpoint verified in official docs
✅ Library version compatible (checked pyproject.toml)
❌ Rate limit assumption unverified ← STOP: must verify
```

✅ Pass: All assumptions verified with sources
❌ Fail: Any unverified assumption → investigate first

### Question 4: Is There Evidence?

**Requirement**: Provide three types of evidence

| Evidence Type | Example |
|---|---|
| **Test results** | Actual pytest/jest output showing pass/fail |
| **Code changes** | List of files modified with brief description |
| **Validation** | Lint output, type check results, build output |

✅ Pass: All three evidence types present
❌ Fail: Any missing evidence → NOT complete

## Hallucination Red Flags

Stop immediately if you detect any of these patterns:

| Red Flag | Example |
|---|---|
| Tests pass (no output) | "Tests are passing now" |
| Everything works (no evidence) | "The implementation is working correctly" |
| Complete with failing tests | "Done!" (but test output shows failures) |
| Skipped error messages | Omitting stack traces from output |
| Ignored warnings | Not mentioning lint warnings |
| Hidden failures | Showing only passing tests, hiding failures |
| Uncertainty language | "Probably works", "should be fine" |

## Validation Output Format

```
📋 Self-Check Validation:
   ✅ Tests passing (47 passed, 0 failed, 0 errors)
   ✅ All 5 requirements met
   ✅ 3 assumptions verified against official docs
   ✅ Evidence provided (test output, 4 files changed, lint clean)

📊 Validation: PASSED
✅ Implementation complete with evidence
```

When issues are found:

```
📋 Self-Check Validation:
   ✅ Tests passing (47 passed, 0 failed)
   ❌ Requirements not fully met: ['unit tests written']
   ✅ All assumptions verified
   ❌ Missing evidence: ['validation']

📊 Validation: FAILED
❌ 2 issues must be resolved before claiming completion
```

## Scoring

The implementation is only complete when **ALL** checks pass:
- Tests passing: Required (not optional)
- Requirements met: 100% must be checked off
- Assumptions verified: 100% must be verified
- Evidence present: All three types required

**There is no partial credit** — if any check fails, the implementation is not done.

## Implementation Details

The Python implementation is available in `src/superclaude/pm_agent/self_check.py` and the TypeScript reference is in `self-check.ts`, containing:

- `SelfCheck` / `selfCheck(context)` — Main validation function
- `checkTestsPassing(impl)` — Question 1 validator
- `checkRequirementsMet(impl)` — Question 2 validator
- `checkAssumptionsVerified(impl)` — Question 3 validator
- `checkEvidenceExists(impl)` — Question 4 validator
- `detectHallucinations(impl)` — Red flag detector

## ROI

**Token Savings**: Running self-check at the end of each implementation prevents shipping incomplete work, avoiding costly rework cycles.

**94% hallucination detection rate** means 94 out of 100 hallucinated "completions" are caught before the user sees them.
