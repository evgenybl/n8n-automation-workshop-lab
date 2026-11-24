# n8n automation workshop lab: lead intake that says what happened

[![CI: the latest run on main](https://github.com/evgenybl/n8n-automation-workshop-lab/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/evgenybl/n8n-automation-workshop-lab/actions/workflows/ci.yml)

**A hands-on lab, in two sessions of about two hours each (planned), in which people with no programming background
build, in n8n, a flow that takes website enquiries into a CRM and keeps working when the input is bad, the same enquiry
arrives twice, an AI step makes something up, a person must approve, or the CRM fails.**

For people who want to automate their own office work: operations, administration, small-business owners, junior IT.
Comfortable with a computer; no programming. Everything runs on the participant's own laptop, with a practice CRM and a
practice AI step, so no account with an online service and no key is needed.

**This lab has not been taught to a class of people yet.** Every timing in it is planned, not measured.

The finished flow, drawn from its workflow file (`workflows/stage-6-solution.json`):

[![The finished flow: an enquiry arrives, is checked three times, an AI step's summary is checked, a person approves, the contact is looked up, then noted or created; each call to the AI step, the approval inbox and the CRM has an error branch, the three calls that tell the office about a failure have none, and the answer says what was written.](docs/pictures/stage-6-solution.svg)](docs/pictures/stage-6-solution.svg)

After the lab, a participant can:

| # | Objective | Shown by |
|---|---|---|
| O1 | Build a flow from a trigger to a record in another system | Stages 1 and 3 |
| O2 | Validate an input and refuse a bad one with a reason | Stage 2 |
| O3 | Stop a duplicate before it is written | Stage 3 |
| O4 | Check what an AI step returned before using it | Stage 4 |
| O5 | Put a person's approval before a write | Stage 5 |
| O6 | Make a failure visible instead of silent | Stage 6 |
| O7 | Find and repair a broken flow from its symptoms | The four repairs |

The idea that runs through it: **a flow that works once is a demo; a flow that says what happened when it fails is
automation.**

---

## What is in the lab

| Folder | What it holds |
|---|---|
| `participant/` | The setup page with its check, the lab guide stage by stage, the four repairs with three hints each, and a one-page card: six questions to ask of any automation |
| `instructor/` | The run sheet for the two planned sessions, the guide per part (purpose, planned minutes, what to say, mistakes to expect, a debrief question), when things go wrong, variants (one half day; a ninety-minute taster), a rubric with four levels per objective, a practical check with its answer, and the answer key |
| `workflows/` | 22 workflow files: a starter and a solution for each of the six stages, a broken and a repaired file for each of the four repairs, and the practical check's two files |
| `practice/` | The practice office: a lead form, a practice CRM, a practice AI step (a stand-in that is not a model), an approval inbox, an office window and faults on request; one Node program with no dependencies, and its tests |
| `tools/` | The load script, the static checker, the picture tool, the generator that writes the workflow files, the script that writes the repairs page for printing, and the check of the pasted test summaries |
| `tests/` | The scenario tests that drive every published workflow, and the tests of the checker, the workflow files, the lab guide against the workflow files, the pictures and these pages |
| `docs/` | How the lab was tested, and the pictures of every workflow file |

**Participants read the pages on this repository's web page** (GitHub shows their tables, paste blocks and folded hints
laid out); opened in a text editor, the same files show raw text. For a room without internet, the instructor prints the
participant pages beforehand, as the run sheet says, and participants copy the grey blocks from the same files in the
lab's folder.

## Try it

You need Docker (Docker Desktop on Windows or macOS) and, for the load script, Node (the tools are tested with Node 24).
In the lab's folder, in a Bash shell (Git Bash on Windows works):

<!-- try-it:command -->
```bash
docker compose up -d
node tools/load.js --solutions
curl -s -w ' %{http_code}\n' -X POST http://localhost:5678/webhook/stage-6-solution -H 'content-type: application/json' -d '{"name":"Maya Rivers","email":"maya.rivers@example.com","message":"How much would 12 workshop seats cost in March?","consent":true}'
```

The first command starts n8n 2.48.8 and the practice office, both on this computer only; the second loads and publishes
the six stage solutions; the third sends one enquiry to the finished flow. It answers that the enquiry waits for a person:

<!-- try-it:output -->
```text
{"status":"waiting for approval","approval":"A1"} 202
```

Then open the approval inbox at `http://localhost:3333/inbox` and choose Approve or Reject, and see what was written in
the office window at `http://localhost:3333`. The lab's CI runs the third command after loading every file, and compares
its output with the block above. Maya Rivers, like every person and company in the lab, is invented; any resemblance of
an invented name to a real person or business is a coincidence.

A participant does not run these commands: they follow `participant/setup.md`, and build the flow themselves in n8n's
editor at `http://localhost:5678`.

## The plan, with planned minutes

| Session | Part | What is built | Planned minutes |
|---|---|---|---|
| 1 | Opening and the setup check | The idea; the practice office; the setup check | 15 |
| 1 | Stage 1: Catch an enquiry | A webhook that answers with the enquiry's name, safely | 20 |
| 1 | Stage 2: Refuse a bad one | No e-mail, a filled honeypot or no consent: 400 and the reason | 25 |
| 1 | Break | | 10 |
| 1 | Stage 3: No duplicates | Look the contact up; create it, or add a note | 30 |
| 1 | Repair A or B | A broken flow, repaired from its symptoms | 15 |
| 1 | Close of session 1 | | 5 |
| 2 | Recap | | 5 |
| 2 | Stage 4: Ask the AI step, and check it | Use its summary only if it answered and every figure in it is in the enquiry | 25 |
| 2 | Stage 5: A person approves | Post to the approval inbox and wait; write only on Approve | 30 |
| 2 | Break | | 10 |
| 2 | Stage 6: When it fails | Error branches that record what failed and answer honestly about what was written | 25 |
| 2 | Repairs C and D | Two broken flows, repaired from their symptoms; when assessing, the practical check in place of repair D | 20 |
| 2 | Close | The card of six questions | 5 |

**Audience and level:** a group of 4 to 12, each on a laptop with Docker Desktop installed beforehand (the setup page has
a check the participant runs). No programming: each stage's starter file brings its nodes already placed and mostly set
up, every expression is pasted, not typed, and the one piece of code, in stage 4, is pasted and explained, not written.
No stage has more than 14 steps. When you assess, the practical check (`instructor/practical-check.md`) takes the place of repair D, and the part *Repairs C and D* takes 30 planned minutes instead of 20: repair C in 15, then the practical check in 15, so session 2 takes 130 (`instructor/variants.md`). Other shapes are in `instructor/variants.md`: one half day, and a ninety-minute taster of
stages 1 to 3.

## How it was tested

The full account, in the same plain terms, is `docs/HOW-THIS-WAS-TESTED.md`. In short:

| Kind of evidence | State |
|---|---|
| Automated tests of the office, the checker, the workflow files, the lab guide against them, the pictures and these pages | Done; run on Linux and Windows in CI, and locally on Windows |
| Every workflow file run in CI on n8n 2.48.8 | Done: all 22 imported, published and driven through their webhooks with no screen; each solution passes its checks, each broken file shows its symptom, each repaired file does not |
| A new-user test | Done twice, at commit 9785e5b and at commit 25e7f76, each by a separate AI agent (a Claude model with no part in the build), reading the pages without n8n's screen; not repeated on the current version |
| An independent review | Done once, at commit 9785e5b, by a separate AI agent (a Claude model with no part in the build); not repeated on the current version |
| The steps in n8n's own screen walked through by a person | Not done: they were written from n8n's documentation and the workflow files |
| Taught to a class of people | Not done |

## The n8n version, and when n8n moves on

The lab is pinned to **n8n 2.48.8** (`docker.n8n.io/n8nio/n8n:2.48.8` in `compose.yaml`), n8n's stable release on 24
November 2026, the date the lab's CI first ran it. It is pinned by its tag, not by its digest: the tag names the version,
but the registry could serve a different image under the same tag. The digest CI saw is on the testing page. n8n releases
often. To move the lab to a newer version: change the image in `compose.yaml`, run the CI (it imports, publishes and
drives every workflow file), and read what fails. The labels in the participant guide come from n8n 2.48.8's
documentation and its own English text, and may move in a newer version; walk the guide on the new version before
teaching it.

## Third parties and their terms

- **This lab is not affiliated with or endorsed by n8n.** n8n is used under its own licence, the Sustainable Use License
  (see n8n's documentation page *Community license*, https://docs.n8n.io/n8n-community-license). The lab does not
  redistribute n8n: `compose.yaml` names n8n's own image, which Docker downloads from n8n's registry onto each laptop.
- **Docker Desktop** is free only for personal use, education, non-commercial open source projects and small businesses
  (fewer than 250 employees and less than 10 million US dollars in annual revenue), under Docker's terms
  (https://docs.docker.com/subscription-billing/desktop-license/). Staff of larger organisations need their employer's
  paid Docker subscription.

## What it does not do

- It connects to no real CRM, mail or messaging account, and needs no key. The practice CRM is practice software, not a
  CRM product.
- The practice AI step is a stand-in that is not a model: it answers from fixed rules, the same way every time. The lab
  teaches how to check an AI step's output; it does not show what any real model does.
- It uses no paid n8n feature and no hosted n8n. The static checker, `tools/check-workflows.js`, refuses a workflow file
  that holds a credentials block, authentication on a node, a header or query parameter named like a secret (also in the
  address itself), a body field named like a secret with a value written in the file, a token-like value (a key's shape
  also inside an expression), an address that is not written out as the practice office's, an e-mail address outside
  example.com, or an IP address, also in a node's or the workflow's name. `tests/checker.test.js` makes a file of each
  kind and proves the checker refuses it, and proves every file in `workflows/` passes. The checker is a set of patterns:
  it catches the common shapes of these, and proves nothing beyond them.
- Nothing in it is meant for production use. The practice office has no login, keeps everything in memory, and refuses
  changes sent from another site.

## How it was built

Built with Claude Code under the author's direction. The n8n behaviours the guides rely on were first tried in small
experiment flows in CI, then built into the stages; every quoted answer in the guides is replayed against the published
flows in CI and compared. The workflow files are written by `tools/build-workflows.js`. Node and its built-in modules
only: no package is installed.

## Licences

| Folder or file | Licence |
|---|---|
| `workflows/`, `practice/`, `tools/`, `tests/`, `compose.yaml`, `.github/`, `.gitattributes` | MIT (`LICENSE`) |
| `docs/pictures/` (drawn by the picture tool from the workflow files) | MIT (`LICENSE`) |
| `participant/`, `instructor/`, `docs/HOW-THIS-WAS-TESTED.md`, `README.md` (this page) | Creative Commons BY-NC 4.0 (`LICENSE-TEXT.md`) |

---

Built by Evgeny Blekhman. Written with Claude Code under the author's direction. linkedin.com/in/evgeny-blekhman
