# The lab guide: lead intake in n8n, stage by stage

**A flow that works once is a demo; a flow that says what happened when it fails is automation.**

You will build one flow in six stages. It takes an enquiry from a website form, checks it, stops duplicates, uses an AI
step carefully, waits for a person's approval, and says honestly when something fails. Each stage starts from a file that
holds the previous stage's finished flow, so you can always start a stage cleanly, even if the last one went wrong.

Before you start, do the setup page (`setup.md`) and its check. Every person and company in this lab is invented.

> **How these steps were written.** The steps for n8n's own screen were written from n8n's documentation and from the
> workflow files in this lab, using the labels in n8n 2.48.8's own text. They were not walked through on a screen by a
> person. Every flow they build was run by the lab's automated tests on n8n 2.48.8, and every answer quoted below is what
> those flows answered there. If a label on your screen differs, look for the nearest match, and tell your instructor.

---

## Words you will meet

| Word | What it means here |
|---|---|
| **Flow** (n8n says *workflow*) | A chain of steps that runs by itself when something happens. |
| **Node** | One step in a flow, shown as a box on n8n's canvas: "check the e-mail", "call the CRM". |
| **Trigger** | The node that starts a flow. In this lab it is always a webhook. |
| **Webhook** | An address on the web that starts a flow when something sends data to it. The form sends each enquiry to your flow's webhook. |
| **Path** | The last part of a webhook's address, such as `stage-3` in `http://localhost:5678/webhook/stage-3`. |
| **Execution** | One run of a flow. n8n keeps a record of each one, step by step. |
| **Expression** | A value that n8n works out while the flow runs, written between `{{` and `}}`, such as `{{ $json.body.email }}` (the e-mail of the enquiry this node received). |
| **Publish** | Make a flow live, so its webhook answers. A change takes effect only when you publish again. |
| **CRM** | The system where a business keeps its contacts and notes. Here it is a practice CRM inside the practice office: practice software, not a CRM product. |
| **Duplicate** | A second record for the same person. Stage 3 stops them. |

## How every stage works

1. **In n8n**, make a new, empty workflow: choose **Create workflow**.
2. **Load the stage's starter file.** Open the workflow's menu (the three dots at the top right), choose **Import**, then
   **From file**, and pick the file the stage names, from the lab's `workflows` folder. *If your screen differs:* open the
   file in a text editor, copy all of it, click on n8n's empty canvas and paste; n8n's documentation describes both ways.
3. **Build** what the stage's table says. Each row is one thing to do: the node, the setting, and its value.
4. **Publish**: choose **Publish** at the top right, then **Publish** again in the window that opens. Do this again after
   every change: n8n saves your edits as a draft, and, as its documentation says, the webhook keeps running the version
   you published until you publish again.
5. **Send an enquiry** from the lead form, `http://localhost:3333/form?path=` followed by your stage's path (each stage
   gives the full address). Choose **Fill a sample enquiry**, then **Send**. The form shows what your flow answered.
6. **Check yourself** in the office window, `http://localhost:3333`: it shows the contacts, the notes, the approvals, the
   failures your flow reported, and every call the office received, newest first.

**Four habits that save time**

- **Names matter.** Give every node exactly the name in the table. Later expressions name earlier nodes, such as
  `$('Enquiry arrives')`, and a different name breaks them. To rename a node, right-click it and choose **Rename node**.
- **Typing an expression.** A value with `{{ }}` in it is an expression. Above the field, switch from **Fixed** to
  **Expression** first, then type or paste the value. Instead of typing, you can drag a field from the input panel on the
  left of an open node into the box; n8n writes the expression for you.
- **Connecting nodes.** Drag from the small circle on the right of one node to the left of the next. An **If** node has
  two outputs, **true** and **false**; connect each to what should happen in that case.
- **Seeing inside a run.** Open the **Executions** tab at the top of the canvas and choose a run: every node shows what it
  received and what it sent on. This is where you look when an answer surprises you.

**Live or test address.** The form can send to the *live* address (`/webhook/...`), which answers once the flow is
published, or to the *test* address (`/webhook-test/...`), which answers one call after you press **Execute workflow** on
the canvas, and shows that call's data on the canvas as it runs. This guide uses the live address. The test address is
useful while you build, because you can see the data arrive in each node.

---

## Stage 1: Catch an enquiry

