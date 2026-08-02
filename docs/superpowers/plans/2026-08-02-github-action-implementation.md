# Dokion GitHub Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and launch the official `action.yml` Composite GitHub Action for Dokion, integrate step summaries, update documentation, and push to GitHub.

**Architecture:** A GitHub Composite Action (`action.yml`) in the repository root that sets up Bun, installs/runs Dokion against configured playbooks, formats evidence and reports to `$GITHUB_STEP_SUMMARY`, and enforces CI failure policies.

**Tech Stack:** GitHub Actions (Composite Action), Bun, TypeScript, Dokion CLI (`dokion validate`, `dokion run`, `dokion status`, `dokion findings`).
