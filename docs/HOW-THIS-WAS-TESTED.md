# How this lab was tested

This page uses six kinds of evidence, and keeps them apart. A kind of evidence is listed as done only when it was done,
and with the version it was done on.

| Kind of evidence | What it is here | State |
|---|---|---|
| Automated tests, with no container | The practice office's own tests; the static checker against every kind of bad file; the workflow files against their generator and against each other; the lab guide, the repairs, the answer key and the practical check against the workflow files; the pictures; these pages | Done: on Windows locally and in CI, and on Linux in CI. The last local run is pasted below. |
| Every workflow file run in CI on n8n 2.48.8 | n8n and the practice office started as `compose.yaml` starts them; all 22 workflow files imported and published with n8n's own command line; every one driven through its webhook with no screen, and every answer quoted in the guides replayed and compared | Done in CI. The run and its summary are pasted below; the badge at the top of the README shows the latest run on `main`. |
| A new-user test | Done twice, at commit 9785e5b and at commit 25e7f76, each by a separate AI agent (a Claude model with no part in the build), reading the pages without n8n's screen; not repeated on the current version | See below: what each was given, did and found, and what was changed. |
| An independent review | Done once, at commit 9785e5b, by a separate AI agent (a Claude model with no part in the build); not repeated on the current version | See below. |
| The steps in n8n's own screen, walked through by a person | A person follows the participant guide on n8n's editor, stage by stage, and notes every label or step that differs | Not done. |
| Taught to a class of people | | Not done. |

**This lab has not been taught to a class of people.** Every timing in it is planned. **The steps in n8n's own screen were
written from n8n's documentation and the workflow files, and were not walked through on a screen by a person.** The flows
those steps build were run, exactly as the workflow files hold them, and a test applies the guide's steps to each starter
file and arrives at the solution file; whether a person can carry out those steps on the screen is what a walk-through
by a person will show.

---

## Automated tests, with no container

