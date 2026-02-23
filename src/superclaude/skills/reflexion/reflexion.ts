/**
 * Reflexion - Error learning and prevention through cross-session pattern matching
 *
 * Records errors and solutions so that the same class of mistake is never
 * investigated twice. Works in two modes:
 *
 *   1. Lookup  — Check solutions_learned.jsonl before investigating a new error
 *   2. Record  — Append solution after root-cause analysis is complete
 *
 * Storage:
 *   - docs/memory/solutions_learned.jsonl  (append-only, grep-searchable)
 *   - docs/mistakes/[name]-YYYY-MM-DD.md  (detailed analysis for significant errors)
 *
 * Performance:
 *   - Cache hit:  ~0 tokens  (instant match)
 *   - Cache miss: 1–2K tokens (investigate once, never again)
 *   - Error recurrence rate: <10%
 *   - Solution reuse rate:   >90%
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ErrorInfo {
  /** Name of the failing test or operation */
  testName?: string;
  /** Exception / error class name (e.g., "AssertionError") */
  errorType?: string;
  /** Human-readable error message */
  errorMessage?: string;
  /** Full stack trace */
  traceback?: string;
  /** Root cause (filled in after investigation) */
  rootCause?: string;
  /** Steps taken to fix the error */
  solution?: string;
  /** How to prevent this error in future */
  prevention?: string;
  /** Why the error was missed initially */
  whyMissed?: string;
  /** Lesson for future sessions */
  lesson?: string;
  /** ISO timestamp — added automatically by recordSolution() */
  timestamp?: string;
}

export interface LookupResult {
  found: boolean;
  solution?: Pick<ErrorInfo, "rootCause" | "solution" | "prevention" | "lesson" | "timestamp">;
}

// ─── Error Signature ──────────────────────────────────────────────────────────

/**
 * Create a normalised error signature for fuzzy matching.
 *
 * Numbers are replaced with "N" so "Expected 5, got 3" and
 * "Expected 12, got 7" match as the same class of error.
 *
 * @param errorInfo - Error details
 * @returns Normalised signature string
 */
export function createErrorSignature(errorInfo: ErrorInfo): string {
  const parts: string[] = [];

  if (errorInfo.errorType) {
    parts.push(errorInfo.errorType);
  }

  if (errorInfo.errorMessage) {
    const normalised = errorInfo.errorMessage
      .replace(/\d+/g, "N")   // normalise numbers
      .slice(0, 120);          // cap length
    parts.push(normalised);
  }

  if (errorInfo.testName) {
    parts.push(errorInfo.testName);
  }

  return parts.join(" | ");
}

/**
 * Compute word-overlap similarity between two signatures.
 *
 * @param sig1 - First signature
 * @param sig2 - Second signature
 * @param threshold - Minimum overlap ratio to consider a match (default 0.7)
 * @returns True when signatures are similar enough
 */
export function matchSignatures(
  sig1: string,
  sig2: string,
  threshold = 0.7
): boolean {
  const words1 = new Set(sig1.toLowerCase().split(/\s+/).filter(Boolean));
  const words2 = new Set(sig2.toLowerCase().split(/\s+/).filter(Boolean));

  if (words1.size === 0 || words2.size === 0) return false;

  let overlap = 0;
  for (const w of words1) {
    if (words2.has(w)) overlap++;
  }

  const union = new Set([...words1, ...words2]).size;
  return overlap / union >= threshold;
}

// ─── In-Memory Lookup (Node.js / Deno) ───────────────────────────────────────

/**
 * Search a JSONL log file for a solution matching the given error.
 *
 * In a real Claude Code skill, this is called via a Bash tool:
 *
 *   grep -i "<errorType>" docs/memory/solutions_learned.jsonl | tail -10
 *
 * This TypeScript implementation is provided as a reference and for
 * environments where file I/O is available.
 *
 * @param errorInfo - Error to look up
 * @param jsonlLines - Lines from solutions_learned.jsonl (one JSON per line)
 * @returns LookupResult with found flag and solution if matched
 */
