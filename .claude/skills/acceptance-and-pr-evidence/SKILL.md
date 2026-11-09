---
name: acceptance-and-pr-evidence
description: Verify implemented work against its approved acceptance criteria and prepare evidence for a PR or review. Use before claiming task completion or requesting merge approval.
---

# Acceptance and PR evidence

Read the approved task contract and inspect the actual diff. Map each acceptance criterion to the changed behavior and appropriate evidence. Another agent's completion summary is a lead, not proof.

Run repository-required checks and validation proportional to the change. Prefer existing test infrastructure. For a bug, demonstrate the original failure and the corrected behavior when feasible. Do not replace required coverage with Ponytail's single-check suggestion, or add tests that only restate implementation details.

Record the command, exit/result, tested revision and relevant limitations. Distinguish test, lint, build and manual UI evidence. Reuse valid evidence for unchanged work; new edits or unresolved failures require relevant rechecks. Never infer a pass from an unfinished run or claim an untested criterion passed.

Prepare or update the PR with the user-visible outcome, scope, evidence, risks and outstanding work. Keep prose clear and include enough detail to assess the change. Flag unrelated changes without overwriting another worker's work. Product changes and consequential technical choices go to Rahza before implementation outside the approved contract.

You may open a PR within the assigned scope. Request Rahza's merge decision once the change is reviewable; do not merge or deploy. Finish with links, acceptance status and the smallest actionable blocker, if any.
