---
name: Session Start Hook
description: Creating and developing startup hooks for Claude Code on the web. Use when the user wants to set up a repository for Claude Code on the web, create a SessionStart hook to ensure their project can run tests and linters during web sessions.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Session Start Hook Skill

## Purpose

Configures a **SessionStart hook** that runs automatically when Claude Code starts a new session. This ensures the project environment is ready: dependencies installed, linters configured, and tests available.

**Primary Use Case**: Setting up repositories for Claude Code web sessions where the environment must be bootstrapped automatically.

## When to Use

Use this skill when:
- Setting up a new repository for Claude Code on the web
- The project needs automated environment setup at session start
- Tests and/or linters must run at session initialization
- CI/CD-style checks are needed before Claude begins work

## How It Works

The SessionStart hook runs shell commands immediately when Claude Code opens a session. This skill:

1. Creates `.claude/settings.json` with hook configuration
2. Creates a `scripts/session-init.sh` bootstrap script
3. Configures the script to install dependencies, verify tooling, and run a quick health check

## Hook Configuration

### Step 1: Create `.claude/settings.json`

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/session-init.sh",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

### Step 2: Create `scripts/session-init.sh`

The bootstrap script should:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Session Start Hook ==="

# 1. Install / sync dependencies
if [ -f "pyproject.toml" ]; then
    echo "Installing Python dependencies (UV)..."
    uv sync --quiet 2>/dev/null || pip install -e ".[dev]" --quiet
fi

if [ -f "package.json" ]; then
    echo "Installing Node dependencies..."
    npm ci --silent 2>/dev/null || npm install --silent
fi

# 2. Verify linters available
echo "Checking linters..."
command -v ruff  >/dev/null 2>&1 && echo "  ✅ ruff"  || echo "  ⚠️  ruff not found"
command -v eslint>/dev/null 2>&1 && echo "  ✅ eslint" || echo "  ⚠️  eslint not found"

# 3. Quick health check (fast tests only)
echo "Running health check..."
if [ -f "pyproject.toml" ]; then
    uv run pytest -x -q --tb=no -m "not slow" 2>/dev/null \
        && echo "  ✅ Tests healthy" \
        || echo "  ⚠️  Some tests failing"
fi

echo "=== Session ready ==="
```

## Timeout Guidelines

| Project Size | Recommended Timeout |
|---|---|
| Small (< 50 tests) | 30 seconds |
| Medium (50-500 tests) | 60 seconds |
| Large (> 500 tests) | 120 seconds |

Only run **fast** tests (`-m "not slow"`) in the hook — leave the full suite for explicit `make test` calls.

## Customization by Project Type

### Python (UV) Project
```bash
uv sync
uv run ruff check . --quiet
uv run pytest -x -q -m "not slow"
```

### Node.js Project
```bash
npm ci --silent
npm run lint --silent
npm test -- --passWithNoTests --silent
```

### Monorepo (Mixed)
```bash
# Install all workspaces
npm ci --silent
uv sync --quiet

# Gate on linter only (tests too slow)
npm run lint --silent
uv run ruff check . --quiet
```

## Output Format

When the hook runs successfully:
```
=== Session Start Hook ===
Installing Python dependencies (UV)...
Checking linters...
  ✅ ruff
  ✅ eslint
Running health check...
  ✅ Tests healthy
=== Session ready ===
```

## Important Notes

- The hook **must not block** the session if non-critical steps fail — use `|| true` for optional steps
- Keep total runtime under the configured timeout
- Avoid running the full test suite — target < 10 seconds for the health check portion
- The script runs from the **repository root** directory
- Hook output is visible in the Claude Code session start output

## Implementation Details

The TypeScript implementation is available in `session-start-hook.ts` for reference:

- `configureSessionStartHook(config)` — writes settings and script
- `generateInitScript(projectType)` — generates appropriate init script
- `validateHookConfig(config)` — validates configuration before writing
