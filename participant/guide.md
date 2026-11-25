# The lab guide: lead intake in n8n, stage by stage

**A flow that works once is a demo; a flow that says what happened when it fails is automation.**

You will build one flow in six stages. It takes an enquiry from a website form, checks it, stops duplicates, uses an AI
step carefully, waits for a person's approval, and says honestly when something fails. Each stage starts from a file that
holds the previous stage's finished flow and the new stage's parts, already placed and mostly set up, so you spend your
time on the idea of the stage, not on typing. Every person and company in this lab is invented. The minutes given for
each stage are planned, not measured: this lab has not been taught to a class of people yet.

Do the setup page (`setup.md`) and its check first. Read this guide on the lab's page on GitHub, where the tables and the
folded hints display properly; in a plain text editor they do not.

> **How these steps were written.** The steps for n8n's own screen were written from n8n's documentation and from the
> workflow files in this lab, using the labels in n8n 2.48.8's documentation and its own English text. They were not
> walked through on a screen by a person. On 25 November 2026 an AI agent, driving a browser, carried out the steps of
> *How every stage works* (not the test address), stages 1 and 2 and repair A on n8n 2.48.8's own screen, with n8n
> started without Docker, and the words of those parts were corrected to what the screen showed: where the screen and
> n8n's documentation differ, this guide gives the screen's word and names the documentation's. The same agent made
> the corrections, so this was not an independent test. Stages 3 to 6 have not been carried out on a screen: there the
> guide says where something sits only as n8n's documentation does, and names the page (the list is at the end of
> *How every stage works*). Two labels are not in the documentation and were seen on the screen: *Convert types where
> required*, and the If node's empty boxes, shown as value1 and value2. Every flow these steps build was run by the
> lab's automated tests on n8n 2.48.8, and every answer quoted below is what those flows answered there. If a label on
> your screen differs, look for the nearest match, and tell your instructor.
>
> **The first step of every stage is the import, and this is where it is.** Beside the workflow's name, in the canvas
> header, there is a button with three dots. Select it, then **Import**, then **From file**. n8n's documentation
> calls the same thing **Import from File**, in a menu it calls the Workflow menu
> (*Export and import* (https://docs.n8n.io/build/manage-workflows/export-and-import)); on n8n 2.48.8's screen no
> menu has that name. The first time you import, n8n asks *Importing this from an AI tool?* Tick **Don't show again**
> and choose **Skip**: it does not ask again.

**Two rules for every stage.**

1. **Every stage starts by importing its starter file into a new workflow.** Do not carry on in the flow you built in
   the stage before: each stage's flow listens at its own address (`stage-1`, `stage-2`, ...), and the old one would
   answer the new stage's form with 404.
2. **Paste every value shown in a grey block; do not type it.** Each block has a copy button on GitHub. A typing slip in
   an expression fails only when the flow runs, with n8n's own message. The short values written in the tables, such as
   `@` or `approve`, you type as they are. Working from a printed copy? Every block is also in this page's file in the
   lab's folder, `participant/guide.md`, which you can open in a text editor and copy from.

---

## Words you will meet

| Word | What it means here |
|---|---|
| **Flow** (n8n says *workflow*) | A chain of steps that runs by itself when something happens. |
| **Canvas** | n8n's drawing area, where a flow's nodes and the lines between them are shown. |
| **Node** | One step in a flow, shown as a box on the canvas: "check the e-mail", "call the CRM". |
| **Trigger** | The node that starts a flow. In this lab it is always a webhook. |
| **Webhook** | An address on the web that starts a flow when something sends data to it. The form sends each enquiry to your flow's webhook. |
| **Path** | The last part of a webhook's address, such as `stage-3` in `http://localhost:5678/webhook/stage-3`. |
| **Execution** | One run of a flow. n8n keeps a record of each one, step by step. |
| **Expression** | A value that n8n works out while the flow runs, written between `{{` and `}}`, such as `{{ $json.body.email }}`: the e-mail of the enquiry this node received. |
| **Fixed / Expression** | The two ways a box in a node can hold a value: as it is written (Fixed), or worked out each time (Expression). |
| **Publish** | Make a flow live, so its webhook answers. n8n's documentation says your edits stay a draft until you publish again. |
| **JSON** | A plain-text way of writing data as names and values, such as `{"name": "Maya Rivers"}`. The form, the flow and the office send each other JSON. |
| **HTTP request** | How programs on the web call each other: an address, a method (`GET` to read, `POST` to send), and sometimes headers and a body of data. n8n's **HTTP Request** node makes one. |
| **Status** | The number every answer on the web starts with: `200` fine; `202` accepted, not finished yet; `400` the request was wrong; `401` not allowed; `404` nothing here; `409` a conflict, such as a record that exists already; `500` the server failed; `502` a system behind it failed; `503` a service is not available. |
| **CRM** | The system where a business keeps its contacts and notes. Here it is a practice CRM inside the practice office: practice software, not a CRM product. |
| **Duplicate** | A second record for the same person. Stage 3 stops them. |

## How every stage works

1. **Create a new, empty workflow.** Select the create button, a plus sign in the upper-left corner of the side menu
   (the documentation calls it the universal create resource icon), then select **New workflow** (the documentation
   says *Workflow*). On n8n's Overview page there is also a **Create workflow** button in the upper-right corner, once
   you have a workflow; before that, the page shows two cards, *Build an agent* and *Build a workflow*.
2. **Import the stage's starter file** (rule 1). Select the three dots beside the workflow's name, then **Import**, then
   **From file** (the box at the top of this guide), and pick the starter from the lab's `workflows` folder. The
   workflow takes the starter's name. *If your screen differs:* open the file in a text editor, copy all of it, click
   on n8n's empty canvas and paste (this second way was not tried on a screen).
3. **Build** what the stage's table says. Each row is one thing to do; a row that says **P1** means "paste block P1".
4. **Publish**: select the **Publish** button in the canvas header, then **Publish** again in the window that opens
   (its two boxes, *Version name* and *Describe changes*, can stay as they are). The first time you publish a workflow,
   n8n then shows a note, *Workflow published*: choose **Got it**. A panel headed *Production Checklist* may then cover
   the upper-left part of the canvas: the lab needs nothing in it, and the **X** beside its heading closes it. The
   button now reads **Published**. Do this again after every change: your edits stay a draft until you publish, and
   after a change the button reads **Publish** again.
5. **Reset the office, then send an enquiry.** In the office window, `http://localhost:3333`, choose **Reset the office**
   (the browser asks whether to empty the whole office: choose **OK**), so that what you see belongs to this try. Then
   open the stage's form address, choose **Fill a sample enquiry**, then **Send**. The form shows what your flow
   answered.
6. **Check yourself** in the office window: it shows the contacts, the notes, the approvals, the failures your flow
   reported, and every call the office received, newest first.

**How to open and close a node.** Double-click a node on the canvas: its window opens, with its settings in the middle.
The **X** in the window's upper-right corner closes it and brings you back to the canvas.

**How to add a node.** Select the plus sign at the end of the short line on the right side of the node you want to
follow (the documentation calls it **Add node**), or **Add first step** on an empty canvas; n8n opens the nodes panel,
headed *What happens next?*, where you can search. Type the node's name, such as `If`, and choose it. The new node's
window opens at once. A new node arrives with its type's name, such as *If*; the table's row tells you to rename it,
because later expressions name earlier nodes, such as `$('Enquiry arrives')`, and a different name breaks them. **To
rename a node**, close its window, hover over the node on the canvas, select the three dots that appear above it, then
**Rename** (the documentation says *Rename node*); type the new name in the small window that opens and choose
**Rename**.

**How to connect two nodes.** Press the grey dot on the right side of a node and slide the arrow to the dot on the left
side of the following node (the documentation calls that one a grey rectangle; on n8n 2.48.8's screen both are dots).
An **If** node has two outputs, **true** and **false**; connect each to what should happen in that case. **To delete a
connection**, hover over the line: two small icons appear at its middle, a plus sign and a dustbin. Move along the line
to the dustbin, whose tip reads **Delete**, and select it. If no icons appear, click an empty part of the canvas first,
then hover again.

**How to put a pasted value in a box.** A value with `{{ }}` in it is an expression: switch the box from **Fixed** to
**Expression**, then paste. The table says *(as an Expression)* on each such row. Where a box already holds a value, the
row says *select everything in the box, then paste*, so that the new value replaces the old one instead of joining it.
The **Fixed** and **Expression** switch shows only while the pointer is over that box: on the line over the box,
towards its right end, beside the box's label where it has one.

**Seeing inside a run.** Select the **Executions** tab in the top menu, and choose a run: n8n shows what each node received
and sent on. This is where you look when an answer surprises you. The list on the left holds this workflow's runs only:
if the right side shows a run while the list says *No executions found*, that run is left over from the workflow you
looked at before (on n8n 2.48.8's screen it went away when the page was reloaded while the **Editor** tab was shown).

**Starting a stage again.** Delete your half-built workflow, or unpublish it (the small arrow beside the **Published**
button, then **Unpublish**, and **Unpublish** again in the window that opens; deleting was not tried on a screen). Then
import the stage's starter into a new workflow, so that only one flow listens at the stage's path.

**Comparing with a solution.** Each stage's solution file listens at its own path, `stage-1-solution` to
`stage-6-solution`, so you can import it beside your own flow and send to it from
`http://localhost:3333/form?path=stage-1-solution` (and so on).

**Where the places named on this page come from**, in n8n's documentation. The names in this table are the
documentation's; where n8n 2.48.8's screen showed another word or shape (**New workflow**, **Rename**, a dot where the
documentation has a rectangle), the paragraphs above give the screen's:

| What | Page |
|---|---|
| The create button, then Workflow | *Create and run workflows* (https://docs.n8n.io/build/understand-workflows/create-and-run-workflows) |
| The Publish button in the canvas header, and the window it opens | *Save and publish workflows* (https://docs.n8n.io/build/understand-workflows/save-and-publish-workflows) |
| Add node, Add first step, the nodes panel, Rename node in the node's context menu, the Settings tab | *Work with nodes* (https://docs.n8n.io/build/understand-workflows/workflow-components/work-with-nodes) |
| The grey dot, the grey rectangle, and Delete on a connection | *Connect nodes together* (https://docs.n8n.io/build/understand-workflows/workflow-components/connect-nodes-together) |
| The Executions tab in the top menu | *View executions for a single workflow* (https://docs.n8n.io/build/understand-workflows/understand-executions/view-executions-for-a-single-workflow) |
| The Wait node's Respond parameter for On Webhook Call | *Wait* (https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/) |

**Live or test address.** The form can send to the *live* address (`/webhook/...`), which answers once the flow is
published, or to the *test* address (`/webhook-test/...`), which answers one call after you press **Execute workflow** on
the canvas and shows that call's data in each node. This guide uses the live address. The test address is useful while you
build, because you can see the data arrive.

---

## Stage 1: Catch an enquiry

**Goal:** a webhook that answers each enquiry with the enquiry's name. **Planned minutes:** 20. **Starter:** `workflows/stage-1-starter.json`.
**Your form address:** `http://localhost:3333/form?path=stage-1`.

**What the starter brings:** one node, **Enquiry arrives**, a Webhook trigger. It listens for `POST` at the path `stage-1`,
and it answers **Immediately**, before anything else happens. Publish it and send the sample from the form: the form
shows n8n's own answer.

<!-- run: reset; send stage-1 maya -->
```text
Status:    200
Answer:    {"message":"Workflow was started"}
```

That tells the sender only that something started. Your flow will now answer properly. A Webhook node can answer at once
by itself, or leave the answer to a later **Respond to Webhook** node, which answers with what you choose; step 4
chooses the second, and step 5 adds that node.

| # | Do this | Node | Setting | Value |
|---|---|---|---|---|
| 1 | **Import into a new workflow** | | starter | `workflows/stage-1-starter.json` |
| 2 | Look at | `Enquiry arrives` | Path | `stage-1` |
| 3 | Look at | `Enquiry arrives` | HTTP Method | `POST` |
| 4 | Set | `Enquiry arrives` | Respond | `Using 'Respond to Webhook' Node` |
| 5 | Add a **Respond to Webhook** node, and rename it to `Answer with the name` | `Answer with the name` | after | `Enquiry arrives` |
| 6 | Set | `Answer with the name` | Respond With | `JSON` |
| 7 | Select everything in the box, then paste (as an Expression) | `Answer with the name` | Response Body | **P1** |
| 8 | Publish; reset the office; send the sample | | | |

Row 1, the import: the three dots beside the workflow's name, then **Import**, then **From file** (the box at the top of
this guide). Rows 2 to 4: double-click **Enquiry arrives** to open it. Row 5: the new node's window opens at once.
Close it, rename the node, then double-click the node to open it again for rows 6 and 7.

**P1** (step 7: the box already holds a sample body, so select everything in it first):

```paste
{
  "status": "received",
  "name": {{ JSON.stringify($json.body.name) }}
}
```

**What it means.** A webhook gives the next node everything it received; the form's fields are under `body`, so
`$json.body.name` is the name typed in the form. **Why `JSON.stringify`, and why no quote marks around it:**
`JSON.stringify` writes the name as JSON text, quote marks included, with any quote mark, backslash or line break inside
the name made safe; a name put straight between quote marks of your own breaks the answer when it holds a quote mark, and
can even add a field of its own.

**Look at it afterwards.** The form shows:

<!-- run: reset; send stage-1-solution maya -->
```text
Status:    200
Answer:    {"status":"received","name":"Maya Rivers"}
```

Now type `Maya "MJ" Rivers` in the form's name box and send again. The answer still holds, quote marks and all:

<!-- run: reset; send stage-1-solution quoted -->
```text
Status:    200
Answer:    {"status":"received","name":"Maya \"MJ\" Rivers"}
```

**Check yourself in the office window.** Choose **Reset the office**, send the sample, and look under *Every call the
office received*: the newest row is a **Form** call, "Sent to /webhook/stage-1; the flow answered 200." In n8n, the
**Executions** tab shows the same run, with the whole enquiry as the webhook received it.

---

## Stage 2: Refuse a bad one

**Goal:** an enquiry with no e-mail, a filled honeypot or no consent is answered with 400 and the reason; a good one
passes. **Planned minutes:** 25. **Starter:** `workflows/stage-2-starter.json`. **Your form address:** `http://localhost:3333/form?path=stage-2`.

**A honeypot** is a field that people never see on the page, so they leave it empty; a robot that fills in every field
fills it in too. The form has one, called `website`; its box *Act as a robot* fills it for you. **Status 400** means "the
request was wrong": the sender learns that it was refused, and why.

**What the starter brings:** your stage-1 flow; three **If** nodes, *Has an e-mail?*, *Honeypot empty?* and *Consent
given?*, with no condition set yet; and three answers, *Refuse: no e-mail*, *Refuse: looks like a robot* and *Refuse: no
consent*, each set to answer 400 with its reason and already connected to the **false** output of its If node. You set the
three checks and connect their **true** outputs.

An If node's condition has three parts on the screen: a **left box** for the value to test, an **operator** menu (choose
the type first, such as String, then the comparison), and a **right box** for what to compare with. n8n's documentation
calls the menu the data type dropdown, and the boxes the condition's fields and values. On n8n 2.48.8's screen the left
box and the operator menu share one row, and the right box is the box under them; while they are empty, the two boxes
show *value1* and *value2*.

| # | Do this | Node | Setting | Value |
|---|---|---|---|---|
| 1 | **Import into a new workflow** | | starter | `workflows/stage-2-starter.json` |
| 2 | Delete the connection | `Enquiry arrives` | | to `Answer with the name` |
| 3 | Connect | `Enquiry arrives` | its output | to `Has an e-mail?` |
| 4 | Paste (as an Expression) | `Has an e-mail?` | left box | **P1** |
| 5 | Set | `Has an e-mail?` | operator | String, then `contains`; right box `@` |
| 6 | Connect | `Has an e-mail?` | its **true** output | to `Honeypot empty?` |
| 7 | Paste (as an Expression) | `Honeypot empty?` | left box | **P2** |
| 8 | Set | `Honeypot empty?` | operator | String, then `is empty` |
| 9 | Connect | `Honeypot empty?` | its **true** output | to `Consent given?` |
| 10 | Paste (as an Expression) | `Consent given?` | left box | **P3** |
| 11 | Set | `Consent given?` | operator | String, then `is equal to`; right box `true` |
| 12 | Set | `Consent given?` | Convert types where required | `on` |
| 13 | Connect | `Consent given?` | its **true** output | to `Answer with the name` |
| 14 | Publish; reset the office; send four enquiries (below) | | | |

Row 2: the line from *Enquiry arrives* to *Answer with the name* runs behind the three If nodes. Click an empty part of
the canvas, then hover over a part of the line that you can see, between *Enquiry arrives* and *Has an e-mail?*: the
plus sign and the dustbin appear at the middle of the line, on top of *Honeypot empty?*. Move along the line to the
dustbin and select it.

Row 11: after you type `true`, wait two seconds before you go on to row 12. The reason is below the blocks.

**P1** (step 4):

```paste
{{ $json.body.email }}
```

**P2** (step 7):

```paste
{{ $json.body.website }}
```

**P3** (step 10):

```paste
{{ $json.body.consent }}
```

*Convert types where required* is a switch of the If node, under its condition; the label is n8n's own, and the If
node's documentation does not name it. Without it, an enquiry with a consent of `true` stops at *Consent given?*: the
form shows status 500 and n8n's own answer, "Error in workflow", and the run in the **Executions** tab says "Wrong type:
'true' is a boolean but was expecting a string" (seen on n8n 2.48.8's screen on 25 November 2026; not run in the lab's
tests).

**After you type in an If node's right box, wait two seconds before you do anything else.** On n8n 2.48.8's screen an
If node took in the letters typed in its right box only after a pause. When the switch was pressed, or the node's
window closed, up to a second after the last letter, letters were lost: `true` was left as `t` in each of six measured
tries, and in other tries as `tru` once and as nothing twice. A second and a half after the last letter, and two
seconds after, nothing was lost (each wait was tried once). The box can show `true` while n8n has kept less: to be
sure, close the node, open it again and read the right box. It must say `true`. The same kind of node is used in every
later stage, where this was not tried. A single letter (`@`), a block put in in one go by a script, and the webhook's
**Path** were kept when the node was closed a third of a second later.

**Why consent is compared as text with types converted.** The lab's form sends consent as the value `true`. A plain HTML
checkbox on a real website sends `on` instead. With *Convert types where required* on, the check turns whatever arrives
into text and asks whether it is exactly `true`: `true` passes, and `false`, `on` or a missing value are refused with the
reason. Decide what a valid value is, and refuse everything else with a reason, rather than guessing what a sender meant.

**The other two checks compare text as it is.** *Has an e-mail?* and *Honeypot empty?* leave *Convert types where
required* off, so they expect text. A plain web form sends every field as text, and the lab's form sends the e-mail and
the hidden field as text. What these two checks do with a value that is not text, such as a number, is not tried by any
test of this lab.

**Look at it afterwards.** Send four enquiries from the form: the sample as it is (answered as in stage 1); the sample
with the e-mail box emptied; the sample with *Act as a robot* ticked; the sample with the consent box unticked.

<!-- run: reset; send stage-2-solution no-email -->
```text
Status:    400
Answer:    {"status":"refused","reason":"The enquiry has no e-mail address."}
```

<!-- run: reset; send stage-2-solution robot -->
```text
Status:    400
Answer:    {"status":"refused","reason":"The hidden website field is filled in, so this looks like a robot."}
```

<!-- run: reset; send stage-2-solution no-consent -->
```text
Status:    400
Answer:    {"status":"refused","reason":"The enquiry does not agree to be contacted: consent must be true."}
```

A sender whose form sends `on` for the ticked box gets the same answer:

<!-- run: reset; send stage-2-solution consent-on -->
```text
Status:    400
Answer:    {"status":"refused","reason":"The enquiry does not agree to be contacted: consent must be true."}
```

**Check yourself in the office window.** Choose **Reset the office**, send the three bad enquiries again, and look: they
reached nothing but your flow. There is no CRM call, no AI step call and no inbox call, only **Form** rows with "the flow
answered 400".

**Going further: a question, not a step.** The stage 2 flow does not check the name. An enquiry with no name at all (the
lab's form always sends one, even an empty one, but another sender may not) passes the three checks and reaches the answer
that carries the name. What should your flow answer to it, and which check would you add? An enquiry with no name is not
tried by any test of this lab, so this guide does not say what n8n answers to it.

---

## Stage 3: No duplicates

**Goal:** look the contact up first; then create it, or add a note to it. The same enquiry twice leaves one contact and
two notes, never two contacts. **Planned minutes:** 30. **Starter:** `workflows/stage-3-starter.json`. **Your form address:**
`http://localhost:3333/form?path=stage-3`.

**Why.** Forms are sent twice: a double click, a person who writes again next week. A flow that creates a contact every
time fills the CRM with copies of the same person. Engineers call a step that does no harm when it runs twice
*idempotent*; here, it means "the second time, add a note, not a person".

**What the starter brings:** your stage-2 flow, and four nodes, already set up:

- **Look up the contact**, an HTTP Request: `GET` from `http://office:3333/crm/contacts`, with the header the practice CRM
  wants and a five-second timeout. You set *what* it looks up by.
- **Add a note** and **Create the contact**, HTTP Requests that `POST` to the practice CRM: the note's text, or the new
  contact's name, e-mail, company and first note, all taken from the enquiry.
- **Answer: recorded**, which answers `{"status": "recorded", ...}`, already connected after both.

Open them and look. Two things in them need a word. The practice CRM answers only calls that carry the header
`X-Office-Badge` with the value `practice-badge`: a practice value printed here, not a secret (repair D shows what
happens without it). And the address is `http://office:3333`, not `localhost`: inside the lab, n8n and the office run in
two containers that know each other by name. (A *header* is a line of extra information sent with a call; a *query
parameter* is a name and a value added to an address after a `?`, such as `?email=maya.rivers@example.com`.)

| # | Do this | Node | Setting | Value |
|---|---|---|---|---|
| 1 | **Import into a new workflow** | | starter | `workflows/stage-3-starter.json` |
| 2 | Delete the node | `Answer with the name` | | |
| 3 | Connect | `Consent given?` | its **true** output | to `Look up the contact` |
| 4 | Set | `Look up the contact` | Query Parameters: Name | `email` |
| 5 | Paste (as an Expression) | `Look up the contact` | Query Parameters: Value | **P1** |
| 6 | Add an **If** node, and rename it to `Known contact?` | `Known contact?` | after | `Look up the contact` |
| 7 | Paste (as an Expression) | `Known contact?` | left box | **P2** |
| 8 | Set | `Known contact?` | operator | Boolean, then `is true` |
| 9 | Connect | `Known contact?` | its **true** output | to `Add a note` |
| 10 | Connect | `Known contact?` | its **false** output | to `Create the contact` |
| 11 | Publish; reset the office; send the sample twice | | | |

**P1** (step 5):

```paste
{{ $('Enquiry arrives').item.json.body.email }}
```

**P2** (step 7):

```paste
{{ $json.found }}
```

**Why `$('Enquiry arrives')` and not `$json`.** `$json` is what the node just before sent on. Before the lookup, that is
the enquiry; after it, the CRM's answer (`found`, and the contact). `$('Enquiry arrives').item.json...` names the node the
value comes from, so it keeps working when nodes are added in between.

**Why the contact is created with its first note in one call.** If the flow created the contact and then failed before
adding the note, the CRM would hold a person with no record of why they wrote. One call either writes both or nothing.

**What the practice CRM does for you, and a real one may not.** It matches the e-mail with the spaces at its ends trimmed
and its letters made small, so `Maya.Rivers@example.com ` finds `maya.rivers@example.com`; and it refuses a second
contact with the same e-mail, with status 409. A real CRM may match only the exact text, and may accept the second
contact. That refusal matters for the case this stage opened with: if the same enquiry is sent twice at the same moment
(a double click), both runs can look up before either has written, both find nothing, and both try to create; the
practice CRM refuses the second, and that run stops with n8n's own error. The lookup makes duplicates rare; only the
CRM's own rule makes them impossible.

**Look at it afterwards.** Send the sample twice. Both times the form shows:

<!-- run: reset; send stage-3-solution maya; send stage-3-solution maya -->
```text
Status:    200
Answer:    {"status":"recorded","contact":"C1"}
```

**Check yourself in the office window.** Choose **Reset the office**, send the sample twice, and look: one contact, C1,
Maya Rivers, with two notes. Under the calls: a lookup that found nothing and a creation, then a lookup that found C1 and a
note.

---

## Stage 4: Ask the AI step, and check it

**Goal:** ask the practice AI step for a summary, and use the summary only if every figure in it is in the enquiry.
**Planned minutes:** 25. **Starter:** `workflows/stage-4-starter.json`. **Your form address:** `http://localhost:3333/form?path=stage-4`.

**The practice AI step is a stand-in that is not a model.** It answers from fixed rules, the same way every time, so that
the lab needs no account and no key, and so that everyone in the room sees the same answer. What you learn here is about
any AI step: what it returns is a suggestion until something checks it. A figure that the person never wrote, such as a
budget, is the kind of mistake that does harm when it reaches a CRM unseen.

**What the starter brings:** your stage-3 flow, and two nodes:

- **Ask the AI step**, an HTTP Request that `POST`s the name and the message to `http://office:3333/ai/read`. Its
  *On Error* setting is already *Continue (using error output)*, and both its outputs lead to the next node, so that the
  flow carries on, and says so in the note, when the AI step fails. (Only the CRM wants the badge header; the AI step
  does not.)
- **Check the AI figures**, a **Code** node, empty except for two lines that ask for the code below.

| # | Do this | Node | Setting | Value |
|---|---|---|---|---|
| 1 | **Import into a new workflow** | | starter | `workflows/stage-4-starter.json` |
| 2 | Delete the connection | `Consent given?` | its **true** output | to `Look up the contact` |
| 3 | Connect | `Consent given?` | its **true** output | to `Ask the AI step` |
| 4 | Select everything in the box, then paste | `Check the AI figures` | Code | **P1** |
| 5 | Connect | `Check the AI figures` | its output | to `Look up the contact` |
| 6 | Select everything in the box, then paste (as an Expression) | `Add a note` | Body Parameters: text | **P2** |
| 7 | Select everything in the box, then paste (as an Expression) | `Create the contact` | Body Parameters: note | **P2** |
| 8 | Publish; reset the office; send the sample; then try the two faults (below) | | | |

**P1** (step 4: select everything in the code box, then paste; leave *Mode* and *Language* as they are). You do not
need to write code in this lab; read the comments, which say what each part does.

```paste
// Use the AI summary only if the AI step answered and every figure in its summary is also in the enquiry.
const enquiry = $('Enquiry arrives').first().json.body;
const answer = $input.first().json;
const summary = answer.summary || '';

// Every figure in a text, such as 12 or 1,200 (written 1200 here).
const figures = (text) => (String(text || '').match(/\d+(?:[.,]\d+)*/g) || []).map((f) => f.replace(/,/g, ''));

const inEnquiry = figures(enquiry.message);
const notInEnquiry = figures(summary).filter((f) => !inEnquiry.includes(f));
const aiFailed = Boolean(answer.error);
const summaryUsed = !aiFailed && notInEnquiry.length === 0;

let note = 'Message: ' + enquiry.message + '\n';
if (aiFailed) note += 'AI summary not used: the AI step did not answer.';
else if (summaryUsed) note += 'AI summary (checked): ' + summary;
else note += 'AI summary not used: it gives figures that are not in the enquiry (' + notInEnquiry.join(', ') + ').';

return [{ json: { summaryUsed, notInEnquiry, note } }];
```

**P2** (steps 6 and 7: each box already holds stage 3's value, so select everything in it first):

```paste
{{ $('Check the AI figures').item.json.note }}
```

In plain words, the code takes the enquiry and what the AI step answered; finds every figure in each; keeps the figures of
the summary that the enquiry does not have; and writes the note. If the AI step did not answer, the note says so. With no
figure left over, the note carries the summary, marked *checked*. With any left over, the note carries the message alone,
and says which figure was not in it.

**Look at it afterwards.** Send the sample, and open the contact in the office window. Its note:

<!-- run: reset; send stage-4-solution maya; note -->
```text
Message: Hello, how much would 12 workshop seats cost for our team in March?
AI summary (checked): Maya Rivers asks for a price. The message begins: Hello, how much would 12 workshop seats cost for our team in March?
```

Now choose **Reset the office**, set **Practice AI step** to `invents a figure` under *Faults on request* (reset switches
faults off, so set it after), choose **Apply**, and send the sample again:

If the call list does not say "Answered, with an invented figure (fault on).", the fault is not on: set it again, after
the reset.

<!-- run: reset; fault ai=invent; send stage-4-solution maya; note -->
```text
Message: Hello, how much would 12 workshop seats cost for our team in March?
AI summary not used: it gives figures that are not in the enquiry (4800).
```

Then the same with the AI step set to `fails (answers 500)`:

<!-- run: reset; fault ai=fail; send stage-4-solution maya; note -->
```text
Message: Hello, how much would 12 workshop seats cost for our team in March?
AI summary not used: the AI step did not answer.
```

**Check yourself in the office window.** Choose **Reset the office**, set the fault, send, and look: with *invents a
figure*, the call list says the AI step "Answered, with an invented figure (fault on)."; with *fails*, "Failed on request
(fault on)."; either way, the enquiry is recorded and the note says why it holds no AI summary. Set the fault back to
`works normally` before the next stage.

**What this check lets through.** It compares figures written as figures. It does not catch a figure written in words
("five thousand"), or a right figure with the wrong meaning ("12 seats" summarised as "a budget of 12"). A check catches
exactly what it checks.

It also reads only the message, and takes whatever the AI step sent as its summary. One of the lab's tests runs the code
above in plain Node, not in n8n, and shows four more limits of it:

- A figure in the person's name is reported as invented, because the summary starts with the name: the name `Team 47`
  with the message `What is the price of 3 seats?` gives "AI summary not used: it gives figures that are not in the
  enquiry (47)."
- An answer with no summary is labelled checked: the note says "AI summary (checked):" and no summary follows.
- A summary that is not text is labelled checked too: a summary sent as an object gives "AI summary (checked): [object
  Object]".
- An enquiry with no message gives a note that starts "Message: undefined".

**Going further: an exercise, not a step.** Change the code so that it also reads the name, refuses an answer whose summary
is missing or is not text, and writes something better than "undefined" when there is no message. The lab does not teach
or test such a version.

> **What changes with a real model.** Its answers vary from one call to the next, so the same enquiry can pass the check
> once and fail it the next time. Each call costs money. It needs a key, which belongs in n8n's credentials, never in a
> workflow file. The enquiry, with the person's name and e-mail, leaves your laptop for the model's provider. And the
> check must expect anything: an empty answer, an answer in another shape, a figure in words.

---

## Stage 5: A person approves

**Goal:** before anything is written, a person approves or rejects the enquiry in the approval inbox; the flow waits for
the decision, then writes only on Approve. **Planned minutes:** 30. **Starter:** `workflows/stage-5-starter.json`. **Your form address:**
`http://localhost:3333/form?path=stage-5`. **The inbox:** `http://localhost:3333/inbox`.

**How a flow waits for a person.** n8n's **Wait** node can pause a run until someone calls an address that n8n makes for
that one run: its **resume address**, written `{{ $execution.resumeUrl }}` in an expression. You send that address to the
inbox together with the enquiry. When a person presses Approve or Reject, the inbox calls the address with the decision,
and the paused run carries on from the Wait node, with the decision as its data.

**Two requests, two answers. Read this before you build.**

1. The form sends the enquiry: the first request.
2. *Answer: waiting for approval* answers it at once, status **202** ("accepted, not finished yet"); the run then waits.
3. The person's click in the inbox calls the resume address: the second request.
4. The run goes on from the Wait node, and the next Respond to Webhook node it reaches answers that click.

**What the starter brings:** your stage-4 flow, and four nodes:

- **Ask a person**, an HTTP Request that `POST`s the enquiry and its checked note to `http://office:3333/inbox`, with a
  field `resumeUrl` whose value you paste. Its *On Error* is already *Continue (using error output)*, and its error output
  leads to **Answer: not queued**, which answers 503: if the inbox cannot take the enquiry, the form is told so.
- **Answer: waiting for approval** (202), already connected after it.
- **Tell the approver: nothing written**, the answer to a Reject.

| # | Do this | Node | Setting | Value |
|---|---|---|---|---|
| 1 | **Import into a new workflow** | | starter | `workflows/stage-5-starter.json` |
| 2 | Delete the connection | `Check the AI figures` | | to `Look up the contact` |
| 3 | Connect | `Check the AI figures` | its output | to `Ask a person` |
| 4 | Paste (as an Expression) | `Ask a person` | Body Parameters: resumeUrl | **P1** |
| 5 | Add a **Wait** node, and rename it to `Wait for the decision` | `Wait for the decision` | after | `Answer: waiting for approval` |
| 6 | Set | `Wait for the decision` | Resume | `On Webhook Call` |
| 7 | Set | `Wait for the decision` | HTTP Method | `POST` |
| 8 | Set | `Wait for the decision` | Respond | `Using 'Respond to Webhook' Node` |
| 9 | Add an **If** node, and rename it to `Approved?` | `Approved?` | after | `Wait for the decision` |
| 10 | Paste (as an Expression) | `Approved?` | left box | **P2** |
| 11 | Set | `Approved?` | operator | String, then `is equal to`; right box `approve` |
| 12 | Connect | `Approved?` | its **true** output | to `Look up the contact` |
| 13 | Connect | `Approved?` | its **false** output | to `Tell the approver: nothing written` |
| 14 | Publish; reset the office; send, then decide (below) | | | |

Row 11: after you type `approve`, wait two seconds before you go on (stage 2 says why; this was not tried on a screen in
this stage).

**P1** (step 4):

```paste
{{ $execution.resumeUrl }}
```

**P2** (step 10):

```paste
{{ $json.body.decision }}
```

*HTTP Method* and *Respond* are among the parameters n8n's documentation lists for the Wait node when it resumes *On
Webhook Call* (the *Wait* page). If *HTTP Method* is left at its default, the inbox's call (a `POST`) does not reach the
Wait node, and the decision seems to do nothing; set it to `POST`.

**Look at it afterwards.** Send the sample. The form shows:

<!-- run: reset; send stage-5-solution maya -->
```text
Status:    202
Answer:    {"status":"waiting for approval","approval":"A1"}
```

The office window shows no contact yet: nothing is written before a decision. Open the inbox: A1 waits, with its resume
address. Choose **Reject**. Under the decision, the inbox shows what your flow answered:

<!-- run: reset; send stage-5-solution maya; reject -->
```text
Status:    200
Answer:    {"status":"rejected","written":"nothing"}
```

Choose **Reset the office**, send the sample again, and choose **Approve** this time:

<!-- run: reset; send stage-5-solution maya; approve -->
```text
Status:    200
Answer:    {"status":"recorded","contact":"C1"}
```

Last, set **Approval inbox** to `fails (answers 500)` and send: the form is told at once that the enquiry was not queued.

<!-- run: reset; fault inbox=fail; send stage-5-solution maya -->
```text
Status:    503
Answer:    {"status":"not queued","reason":"The approval inbox did not answer, so nothing was written. Please send the enquiry again later."}
```

**Check yourself in the office window.** Choose **Reset the office** before each try. After Reject: no contact. After
Approve: the contact, with its note. With the inbox failing: no approval and no contact. In n8n's **Executions** tab, a
run that waits for a person shows as waiting until the decision comes.

> **The limits of this design.** This flow is a place to learn, not something to put in front of real enquiries as it is.
>
> - The resume address works for anyone who holds it: whoever has the link can approve. That is acceptable only in this
>   practice office, on your own laptop.
> - An enquiry that nobody decides waits with no time limit. And the person who sent it gets only the first answer,
>   "waiting for approval": nothing tells them what was decided.
> - The flow's own webhook takes an enquiry from anyone who can reach its address; it asks for no login and no key. In
>   this lab, only your own laptop can reach it.
> - The hidden website field, the honeypot, is the flow's only defence against robots.
> - n8n keeps each run's data, the enquirer's name and e-mail address included: the *Executions* tab shows them.
> - The calls to the AI step and to the inbox have no timeout of their own in the files, unlike the CRM calls; how long
>   n8n then waits for an answer is not tried by any test of this lab.
>
> *Going further*, at the end of this guide, names what n8n offers for the first two; the lab does not teach them.

---

## Stage 6: When it fails

**Goal:** when the CRM fails, the flow records what failed and answers honestly about what was written.
**Planned minutes:** 25. **Starter:** `workflows/stage-6-starter.json`. **Your form address:** `http://localhost:3333/form?path=stage-6`.

> **First, if you like, watch it fail the old way** (an optional try, not a step; skip it when short of time). Set the practice CRM to `fails (answers
> 500)`, send the sample and approve it. Without this stage, n8n stops the run at the failing node: the inbox shows only
> n8n's own error, and nothing tells the office what happened. Set the CRM back to `works normally`.

**Failed lookup, failed write: not the same answer.** A lookup that failed wrote nothing: the answer can say so. A write
that failed may still have written: the CRM may have saved the contact and then failed to answer in time. The honest
answer then is "unknown: check the CRM". This stage gives each CRM call a second way out, an **error output**, and sends
the lookup's failures and the writes' failures to different answers.

**A timeout** is how long a call may take before n8n gives up on it. Every CRM call in this flow has had a five-second
timeout since stage 3; with this stage, a call that runs out of time becomes a failure the flow reports.

**What the starter brings:** your stage-5 flow, and six nodes, connected among themselves:

- **Tell the office: lookup failed**, which posts the failing step and n8n's reason to `http://office:3333/alerts`, then
  **Answer: nothing written** (502).
- **Tell the office: write failed**, the same for the writes, then **Answer: check the CRM** (502, `"written": "unknown:
  check the CRM"`).
- **CRM confirmed?**, an If node that asks whether the CRM's answer names the contact it wrote, already connected to
  *Answer: recorded* (true) and to **Tell the office: not confirmed** (false), which leads to *Answer: check the CRM*.

**On Error** is a setting on a node's **Settings** tab. Set to *Continue (using error output)*, the node gets an
**error** output beside its normal one, for a failure. This page was not written from a screen: if you cannot tell the
two outputs apart, ask your instructor.

| # | Do this | Node | Setting | Value |
|---|---|---|---|---|
| 1 | **Import into a new workflow** | | starter | `workflows/stage-6-starter.json` |
| 2 | Set | `Look up the contact` | On Error | `Continue (using error output)` |
| 3 | Set | `Add a note` | On Error | `Continue (using error output)` |
| 4 | Set | `Create the contact` | On Error | `Continue (using error output)` |
| 5 | Connect | `Look up the contact` | its **error** output | to `Tell the office: lookup failed` |
| 6 | Connect | `Add a note` | its **error** output | to `Tell the office: write failed` |
| 7 | Connect | `Create the contact` | its **error** output | to `Tell the office: write failed` |
| 8 | Delete the connection | `Add a note` | | to `Answer: recorded` |
| 9 | Delete the connection | `Create the contact` | | to `Answer: recorded` |
| 10 | Connect | `Add a note` | its **success** output | to `CRM confirmed?` |
| 11 | Connect | `Create the contact` | its **success** output | to `CRM confirmed?` |
| 12 | Publish; reset the office; try each fault (below) | | | |

**What the pieces do.** The alerts send `{{ $prevNode.name }}`, the name of the node whose error output led there, so the
office learns which call failed, and `{{ $json.error.message }}`, n8n's description of the failure. *CRM confirmed?* is
there because an answer of 200 is not proof: a system can say "fine" and write nothing.

**Why the answer does not repeat the error text.** The error text can hold quote marks, and quote marks inside a JSON
answer break it: n8n then answers with its own error instead of yours. The lab's own first test run met exactly this. So
the full reason goes to the office, and the answer names the step and the alert.

**Each fault must end with Status 502 under your decision in the inbox.** A 500 with n8n's own error means a CRM call
failed with no branch to catch it: check that its *On Error* is set and its error output is connected. **Short of time?**
Do *fails* and *writes, but answers too late*; *is slow* and *answers wrongly* can wait.

**Look at it afterwards.** Choose **Reset the office**, set the practice CRM to `fails (answers 500)`, send the sample and
approve it. The inbox shows what your flow answered, and the office window, under *Failures your flow reported*, why:

<!-- run: reset; fault crm=fail; send stage-6-solution maya; approve -->
```text
Status:    502
Answer:    {"status":"failed","step":"Look up the contact","written":"nothing","alert":"F1"}
```

<!-- run: reset; fault crm=fail; send stage-6-solution maya; approve; alert -->
```text
Look up the contact: 500 - "{\"error\":\"The practice CRM was told to fail. Nothing was read or written.\"}"
```

With the CRM `is slow`, the lookup runs out of time after five seconds, and the answer is the same: nothing written.

<!-- run: reset; fault crm=slow; send stage-6-solution maya; approve -->
```text
Status:    502
Answer:    {"status":"failed","step":"Look up the contact","written":"nothing","alert":"F1"}
```

With the CRM `writes, but answers too late`, the lookup works, the contact is created, and its answer comes too late:

<!-- run: reset; fault crm=late-writes; send stage-6-solution maya; approve -->
```text
Status:    502
Answer:    {"status":"failed","step":"Create the contact","written":"unknown: check the CRM","alert":"F1"}
```

and the office window shows the contact, C1: the call failed, and the write happened. That is why the answer says
"unknown". With the CRM `answers wrongly`, every call gets 200 and nothing is done. The lookup's answer has no `found`, so
the flow takes the person for new and creates; the create's answer names no contact, so *CRM confirmed?* sends it to the
failure branch:

<!-- run: reset; fault crm=wrong; send stage-6-solution maya; approve -->
```text
Status:    502
Answer:    {"status":"failed","step":"Write to the CRM","written":"unknown: check the CRM","alert":"F1"}
```

**Check yourself in the office window.** Choose **Reset the office** before each fault. After *fails* and *is slow*: one
failure reported and no contact. After *writes, but answers too late*: one failure reported, and a contact. After
*answers wrongly*: one failure reported, and no contact. Set the CRM back to `works normally`, send and approve once more:
the contact is recorded as in stage 5.

---

## What you built, and going further

The finished flow is `workflows/stage-6-solution.json`, and its picture is `docs/pictures/stage-6-solution.svg`. Next:
the repairs, in `repairs.md`. Keep the card, `card.md`, for the next flow you build or are shown.

**Going further: not taught here, and not tested by this lab.**

- The **Wait** node has a *Limit Wait Time* setting (n8n's documentation), which resumes a waiting run after a time
  limit: the start of an answer to "nobody decided".
- The Wait node's resume address can require authentication (n8n's documentation lists Basic, Header and JWT), so that
  only the inbox can approve.
- n8n can run a separate **error workflow** whenever a flow fails (n8n's documentation: *Workflow Settings*, *Error
  workflow*, starting with the *Error Trigger* node), so that a failure nobody handled is still reported.
- A real CRM is reached with a credential that n8n keeps encrypted, never with a value written in the workflow file.
- The flow's own webhook takes an enquiry from anyone who can reach its address, and the honeypot is its only defence
  against robots. A flow in front of real enquiries needs more than that; the lab does not teach it.
- n8n keeps each run's data, names and e-mail addresses included. A flow that handles real people's enquiries needs a
  decision on how long that is kept; the lab does not teach n8n's settings for it.

This lab is a place to learn, not something to put in front of real enquiries as it is.

---

*Teaching text licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/); the workflow files under
the MIT licence. From the n8n automation workshop lab by Evgeny Blekhman.*
