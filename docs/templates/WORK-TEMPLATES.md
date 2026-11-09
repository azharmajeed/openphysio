# Common product-to-implementation templates

Date: 2026-09-19
Status: Proposed templates. Use with WORK-SYSTEM-PRD.md and WORK-PIPELINES.md. Unfilled fields and drafted tasks are not execution approval.

## Minimum user input

Ask for the desired outcome, intended user/use case, priority, known constraints, and examples of success. Infer existing technical facts from the repository and record the evidence. Batch questions whose answers materially change the product. Do not ask the user to repeat documented decisions.

Scale documentation to the change: a small fix can use a task with acceptance checks; a feature needs a PRD and plan; a project-wide direction change needs a revised brief.

## 1. Project brief

```markdown
# <Project>
Owner:
Repository and default branch:
Last verified commit/date:
Purpose and intended users:
Current milestone:
Success measure:
Priority relative to other projects:
Constraints and explicit exclusions:
Existing architecture/instructions:
Setup and validation references:
Environment and external dependencies:
Delegation policy and action-specific restrictions:
Open decisions:
```

## 2. Feature PRD

```markdown
# <Feature ID>: <Outcome>
Status: Draft | Needs decision | Approved | Superseded
Project/milestone:
Problem and evidence:
User and triggering situation:
Desired outcome and success measure:
User journey:
Included behavior:
Explicit exclusions:
Acceptance criteria with stable IDs:
  AC-1: Given ..., when ..., then ...
Failure/empty/edge cases:
Constraints:
Dependencies:
Assumptions with supporting evidence:
Open product decisions:
Approval record and approved version:
```

## 3. Technical plan

```markdown
# Implementation plan for <Feature ID / approved version>
Status: Draft | Needs technical decision | Approved | Superseded
Technical plan ID/version:
Current behavior and verified base commit:
Relevant repository instructions:
Proposed design and rationale:
Affected components:
Data/interface changes:
Compatibility and migration considerations:
External services/resources required:
Validation mapped to acceptance criteria:
Preview/review evidence:
Rollout and recovery:
Task dependency order:
Potential parallel work and shared-file conflicts:
Remaining technical uncertainties:
Product deviations requiring a decision:
Consequential technical decisions and user responses:
Technical approval record and approved version:
```

## 4. Executable task contract

```markdown
# <Task ID>: <One reviewable outcome>
Project / milestone / feature:
Status: Draft
Approved scope reference:
Approved product specification ID/version:
Approved technical plan ID/version:
Acceptance criteria covered:
Repository and base branch/commit:
Relevant files/context links:
Dependencies and required completion state:
Expected result:
Allowed changes:
Explicit exclusions:
Setup and validation commands:
Required evidence/artifacts:
Agent/runtime preference, if any:
Execution budget and retry limit:
When to request a product or consequential technical decision:
Completion condition: validated result + PR -> In review
Merge authority: user
```

An agent may propose tasks, but only eligible tasks within approved scope enter Ready. Completion criteria must describe behavior, not simply restate implementation steps.

## 5. Decision request and record

```markdown
# <Decision ID>: <Question>
Project and affected tasks:
Decision type: Product | Technical | Merge | Other explicit authorization
Why the decision is needed:
Evidence and current constraints:
Options with consequences:
Recommended option and rationale:
What can continue independently:
Decision owner:
Answer and timestamp:
Scope/version to which the answer applies:
Supersedes / superseded by:
```

Ask once, retain the answer, and revisit only when new evidence changes its applicability. A missing answer is not approval.

## 6. Run checkpoint and handoff

```markdown
# <Task ID> / <Run ID>
Agent/runtime/model, if reported:
Execution host and checkout:
Base commit / current branch / latest commit:
Task/spec version:
Last activity time:
Work completed:
Uncommitted changes and where they are preserved:
Validation performed and results:
Artifacts, preview, and PR links:
Failures and attempts already made:
Open decisions/blockers:
Next action:
Task state and reason:
Usage/cost, or unavailable:
```

## 7. Review packet

```markdown
# Review <Task ID / PR>
User-visible outcome:
Acceptance criteria and evidence:
What changed and why:
Checks passed / failed / not run, with reasons:
Preview or screenshots where relevant:
Known gaps:
Product decisions involved:
PR/base/head references:
Requested user action:
```

## Information ownership

- Briefs, specifications, plans, and project rules: versioned documents in the chosen authoritative location.
- Live task status, claims, run attempts, and decisions: the selected work tracker, with links to document versions.
- Code/PR/CI state: repository host and execution evidence, synchronized into the dashboard.
- Dashboard summaries: derived views with source links and freshness, not independent status records.

If changing models, platforms, or agents, transfer the task contract and checkpoint. Do not assume proprietary conversation state can be transferred.

## Discussion round

```markdown
# <Feature ID> / <Product or technical discussion> / Round <N>
Current draft version and previously approved baseline, if any:
New user input and evidence:
Changes since the previous round:
Questions resolved and decision links:
Remaining consequential questions:
Recommendation and alternatives:
Impact on active/queued work:
Next artifact or decision needed:
```

## Approved handoff

```markdown
# <Feature ID> / Execution handoff
Approved PRD version and user approval:
Approved technical plan version and user approval:
Milestone and acceptance criteria:
Ready task IDs and dependency order:
Allowed scope and project-specific restrictions:
Budget/concurrency/retry policy:
Verification and review evidence:
Escalation conditions:
Merge authority: user
```

Changing an approved baseline requires a new revision and impact assessment. New drafts do not silently redirect active workers.