export function lookupSolution(
  errorInfo: ErrorInfo,
  jsonlLines: string[]
): LookupResult {
  const querySig = createErrorSignature(errorInfo);

  for (const line of jsonlLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let record: ErrorInfo;
    try {
      record = JSON.parse(trimmed) as ErrorInfo;
    } catch {
      continue; // skip malformed lines
    }

    const recordSig = createErrorSignature(record);
    if (matchSignatures(querySig, recordSig)) {
      return {
        found: true,
        solution: {
          rootCause: record.rootCause,
          solution: record.solution,
          prevention: record.prevention,
          lesson: record.lesson,
          timestamp: record.timestamp,
        },
      };
    }
  }

  return { found: false };
}

// ─── Solution Recording ───────────────────────────────────────────────────────

/**
 * Serialise an ErrorInfo record for appending to solutions_learned.jsonl.
 *
 * Usage (via Bash tool):
 *   echo '<output>' >> docs/memory/solutions_learned.jsonl
 *
 * @param errorInfo - Completed error record (with rootCause and solution)
 * @returns JSON string ready to append to the JSONL file
 */
export function serialiseSolution(errorInfo: ErrorInfo): string {
  const record: ErrorInfo = {
    ...errorInfo,
    timestamp: new Date().toISOString(),
  };
  return JSON.stringify(record);
}

// ─── Mistake Document ─────────────────────────────────────────────────────────

/**
 * Generate a detailed mistake Markdown document.
 *
 * Write to: docs/mistakes/[testName]-YYYY-MM-DD.md
 *
 * @param errorInfo - Completed error record
 * @returns Markdown content as a string
 */
export function createMistakeDoc(errorInfo: ErrorInfo): string {
  const date = new Date().toISOString().slice(0, 10);
  const title = errorInfo.testName ?? "unknown";

  return `# Mistake Record: ${title}

**Date**: ${date}
**Error Type**: ${errorInfo.errorType ?? "Unknown"}

---

## ❌ What Happened

${errorInfo.errorMessage ?? "No error message"}

\`\`\`
${errorInfo.traceback ?? "No traceback"}
\`\`\`

---

## 🔍 Root Cause

${errorInfo.rootCause ?? "Not analyzed"}

---

## 🤔 Why Missed

${errorInfo.whyMissed ?? "Not analyzed"}

---

## ✅ Fix Applied

${errorInfo.solution ?? "Not documented"}

---

## 🛡️ Prevention Checklist

${errorInfo.prevention ?? "Not documented"}

---

## 💡 Lesson Learned

${errorInfo.lesson ?? "Not documented"}
`;
}

// ─── Output Formatting ────────────────────────────────────────────────────────

/**
 * Format a lookup result for display.
 *
 * @param errorInfo - The error that was looked up
 * @param result - Lookup result
 * @returns Human-readable output string
 */
export function formatLookupOutput(
  errorInfo: ErrorInfo,
  result: LookupResult
): string {
  const sig = createErrorSignature(errorInfo);

  if (result.found && result.solution) {
    const ts = result.solution.timestamp
      ? ` (${result.solution.timestamp.slice(0, 10)})`
      : "";
    const lines = [
      `🔍 Reflexion Lookup: ${sig}`,
      `✅ Known error found${ts}`,
      `   Root Cause: ${result.solution.rootCause ?? "see record"}`,
      `   Solution: ${result.solution.solution ?? "see record"}`,
    ];
    if (result.solution.prevention) {
      lines.push(`   Prevention: ${result.solution.prevention}`);
    }
    return lines.join("\n");
  }

  return [
    `🔍 Reflexion Lookup: ${sig}`,
    "⚠️  No prior record found — investigating root cause...",
    "📝 Remember to record the solution once found:",
    "   echo '<json>' >> docs/memory/solutions_learned.jsonl",
  ].join("\n");
}
