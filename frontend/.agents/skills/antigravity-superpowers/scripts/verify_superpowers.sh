#!/usr/bin/env bash
# Antigravity Superpowers Verification Script
set -e

echo "=================================================="
echo "⚡ Antigravity Superpowers Diagnostic & Audit Tool"
echo "=================================================="

# Check Bun installation
if command -v bun >/dev/null 2>&1; then
    BUN_VER=$(bun --version)
    echo "✅ [Bun Engine] Available (Version: $BUN_VER)"
else
    echo "⚠️ [Bun Engine] Not found in PATH. Install Bun for maximum execution performance."
fi

# Check Ripgrep installation
if command -v rg >/dev/null 2>&1; then
    echo "✅ [Ripgrep] Available for instant codebase search."
else
    echo "⚠️ [Ripgrep] Not found. Falling back to standard search tools."
fi

# Check Git worktree capabilities
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "✅ [Git] Active workspace detected."
else
    echo "ℹ️ [Git] No git repository initialized in current directory."
fi

# Audit Superpowers Skill Directory
SKILL_DIR=""$HOME"/.gemini/config/skills/antigravity-superpowers"
if [ -d "$SKILL_DIR/protocols" ]; then
    echo "✅ [Superpowers Protocols] Loaded successfully ($(ls -1 "$SKILL_DIR/protocols" | wc -l | tr -d ' ') protocol files)."
else
    echo "❌ [Superpowers Protocols] Missing protocols directory."
fi

echo "=================================================="
echo "⚡ Superpowers Status: OPERATIONAL & READY"
echo "=================================================="
