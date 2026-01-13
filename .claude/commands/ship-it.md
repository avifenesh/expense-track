---
description: Automated PR workflow - commit, push, create PR, address reviews, merge, deploy, and validate
argument-hint: '[commit-message]'
---

# Ship It - Automated PR Workflow

**OBJECTIVE:** Complete end-to-end PR workflow from commit to deployment validation. No shortcuts - fix all issues properly.

**COMMIT MESSAGE:** $ARGUMENTS

---

## CRITICAL RULES

- **NO WORKAROUNDS**: Fix errors properly, even if not caused by your code
- **ADDRESS ALL COMMENTS**: Including minor suggestions - nothing gets skipped
- **FIX ALL CI FAILURES**: Don't merge until CI is completely green
- **WAIT FOR REVIEWS**: Give bots and humans time to review (180s between checks)
- **VALIDATE DEPLOYMENT**: Manually test deployed software before declaring success

---

## PHASE 1: COMMIT & PUSH

### 1.1 Stage All Changes

```bash
git add .
```

### 1.2 Commit with Message

Use the provided commit message or generate one based on changes:

```bash
git commit -m "$ARGUMENTS"
```

If $ARGUMENTS is empty, analyze staged changes and generate appropriate message following conventional commits.

### 1.3 Push to Remote

```bash
git push
```

If push fails, handle common issues:

- Need to pull: `git pull --rebase && git push`
- Upstream not set: `git push -u origin $(git branch --show-current)`

**Checkpoint:** Changes pushed successfully to remote branch

---

## PHASE 2: CREATE PULL REQUEST

### 2.1 Gather PR Context

- Get current branch name
- Check if PR already exists for this branch
- Get related issue number from branch name or commits
- Analyze changes to generate PR description

### 2.2 Generate PR Title & Body

**Title format:** `type: brief description (closes #issue)`

**Body format:**

```markdown
## Summary

- Bullet point of main changes
- Why this change is needed
- What problem it solves

## Changes

- File changes explained
- New functionality added
- Bug fixes included

## Testing

- [ ] All tests passing
- [ ] Manual testing performed
- [ ] Edge cases covered

## Related Issues

Closes #issue-number
```

### 2.3 Create PR

```bash
gh pr create --title "..." --body "$(cat <<'EOF'
[PR body here]
EOF
)"
```

Get PR number and URL from output.

**Checkpoint:** PR created successfully

---

## PHASE 3: INITIAL CI WAIT

### 3.1 Sleep for Initial Check

Wait 180 seconds for CI to start running:

```bash
sleep 180
```

Display countdown to user so they know what's happening.

**Checkpoint:** Initial wait complete

---

## PHASE 4: REVIEW & FIX LOOP

Loop until CI is green and no unresolved comments:

### 4.1 Check CI Status

```bash
gh pr checks <PR_NUMBER>
```

Capture all check statuses:

- ✅ Passing checks
- ❌ Failing checks
- ⏳ In progress checks

### 4.2 Get CI Details for Failures

For each failing check:

```bash
gh run view <RUN_ID>
```

Capture:

- Error messages
- Failed test names
- Build errors
- Lint violations

### 4.3 Check PR Comments

```bash
gh pr view <PR_NUMBER> --comments
```

Capture:

- All review comments
- Bot suggestions (Codecov, linters, etc.)
- Requested changes
- Unresolved threads

### 4.4 Analyze All Issues

Create comprehensive list:

1. CI failures with error details
2. Unresolved review comments (human & bot)
3. Minor suggestions that need addressing
4. Warnings that should be fixed

**NO SKIPPING**: Every item must be addressed, no matter how minor.

### 4.5 Fix Issues

For each issue:

**A. Understand the problem**

- Read error message carefully
- Check related code context
- Identify root cause

**B. Implement proper fix**

- Fix the actual issue, not symptoms
- Don't use workarounds or disable checks
- Fix errors even if they're in existing code
- Follow project patterns and best practices

**C. Verify fix locally**

- Run affected tests
- Run full test suite if needed
- Check types: `npm run check-types`
- Run linter: `npm run lint`

**D. Document fix**

- Add clear commit message explaining what and why
- Reference PR comment if addressing review feedback

### 4.6 Commit Fixes

```bash
git add .
git commit -m "fix: address PR feedback - [specific issue fixed]"
```

Use descriptive commit messages for each fix batch.

### 4.7 Sync with Main

Pull latest changes from main:

```bash
git fetch origin
git rebase origin/main
```

If conflicts, resolve them properly:

- Understand both changes
- Merge intelligently
- Test after resolution

### 4.8 Push Fixes

```bash
git push --force-with-lease
```

### 4.9 Wait and Recheck

Sleep 180 seconds for CI to re-run:

```bash
sleep 180
```

### 4.10 Loop Condition

Check status:

```bash
gh pr checks <PR_NUMBER>
gh pr view <PR_NUMBER> --comments --json reviewDecision
```

**Continue loop if ANY of:**

- CI checks failing
- CI checks still pending
- Unresolved review comments exist
- Bots have new suggestions

**Exit loop when ALL of:**

- ✅ All CI checks passing
- ✅ No unresolved comments
- ✅ Review decision is APPROVED or no blocking reviews
- ✅ Auto-review bots are satisfied

**Checkpoint:** All reviews addressed, CI green

---

## PHASE 5: MERGE TO MAIN

### 5.1 Final Pre-Merge Check

Verify everything is ready:

```bash
gh pr checks <PR_NUMBER> --watch
gh pr view <PR_NUMBER>
```

