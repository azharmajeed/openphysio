---
name: project-checkpoint
description: Save or resume a compact project checkpoint when completing, handing off, blocking, or resuming an assigned task across agent runs.
---

# Project checkpoint

Keep one current checkpoint in the assigned task or its linked project artifact. Preserve old evidence through links rather than repeating the full conversation. Never store credentials, authentication headers or private environment values.

Record only what the next worker needs:

- Task and approved scope/version links; decisions and explicit exclusions.
- Repository, branch/worktree and last verified revision; relevant uncommitted changes and their owner.
- Completed work with file/PR links and the next concrete action.
- Validation commands, outcomes, tested revision and evidence locations; explicitly mark anything untested.
- Blockers, failed hypotheses and the missing decision or condition that permits a retry.

On resume, read the task and latest checkpoint first. Verify repository status and whether the recorded assumptions still hold. Inspect relevant files and expand investigation only as needed. Do not rerun unchanged successful checks solely because a new session started; rerun when changes or uncertainty invalidate the evidence.

Publish updates at meaningful milestones, handoff, completion or blocking. Keep PRDs and checkpoints in clear normal prose. Stop retrying an unchanged blocker; progress on independent authorized work if available, otherwise leave a precise decision request.
