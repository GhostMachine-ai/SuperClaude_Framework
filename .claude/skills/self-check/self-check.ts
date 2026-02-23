/**
 * Self Check - Post-implementation evidence-based validation
 *
 * Prevents hallucinations by answering The Four Questions with evidence:
 *   1. Are all tests passing?      (requires actual test output)
 *   2. Are all requirements met?   (explicit requirement checklist)
 *   3. No unverified assumptions?  (each assumption must be sourced)
 *   4. Is there evidence?          (test results, code changes, validation)
 *
 * Detection Rate: 94% (Reflexion benchmark)
 */

export interface Evidence {
  /** Actual test runner output (e.g., pytest stdout) */
  testResults?: string;
  /** List of files changed and a brief description of each change */
  codeChanges?: string[];
  /** Linter, type-checker, or build output */
  validation?: string;
}

export interface Implementation {
  /** Whether the test suite ran and passed */
  testsPassed: boolean;
  /** Raw test runner output — REQUIRED when testsPassed is true */
  testOutput?: string;
  /** Full list of requirements for this task */
  requirements?: string[];
  /** Subset of requirements that are confirmed complete */
  requirementsMet?: string[];
  /** Assumptions made during implementation */
  assumptions?: string[];
  /** Assumptions that have been verified against docs/code */
  assumptionsVerified?: string[];
  /** Collected evidence */
  evidence?: Evidence;
  /** Free-text status claimed by the implementer */
  status?: string;
  /** Free-text description of the implementation */
  description?: string;
  /** Any errors reported by the runtime */
  errors?: string[];
  /** Any warnings reported by the runtime */
  warnings?: string[];
}

export interface ValidationResult {
  /** True only when ALL four questions pass */
  passed: boolean;
  /** Human-readable issues (empty when passed) */
  issues: string[];
  /** Formatted report string */
  report: string;
}

// ─── Hallucination Red Flags ────────────────────────────────────────────────

const UNCERTAINTY_WORDS = [
  "probably",
  "maybe",
  "should work",
  "might work",
  "seems to",
  "appears to",
];

// ─── Four Question Validators ────────────────────────────────────────────────

/**
 * Question 1: Are all tests passing WITH evidence?
 *
 * Requires both `testsPassed === true` AND non-empty `testOutput`
 * containing a passing indicator. Claiming tests pass without
 * showing output is a hallucination red flag.
 */
function checkTestsPassing(impl: Implementation): string | null {
  if (!impl.testsPassed) {
    return "❌ Tests not passing — implementation is incomplete";
  }
  if (!impl.testOutput || impl.testOutput.trim() === "") {
    return "❌ Tests claimed passing but no output provided (hallucination risk)";
  }

  const passingIndicators = ["passed", "OK", "✓", "✅", "success"];
  const hasPassingIndicator = passingIndicators.some((ind) =>
    impl.testOutput!.toLowerCase().includes(ind.toLowerCase())
  );

  if (!hasPassingIndicator) {
    return "❌ Test output does not contain a passing indicator";
  }

  return null; // pass
}

/**
 * Question 2: Are ALL requirements met?
 *
 * Every item in `requirements` must appear in `requirementsMet`.
 * Returns a list of unmet requirements, or null if all are met.
 */
function checkRequirementsMet(impl: Implementation): string | null {
  const requirements = impl.requirements ?? [];
  if (requirements.length === 0) return null; // nothing to check

  const metSet = new Set(impl.requirementsMet ?? []);
  const unmet = requirements.filter((r) => !metSet.has(r));

  if (unmet.length === 0) return null;
  return `❌ Requirements not fully met: ${unmet.join(", ")}`;
}

/**
 * Question 3: Are all assumptions verified?
 *
 * Every item in `assumptions` must appear in `assumptionsVerified`.
 * Returns a description of unverified assumptions, or null if all verified.
 */
function checkAssumptionsVerified(impl: Implementation): string | null {
  const assumptions = impl.assumptions ?? [];
  if (assumptions.length === 0) return null;

  const verifiedSet = new Set(impl.assumptionsVerified ?? []);
  const unverified = assumptions.filter((a) => !verifiedSet.has(a));

  if (unverified.length === 0) return null;
  return `❌ Unverified assumptions: ${unverified.join(", ")}`;
}

