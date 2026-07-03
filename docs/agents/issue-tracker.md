# Issue tracker: Local Markdown

Issues and PRDs for this repo live as markdown files in `.scratch/`.

## Conventions

- The build PRD is the repo-root `PRD.md`; the feature directory is
  `.scratch/championz-predictor/`
- Implementation issues are `.scratch/championz-predictor/issues/<NN>-<slug>.md`,
  numbered from `01`
- Triage state is recorded as a `Status:` line near the top of each issue file (see
  `triage-labels.md` for the role strings); a finished slice sets `Status: done`
- Comments and conversation history append to the bottom of the file under a
  `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/championz-predictor/issues/` (creating directories
if needed) and add it to the dependency table in `.scratch/championz-predictor/README.md`.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the
issue number directly.
