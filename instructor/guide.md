# The instructor guide, part by part

**This lab has not been taught to a class of people. Every minute here is planned, not measured; the mistakes listed are
the ones the design expects, not ones observed in a room.** Where a mistake's symptom was seen in the lab's automated
tests, the line says so; the other symptoms are what n8n's documentation leads one to expect. The steps for n8n's own
screen were written from n8n's documentation and the workflow files, and were not walked through on a screen by a person:
do the whole lab yourself on your own laptop before you teach it, and note anything on your screen that differs from the
participant guide.

Keep the office window on the projector whenever you can. It is the lab's best teacher: it shows what a flow really did,
not what it says it did. Two habits to say at the start and repeat: **every stage starts by importing its starter into a
new workflow**, and **every value in a grey block is pasted, not typed**. n8n's documentation places the import in the
**Workflow** menu of the canvas header (the page *Export and import*); nobody has looked for it on a screen for this
lab, so find it on your own n8n before the session.

The parts follow the run sheet's two sessions (`instructor/run-sheet.md`).

---

## Opening and the setup check

**Purpose:** everyone knows what they will build, why, and has a working lab. **Planned minutes:** 15

**What to say.** "Most automations work once, on a good input, while someone watches. Then they meet a real one: a form
with no e-mail, the same person twice, an AI answer with a made-up figure, a CRM that is down. A flow that works once is a
demo; a flow that says what happened when it fails is automation. In these two sessions you will build the second kind."
Then show the office window, the form and the inbox, and say what each is: practice software on their own laptop, not a
real CRM, and an AI step that is a stand-in, not a model. Everyone opens the check page, n8n, the office window and the
form, and the lab's page on GitHub, where they read the guide.

**Mistakes to expect.** A laptop where the check page does not open (see `when-things-go-wrong.md`); someone who did not
set up the n8n owner account and is now choosing a password: let them, it takes a minute; someone reading the guide as a
raw text file, where the tables are hard to read: point them to the lab's page on GitHub, or to a printed copy.

---

## Stage 1: Catch an enquiry

**Purpose:** the loop from the outside: a form sends, a webhook catches, the flow answers. **Planned minutes:** 20

**What to say.** "A webhook is an address that starts your flow. The form is the outside world; your flow decides what
the outside world hears back. Right now it hears 'Workflow was started', which tells it nothing." After they build it:
"Now the sender knows its enquiry arrived. That answer is the first thing a flow owes anyone who uses it." Then the name
with quote marks: "Whatever a person types reaches your answer. JSON.stringify makes it safe; a name pasted between quote
marks of your own would break the answer, or add a field to it."

**Mistakes to expect.**
- Forgetting to publish after a change, so the form gets the old answer. Say it once to the room: every change needs
  Publish again.
- Pasting the Response Body while the box is **Fixed**. The text with the braces in it is not valid JSON, so n8n may
  answer with its own error rather than with that text: not verified, and not tried by any test.
- Leaving the webhook's **Respond** on `Immediately`: the Respond to Webhook node then has nothing to answer.

**Debrief question:** What did the sender learn from n8n's first answer, and what does it learn now?

---

## Stage 2: Refuse a bad one

**Purpose:** a flow checks its input and refuses a bad one with a reason. **Planned minutes:** 25

**What to say.** "Every check here protects something later: no e-mail, nobody to answer; a robot, a CRM full of rubbish;
no consent, a person contacted who did not agree. A refusal with its reason is a kindness to whoever sent it, and to
whoever reads the logs." On consent: "Decide what a valid value is, and refuse everything else with a reason. A real
checkbox sends `on`, not `true`; this flow refuses it cleanly instead of guessing."

**Mistakes to expect.**
- Connecting the **false** output to the next check instead of the **true** output: every good enquiry is refused. The
  starter's refusals are already on the false outputs; point at them.
- Choosing the operator under the wrong type: `is true` is under **Boolean**, `contains`, `is empty` and `is equal to`
  under **String**.
