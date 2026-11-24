# How this lab was tested

This page uses six kinds of evidence, and keeps them apart. A kind of evidence is listed as done only when it was done;
what is owed is listed as owed.

| Kind of evidence | What it is here | State |
|---|---|---|
| Automated tests, with no container | The practice office's own tests; the static checker against every kind of bad file; the workflow files against their generator and against each other; the pictures; these pages | Done: on Windows locally and in CI, and on Linux in CI. The last local run is pasted below. |
| Every workflow file run in CI on n8n 2.48.8 | n8n and the practice office started as `compose.yaml` starts them; all 22 workflow files imported and published with n8n's own command line; every one driven through its webhook with no screen, and every answer quoted in the guides replayed and compared | Done in CI on 24 November 2026. The run and its summary are pasted below. |
| A new-user test | A first-time participant, with only the participant's folder, does every stage and repair, and every point of friction is kept | Owed. |
| An independent review | A reviewer with no part in the build | Owed. |
| The steps in n8n's own screen, walked through by a person | A person follows the participant guide on n8n's editor, stage by stage, and notes every label or step that differs | Not done. |
| Taught to a class of people | | Not done. |

**This lab has not been taught to a class of people.** Every timing in it is planned. **The steps in n8n's own screen were
written from n8n's documentation and the workflow files, and were not walked through on a screen by a person.** The flows
those steps build were run, exactly as the workflow files hold them; whether a person can build them from the steps is
what the new-user test and the walk-through will show.

---

## Automated tests, with no container