**Goal:** a webhook that answers each enquiry with the enquiry's name. **Starter:** `workflows/stage-1-starter.json`.
**Your form address:** `http://localhost:3333/form?path=stage-1`.

**First, look at what you have.** The starter holds one node, **Enquiry arrives**, a Webhook trigger. Open it (double-click):
its **HTTP Method** is `POST`, its **Path** is `stage-1`, and **Respond** is `Immediately`. Publish the flow, open the form,
choose **Fill a sample enquiry**, then **Send**. The form shows n8n's own answer:

<!-- run: reset; send stage-1 maya -->
```text
Status:    200
Answer:    {"message":"Workflow was started"}
```

That tells the sender only that something started. Your flow will now answer properly.

| # | Node | Setting | Value |
|---|---|---|---|
| 1 | **Enquiry arrives** (open it) | Respond | `Using 'Respond to Webhook' Node` |
| 2 | Add a **Respond to Webhook** node after it | Name | `Answer with the name` |
| 3 | | Respond With | `JSON` |
| 4 | | Response Body (Expression) | `{"status": "received", "name": "{{ $json.body.name }}"}` |

**What `$json.body.name` means.** A webhook gives the next node everything it received; the form's fields are under
`body`. So `$json.body.name` is the name typed in the form.

**Look at it afterwards.** Publish again, and send the sample enquiry. The form shows:

<!-- run: reset; send stage-1-solution maya -->
```text
Status:    200
Answer:    {"status":"received","name":"Maya Rivers"}
```

**Check yourself in the office window.** Under *Every call the office received*, the newest row is a **Form** call:
"Sent to /webhook/stage-1; the flow answered 200." Open the **Executions** tab in n8n: you see the same run, and in it
the whole enquiry as the webhook received it.

---

## Stage 2: Refuse a bad one

**Goal:** an enquiry with no e-mail, a filled honeypot or no consent is answered with 400 and the reason; a good one
passes. **Starter:** `workflows/stage-2-starter.json`. **Your form address:** `http://localhost:3333/form?path=stage-2`.

**A honeypot** is a field that people never see on the page, so they leave it empty; a robot that fills in every field
fills it in too. The form has one, called `website`; the box *Act as a robot* fills it for you.

**Status 400** means "the request was wrong". The sender learns that it was refused, and why.

| # | Node | Setting | Value |
|---|---|---|---|
| 1 | Delete the connection between **Enquiry arrives** and **Answer with the name** (hover it, choose the bin) | | |
| 2 | Add an **If** node after **Enquiry arrives** | Name | `Has an e-mail?` |
| 3 | | Conditions: value1 (Expression) | `{{ $json.body.email }}` |
| 4 | | Conditions: operator | String, then `contains` |
| 5 | | Conditions: value2 | `@` |
| 6 | Add an **If** node to the **true** output of *Has an e-mail?* | Name | `Honeypot empty?` |
| 7 | | Conditions: value1 (Expression) | `{{ $json.body.website }}` |
| 8 | | Conditions: operator | String, then `is empty` |
| 9 | Add an **If** node to the **true** output of *Honeypot empty?* | Name | `Consent given?` |
| 10 | | Conditions: value1 (Expression) | `{{ $json.body.consent }}` |
| 11 | | Conditions: operator | Boolean, then `is true` |
| 12 | Connect the **true** output of *Consent given?* to **Answer with the name** | | |
| 13 | Add a **Respond to Webhook** node to the **false** output of *Has an e-mail?* | Name | `Refuse: no e-mail` |
| 14 | | Respond With | `JSON` |
| 15 | | Response Body | `{"status": "refused", "reason": "The enquiry has no e-mail address."}` |
| 16 | | Options, Add option, Response Code | `400` |
| 17 | The same for the **false** output of *Honeypot empty?* | Name | `Refuse: looks like a robot` |
| 18 | | Response Body | `{"status": "refused", "reason": "The hidden website field is filled in, so this looks like a robot."}` |
| 19 | | Response Code | `400` |
| 20 | The same for the **false** output of *Consent given?* | Name | `Refuse: no consent` |
| 21 | | Response Body | `{"status": "refused", "reason": "The enquiry does not agree to be contacted."}` |
| 22 | | Response Code | `400` |

The refusal bodies have no `{{ }}`, so they stay **Fixed**.

