# Project state — verified 2026-09-30

Created from repository observations and completed Stage 1/2 work. AGENTS.md and TASKS.md were absent at orientation; no historical task status has been invented.

- Current phase: Stage 3 AI baseline audit complete; stopped awaiting the user's go-ahead for Stage 4. No pipeline fixes were made in Stage 3.
- V2-RELATIONAL: typed rules and regression tests added. See [Stage 2 report](backend/tools/RELATIONAL_FIXES.md) for scope, exact commands, fixture migration, and limitations.
- Raw audit summaries: baseline `SUMMARY checks=260 passed=179 failed=81`; after `SUMMARY checks=260 passed=260 failed=0`. The after fixture expresses requested requirements as typed rules; this is not a byte-identical-spec comparison.
- Raw relational test result: `39 passed in 7.73s`.
- Raw full backend result: `7 failed, 125 passed, 1 skipped, 1 warning in 34.40s`.
- All failed assertions reproduced against isolated unmodified HEAD in foundation/intelligence tests: `7 failed, 10 passed, 1 warning in 5.37s`.
- Blockers: existing raw ValueError disclosure in job failures; AI draft count expansion/clamping and invalid-count acceptance. These files were not changed in the relational stage.
- V2-INTEGRATION: **BLOCKED**. Full backend is not green; later AI/UI/E2E checks remain unverified. Provider tests used mocks only; live Gemini unverified.
- Resource discipline: memory checked before execution; numerical libraries limited to one thread; audit/tests run serially. No user applications killed, frontend builds run, or deep training enabled.
- Working tree remains uncommitted. Existing frontend/tsconfig.tsbuildinfo and untracked user files preserved. No reset, stash, discard, or deployment-file edits.

## Stage 3 verified baseline

- [Audit report](backend/tools/PROMPT_TO_SPEC_AUDIT.md), [fixed fixtures](backend/tests/fixtures/prompts/cases.json), and [raw output](backend/tools/prompt_to_spec_baseline.txt).
- Raw result: `SUMMARY prompts=25 modes=2 failed_requirements=488 unsafe_fault_responses=1 live_calls=0`; `EVAL_EXIT_CODE=1`.
- Mock scores measure preservation of authored provider metadata, not real-model prompt comprehension. Counts: `26/39`; relationships: `50/56`; semantic pairs: `119/125`; rules: `10/16`; documents: `0/2`; safety cases: `1/5`. Full metric denominators are in the report.
- Disabled mode: all prompts returned unavailable; no deterministic spec fallback exists. Manual schema validation returned HTTP 200 independently of AI. This did not exercise manual generation/download.
- Additional blocker reproduced: draft conversion errors echo a synthetic canary via raw Pydantic error text. Actual secrets were not used and saved evidence redacts the canary.
- Frozen fixture SHA256: `e3aa4fb79403766dbc4734da06f5210863df2731c9df0f03f73964437a668c35`.
- V2-INTEGRATION remains **BLOCKED**. Live Gemini unverified; mock-verified only.