Confirm:

- All checks passing
- No merge conflicts
- Branch is up to date with main

### 5.2 Merge PR

```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
```

Use squash merge to keep main history clean.

Capture merge commit SHA for tracking deployment.

**Checkpoint:** PR merged to main

---

## PHASE 6: CLOSE RELATED ISSUE

### 6.1 Get Issue Number

Extract from PR body or branch name.

### 6.2 Verify Issue Status

```bash
gh issue view <ISSUE_NUMBER>
```

Check if it was auto-closed by merge. If not, close manually:

```bash
gh issue close <ISSUE_NUMBER> --comment "Fixed in PR #<PR_NUMBER>"
```

**Checkpoint:** Issue closed

---

## PHASE 7: CLEANUP WORKTREE

### 7.1 Return to Main Directory

```bash
cd ../expense-track
```

### 7.2 Update Main Branch

```bash
git checkout main
git pull
```

### 7.3 Remove Worktree

```bash
git worktree remove ../expense-track-<branch-name>
```

### 7.4 Prune Remote Branches

```bash
git fetch --prune
```

**Checkpoint:** Worktree cleaned up

---

## PHASE 8: MONITOR DEPLOYMENT

### 8.1 Wait for Deployment to Start

Deployment should trigger automatically on main branch push. Wait 60 seconds:

```bash
sleep 60
```

### 8.2 Check Deployment Status

Depending on deployment platform:

**For Vercel:**

```bash
vercel ls --scope <scope> | head -5
```

**For Railway:**

```bash
gh run list --branch main --limit 5
```

**For GitHub Actions Deploy:**

```bash
gh run list --workflow=deploy --branch main --limit 1
```

Monitor status until deployment completes or fails.

### 8.3 Get Deployment URL

Capture deployed application URL from deployment logs.

### 8.4 Wait for Deployment Complete

Keep checking every 30 seconds until:

- Deployment succeeds
- Deployment fails (go to Phase 9 for rollback)

Timeout after 10 minutes - if not complete, investigate.

**Checkpoint:** Deployment completed successfully

---

## PHASE 9: VALIDATE DEPLOYMENT

### 9.1 Test Critical Paths

Based on changes made, test affected functionality:

**A. Open deployed application**

- Navigate to deployment URL
- Verify app loads without errors

**B. Test changed features**

- For bug fixes: Verify bug is fixed
- For new features: Test new functionality works
- For refactors: Test affected areas still work

**C. Smoke test core flows**

- User can sign in/out
- Main features functional
- No console errors
- No visual regressions

### 9.2 Check Production Logs

Monitor for errors:

**Vercel:**

```bash
vercel logs <deployment-url> --follow
```

**Other platforms:**
Check via dashboard or CLI tools.

Watch for:

- 5xx errors
- Client-side errors
- Performance issues
- API failures

### 9.3 Document Test Results

Create checklist of what was tested:

- ✅ Features work as expected
- ✅ No new errors in logs
- ✅ Performance acceptable
- ✅ UI/UX intact

### 9.4 Handle Issues Found

**If issues found in production:**

1. **Assess severity**
   - P0 (breaking): Immediate rollback required
   - P1 (degraded): Fix fast-track
   - P2 (minor): Track for next fix

2. **For P0 issues - ROLLBACK:**

   ```bash
   git revert <merge-commit-sha>
   git push origin main
   ```

   Create hotfix issue, notify team

3. **For P1/P2 issues - CREATE FIX:**
   - Create new issue with details
   - Start new branch for fix
   - Run through this workflow again

**If no issues found:**

Proceed to final checkpoint.

**Checkpoint:** Deployment validated, production healthy

---

## PHASE 10: COMPLETION REPORT

### 10.1 Generate Summary

```markdown
## Ship It Complete ✅

**PR:** #<PR_NUMBER>
**Issue:** #<ISSUE_NUMBER>
**Deployment:** <DEPLOYMENT_URL>

### Timeline

- Committed: <timestamp>
- PR Created: <timestamp>
- Reviews Addressed: <count> rounds
- Merged: <timestamp>
- Deployed: <timestamp>
- Validated: <timestamp>

### Fixes Applied

- CI fixes: <count>
- Review comments addressed: <count>
- Total commits: <count>

### Production Status

✅ Deployment successful
✅ Manual testing passed
✅ No errors in logs
✅ All features working

### Next Steps

- Monitor production logs for 24h
- Watch for user feedback
- Check error tracking dashboard
```

### 10.2 Notify User

Display completion message with summary.

**FINAL CHECKPOINT:** Ship It workflow complete! 🚀

---

## ERROR RECOVERY

If any phase fails:

### Rollback Strategy

**During Phase 1-4 (Pre-merge):**

- Fix locally and retry
- Don't proceed to merge if CI/reviews not passing

**During Phase 5 (Merge):**

- If merge fails, check for conflicts
- Rebase and retry

**During Phase 8-9 (Deployment):**

- If deployment fails, check logs
- Rollback if needed: `git revert <SHA> && git push`

**During Phase 10 (Validation):**

- If validation finds issues, create hotfix
- Rollback if critical

### Manual Override

User can interrupt at any checkpoint with:

- `/cancel` - Stop workflow
- `/skip-validation` - Skip manual testing (NOT RECOMMENDED)
- `/force-merge` - Override checks (DANGEROUS)

---

## EXECUTION

Begin Phase 1 now with provided commit message.

If any phase encounters an error, stop and report the issue with context for debugging.