**Look at it afterwards.** Publish, then send four enquiries from the form: the sample as it is; the sample with the
e-mail box emptied; the sample with *Act as a robot* ticked; the sample with the consent box unticked. The first is
answered as in stage 1. The other three:

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
Answer:    {"status":"refused","reason":"The enquiry does not agree to be contacted."}
```

**Check yourself in the office window.** The three refused enquiries reached nothing but your flow: there is no CRM call,
no AI step call and no inbox call, only the **Form** rows with "the flow answered 400".

---

## Stage 3: No duplicates

**Goal:** look the contact up first; create it, or add a note to it. The same enquiry twice leaves one contact and two
notes, never two contacts. **Starter:** `workflows/stage-3-starter.json`. **Your form address:**
`http://localhost:3333/form?path=stage-3`.

**Why.** Forms are sent twice: a double click, a person who writes again next week. A flow that creates a contact every
time fills the CRM with copies of the same person, and nobody knows which one is right. Engineers call a step that does no
harm when it runs twice *idempotent*; here, it means "the second time, add a note, not a person".

**Two things the practice CRM needs.** It answers only calls that carry the header `X-Office-Badge` with the value
`practice-badge`. This is a practice value printed in this guide, not a secret: the point is to see, in repair D, what
happens when a call does not carry it. And n8n reaches the office at `http://office:3333`, not `localhost`: inside the lab,
n8n and the office run in two containers that know each other by name. (A *header* is a line of extra information sent
with a call, before the data.)

| # | Node | Setting | Value |
|---|---|---|---|
| 1 | Delete **Answer with the name** | | |
| 2 | Add an **HTTP Request** node to the **true** output of *Consent given?* | Name | `Look up the contact` |
| 3 | | Method | `GET` |
| 4 | | URL | `http://office:3333/crm/contacts` |
| 5 | | Send Query Parameters | on; Name `email`, Value (Expression) `{{ $('Enquiry arrives').item.json.body.email }}` |
| 6 | | Send Headers | on; Name `X-Office-Badge`, Value `practice-badge` |
| 7 | Add an **If** node after it | Name | `Known contact?` |
| 8 | | Conditions: value1 (Expression) | `{{ $json.found }}` |
| 9 | | Conditions: operator | Boolean, then `is true` |
| 10 | Add an **HTTP Request** node to the **true** output | Name | `Add a note` |
| 11 | | Method | `POST` |
| 12 | | URL (Expression) | `http://office:3333/crm/contacts/{{ $json.contact.id }}/notes` |
| 13 | | Send Headers | on; Name `X-Office-Badge`, Value `practice-badge` |
| 14 | | Send Body | on; Body Content Type `JSON`; Specify Body `Using Fields Below` |
| 15 | | Body Parameters | Name `text`, Value (Expression) `{{ $('Enquiry arrives').item.json.body.message }}` |
| 16 | Add an **HTTP Request** node to the **false** output | Name | `Create the contact` |
| 17 | | Method | `POST` |
| 18 | | URL | `http://office:3333/crm/contacts` |
| 19 | | Send Headers | on; Name `X-Office-Badge`, Value `practice-badge` |
| 20 | | Send Body | on; Body Content Type `JSON`; Specify Body `Using Fields Below` |
| 21 | | Body Parameters | four fields, each Value an Expression: `name` `{{ $('Enquiry arrives').item.json.body.name }}`; `email` `{{ $('Enquiry arrives').item.json.body.email }}`; `company` `{{ $('Enquiry arrives').item.json.body.company }}`; `note` `{{ $('Enquiry arrives').item.json.body.message }}` |
| 22 | Add a **Respond to Webhook** node, and connect both *Add a note* and *Create the contact* to it | Name | `Answer: recorded` |
| 23 | | Respond With | `JSON` |
| 24 | | Response Body (Expression) | `{"status": "recorded", "contact": "{{ $json.contact }}"}` |

**Why `$('Enquiry arrives')` and not `$json`.** `$json` is what the node just before sent on. After the lookup, that is
the CRM's answer, not the enquiry. `$('Enquiry arrives').item.json...` names the node the value comes from, so it keeps
working when you add nodes in between.

**Why the contact is created with its first note in one call.** If the flow created the contact and then failed before
adding the note, the CRM would hold a person with no record of why they wrote. One call either writes both or nothing.

**Look at it afterwards.** Publish, then send the sample enquiry twice. Both times the form shows:

<!-- run: reset; send stage-3-solution maya; send stage-3-solution maya -->
```text
Status:    200
Answer:    {"status":"recorded","contact":"C1"}
```