**How to run them** (Node; nothing to install, no package, no network beyond this computer's own address):

```
node --test "practice/tests/*.test.js" "tests/*.test.js"
```

The scenario tests in `tests/scenarios.test.js` are skipped here: they need n8n running, and n8n runs only in CI. The
one test in that file that needs no container, that every workflow file has a scenario and every scenario a file, runs
everywhere.

| Test file | What it proves |
|---|---|
| `practice/tests/office.test.js` | The practice CRM: the badge header, lookup by e-mail in any letter case and by exact name, a contact created with its first note in one call, 409 for a second contact with the same e-mail, the refusals. The faults: fail, slow (and nothing written when the caller hangs up), wrong, late writes (the write made, the answer late), invent, the AI step failing, the inbox failing. The AI step: the same answer every time, its rules, an invented figure never one the enquiry has, no quote marks in its answers. The inbox: a resume address needed; a decision sent to the n8n the office can reach, with the path and its signature kept; a decision made once; a decision tried again while n8n says the run is still on its way to the Wait node. A change sent by a page on another site refused with 403 (reset, approve, reject, faults, form, alerts), the office's own pages and tools not. A body over 100 KB answered 413. The form, the setup check, reset, the pages and their content security policy, and that the office listens on 127.0.0.1 only. |
| `tests/checker.test.js` | The static checker refuses each kind of bad file (no JSON, a wrong file name, no id, a credentials block anywhere, an account or owner record, an unknown key, a disabled node, a node type outside the list or at another version, an address beyond the practice office, one with no scheme, one built in an expression, one that only starts like the office or hides another host behind its name, an e-mail outside example.com, an IP address, a phone-like number, a token-like value in a header, a query parameter or a body, a header or query parameter named like a secret, authentication, an address or e-mail in a node's or the workflow's name, a name over 60 characters, an error workflow or other setting, an unconnected node outside a starter, a connection to nothing, two triggers, a bad path, a published file, recorded data, two nodes of one name, two files with one path or one id), and passes every file in `workflows/`. |
| `tests/workflows.test.js` | Every workflow file is what the generator writes; each starter is the previous stage's solution plus the stage's parts, each part as in the solution but for the one setting the participant sets; every node keeps its place from stage to stage; each broken file differs from its repaired file only where its exercise says; every answer stays valid JSON, with no field forged, when the test fills it with a name that holds a quote mark, a forging name, a backslash or a line break, because free text enters an answer only through `JSON.stringify`, never inside quote marks (the stage 1 and 2 flows do not check the name, and an enquiry with no name is not tried by any test); the consent check compares as text with types converted; no node name holds a quote mark; every CRM call carries the badge header and a five-second timeout, but the one repair D breaks. |
| `tests/guide.test.js` | Following each stage's table of the lab guide on its starter file gives exactly that stage's solution file: the same nodes, settings and connections. No stage has more than 14 steps; every expression is in a paste block; every expression in a stage, also in its prose, is in its solution; the form addresses, office addresses, methods, status codes, the timeout, the badge and the On Error settings in the prose are those of the files; each stage's planned minutes are the run sheet's. Stage 2's two checks that compare text as it is, as the solution sets them. The stage 4 code, run in plain Node (not in n8n) on the finished flow's text, does what the guide says it lets through: a figure in the name reported as invented, an answer with no summary or a summary that is not text labelled checked, "Message: undefined" for an enquiry with no message. Each repair's file, form address, cause and fix, the answer key's causes, and the practical check's cause, repair and minutes are those of the files. |
| `tests/pictures.test.js` | Every workflow file has its picture, drawn the same way every time, current, naming every node and drawing every connection; the five error branches of the finished flow dashed and labelled. |
| `tests/pasted.test.js` | `tools/check-pasted.js`, the CI step below, agrees on a pasted summary that matches whatever the duration, and refuses any other difference or a missing block. |
| `tests/docs.test.js` | Plain ASCII and LF line ends in every file; no absolute path; every e-mail address at example.com; no package files; no claim that nothing needs paying for, and nothing left to paste; the "not taught", "planned, not measured", screen-steps and "stand-in that is not a model" lines where they belong; each session of the run sheet adds up to its stated 120 minutes, the README and the instructor guide give the same parts, minutes and debrief questions, each variant adds up to its stated total with the run sheet's stage minutes, and the practical check fits the part it replaces; links and pictures resolve; every quoted answer is marked for replay, with real flows, people and faults; the README's and this page's evidence rows, the number of workflow files, and that a CI run is cited only with its commit; every test file is named on this page; the licence line on every teaching page, the README's licence table and the licence notice in agreement, every file under exactly one licence; the third parties' terms; the setup page's browsers, password rule, check and proxy; the author line; the compose file's ports and addresses; pinned actions; the order of the load script's modes in CI and on the run sheet. |
| `tests/scenarios.test.js` | In CI only: see the next section. |

**The last lines of the last local run**, as printed, on Windows with Node 24:

<!-- pasted (local) from: node --test --test-reporter=tap "practice/tests/*.test.js" "tests/*.test.js" (the last lines) -->
```text
1..201
# tests 201
# suites 0
# pass 144
# fail 0
# cancelled 0
# skipped 57
# todo 0
# duration_ms 10777.5189
```

The skipped tests are the scenario tests, which need n8n.

---

## What runs only in CI

The workflow in `.github/workflows/ci.yml` has two jobs; actions are pinned by commit.

**On Linux**, in this order:

1. the tests above;
2. the static checks (`node tools/check-workflows.js`), the generator (`node tools/build-workflows.js --check`), the
   picture tool (`node tools/draw-workflow.js --check`) and the repairs page for printing (`node tools/print-repairs.js
   --check`), each compared with the files;
3. n8n and the practice office started with `docker compose up -d`; the image's digest, size and platforms printed; and
   what starting the lab prints in a folder without `compose.yaml`, for the setup page;
4. every workflow file imported and published with `node tools/load.js --all`, which waits until n8n is ready and then
   until every webhook is live;
5. the scenario tests, with `LAB_LIVE=1`;
6. the instructor's preparation as the run sheet gives it: `node tools/load.js --clear`, then `--solutions`, which ends by
   checking that no participant's path answers;
7. `tools/check-pasted.js`, which compares the two summaries pasted on this page with what this run printed (the
   duration aside), and fails the run if either differs. This comparison is a CI step, not a local test: a local run
   cannot check its own summary.

**On Windows:** the tests above, the static checks, the picture tool, the repairs page for printing, and the comparison
of the local summary.

What the scenario tests do, for each workflow file: send it enquiries through its webhook, decide in the approval inbox
where the flow asks for a person, set the office's faults, and read the office's state. Each solution must pass its
stage's checks and every earlier check that still applies; each starter must behave as the previous stage's solution;
each broken file must show its symptom, and each repaired file must not. Then every answer quoted in the guides is
produced again from the steps marked beside it, and compared with the quote; and the README's "Try it" command is run as
written and its output compared.

<!-- pasted (ci) from: the CI run's scenario step, LAB_LIVE=1 node --test --test-reporter=tap tests/scenarios.test.js (the last lines) -->
```text
1..58
# tests 58
# suites 0
# pass 58
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 135522.855194
```

This summary was printed by CI run 45345044613, at commit 2f3c4a7, on 24 November 2026. The tests are one scenario
for each workflow file, one replay for each answer quoted in the guides, and the checks that every file has a scenario,
that the setup check page answers, that the lead form reaches a flow, and that the README's command prints what the
README shows.

### The n8n image

`compose.yaml` pins the image by its tag, `docker.n8n.io/n8nio/n8n:2.48.8`, not by its digest. The tag names the version;
the registry could, in principle, serve a different image under the same tag, and the lab would not notice. CI run 45339281817, at commit b229a23,
printed the image it used: its digest, its size, the platforms it is published for (so it also runs on a Mac with
Apple silicon, as linux/arm64), and the size of its download for each platform:

<!-- pasted from: the step "The n8n image this run used" of CI run 45339281817, at commit b229a23 -->
```text
digest docker.n8n.io/n8nio/n8n@sha256:e0df076a41076127d5f765e05acb8ba746bddff86442a92269c0f5a7219a7e4b
size on disk 377894246 bytes
  Platform:  linux/amd64
  Platform:  linux/arm64
download for linux/amd64: 377879245 bytes in 20 layers
download for linux/arm64: 377577771 bytes in 20 layers
```

### How each n8n behaviour the guides rely on was proven

| The guides rely on | Proven by |
|---|---|
| A published Webhook trigger answers at `/webhook/<path>`; an address nobody listens at answers 404 with "is not registered" | Every scenario; repair A, with the repaired file unpublished for the test |
| Respond to Webhook answers with a JSON body and a chosen status: 200, 202, 400, 502, 503 | Stages 1, 2, 5 and 6 |
| `{{ JSON.stringify($json.body.name) }}` in a JSON answer, with no quote marks around it, carries a name with quote marks, a backslash or a line break, and lets no name add a field | Stage 1's solution and every later flow that answers with the name, with those four names; an enquiry with no name is not tried by any test |
| The If node's `contains`, `is empty`, `is true`, `is equal to` and `is not empty`; a field that is missing goes to the false output | Stage 2 (including an enquiry with no e-mail field and one with no consent field); *Known contact?*, *Approved?*, *CRM confirmed?* in stages 3, 5 and 6 |
| With *Convert types where required* on, a consent of `true` passes a text comparison with `true`; `false`, `on` and no consent are refused | Stage 2 and every later flow |
| The HTTP Request node reaches the office by its service name, `http://office:3333`, with a query parameter, a header and a JSON body | Stage 3 |
| `$('Enquiry arrives').item.json...` reads an earlier node's data, also after a Wait | Stages 3 and 5 |
| The Code node runs JavaScript, reads another node with `$('...').first()`, and sees the error of the node before it | Stage 4 (the AI step failing), and the practical check |
| The Wait node, on webhook call: `{{ $execution.resumeUrl }}` (an address with a signature) handed to the inbox; the inbox's call resumes the run with the decision; a Respond to Webhook after the Wait answers the person who decided | Stage 5 (Reject, then Approve), repair C |
| Until a run reaches its Wait node, n8n refuses a decision with 409 "The execution ... is running already" | Seen in CI run 45320046704, at commit 0678574, before the office learned to try again; the office's own tests cover the retry |
| On Error `Continue (using error output)` sends a 500 and a timeout to the error output | Stage 4 (the AI step), stage 5 (the inbox), stage 6 (fail, slow, late writes) and repair D's repaired file |
| A write that runs out of time may still have been made | Stage 6 with the CRM's *late writes* fault: the answer says "unknown: check the CRM", and the contact exists |
| On Error `Continue` passes a failure on to the next node as if it were a result | Repair D's broken file |
| `$prevNode.name` names the node whose error output led here | Stage 6 and repair D's repaired file (the alert's step) |
| A failing node with no error output makes the webhook answer 500 `{"message":"Error in workflow"}` | Repair B's broken file |
| An error message with quote marks, put inside a JSON answer, breaks the answer | Seen in CI run 45318193799, at commit 66cf58f, the run of the first experiment flows (removed since); the flows avoid it, and `tests/workflows.test.js` keeps them from doing it again |
| A publish is applied by a running n8n shortly, not at once | Seen in CI run 45320046704, at commit 0678574; the load script waits until every webhook is live |