**How to run them** (Node; nothing to install, no package, no network beyond this computer's own address):

```
node --test "practice/tests/*.test.js" "tests/*.test.js"
```

The scenario tests in `tests/scenarios.test.js` are skipped here: they need n8n running, and n8n runs only in CI. The
tests in that file that need no container (that every workflow file has a scenario, and that the scenario count below is
current) run everywhere.

| Test file | What it proves |
|---|---|
| `practice/tests/office.test.js` | The practice CRM: the badge header, lookup by e-mail in any letter case and by exact name, a contact created with its first note in one call, 409 for a second contact with the same e-mail, the refusals. The faults: fail, slow (and nothing written when the caller hangs up), wrong, and invent. The AI step: the same answer every time, its rules, an invented figure never one the enquiry has, no quote marks in its answers. The inbox: a resume address needed; a decision sent to the n8n the office can reach, with the path and its signature kept; a decision made once; a decision tried again while n8n says the run is still on its way to the Wait node. The form, the setup check, reset, the pages and their content security policy, and that the office listens on 127.0.0.1 only. |
| `tests/checker.test.js` | The static checker refuses each kind of bad file (no JSON, a wrong file name, no id, a credentials block anywhere, an account or owner record, an unknown key, a node type outside the list or at another version, an address beyond the practice office, an e-mail outside example.com, an IP address, authentication, an unconnected node, a connection to nothing, two triggers, a bad path, a published file, recorded data, two nodes of one name, two files with one path or one id), and passes every file in `workflows/`. |
| `tests/workflows.test.js` | Every workflow file is what the generator writes; each starter is the previous stage's solution with only its id, name and path changed; each broken file differs from its repaired file only where its exercise says; every answer is valid JSON and repeats no free text; no node name holds a quote mark; every CRM call carries the badge header but the one repair D breaks. |
| `tests/pictures.test.js` | Every workflow file has its picture, drawn the same way every time, current, naming every node and drawing every connection; error branches dashed and labelled. |
| `tests/docs.test.js` | Plain ASCII and LF line ends in every file; no absolute path; every e-mail address at example.com; no package files; the "not taught", "planned", screen-steps and "stand-in that is not a model" lines where they belong; the planned minutes agree between the README, the run sheet and the instructor guide, and add up to 180, and each variant's sessions to 90; the debrief questions agree; links and pictures resolve; every quoted answer is marked for replay; the author line; the licence line on every teaching page; the test counts pasted on this page are current. |
| `tests/scenarios.test.js` | In CI only: see the next section. |

**The last lines of the last local run**, as printed, on Windows with Node 24:

<!-- pasted (local) from: node --test --test-reporter=tap "practice/tests/*.test.js" "tests/*.test.js" (the last lines) -->
```text
1..137
# tests 137
# suites 0
# pass 89
# fail 0
# cancelled 0
# skipped 48
# todo 0
# duration_ms 9023.5437
```

The 48 skipped are the scenario tests, which need n8n.

---

## Every workflow file run in CI on n8n 2.48.8

The workflow in `.github/workflows/ci.yml` has two jobs. **On Linux:** the tests above; the static checks; the generator
and the picture tool, each compared with the files; then n8n and the practice office started with `docker compose up -d`;
every workflow file imported and published with `node tools/load.js`, which waits until n8n is ready and then until every
webhook is live; then the scenario tests, with `LAB_LIVE=1`. **On Windows:** what needs no container: the tests, the
static checks and the picture tool. Actions are pinned by commit.

What the scenario tests do, for each workflow file: send it enquiries through its webhook, decide in the approval inbox
where the flow asks for a person, set the office's faults, and read the office's state. Each solution must pass its
stage's checks and every earlier check that still applies; each starter must behave as the previous stage's solution;
each broken file must show its symptom, and each repaired file must not. Then every answer quoted in the guides is
produced again from the steps marked beside it, and compared with the quote; and the README's "Try it" command is run as
written and its output compared.

<!-- pasted (ci) from: the CI run's scenario step, LAB_LIVE=1 node --test --test-reporter=tap tests/scenarios.test.js (the last lines) -->
```text
PENDING
```

### How each n8n behaviour the guides rely on was proven

| The guides rely on | Proven by |
|---|---|
| A published Webhook trigger answers at `/webhook/<path>`; an address nobody listens at answers 404 with "is not registered" | Every scenario; repair A, with the repaired file unpublished for the test |
| Respond to Webhook answers with a JSON body and a chosen status: 200, 202, 400, 502 | Stages 1, 2, 5 and 6 |
| The If node's `contains`, `is empty`, `is true`, `is equal to` and `is not empty`; a field that is missing goes to the false output | Stage 2 (including an enquiry with no e-mail field and one with no consent field); *Known contact?*, *Approved?*, *CRM confirmed?* in stages 3, 5 and 6 |
| The HTTP Request node reaches the office by its service name, `http://office:3333`, with a query parameter, a header and a JSON body | Stage 3 |
| `$('Enquiry arrives').item.json...` reads an earlier node's data, also after a Wait | Stages 3 and 5 |
| The Code node runs JavaScript and reads another node with `$('...').first()` | Stage 4, and the practical check |
| The Wait node, on webhook call: `{{ $execution.resumeUrl }}` (an address with a signature) handed to the inbox; the inbox's call resumes the run with the decision; a Respond to Webhook after the Wait answers the person who decided | Stage 5 (Reject, then Approve), repair C |
| Until a run reaches its Wait node, n8n refuses a decision with 409 "The execution ... is running already" | Seen in CI before the office learned to try again; the office's own tests cover the retry |
| On Error `Continue (using error output)` sends a 500 and a timeout to the error output | Stage 6 (fail, slow) and repair D's repaired file |
| On Error `Continue` passes a failure on to the next node as if it were a result | Repair D's broken file |
| `$prevNode.name` names the node whose error output led here | Stage 6 and repair D's repaired file (the alert's step) |
| A failing node with no error output makes the webhook answer 500 `{"message":"Error in workflow"}` | Repair B's broken file |
| An error message with quote marks, put inside a JSON answer, breaks the answer | Seen in CI in the first experiment run; the flows avoid it, and `tests/workflows.test.js` keeps them from doing it again |
| A publish is applied by a running n8n shortly, not at once | Seen in CI; the load script waits until every webhook is live |

**What rests on n8n's documentation only**, and was not proven by a run: every label and step in n8n's own screen; that
an edit in the editor stays a draft until it is published again; the owner account's password rule; importing a file from
the editor's menu; that the test address answers one call after **Execute workflow**. (That the test address answers 404
when nobody listens was seen in CI.)

---

## A new-user test

**State: owed.** A first-time participant, given only the `participant/` folder and a laptop, does the setup, every stage
and every repair, and writes down every point of friction at the moment it happens. What they were given, what they did,
and what was changed are owed on this page.

## An independent review

**State: owed.** Who reviewed the lab, what they reviewed, what they found and what was changed are owed on this page.

## The steps in n8n's own screen, walked through by a person

**State: not done.** The steps were written from n8n's documentation and the workflow files, with the labels in n8n
2.48.8's own English text. A person follows `participant/guide.md` and `participant/repairs.md` on n8n 2.48.8 and notes
every difference.

## Taught to a class of people

This lab has not been taught to a class of people.