**Check yourself in the office window.** One contact, C1, Maya Rivers, with two notes. Under the calls: a lookup that found
nothing and a creation, then a lookup that found C1 and a note.

---

## Stage 4: Ask the AI step, and check it

**Goal:** ask the practice AI step for a summary, and use the summary only if every figure in it is in the enquiry.
**Starter:** `workflows/stage-4-starter.json`. **Your form address:** `http://localhost:3333/form?path=stage-4`.

**The practice AI step is a stand-in that is not a model.** It answers from fixed rules, the same way every time, so that
the lab needs no account and no key, and so that everyone in the room sees the same answer. What you learn here is about
any AI step: what it returns is a suggestion until something checks it. A figure that the person never wrote, such as a
budget, is the kind of mistake that does harm when it reaches a CRM unseen.

| # | Node | Setting | Value |
|---|---|---|---|
| 1 | Delete the connection from the **true** output of *Consent given?* to *Look up the contact* | | |
| 2 | Add an **HTTP Request** node to the **true** output of *Consent given?* | Name | `Ask the AI step` |
| 3 | | Method | `POST` |
| 4 | | URL | `http://office:3333/ai/read` |
| 5 | | Send Body | on; Body Content Type `JSON`; Specify Body `Using Fields Below` |
| 6 | | Body Parameters | `name` `{{ $json.body.name }}`; `message` `{{ $json.body.message }}` (both Expressions) |
| 7 | Add a **Code** node after it | Name | `Check the AI figures` |
| 8 | | Mode | `Run Once for All Items` |
| 9 | | Language | `JavaScript` |
| 10 | | Code | paste the code below, replacing what is there |
| 11 | Connect *Check the AI figures* to **Look up the contact** | | |
| 12 | Open **Add a note** | Body Parameters: `text` (Expression) | `{{ $('Check the AI figures').item.json.note }}` |
| 13 | Open **Create the contact** | Body Parameters: `note` (Expression) | `{{ $('Check the AI figures').item.json.note }}` |

The code for step 10. You do not need to write code in this lab; read the comments, which say what each part does.

```javascript
// Use the AI summary only if every figure in it is also in the enquiry.
const enquiry = $('Enquiry arrives').first().json.body;
const summary = $input.first().json.summary || '';

// Every figure in a text, such as 12 or 1,200 (written 1200 here).
const figures = (text) => (String(text || '').match(/\d+(?:[.,]\d+)*/g) || []).map((f) => f.replace(/,/g, ''));

const inEnquiry = figures(enquiry.message);
const notInEnquiry = figures(summary).filter((f) => !inEnquiry.includes(f));
const summaryUsed = notInEnquiry.length === 0;

const note = summaryUsed
  ? 'Message: ' + enquiry.message + '\nAI summary (checked): ' + summary
  : 'Message: ' + enquiry.message + '\nAI summary not used: it gives figures that are not in the enquiry (' + notInEnquiry.join(', ') + ').';

return [{ json: { summaryUsed, notInEnquiry, note } }];
```

In plain words: it takes the enquiry and the AI step's summary; finds every figure in each; keeps the figures of the
summary that the enquiry does not have; and writes the note. With none left over, the note carries the summary, marked
*checked*. With any left over, the note carries the message alone, and says which figure was not in it.

**Look at it afterwards.** Publish, send the sample enquiry, and open the contact in the office window. Its note:

<!-- run: reset; send stage-4-solution maya; note -->
```text
Message: Hello, how much would 12 workshop seats cost for our team in March?
AI summary (checked): Maya Rivers asks for a price. The message begins: Hello, how much would 12 workshop seats cost for our team in March?
```

Now, in the office window under *Faults on request*, set **Practice AI step** to `invents a figure` and choose **Apply**.
Choose **Reset the office** first if you like a clean window (it switches faults off too, so set the fault after it).
Send the sample again. The new note:

<!-- run: reset; fault ai=invent; send stage-4-solution maya; note -->
```text
Message: Hello, how much would 12 workshop seats cost for our team in March?
AI summary not used: it gives figures that are not in the enquiry (4800).
```

**Check yourself in the office window.** With the fault on, the call list says the AI step "Answered, with an invented
figure", and the note holds no AI summary and says why. Set the fault back to `works normally` before the next stage.

---

## Stage 5: A person approves

