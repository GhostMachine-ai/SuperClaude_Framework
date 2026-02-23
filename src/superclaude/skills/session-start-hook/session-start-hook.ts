/**
 * Session Start Hook - Automated session initialization for Claude Code
 *
 * Creates a SessionStart hook that bootstraps the project environment
 * when Claude Code opens a new session:
 *   - Installs dependencies
 *   - Verifies linter availability
 *   - Runs a fast health check
 *
 * Supports Python (UV), Node.js, and mixed monorepo projects.
 */

export type ProjectType = "python" | "node" | "monorepo" | "unknown";

export interface HookConfig {
  /** Path to the init script, relative to repo root */
  scriptPath: string;
  /** Timeout in seconds before the hook is killed */
  timeoutSeconds: number;
  /** Project type used to generate the init script */
  projectType: ProjectType;
  /** Run a fast test health-check at session start */
  runHealthCheck: boolean;
  /** Additional shell commands to append to the init script */
  extraCommands?: string[];
}

export interface ClaudeSettings {
  hooks: {
    SessionStart: Array<{
      hooks: Array<{
        type: "command";
        command: string;
        timeout: number;
      }>;
    }>;
  };
}

/**
 * Build the Claude settings object for a SessionStart hook.
 *
 * @param config - Hook configuration
 * @returns Claude settings JSON object
 */
export function buildClaudeSettings(config: HookConfig): ClaudeSettings {
  return {
    hooks: {
      SessionStart: [
        {
          hooks: [
            {
              type: "command",
              command: config.scriptPath,
              timeout: config.timeoutSeconds,
            },
          ],
        },
      ],
    },
  };
}

/**
 * Generate the session initialization shell script.
 *
 * @param config - Hook configuration
 * @returns Shell script content as a string
 */
export function generateInitScript(config: HookConfig): string {
  const lines: string[] = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    'echo "=== Session Start Hook ==="',
    "",
  ];

  // Dependency installation
  switch (config.projectType) {
    case "python":
      lines.push(
        "# Install Python dependencies",
        'if [ -f "pyproject.toml" ]; then',
        '    echo "Installing Python dependencies (UV)..."',
        '    uv sync --quiet 2>/dev/null || pip install -e ".[dev]" --quiet',
        "fi",
        ""
      );
      break;

    case "node":
      lines.push(
        "# Install Node.js dependencies",
        'if [ -f "package.json" ]; then',
        '    echo "Installing Node dependencies..."',
        "    npm ci --silent 2>/dev/null || npm install --silent",
        "fi",
        ""
      );
      break;

    case "monorepo":
      lines.push(
        "# Install all workspace dependencies",
        'if [ -f "package.json" ]; then',
        '    echo "Installing Node dependencies..."',
        "    npm ci --silent 2>/dev/null || npm install --silent",
        "fi",
        'if [ -f "pyproject.toml" ]; then',
        '    echo "Installing Python dependencies (UV)..."',
        "    uv sync --quiet 2>/dev/null || true",
        "fi",
        ""
      );
      break;

    default:
      lines.push(
        "# Install dependencies (auto-detected)",
        '[ -f "package.json"   ] && (npm ci --silent 2>/dev/null || npm install --silent)',
        '[ -f "pyproject.toml" ] && (uv sync --quiet  2>/dev/null || true)',
        ""
      );
  }

  // Linter availability check
  lines.push(
    '# Verify linters are available',
    'echo "Checking linters..."',
    'command -v ruff   >/dev/null 2>&1 && echo "  ✅ ruff"   || echo "  ⚠️  ruff not found"',
    'command -v eslint >/dev/null 2>&1 && echo "  ✅ eslint" || echo "  ⚠️  eslint not found"',
    ""
  );

  // Health check (fast tests)
  if (config.runHealthCheck) {
    lines.push('echo "Running health check..."');

    if (config.projectType === "python" || config.projectType === "monorepo") {
      lines.push(
        'if [ -f "pyproject.toml" ]; then',
        '    uv run pytest -x -q --tb=no -m "not slow" 2>/dev/null \\',
        '        && echo "  ✅ Tests healthy" \\',
        '        || echo "  ⚠️  Some tests failing"',
        "fi"
      );
    }

    if (config.projectType === "node" || config.projectType === "monorepo") {
      lines.push(
        'if [ -f "package.json" ]; then',
        '    npm test -- --passWithNoTests --silent 2>/dev/null \\',
        '        && echo "  ✅ Tests healthy" \\',
        '        || echo "  ⚠️  Some tests failing"',
        "fi"
      );
    }

    lines.push("");
  }

  // Extra commands
  if (config.extraCommands && config.extraCommands.length > 0) {
    lines.push("# Additional project-specific setup");
    lines.push(...config.extraCommands);
    lines.push("");
  }

  lines.push('echo "=== Session ready ==="');
  lines.push("");

  return lines.join("\n");
}

/**
 * Detect the project type from available manifest files.
 *
 * @param manifestFiles - List of files present in repo root
 * @returns Detected project type
 */
export function detectProjectType(manifestFiles: string[]): ProjectType {
  const hasPyproject = manifestFiles.includes("pyproject.toml");
  const hasPackageJson = manifestFiles.includes("package.json");

  if (hasPyproject && hasPackageJson) return "monorepo";
  if (hasPyproject) return "python";
  if (hasPackageJson) return "node";
  return "unknown";
}

/**
 * Recommend a timeout based on project type and health-check flag.
 *
 * @param projectType - Detected or configured project type
 * @param runHealthCheck - Whether a test health-check is included
 * @returns Recommended timeout in seconds
 */
export function recommendTimeout(
  projectType: ProjectType,
  runHealthCheck: boolean
): number {
  const base: Record<ProjectType, number> = {
    python: 30,
    node: 30,
    monorepo: 60,
    unknown: 30,
  };

  const healthCheckExtra = runHealthCheck ? 30 : 0;
  return base[projectType] + healthCheckExtra;
}

/**
 * Validate the hook configuration.
 *
 * @param config - Hook configuration to validate
 * @returns Array of validation error messages (empty = valid)
 */
export function validateHookConfig(config: HookConfig): string[] {
  const errors: string[] = [];

  if (!config.scriptPath || config.scriptPath.trim() === "") {
    errors.push("scriptPath must not be empty");
  }

  if (config.timeoutSeconds <= 0) {
    errors.push("timeoutSeconds must be a positive number");
  }

  if (config.timeoutSeconds > 300) {
    errors.push(
      "timeoutSeconds should not exceed 300 (session start would be too slow)"
    );
  }

  return errors;
}