**What rests on n8n's documentation or source only**, and was not proven by a run or seen on a screen:

| Point | Where it comes from |
|---|---|
| Every label and step in n8n's own screen | n8n's documentation and n8n 2.48.8's own English text |
| *Import from File* in the workflow's menu | n8n's documentation; n8n's English text has *Import*, then *From file*. The guide gives both labels; it does not say where the workflow's menu sits, and asks the participant to ask the instructor if they cannot find it |
| The create button in the upper-left corner of the side menu, then *Workflow* | n8n's documentation |
| How a node is added (*Add node* on the right side of a node, *Add first step*, the nodes panel), and *Rename node* in the node's context menu | n8n's documentation, *Work with nodes* |
| Connecting two nodes (the grey dot, the grey rectangle) and deleting a connection (hover over it, then *Delete*) | n8n's documentation, *Connect nodes together* |
| The *Publish* button in the canvas header, and the window it opens | n8n's documentation, *Save and publish workflows* |
| The *Executions* tab in the top menu | n8n's documentation, *View executions for a single workflow* |
| *HTTP Method* and *Respond* among the Wait node's parameters for *On Webhook Call* | n8n's documentation, *Wait* |
| That an edit stays a draft until it is published again | n8n's documentation |
| That the test address answers one call after **Execute workflow** | n8n's documentation (that it answers 404 when nobody listens was seen in CI) |
| The owner account and its password rule: at least eight characters, at least one number and one capital letter | n8n's documentation, *Configure user management* for self-hosted n8n |
| The optional free licence key offered while the owner account is created | n8n's documentation on the Community edition |
| The If node's empty boxes shown as *value1* and *value2* | n8n 2.48.8's English text only; not in the documentation |
| The *Fixed* / *Expression* switch of a box, and where it sits | n8n's English text has the two labels; the documentation does not say where the switch sits. The guide says so, and asks the participant to ask the instructor |
| The label *Convert types where required*, and where the switch sits on the If node | n8n's English text only: the If node's documentation does not name it. The guide says so, and asks the participant to ask the instructor |
| Where a node's error output sits beside its normal one, once *On Error* is *Continue (using error output)* | Not in the documentation; the guide says so, and asks the participant to ask the instructor |
| That a new Respond to Webhook node's Response Body already holds a sample body, which the guide says to select before pasting | n8n 2.48.8's source |
| What n8n shows after the owner account is created, beyond the sign-up screen and the optional licence key | Not in the documentation the lab read; the setup page says so, and asks the participant to ask the instructor |
| Pasting a whole workflow file onto the canvas | Not confirmed in the documentation |
| That *Convert types where required* writes `looseTypeValidation` and a loose `typeValidation` into the file | n8n 2.48.8's source |
| That the type versions in the files (Webhook 2.2, Respond to Webhook 1.5, If 2.4, HTTP Request 4.5, Code 2, Wait 1.1) are the ones n8n's editor gives a new node | Not confirmed: the files were written with these versions, and n8n 2.48.8 ran them; a node added on the screen may get another version |
| That strict type checking stops *Consent given?* for a consent of `true` when *Convert types* is off | n8n 2.48.8's source |
| That Safari refuses n8n's sign-in at `http://localhost` | A community report, not verified |

