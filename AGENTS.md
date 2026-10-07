# AGENTS.md — Working Rules for Coding Agents

This repository is built and maintained by autonomous and semi-autonomous coding agents. All agents MUST adhere to these operating principles.

> **Active plan: `REPAIR_PLAN.md`.** Execute one vertical slice at a time, in order. It supersedes the V2 work order in `TASKS.md`. Do not work on any other plan.

---

## 1. Operating Protocol

1. **Read `PROJECT_STATE.md` First**: Always inspect `PROJECT_STATE.md` at the start of a turn to determine the active project phase, active task, and recent architectural decisions.
2. **Consult `TASKS.md`**: Pick or resume only the active task. Strictly execute within the task's defined scope, acceptance criteria, and dependencies.
3. **Repository State Over Chat History**: Treat code, configuration, and documentation in this repository as the sole authoritative truth—never rely on stale chat memory or assumptions.
4. **Read Minimally**: Load only the files, schemas, and tests directly needed for your current task to conserve context tokens.
5. **Protect Working Code**: Do not refactor, rewrite, or alter unrelated working code or tests outside your task scope.
6. **Preserve API Contracts**: Maintain existing schemas, endpoints, and data contracts between frontend and backend unless the active task explicitly demands a migration.
7. **Verify Before Completion**: Run all relevant tests (backend unit tests, linters, frontend type checks/builds) before marking any task `DONE`.
8. **Keep Secrets Out**: Never write, commit, or log credentials, API keys, or private datasets. Use environment variables defined in `.env.example`.
9. **Update State Immediately**: Upon completing a task or milestone, update `TASKS.md` (status `DONE`) and keep `PROJECT_STATE.md` concise and synchronized.
10. **Stop at Real Blockers**: If an external dependency fails, requirements conflict, or a critical blocker arises, document the issue under Blockers in `PROJECT_STATE.md` and stop—do not invent speculative workarounds.
11. **Read `CODEMAP.md` First**: Use it to locate which file to open. Never read whole directories; open only the specific files the current slice names.
12. **Search, Don't Browse**: Use `grep`/`ripgrep` to find code by name or pattern. Never scan an entire directory tree to find something.
13. **Keep `CODEMAP.md` Updated**: When a slice adds, moves, or deletes files, update `CODEMAP.md` in the same commit.

---

## 2. Project Lifecycle Phases

The project progresses sequentially through these discrete phases. The current active phase is governed strictly by `PROJECT_STATE.md`:

1. **PREPARATION**: Repository foundation, architecture specification, requirements mapping, task planning.
2. **INTAKE**: Ingesting datasets, schema extraction, normalization into canonical internal representations.
3. **PLANNING**: Generation plan formulation, synthesizer selection, constraint resolution.
4. **IMPLEMENTATION**: Backend synthesizers, metrics, API endpoints, and frontend components.
5. **INTEGRATION**: End-to-end communication between frontend and backend services.
6. **DEPLOYMENT**: Containerization, serverless/cloud hosting setup, production build validation.
7. **FINAL_QA**: End-to-end user verification against hackathon judging criteria.

---

## 3. Scope Discipline & Conflict Hierarchy

When encountering any uncertainty or conflicting guidance:
1. **OFFICIAL-PDF** (`Synthetic Data Platform — HackDataV2.pdf`) is authoritative on product vision, core engines, and judging criteria.
2. **ORGANIZER-PROVIDED** rules are authoritative on specific evaluation mandates.
3. **PRODUCT-DECISION** documents implementation choices, tech stack, and fallback behaviors.
4. Do not invent requirements outside these sources.

