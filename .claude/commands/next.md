---
description: Assess next priority tasks from GitHub Issues. Validates code status matches task status.
argument-hint: '[filter] bugs|tests|features|ui'
---

# Task Priority Assessment Protocol

**OBJECTIVE:** Identify the next most important tasks by analyzing GitHub Issues and code status. Validate actual implementation to surface truly pending tasks, not already completed work.

**FILTER:** $ARGUMENTS

---

## PHASE 1: GATHER SOURCES

### 1.1 GitHub Issues (Primary Source)

Run: `gh issue list --state open --json number,title,body,labels,assignees --limit 50`

Filter by labels if needed:

- `--label "priority/high"` - High priority tasks
- `--label "type/bug"` - Bug fixes
- `--label "type/feature"` - New features
- `--label "type/test"` - Test coverage improvements

### 1.2 Recent Activity

Run: `git log --oneline -20` to understand recent work context

---

## PHASE 2: FILTER BY SUBJECT (if provided)

If a subject filter was provided ($ARGUMENTS), focus analysis on:

- **bugs**: Error handling, edge cases, reported issues
- **tests**: Test coverage gaps, missing integration tests
- **features**: New functionality, enhancements
- **ui**: Frontend components, UX issues, accessibility

If no filter, assess all areas.

---

## PHASE 3: CODE STATUS VALIDATION

For each candidate task identified:

### 3.1 Check If Already Implemented

- Search codebase for related functions/components
- Verify the feature doesn't already exist
- Check test files for existing coverage

### 3.2 Verify Task Accuracy

- Does the task description match current code state?
- Is the task still relevant given recent changes?
- Are there hidden dependencies or blockers?

### 3.3 Identify Stale Tasks

- Tasks that claim something is broken but it works
- Tasks that reference old architecture
- Duplicate tasks covering same work

---

## PHASE 4: PRIORITY ASSESSMENT

Rank remaining valid tasks by:

1. **Impact**: How much value does this deliver?
2. **Urgency**: Is there a deadline or blocking dependency?
3. **Effort**: Can this be done quickly or is it complex?
4. **Risk**: What breaks if we don't do this?

Priority levels:

- **P0-CRITICAL**: Blocking production or security vulnerability
- **P1-HIGH**: Core functionality gap or significant user impact
- **P2-MEDIUM**: Important improvement, not blocking
- **P3-LOW**: Nice to have, can defer

---

## PHASE 5: REPORT

Generate a structured report:

### Summary

- Total tasks found across sources
- Tasks filtered out (already done, stale, duplicates)
- Tasks remaining after validation

### Recommended Next Tasks (Top 3-5)

For each task:

```
**[Priority] Task Title**
- Source: GitHub Issue #N
- Status: Verified Pending, Partially Done, or Blocked
- Why Now: Rationale for priority
- Effort Estimate: Small, Medium, or Large
- Files Likely Affected: specific paths
- Dependencies: if any
```

### Stale/Invalid Tasks Found

List any tasks that should be closed or updated because they're:

- Already implemented
- No longer relevant
- Duplicates

### Blocked Tasks

List tasks that can't proceed and why.

---

## EXECUTION NOTES

- Use subagents for parallel source gathering
- Verify claims with actual code inspection
- Don't assume - check the actual files
- If a task looks done, grep for implementation before reporting
- Reference specific file paths and line numbers where relevant

Begin Phase 1 now.