---

## The new-user test, at commit 9785e5b

**Who:** a separate AI agent, a Claude model with no part in the build. **What it was given:** the `participant/` folder
and the top of the README, as a first-time participant would have them, and a computer with Node; no n8n and no Docker. **What
it did:** it read every participant page in order as a newcomer, ran the practice office alone and replayed each stage's
calls to it, wrote down what it believed each flow it would build was, and logged every point of friction at the moment
it met it, before it opened any solution or instructor file; then it compared what it believed with the solution files.
**What it found:** all six stages could be followed, and every value it believed it had set is in the solution files; 29
points of friction, the main ones below. Not repeated on the current version.

| Finding | What was changed |
|---|---|
| Two readings of whether a stage starts from its starter or from one's own flow; carrying on gives a 404 with no hint | A bold rule at the top of the guide and the bold first row of every stage's table: every stage starts by importing its starter into a new workflow |
| Expressions are typed blind; a slip fails only when the node runs | Every expression is in a block to paste; a bold rule says to paste, not type; a test keeps expressions out of the tables |
| Nobody says how to add a node | One paragraph, from n8n's documentation |
| `value1`/`value2` unverifiable | "Left box, operator, right box", with value1 and value2 named as n8n's text only |
| "The same for the false output" unclear | The refusals arrive built in stage 2's starter |
| "Using Fields Below" given for the body but not the query | The query, header and body arrive set in the starters; the participant sets only the query's field |
| No "reset the office" before each check, so ids and counts differ | "Choose Reset the office" is the first line of every "check yourself", and a test holds it there |
| Stage 5's two answers explained after the table | Explained before the build, request by request |
| The Wait node's method default | The symptom of a forgotten `POST` is named |
| Stage 6's opening reads as both a step and an explanation | Marked as an optional try, not a step |
| Stage 6 has 22 rows | The starter brings the alerts, the answers and the confirmation; 12 steps remain |
| Why the "answers wrongly" fault ends on the write | One sentence: the lookup's answer has no `found`, so the flow creates, and the create's answer names no contact |
| Repair D's full fix is a stage-6 build | The minimum repair is named; the full repair is marked as stage 6's |
| `docker compose version` passes with Docker stopped | The check is `docker info` |
| The Windows port message differs | The page describes "a message that the port is already in use" instead of quoting one |
| Nothing on restarts, sign-in or the owner screen | A restart is named; the owner screen and its optional licence key are described from n8n's documentation |
| No Windows 10 way to open a terminal | Added |
| `n8nAddress` unexplained | One line |
| Only the CRM wants the badge | Said in stage 4 |
| The Code node's Mode and Language | "Leave them as they are" |

