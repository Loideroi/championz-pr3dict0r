# Triage labels

Five canonical roles, recorded as the `Status:` line in each issue file:

| Role | String | Meaning |
|---|---|---|
| Needs triage | `needs-triage` | New; nobody has evaluated it yet |
| Needs info | `needs-info` | Blocked waiting on an answer from a human |
| Ready for agent | `ready-for-agent` | Fully specced; an AFK agent can pick it up |
| Ready for human | `ready-for-human` | Needs human judgment, review or an external action |
| Won't fix | `wontfix` | Declined; keep the file for the record |

Terminal state for completed work: `done` (with the date), plus a closing note under
`## Comments`.
