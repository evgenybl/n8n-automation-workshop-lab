# The answer key

Every solution is a workflow file, and every file is run by the lab's CI on n8n 2.48.8 (`docs/HOW-THIS-WAS-TESTED.md`).
To see a solution, import it into a new workflow, or open its picture.

| Stage | Solution file | Picture | What it must do (each checked in CI) |
|---|---|---|---|
| 1 | `workflows/stage-1-solution.json` | `docs/pictures/stage-1-solution.svg` | Answer a posted enquiry with its name |
| 2 | `workflows/stage-2-solution.json` | `docs/pictures/stage-2-solution.svg` | Refuse no e-mail, a filled honeypot or no consent with 400 and the reason; let a good one pass; a refused enquiry reaches no CRM, AI step or inbox |
| 3 | `workflows/stage-3-solution.json` | `docs/pictures/stage-3-solution.svg` | The same enquiry twice: one contact, two notes, never two contacts |
| 4 | `workflows/stage-4-solution.json` | `docs/pictures/stage-4-solution.svg` | With the AI step told to invent a figure, the note carries no AI summary and says why |
| 5 | `workflows/stage-5-solution.json` | `docs/pictures/stage-5-solution.svg` | Nothing written before a decision; nothing after Reject; the contact after Approve |
| 6 | `workflows/stage-6-solution.json` | `docs/pictures/stage-6-solution.svg` | With the CRM told to fail, to be slow, or to answer wrongly: 502 with the step, the failure reported, and no contact |

Each stage's starter is the previous stage's solution with its own webhook path (a test proves that the two are the same
in every other way), so a participant who is lost can always start the next stage cleanly.

## The repairs

| Repair | Broken file | Repaired file | The cause in one line |
|---|---|---|---|
| A | `workflows/repair-a-broken.json` | `workflows/repair-a-fixed.json` | The webhook's path is `repiar-a`; the form sends to `repair-a` |
| B | `workflows/repair-b-broken.json` | `workflows/repair-b-fixed.json` | The lookup searches by name; a person who writes their name differently is "new", and the CRM refuses a second contact with 409 |
| C | `workflows/repair-c-broken.json` | `workflows/repair-c-fixed.json` | *Approved?* checks that the approval's number is not empty, which is true for every decision |
| D | `workflows/repair-d-broken.json` | `workflows/repair-d-fixed.json` | The note call has no badge header (401), and On Error `Continue` passes the failure on as a result |

A test proves that each broken file differs from its repaired file only where the cause above says (repair D's repaired
file also gives the other two CRM calls an error branch, as its fix says). The full hints, causes and fixes are in
`participant/repairs.md`; the practical check's answer is in `instructor/practical-check.md`.

## The six questions

`participant/card.md` maps each question to its stage. A good answer to any of them names a concrete thing in the
participant's own work: a trigger, a record, a check, a person, a failure.

---

*Teaching text licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/).*