## The second new-user test, at commit 25e7f76

**Who:** a separate AI agent, a Claude model with no part in the build or in the first passes. **What it was given:** the
`participant/` folder and the top of the README, as a first-time participant would have them, and a computer with Node;
no n8n and no Docker. **What it did:** as the first test did, it read every participant page in order, ran the practice
office alone and replayed each stage's calls to it, wrote down what it believed each flow was, and logged every point of
friction before it opened any solution or instructor file; then it compared what it believed with the solution and
repaired files, and last read the instructor pages for what would have rescued it. **What it found:** every stage could
be followed, and the flow it believed it had built matched every solution file in every node, type and value; every
"check yourself" it could reproduce with the office matched; 25 points of friction, the main ones below. **Its limits:**
it never had n8n's screen, so every label and place on the screen is unchecked; it read the repairs page as raw text, so it
saw each cause before the hints, and its estimates of the hint at which each repair is found are estimates, not
measurements. Not repeated on the current version.

Its counts per stage, from the guide's tables, beside the planned minutes:

| Stage | Planned minutes | Rows | Paste blocks | Connect and delete rows | Also |
|---|---|---|---|---|---|
| 1 | 20 | 8 | 1 | 0 | |
| 2 | 25 | 14 | 3 | 5 | |
| 3 | 30 | 11 | 2 | 4 | |
| 4 | 25 | 8 | 2 | 3 | |
| 5 | 30 | 14 | 2 | 4 | two new nodes |
| 6 | 25 | 12 | 0 | 7 | |