- Leaving *Convert types where required* off on *Consent given?*: for a consent of `true`, n8n then stops at that node
  with "Wrong type: 'true' is a boolean but was expecting a string", and the form gets n8n's own error instead of an answer
  (read in n8n 2.48.8's source; not run in the lab's tests).

**Debrief question:** Which of the three refusals would you most want to know about in your own work, and why?

---

## Stage 3: No duplicates

**Purpose:** look before you write; the same enquiry twice leaves one contact. **Planned minutes:** 30

**What to say.** "Every system that creates records gets the same thing twice sooner or later. The question is never
whether, only what then. Here: look the person up first, by something that does not change; create them only if they are
not there; otherwise add a note." Explain `$('Enquiry arrives').item.json...` with the room: after the lookup, `$json` is
the CRM's answer, not the enquiry. Then the double click: "Two enquiries at the same moment both look up, both find
nothing, and both try to create. The practice CRM refuses the second with 409. A real CRM may not; the lookup makes
duplicates rare, and only the CRM's own rule makes them impossible."

**Mistakes to expect.**
- Setting the query parameter's Name to `e-mail` or `Email`: the CRM answers 400, "Look a contact up by ?email=".
- Leaving *Answer with the name* in place, so the flow answers before anything is written.
- A node renamed differently from the guide, so a later expression that names it fails.
- The two outputs of *Known contact?* swapped, false to *Add a note* and true to *Create the contact*: a new person's
  enquiry reaches *Add a note* with no contact to add it to, so nothing is written and the form gets n8n's own error
  instead of "recorded", at every send. This is read from the files and the practice CRM, which answers 404 to a note for
  a contact it does not have; it is not tried by any test. Two contacts for one e-mail cannot appear: the practice CRM
  refuses the second with 409 (the office's own tests).

**Debrief question:** What in your own work is matched by a name today, that should be matched by something that does
not change?

---

## Repair A or B

**Purpose:** find and repair a broken flow from its symptoms. **Planned minutes:** 15

**What to say.** "Start from what you can see. Reproduce it, read the answer, read the office window and the executions,
then open the node you suspect. Hints get more direct; wait a minute before the next one." Everyone does A; those who
finish do B. Pair people who finish with people who are stuck, and ask the one who finished to ask questions, not to give
the answer.

**Mistakes to expect.** Changing the form's path in repair A instead of the flow's; in repair B, changing the name in the
form back to `Maya Rivers` and calling it fixed.

**Debrief question:** Which symptom misled you first, and what showed you the real cause?

---

## Close of session 1

**Purpose:** the flows survive until session 2. **Planned minutes:** 5

**What to say.** "Stop the lab with `docker compose down`, not `down -v`: `-v` deletes your n8n account and your flows.
Next time we start from the stage-4 starter, which holds the finished stage 3, so nothing you did today is lost if
something goes wrong at home."

---

## Recap

**Purpose:** everyone's lab runs again, and the room remembers what the office window shows. **Planned minutes:** 5

**What to say.** "Start the lab with `docker compose up -d`, open the office window, reset it, and send one enquiry to
your stage-3 flow. Read aloud what the window shows: one contact, one note."

**Mistakes to expect.** Docker Desktop not started yet (its first start of the day takes a while); a laptop whose flows are
gone: it imports the stage-4 starter like everyone else, and loses nothing.

---

## Stage 4: Ask the AI step, and check it

**Purpose:** an AI step's output is a suggestion until something checks it. **Planned minutes:** 25

**What to say.** "The practice AI step is a stand-in that is not a model: it answers from fixed rules, the same every
time, so that we all see the same thing. The lesson is about any AI step. A real model can return a confident figure the
person never wrote. Here we check one narrow thing, figures; the habit is what matters: decide what must be true of an AI
answer before you use it, and check exactly that." Walk through the code's comments on the projector; nobody needs to
write code. Then two things the check lets through: a figure written in words, and a right figure with the wrong
meaning; the participant guide's stage 4 box lists four more limits of the code. Read out the box *What changes with a real model*.

**Mistakes to expect.**
- Pasting the code below the starter's two lines instead of replacing them.
- Pasting into only one of the two note fields, so a new contact carries the checked note and a known one does not, or
  the other way round.
- Leaving a fault on for stage 5: the notes look wrong and people suspect their new nodes.

**Debrief question:** What else could an AI step get wrong that a simple check could catch before it is used?

---

## Stage 5: A person approves

**Purpose:** nothing is written before a person says yes. **Planned minutes:** 30

**What to say.** Before the build, on the projector, with the stage-5 picture (`docs/pictures/stage-5-solution.svg`):
"Two requests, two answers. The form's request is answered at once by the first Respond node it reaches: 202, waiting.
The run then waits. The person's click in the inbox is a second request, to the resume address; it is answered by the
Respond node the run reaches after the Wait." Make everyone press **Reject** first, and look at the office window:
nothing written. Then Approve. Then two of the limits in the participant guide's box *The limits of this design*: "The resume address approves for anyone who holds it; that is fine
here, on your own laptop, and not anywhere else. And an enquiry nobody decides waits for ever."

**Mistakes to expect.**
- The Wait node's **HTTP Method** left at its default: the inbox's `POST` does not reach the run, and a decision seems to
  do nothing.
- The Wait node's **Respond** left as it is, so the inbox shows an answer that does not say what was written.
- `resumeUrl` pasted while the box is **Fixed**: the inbox receives text that is not an address, and refuses it with 400
  (the office's own tests show this); the form then gets *Answer: not queued*.
- Pressing Approve in the very same second as sending: n8n answers 409 "running already" until the run reaches the
  Wait node (seen in the lab's tests), so the office tries again for a few seconds; it is not a fault.

**Debrief question:** Which step in your own work should never happen without a person saying yes?

---

## Stage 6: When it fails

**Purpose:** a failure changes the answer and is reported, and the answer is honest about what was written. **Planned
minutes:** 25

**What to say.** "A failed lookup wrote nothing; a failed write may have written. Those are two different answers." After
the build, the four faults, one after another, with the office window on the projector. The one to stop at is *writes,
but answers too late*: the flow reports a failure, and the window shows the contact. "That is why the answer says
'unknown: check the CRM', and why 200 is not proof either." Tell them the story of the quote marks: the lab's own first
test run broke exactly that way, which is why the answer names the step, and the reason goes to the office.

**Mistakes to expect.**
- Setting **On Error** on one CRM node and not the other two.
- Connecting a node's success output to *Tell the office* instead of its error output (the error output appears only after
  the setting is changed).
- Leaving a success link to *Answer: recorded* in place beside the new one to *CRM confirmed?*.
- Waiting for the slow fault's answer and thinking the flow hangs: it answers after the five-second timeout.

**Debrief question:** When something fails in one of your own flows today, who finds out, and how long does it take?

---

## Repairs C and D

**Purpose:** find and repair a broken flow from its symptoms; test the "no" path. **Planned minutes:** 20

When you assess, this part runs as `instructor/variants.md` gives it: repair C, then the practical check, in 30 planned
minutes.

**What to say.** As for repairs A and B. Everyone does C; those who finish do D. For D, the minimum repair is enough for
the room; the full repair is stage 6's branch, which they have just built.

**Mistakes to expect.** "Fixing" repair C by approving instead of rejecting, and seeing it work; "fixing" repair D by
turning the header on and leaving **On Error** on `Continue`.

**Debrief question:** What did the "no" path show you that the "yes" path did not?

---

## Close

**Purpose:** take the questions home. **Planned minutes:** 5

**What to say.** Hand out the card. "Pick one flow in your own work, or one you have been shown, and ask it these six
questions this week." Ask two or three people which question they will ask first.

---

*Teaching text licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/).*
