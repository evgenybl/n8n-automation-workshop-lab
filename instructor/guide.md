# The instructor guide, stage by stage

**This lab has not been taught to a class of people. Every minute here is planned, not measured; the mistakes listed are
the ones the design expects, not ones observed in a room.** Where a mistake's symptom was seen in the lab's automated
tests, the line says so; the other symptoms are what n8n's documentation leads one to expect. The steps for n8n's own screen were written from n8n's
documentation and the workflow files, and were not walked through on a screen by a person: do the whole lab yourself on
your own laptop before you teach it, and note anything on your screen that differs from the participant guide.

Keep the office window on the projector whenever you can. It is the lab's best teacher: it shows what a flow really did,
not what it says it did.

---

## Opening

**Purpose:** everyone knows what they will build, why, and has a working lab. **Planned minutes:** 10

**What to say.** "Most automations work once, on a good input, while someone watches. Then they meet a real one: a form
with no e-mail, the same person twice, an AI answer with a made-up figure, a CRM that is down. A flow that works once is a
demo; a flow that says what happened when it fails is automation. In three hours you will build the second kind." Then
show the office window, the form and the inbox, and say what each is: practice software on their own laptop, not a real
CRM, and an AI step that is a stand-in, not a model.

**Mistakes to expect.** A laptop where the check page does not open (see `when-things-go-wrong.md`); someone who did not
set up the n8n owner account and is now choosing a password: let them, it takes a minute.

---

## Stage 1: Catch an enquiry

**Purpose:** the loop from the outside: a form sends, a webhook catches, the flow answers. **Planned minutes:** 15

**What to say.** "A webhook is an address that starts your flow. The form is the outside world; your flow decides what
the outside world hears back. Right now it hears 'Workflow was started', which tells it nothing." After they build it:
"Now the sender knows its enquiry arrived. That answer is the first thing a flow owes anyone who uses it."

**Mistakes to expect.**
- Forgetting to publish after a change, so the form gets the old answer. Say it once to the room: every change needs
  Publish again.
- Typing the Response Body as **Fixed**, so the answer is the text `{{ $json.body.name }}` itself.
- Leaving the webhook's **Respond** on `Immediately`: the Respond to Webhook node then has nothing to answer.

**Debrief question:** What did the sender learn from n8n's first answer, and what does it learn now?

---

## Stage 2: Refuse a bad one

**Purpose:** a flow checks its input and refuses a bad one with a reason. **Planned minutes:** 20

**What to say.** "Every check here protects something later: no e-mail, nobody to answer; a robot, a CRM full of rubbish;
no consent, a person contacted who did not agree. A refusal with its reason is a kindness to whoever sent it, and to
whoever reads the logs."

**Mistakes to expect.**
- Connecting the refusal to the **true** output instead of **false**: every good enquiry is refused.
- Choosing the operator under the wrong type: `is true` is under **Boolean**, `contains` and `is empty` under **String**.
- Forgetting the Response Code option, so a refusal answers 200: the form shows "refused" in green. Ask them what a
  program sending the form would understand from a 200.

**Debrief question:** Which of the three refusals would you most want to know about in your own work, and why?

---

## Stage 3: No duplicates

**Purpose:** look before you write; the same enquiry twice leaves one contact. **Planned minutes:** 25

**What to say.** "Every system that creates records gets the same thing twice sooner or later. The question is never
whether, only what then. Here: look the person up first, by something that does not change; create them only if they are
not there; otherwise add a note." Explain `$('Enquiry arrives').item.json...` with the room: after the lookup, `$json` is
the CRM's answer, not the enquiry.

**Mistakes to expect.**
- `localhost` instead of `office` in the URL: n8n, inside its container, cannot reach the office that way; expect the
  node to fail with a connection error.
