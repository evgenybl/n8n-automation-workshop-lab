# Run sheet: two sessions of two hours

**This lab has not been taught to a class of people. Every minute on this page is planned, not measured.** Adjust after
the first session, and keep a note of what took longer. The same lab as one half day, and a ninety-minute taster, are in
`instructor/variants.md`.

**Group:** 4 to 12 people, each on a laptop with the setup done (`participant/setup.md`). **Room:** a projector for your
screen, and power for every laptop. The lab runs on each laptop; the room's network is needed only by a laptop that has
not downloaded n8n yet.

## Before the first session

- **Two weeks before:** send the link to the lab's page on GitHub, and ask everyone to do `participant/setup.md` and send
  you the line the setup check shows, or, if `docker info` fails, its last lines (the setup page asks them to). Chase
  those who sent neither: a laptop that cannot run Docker is the one problem the room cannot fix on the day.
- **Do the whole lab yourself** on your own laptop, from `participant/guide.md`, before you teach it. Its steps for n8n's
  own screen were written from n8n's documentation and the workflow files, not walked through on a screen by a person;
  note anything on your screen that differs.
- **Print, if the room may have no internet:** participants read the pages on the lab's page on GitHub, where the tables,
  the paste blocks and the folded hints display properly. Without internet, print `participant/guide.md`,
  `participant/setup.md` and, for the repairs, `instructor/repairs-for-printing.md` from that page beforehand (the
  browser's Print), one set per person. A printout cannot fold, so `participant/repairs.md` would show each repair's cause
  before its hints; the copy for printing is the same page without the causes (a test keeps the two equal apart from
  them), and the causes are in `instructor/answer-key.md`. Print `participant/card.md` in any case, one per person. A
  printout cannot be pasted from: every grey block of the guide is also in the same page's file in the lab's folder,
  `participant/guide.md`, which a participant opens in a text editor and copies from.
- **Prepare your own n8n for showing the solutions**, in this order, in the lab's folder:
  1. `docker compose up -d`
  2. `node tools/load.js --clear` unpublishes every workflow in your n8n, so that no lab path is taken.
  3. `node tools/load.js --solutions` imports and publishes the six stage solutions only. They listen at
     `stage-1-solution` to `stage-6-solution`, so the paths a participant uses (`stage-1` to `stage-6`, `repair-a` to
     `repair-d`) stay free, and you can still do any stage yourself on the same n8n, on the projector. It ends by checking
     that no other lab path answers.

  The load script needs Node on your laptop (the lab's tools are tested with Node 24). **Never run `--all` on a laptop
  used for teaching:** it publishes every file, starters and repairs included, and takes the participants' paths; it is
  for the lab's CI. If you did, `node tools/load.js --clear` frees every path again. Do not run the load script on a
  participant's laptop at all.

## Session 1

| Part | Planned minutes | What happens | Debrief question |
|---|---|---|---|
| Opening and the setup check | 15 | The idea; the practice office on the projector; everyone opens the check page, n8n, the office window and the form | |
| Stage 1: Catch an enquiry | 20 | The first webhook and its answer, and a name with quote marks in it | What did the sender learn from n8n's first answer, and what does it learn now? |
| Stage 2: Refuse a bad one | 25 | Three checks, three refusals with reasons | Which of the three refusals would you most want to know about in your own work, and why? |
| Break | 10 | | |
| Stage 3: No duplicates | 30 | Look up, then note or create | What in your own work is matched by a name today, that should be matched by something that does not change? |
| Repair A or B | 15 | Repair A for everyone; B for those who finish A | Which symptom misled you first, and what showed you the real cause? |
| Close of session 1 | 5 | `docker compose down` (not `down -v`), so the flows are there next time | |

The planned total of session 1 is 120 minutes.

## Session 2

| Part | Planned minutes | What happens | Debrief question |
|---|---|---|---|
| Recap | 5 | Everyone starts the lab, sends one enquiry to their stage-3 flow, and reads the office window aloud | |
| Stage 4: Ask the AI step, and check it | 25 | The stand-in AI step, a check of its figures, and the AI step failing | What else could an AI step get wrong that a simple check could catch before it is used? |
| Stage 5: A person approves | 30 | The two answers, the inbox, the resume address, the Wait node, the inbox failing | Which step in your own work should never happen without a person saying yes? |
| Break | 10 | | |
| Stage 6: When it fails | 25 | Error outputs; a failed lookup wrote nothing, a failed write may have written | When something fails in one of your own flows today, who finds out, and how long does it take? |
| Repairs C and D | 20 | Repair C for everyone; D for those who finish C; when you assess, the practical check in place of repair D | What did the "no" path show you that the "yes" path did not? |
| Close | 5 | The card; what each person will look at in their own work | |

The planned total of session 2 is 120 minutes. When you assess, the practical check (`instructor/practical-check.md`) takes the place of repair D, and the part *Repairs C and D* takes 30 planned minutes instead of 20: repair C in 15, then the practical check in 15, so session 2 takes 130 (`instructor/variants.md`). The instructor guide, `instructor/guide.md`, has what to say in each part
and the mistakes to expect.

## Between the sessions

Ask everyone to keep the lab's folder and not to run `docker compose down -v`, which deletes their n8n account and flows.
A person whose flows are gone imports `workflows/stage-4-starter.json` in session 2 and goes on: it holds the finished
stage 3.

## If you fall behind

Cut in this order: repair B and repair D (they go home); stage 6's *is slow* and *answers wrongly* faults (keep *fails*
and *writes, but answers too late*; the guide tells participants the same); stage 4's *fails* run (show it on the
projector instead). Do not cut stage 5's Reject: it is the moment
the approval proves itself.

## After the last session

To give your n8n back its paths for other work: `node tools/load.js --clear`. To remove the lab and everything in it from
your laptop: `docker compose down -v`.

---

*Teaching text licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/).*