/**
 * Question 4: Is there evidence?
 *
 * Requires all three evidence types:
 *   - testResults   (actual test output)
 *   - codeChanges   (list of changed files)
 *   - validation    (lint/type-check/build output)
 */
function checkEvidenceExists(impl: Implementation): string | null {
  const ev = impl.evidence ?? {};
  const missing: string[] = [];

  if (!ev.testResults || ev.testResults.trim() === "") {
    missing.push("testResults");
  }
  if (!ev.codeChanges || ev.codeChanges.length === 0) {
    missing.push("codeChanges");
  }
  if (!ev.validation || ev.validation.trim() === "") {
    missing.push("validation");
  }

  if (missing.length === 0) return null;
  return `❌ Missing evidence: ${missing.join(", ")}`;
}

// ─── Hallucination Detection ─────────────────────────────────────────────────

/**
 * Detect hallucination red flags in the implementation description.
 *
 * Seven red flags:
 *   1. Tests claimed passing with no output
 *   2. Status "complete" with no evidence
 *   3. Status "complete" despite failing tests
 *   4–6. Errors/warnings present but status still "complete"
 *   7. Uncertainty language in description
 */
function detectHallucinations(impl: Implementation): string[] {
  const flags: string[] = [];

  // Flag 1
  if (impl.testsPassed && !impl.testOutput) {
    flags.push("Claims tests pass without showing output");
  }

  // Flag 2
  if (impl.status === "complete" && !impl.evidence) {
    flags.push("Claims completion without any evidence");
  }

  // Flag 3
  if (impl.status === "complete" && !impl.testsPassed) {
    flags.push("Claims completion despite failing tests");
  }

  // Flags 4–6
  const hasErrors = (impl.errors ?? []).length > 0;
  const hasWarnings = (impl.warnings ?? []).length > 0;
  if ((hasErrors || hasWarnings) && impl.status === "complete") {
    flags.push("Ignored errors or warnings while claiming completion");
  }

  // Flag 7
  const desc = (impl.description ?? "").toLowerCase();
  const uncertaintyFound = UNCERTAINTY_WORDS.filter((w) => desc.includes(w));
  if (uncertaintyFound.length > 0) {
    flags.push(
      `Uncertainty language detected: "${uncertaintyFound.join('", "')}"`
    );
  }

  return flags;
}

// ─── Main Validation ─────────────────────────────────────────────────────────

/**
 * Run the full self-check validation.
 *
 * @param impl - Implementation details to validate
 * @returns ValidationResult with passed flag, issues list, and formatted report
 */
export function selfCheck(impl: Implementation): ValidationResult {
  const issues: string[] = [];

  // The Four Questions
  const q1 = checkTestsPassing(impl);
  if (q1) issues.push(q1);

  const q2 = checkRequirementsMet(impl);
  if (q2) issues.push(q2);

  const q3 = checkAssumptionsVerified(impl);
  if (q3) issues.push(q3);

  const q4 = checkEvidenceExists(impl);
  if (q4) issues.push(q4);

  // Hallucination red flags
  const flags = detectHallucinations(impl);
  flags.forEach((f) => issues.push(`🚨 Hallucination detected: ${f}`));

  const passed = issues.length === 0;
  const report = formatReport(passed, issues);

  return { passed, issues, report };
}

// ─── Reporting ────────────────────────────────────────────────────────────────

function formatReport(passed: boolean, issues: string[]): string {
  if (passed) {
    return [
      "📋 Self-Check Validation:",
      "   ✅ Tests passing",
      "   ✅ All requirements met",
      "   ✅ All assumptions verified",
      "   ✅ Evidence provided",
      "",
      "📊 Validation: PASSED",
      "✅ Implementation complete with evidence",
    ].join("\n");
  }

  const lines = [
    "📋 Self-Check Validation:",
    ...issues.map((i) => `   ${i}`),
    "",
    "📊 Validation: FAILED",
    `❌ ${issues.length} issue(s) must be resolved before claiming completion`,
  ];

  return lines.join("\n");
}