- The badge header missing, or its name misspelt: the CRM answers 401, and the office window says why (seen in the
  lab's tests: repair D).
- The note URL typed as **Fixed**: the braces are sent as they are, not as a contact number; expect the call to fail.
- A node renamed differently from the guide, so a later expression that names it fails.

**Debrief question:** What in your own work is matched by a name today, that should be matched by something that does
not change?

---

## Stage 4: Ask the AI step, and check it

**Purpose:** an AI step's output is a suggestion until something checks it. **Planned minutes:** 20

**What to say.** "The practice AI step is a stand-in that is not a model: it answers from fixed rules, the same every
time, so that we all see the same thing. The lesson is about any AI step. A real model can return a confident figure the
person never wrote. Here we check one narrow thing, figures; the habit is what matters: decide what must be true of an AI
answer before you use it, and check exactly that." Walk through the code's comments on the projector; nobody needs to
write code.

**Mistakes to expect.**
- Pasting the code into the wrong place, or leaving n8n's example code below it.
- Changing only one of the two note fields, so a new contact carries the checked note and a known one does not, or the
  other way round.
- Leaving the *invents a figure* fault on for stage 5: the notes look wrong and people suspect their new nodes.

**Debrief question:** What else could an AI step get wrong that a simple check could catch before it is used?

---

## Stage 5: A person approves

**Purpose:** nothing is written before a person says yes. **Planned minutes:** 25

**What to say.** "The Wait node pauses the run. n8n makes an address for that one run, the resume address, and we send it
to the inbox with the enquiry. Pressing Approve or Reject calls that address, and the run carries on with the decision.
Two answers now: the form hears 'waiting' at once; the person who decides hears what was written." Make everyone press
**Reject** first, and look at the office window: nothing written. Then Approve.

**Mistakes to expect.**
- The Wait node's **Respond** left as it is, so the inbox shows an answer that does not say what was written.
- `resumeUrl` typed as **Fixed**: the inbox receives the text `{{ $execution.resumeUrl }}`, which is not an address,
  and refuses it with 400 (the office's own tests show this); expect *Ask a person* to fail.
- Comparing the decision with `Approve` (a capital A) while the inbox sends `approve`: every decision becomes a rejection.
- Pressing Approve in the very same second as sending: n8n answers 409 "running already" until the run reaches the
  Wait node (seen in the lab's tests), so the office tries again for a few seconds; it is not a fault.

**Debrief question:** Which step in your own work should never happen without a person saying yes?

---

## Stage 6: When it fails

**Purpose:** a failure changes the answer and is reported; nothing is half-written. **Planned minutes:** 20

**What to say.** "First, watch it fail the old way: CRM set to fail, send, approve. The inbox shows n8n's own error, and
the office learns nothing. Now give every CRM call a second way out." After the build: "Three faults, three honest
answers, and the office window says what failed. And 200 is not proof: a system can say 'fine' and write nothing. That is
why the flow checks that the answer names the contact." Tell them the story of the quote marks: the lab's own first test
run broke exactly that way, which is why the answer names the step, and the reason goes to the office.

**Mistakes to expect.**
- Setting **On Error** on one CRM node and not the other two.
- Connecting a node's success output to *Tell the office* instead of its error output (the error output appears only after
  the setting is changed).
- Waiting for the slow fault's answer and thinking the flow hangs: it answers after the five-second timeout.

**Debrief question:** When something fails in one of your own flows today, who finds out, and how long does it take?

---

## The repairs

**Purpose:** find and repair a broken flow from its symptoms. **Planned minutes:** 25

**What to say.** "Start from what you can see. Reproduce it, read the answer, read the office window and the executions,
then open the node you suspect. Hints get more direct; wait a minute before the next one." Everyone does A, then C. Those
ahead do B and D. Pair people who finish with people who are stuck, and ask the one who finished to ask questions, not to
give the answer.

**Mistakes to expect.** Changing the form's path in repair A instead of the flow's; "fixing" repair D by turning the
header on and leaving **On Error** on `Continue`.

**Debrief question:** Which symptom misled you first, and what showed you the real cause?

---

## Close

**Purpose:** take the questions home. **Planned minutes:** 10

**What to say.** Hand out the card. "Pick one flow in your own work, or one you have been shown, and ask it these six
questions this week." Ask two or three people which question they will ask first.

---

*Teaching text licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/).*
