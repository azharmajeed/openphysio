# TR2: Status page: filter pills, collapsible sections, click-through to PRD and plan details
Project / milestone / feature: OpenPhysio / tooling / traceability (Azhar, 2026-11-14)
Lane: Tooling
Status: Done
Approved scope reference: Azhar 2026-11-14: "add filter button pills and collapsible sections to make it easier to use. I should be able to click on the cards to read the underlying PRD and tech details."
Approved product specification ID/version: none (developer tooling)
Approved technical plan ID/version: none
Acceptance criteria covered: none (tooling)
Repository and base branch/commit: azharmajeed/openphysio, base v0.1 (after TR1)
Relevant files/context links: scripts/status-page.mjs, scripts/status-page.test.mjs (TR1); docs/prd/*.md, docs/tech/*.md, docs/tasks/**/*.md, docs/decisions/*.md
Dependencies and required completion state: TR1 merged

Expected result: `docs/status.html` stays one self-contained file (inline CSS and JS, no network, light and dark, works on a phone). It adds:

1. **Filter pills** (sticky bar at the top; multi-select within a group, AND across groups, plus the existing text filter):
   - Milestone (v0.1, v0.2, …)
   - Lane
   - Task status (Planned, Ready, In review, Done, …)
   - AC build state
   - AC verification state

   Every pill shows its count. "Clear filters" resets them. Filters apply to the work-stream cards, the traceability ACs and the gaps lists. Sections and columns left with nothing to show are hidden.
2. **Collapsible sections:** every section (work streams, each milestone, each lane column, waves, traceability, each PRD, gaps, each gap list, documents) collapses, using `<details>`/`<summary>` with a count in the summary. There's an "Expand all / Collapse all" control.
   - Remember filters and open/closed state in localStorage, wrapped in try/catch so the page still works without it.
3. **Click-through detail panel:** clicking or pressing Enter on a card opens a side drawer on desktop, or a full-screen sheet on a phone. It closes with Esc, a close button, or a backdrop click, and is linkable by URL hash (`#task-F4`, `#ac-PRD-002-AC-5`, `#doc-TP-002`).
   - **Task card:** the task's README row (needs, size, done-when); its contract rendered from markdown if it exists, otherwise "No contract yet"; the full text of each AC it covers, linked; and the **plan sections that mention the task ID**. Find these generically: any `docs/tech/*.md` section (by heading) whose text contains the ID as a whole word. Also show its PR link.
   - **AC card:** the AC text; the PRD's title, status and the sections around it (Problem, Desired outcome, Exclusions); the covering tasks, each clickable; and the verification row with its evidence.
   - **Documents list:** clicking a PRD, TP or decision shows the whole document rendered.
   - Use a small markdown renderer written in the script: headings, paragraphs, bullet and numbered lists, tables, inline code, code blocks, bold and italics, links. Escape all HTML from source files.
   - Document text is embedded once (a JSON blob in a `<script type="application/json">`), not duplicated per card.
4. Cards look clickable (hover state, cursor, focus ring) and are keyboard accessible (tabindex, role="button", aria-expanded on toggles).

The pure parsing functions keep their tests. Add tests for the markdown renderer (escaping included) and for finding plan sections that mention a task ID.

Allowed changes: scripts/status-page.mjs, scripts/status-page.test.mjs
Explicit exclusions: no new dependencies (Node built-ins only), no docs content changes.
Setup and validation commands: pnpm lint; pnpm typecheck; pnpm test; node scripts/status-page.mjs
Required evidence/artifacts: test output; the page size in KB; a description of the manual checks done in a browser if one is available
Agent/runtime preference, if any: Claude Sonnet subagent, ponytail lite
Execution budget and retry limit: one implementation run + one repair after review
When to request a product or consequential technical decision: per EXECUTION.md escalation conditions
Completion condition: validated result + PR -> In review
Merge authority: orchestrator into v0.1 after review (D-9); Azhar for v0.1 -> main

## Checkpoint
# TR2 / run 1
Agent/runtime/model, if reported: Claude Sonnet subagent, ponytail lite
Execution host and checkout: local, ..\openphysio-wt\TR2
Base commit / current branch / latest commit: 12c5647 / feat/tr2-status-page-ux / see PR
Task/spec version: TR2 contract
Last activity time: 2026-11-14
Work completed: scripts/status-page.mjs now renders filter pills (5 groups, counts, clear), collapsible sections with counts and expand/collapse all, a click-through drawer (task, AC, document) linked by URL hash, a small markdown renderer, and plan-section lookup by task ID. Filters and open state persist in localStorage (try/catch). Tests added for the renderer, escaping and plan sections.
Uncommitted changes and where they are preserved: none after commit
Validation performed and results: pnpm lint, typecheck, test (237 passed) pass; node scripts/status-page.mjs runs on the real repo (page 373 KB). Checked in a browser: filters (AND across groups), clear, expand/collapse all, drawer open/close (Esc, button, hash), hash links for task, AC and doc, dark and light, phone width (full-screen sheet, no horizontal overflow).
Artifacts, preview, and PR links: see PR
Failures and attempts already made: none
Open decisions/blockers: none
Next action: review
Task state and reason: In review, PR open
Usage/cost, or unavailable: unavailable