It judged stage 6 the heaviest by actions (the build, then four fault runs across the form, the inbox and the office
window), stage 5 the heaviest by ideas, and stage 2 heavy for a first use of the If node.

| Finding | What was changed |
|---|---|
| The practical check is placed in place of repair D on its own page and the variants, but not on the run sheet or the README | One plan, word for word on the run sheet, the README, the variants and its own page, held by a test |
| Stage 4 says the Code node holds "a line"; the starter holds two | "two lines"; a test holds the count to the starter |
| Only repair A's repaired file listens at the repair's path; B, C and D use paths the participant is never told | The repairs page lists each repaired file's path and form address, and why repair A's differs; a test holds them to the files |
| Nothing on WSL 2, virtualisation or administrator rights on Windows | From Docker's installation page, linked |
| "The lab's folder" is ambiguous after unzipping, and the wrong folder's error is not listed | "The folder where you can see `compose.yaml`", and what a wrong folder prints, pasted from CI |
| No sample of a successful start | The last lines of a start, pasted from CI |
| No next step when the check stays "not reachable" | Two commands to run and send to the instructor |
| A failed `docker info` at home, with nobody to ask | "Send its last lines to your instructor before the session", which the run sheet's chase line now asks for too |
| `docker compose down -v` in the same table as the ordinary stop | Out of the table, on a warned line of its own |
| "as an Expression" only once; pasting into a box that holds a value can join two expressions | Every paste row says "(as an Expression)" where it is one, and "select everything in the box, then paste" where a value stands; a test checks both against the starters |
| A new node's name: is it the table's, or must it be renamed? | Every "add a node" row says "and rename it to ..." |
| The Respond to Webhook idea is never explained | One sentence in stage 1 |
| *Convert types where required* and the Wait node's *Respond*: where are they? | *Respond* named as n8n's documentation names it (the *Wait* page); *Convert types* is not in the documentation, so the guide says the page was not written from a screen, and the label is in the list above |
| Stage 5's two requests are dense | Four numbered lines |
| Stage 6: a success output connected by mistake answers 500, not 502; four fault runs are long | "Each fault must end with Status 502"; the faults that can wait when short of time, the same as the run sheet's cuts, held by a test |
| Redoing a stage is not explained | One line: delete the half-built workflow, then import the starter again |
| Which of repairs A and B in session 1? | Said on the repairs page, as the run sheet says it |
| A printout shows each cause before its hints | `instructor/repairs-for-printing.md`: the same page without the causes, with the hints written out, made by `tools/print-repairs.js` and compared in CI and by a test |
| The practical check is on no participant page | Its page says it is handed out by the instructor only, and a test keeps it off the participant pages |
| Places on the screen given without a source (the top right, above the box, right-click, the top and bottom outputs) | Each place is now said as n8n's documentation says it, with the page named; where the documentation is silent, the guide says so |
| "port" and "proxy" never explained | One gloss each |

## The independent review, at commit 9785e5b

