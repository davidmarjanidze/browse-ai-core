---
name: pr-review
description: Review a pull request. Use when the user asks to review a PR, a diff, or a branch before merge.
---

# PR Review Procedure

1. Get the diff with `gh pr diff <number>` (do not read whole files unless needed).
2. Check, in order:
   - Correctness and edge cases
   - Test coverage for changed behavior
   - Security (input validation, secrets, authz)
   - Performance hot spots
   - Files over 5,000 tokens introduced by the PR (suggest splitting)
3. Report findings grouped as **Blocking**, **Should fix**, **Nit**.
4. Cite `file:line` for each finding. Keep comments short and actionable.
5. End with a one-line verdict: approve / request changes.