**Goal:** before anything is written, a person approves or rejects the enquiry in the approval inbox; the flow waits for
the decision, then writes only on Approve. **Starter:** `workflows/stage-5-starter.json`. **Your form address:**
`http://localhost:3333/form?path=stage-5`. **The inbox:** `http://localhost:3333/inbox`.

**How a flow waits for a person.** n8n's **Wait** node can pause a flow until someone calls an address that n8n makes for
that one run: its **resume address**. You send that address to the inbox together with the enquiry. When a person
presses Approve or Reject, the inbox calls the address with the decision, and the paused run carries on from the Wait
node with the decision as its data. In an expression, the resume address is `{{ $execution.resumeUrl }}`.

**Status 202** means "accepted, not finished yet": the form learns at once that its enquiry waits for a person.

| # | Node | Setting | Value |
|---|---|---|---|
| 1 | Delete the connection from *Check the AI figures* to *Look up the contact* | | |
| 2 | Add an **HTTP Request** node after *Check the AI figures* | Name | `Ask a person` |
| 3 | | Method | `POST` |
| 4 | | URL | `http://office:3333/inbox` |
| 5 | | Send Body | on; Body Content Type `JSON`; Specify Body `Using Fields Below` |
| 6 | | Body Parameters (all Expressions) | `name` `{{ $('Enquiry arrives').item.json.body.name }}`; `email` `{{ $('Enquiry arrives').item.json.body.email }}`; `message` `{{ $('Enquiry arrives').item.json.body.message }}`; `summary` `{{ $json.note }}`; `resumeUrl` `{{ $execution.resumeUrl }}` |
| 7 | Add a **Respond to Webhook** node after it | Name | `Answer: waiting for approval` |
| 8 | | Respond With | `JSON` |
| 9 | | Response Body (Expression) | `{"status": "waiting for approval", "approval": "{{ $json.id }}"}` |
| 10 | | Options, Add option, Response Code | `202` |
| 11 | Add a **Wait** node after it | Name | `Wait for the decision` |
| 12 | | Resume | `On Webhook Call` |
| 13 | | HTTP Method | `POST` |
| 14 | | Respond | `Using 'Respond to Webhook' Node` |
| 15 | Add an **If** node after it | Name | `Approved?` |
| 16 | | Conditions: value1 (Expression) | `{{ $json.body.decision }}` |
| 17 | | Conditions: operator | String, then `is equal to` |
| 18 | | Conditions: value2 | `approve` |
| 19 | Connect the **true** output of *Approved?* to **Look up the contact** | | |
| 20 | Add a **Respond to Webhook** node to the **false** output | Name | `Tell the approver: nothing written` |
| 21 | | Respond With | `JSON` |
| 22 | | Response Body | `{"status": "rejected", "written": "nothing"}` |

**Two answers now.** The flow answers the form at step 7, *before* it waits. Everything after the Wait node answers the
person who decided: the inbox shows that answer under the decision. *Answer: recorded* now answers the approver.

**Look at it afterwards.** Publish, send the sample enquiry. The form shows:

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

Send the sample again and choose **Approve** this time:

<!-- run: reset; send stage-5-solution maya; approve -->
```text
Status:    200
Answer:    {"status":"recorded","contact":"C1"}
```

**Check yourself in the office window.** After Reject: no contact. After Approve: the contact, with its note. The
*Approvals* list shows both decisions and what n8n answered to each. In n8n's **Executions** tab, a run that waits for a
person shows as waiting until the decision comes.

---

## Stage 6: When it fails

**Goal:** when the CRM fails, the flow records what failed and answers honestly, and nothing is half-written.
**Starter:** `workflows/stage-6-starter.json`. **Your form address:** `http://localhost:3333/form?path=stage-6`.

**What a silent failure looks like.** Set the practice CRM to `fails (answers 500)` in the office window, send the sample,
and approve it. Without this stage, n8n stops the run at the failing node: the inbox shows only n8n's own error message,
and nothing tells the office what happened or what to do. This stage gives each CRM call a second way out, an **error
output**, that leads to a branch which tells the office and answers with what failed.

**A timeout** is how long a call may take before n8n gives up on it. The practice CRM can be told to be slow; with a
timeout, a slow CRM becomes a failure the flow can report, not a wait with no end.

