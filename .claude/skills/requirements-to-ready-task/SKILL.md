---
name: requirements-to-ready-task
description: Consolidate product input into a reviewable PRD and technical task contract for Rahza's projects. Use for feature intake, product decisions, and preparing approved work for implementation.
---

# Requirements to ready task

Use the existing task and project documents as the source of truth. Read the relevant sections of `/pilot-documents/WORK-TEMPLATES.md` and `WORK-PIPELINES.md`; do not load unrelated project histories.

Keep product definition and technical planning separate. For a feature, record the user problem, intended user, outcome, scope and exclusions, acceptance criteria with stable IDs, constraints and open decisions. For a small fix, a task with acceptance checks is sufficient.

Inspect the repository to answer technical facts. Batch unresolved product or consequential technical decisions into one concise request with options, a recommendation and its tradeoff. Link previous answers; do not ask the user to repeat them. Absence of a reply is not approval.

After product approval, prepare the technical plan: affected components, data/interface changes, dependencies, validation and risks. Link the exact approved product and technical revisions in each executable task, along with covered acceptance criteria, repository/base revision, prerequisites and completion evidence.

Use Paperclip's existing plan-to-task capability when available for creating the task graph. Avoid duplicate tasks and document copies. Label unresolved work as draft or blocked with the specific missing decision. Agents can implement, test and open PRs within approved scope; Rahza owns product decisions, consequential technical choices and merges.

Return the updated artifact links, changes since the last review, and only the decisions needed next. An alternative suggested to save code must not silently replace approved behavior.