**Who:** a separate AI agent, a Claude model with no part in the build. **What it was given:** the repository at commit
9785e5b. **What it did:** it rebuilt the workflow files and pictures and compared them byte for byte (all equal); read the
office's pages for escaping (everything is set as text); probed the static checker with altered workflow files; altered
the pages one rule at a time to see which tests noticed; and read the material as a teacher would. **Its verdict:**
publish after its blockers and majors. Not repeated on the current version.

| Finding | What was changed |
|---|---|
| Stage 1 built its answer from the name unescaped: a name with a quote mark broke it, and a crafted name could forge a field | `{{ JSON.stringify($json.body.name) }}` with no quote marks around it, explained in one sentence; `tests/workflows.test.js` fills every answer with the worst values and parses it; CI sends a quoted name, a forging name, a backslash and a line break |
| The testing page named tests that did not exist | Each test file's line says what it proves; the comparison of pasted summaries is named as a CI step; `tests/docs.test.js` checks that every test file is named here |
| The plan did not fit people new to this | Two sessions of two hours; starters with their parts already built; every expression pasted; at most 14 steps a stage; planned minutes per stage, held to the run sheet by a test |
| The load script published every file, taking the participants' paths | Modes `--solutions`, `--all` and `--clear`; the run sheet gives the order; CI runs that order and checks the paths are free |
| Participants would read raw Markdown | The setup page, the participants' index and the README say to read on the repository's page; the run sheet prints the pages for a room without internet |
| Stage 6 answered "written: nothing" for a failed write | A failed lookup answers "nothing"; a failed or unconfirmed write answers "unknown: check the CRM"; a new fault, *late writes*, makes the write and answers too late, proven in CI |
| Safari and n8n's sign-in | Chrome, Edge or Firefox named; Safari reported, not verified; n8n's cookie setting not changed |
| Third parties' terms, and the claim that nothing needs paying for | Not affiliated with n8n; n8n's licence linked; nothing redistributed; Docker Desktop's terms; the claim removed everywhere, and a test keeps it out |
| Labels not in the documentation | The table above |
| The practice CRM's behaviour unstated | Stage 3 says what it does, what a real CRM may not, and the double click |
| A real form sends `consent: "on"` | Refused cleanly with its reason; proven in CI and taught |
| Three of five outgoing calls protected | The AI step and the inbox have error branches, built in their starters and proven in CI; n8n's error workflow under *going further* |
| Approval: the resume link, no time limit, cross-site requests, two answers | The link's risk and the missing time limit stated; the Wait node's time limit under *going further*; the office refuses changes from another site (403), tested; the two answers explained before the build |
| The AI stage | A box on what changes with a real model; what the check lets through |
| Values that survived because no test held them | `tests/guide.test.js` applies the guide to the starters; the repairs, answer key, practical check, variants and the README's rows are tested |
| The checker's gaps: tokens, addresses with no scheme or built in an expression, names | All refused, and tested |
| The setup page | Starting again on the day, the download's rough size, Apple silicon, a proxy, n8n's first screen, `docker info`, the port message |
| The rubric and the practical check | O1 and O7 reworded; the practical check scheduled in place of repair D |
| The licences | The README's table and the licence notice name the same files; the pictures are MIT; a test checks every file has one licence; the image is said to be pinned by tag, not digest |
| A run cited that was not the latest; a large body reset; two phrases | A run is cited only with its commit, and the README has the badge; 413; the phrases removed |

## What a reading test without n8n's screen cannot show

The three passes read the pages and ran the practice office; none ran n8n's editor. So they could not show: whether the
labels in the guide are the ones on the screen; how n8n's editor behaves when a node is added, a block is pasted, or a
setting is switched; whether dragging and connecting nodes is as easy as the steps suggest; whether Docker Desktop
installs and runs on a newcomer's own laptop; and how long a room of people takes for each stage.

## The steps in n8n's own screen, walked through by a person

**State: not done.** The steps were written from n8n's documentation and the workflow files, with the labels in n8n
2.48.8's own English text. A person follows `participant/guide.md` and `participant/repairs.md` on n8n 2.48.8 and notes
every difference.

## Taught to a class of people

This lab has not been taught to a class of people.