| # | Node | Setting | Value |
|---|---|---|---|
| 1 | Open **Look up the contact**, tab **Settings** | On Error | `Continue (using error output)` |
| 2 | Same node, tab **Parameters** | Options, Add option, Timeout | `5000` (milliseconds: five seconds) |
| 3 | Do steps 1 and 2 for **Add a note** and for **Create the contact** | | |
| 4 | Add an **HTTP Request** node | Name | `Tell the office` |
| 5 | | Method | `POST` |
| 6 | | URL | `http://office:3333/alerts` |
| 7 | | Send Body | on; Body Content Type `JSON`; Specify Body `Using Fields Below` |
| 8 | | Body Parameters (all Expressions) | `step` `{{ $prevNode.name }}`; `reason` `{{ $json.error.message }}`; `email` `{{ $('Enquiry arrives').item.json.body.email }}` |
| 9 | Connect the **error** output of each of the three CRM nodes to *Tell the office* | | |
| 10 | Add a **Respond to Webhook** node after *Tell the office* | Name | `Answer: failed` |
| 11 | | Respond With | `JSON` |
| 12 | | Response Body (Expression) | `{"status": "failed", "step": "{{ $json.step }}", "written": "nothing", "alert": "{{ $json.id }}"}` |
| 13 | | Options, Add option, Response Code | `502` |
| 14 | Delete the connections from *Add a note* and *Create the contact* to *Answer: recorded* | | |
| 15 | Add an **If** node, and connect the success outputs of *Add a note* and *Create the contact* to it | Name | `CRM confirmed?` |
| 16 | | Conditions: value1 (Expression) | `{{ $json.contact }}` |
| 17 | | Conditions: operator | String, then `is not empty` |
| 18 | Connect the **true** output to **Answer: recorded** | | |
| 19 | Add an **HTTP Request** node to the **false** output | Name | `Tell the office: not confirmed` |
| 20 | | Method, URL, Send Body | as *Tell the office* |
| 21 | | Body Parameters | `step` `Write to the CRM`; `reason` `The CRM answered, but its answer did not confirm the write.`; `email` (Expression) `{{ $('Enquiry arrives').item.json.body.email }}` |
| 22 | Connect *Tell the office: not confirmed* to **Answer: failed** | | |

**What the pieces do.** `$prevNode.name` is the name of the node that sent the data here, so the office learns which call
failed. `$json.error.message` is n8n's description of the failure. *CRM confirmed?* is there because an answer of 200 is
not proof: a system can say "fine" and write nothing. The flow checks that the answer names the contact it wrote.

**Why the answer does not repeat the error text.** The error text can hold quote marks, and quote marks inside a JSON
answer break it: n8n then answers with its own error instead of yours. The lab's own tests met exactly this. So the full
reason goes to the office, where it is kept safely, and the answer names the step and the alert.

**Look at it afterwards.** Publish. In the office window, set the practice CRM to `fails (answers 500)`. Send the sample
and approve it in the inbox. The inbox shows what your flow answered:

<!-- run: reset; fault crm=fail; send stage-6-solution maya; approve -->
```text
Status:    502
Answer:    {"status":"failed","step":"Look up the contact","written":"nothing","alert":"F1"}
```

and the office window, under *Failures your flow reported*:

<!-- run: reset; fault crm=fail; send stage-6-solution maya; approve; alert -->
```text
Look up the contact: 500 - "{\"error\":\"The practice CRM was told to fail. Nothing was read or written.\"}"
```

Now try the other two faults the same way. With the CRM `is slow`, the answer comes after five seconds:

<!-- run: reset; fault crm=slow; send stage-6-solution maya; approve -->
```text
Status:    502
Answer:    {"status":"failed","step":"Look up the contact","written":"nothing","alert":"F1"}
```

With the CRM `answers wrongly`:

<!-- run: reset; fault crm=wrong; send stage-6-solution maya; approve -->
```text
Status:    502
Answer:    {"status":"failed","step":"Write to the CRM","written":"nothing","alert":"F1"}
```

**Check yourself in the office window.** After each fault: one failure reported, with its step and reason, and **no
contact**: nothing was half-written. Set the CRM back to `works normally`, send and approve once more: the contact is
recorded as in stage 5.

---

## What you built

The finished flow is `workflows/stage-6-solution.json`, and its picture is `docs/pictures/stage-6-solution.svg`. Next: the
four repairs, in `repairs.md`. Keep the card, `card.md`, for the next flow you build or are shown.

---

*Teaching text licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/); the workflow files under
the MIT licence. From the n8n automation workshop lab by Evgeny Blekhman.*
