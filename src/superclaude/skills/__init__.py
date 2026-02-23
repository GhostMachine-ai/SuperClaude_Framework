"""
SuperClaude Skills

Skills are Claude Code skill definitions installed to ~/.claude/skills/.
Each skill is a directory containing:
  - SKILL.md          — manifest with name, description, and allowed-tools
  - <skill-name>.ts   — TypeScript reference implementation

Available skills:
  confidence-check    — Pre-implementation confidence assessment (≥90% required)
  self-check          — Post-implementation evidence-based validation (The Four Questions)
  reflexion           — Error learning and prevention (cross-session pattern matching)
  session-start-hook  — SessionStart hook setup for Claude Code web sessions

Install a skill:
  superclaude install-skill <skill-name>

List available skills:
  superclaude install-skill --list
"""
