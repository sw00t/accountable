# Improve the harness

Run this at Deploy, after the review fixes and before the merge.

1. Look at what went wrong on this change: the review's findings, what the person corrected and what the checks caught. They're in this change's sections of `docs/STATUS.md` and in `git log main..HEAD`.
2. Compare each mistake with earlier ones: the review sections of `docs/STATUS.md` and the watch list under "Harness improvements". Match the kind of mistake, not just the exact bug, and search the code for the same pattern where no review flagged it.
3. For a mistake that has happened twice, add the correction to AGENTS.md or docs/REVIEW.md, or suggest a change to docs/STANDARDS.md for the person to make. If a tool can catch it, add it to the checks instead.
4. Remove anything out of date.
5. Record the round in `docs/STATUS.md` under "Harness improvements": what changed and why, and a watch list of mistakes seen only once, so the next round can spot a second time.
6. Improve this file, so that the next round makes a better change. Keep this as the last step.
