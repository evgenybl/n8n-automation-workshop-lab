# The four repairs

Each repair is a flow that someone built and that does not do its job. You get the flow and what a user sees, not the
answer. Start from the symptom: reproduce it, read the answer the flow gave, read the record of what it did, and only then
open the node you suspect. Each repair has three hints, from gentle to direct; open one only when you are stuck, and wait a
minute before the next.

**How to start each repair.** Create a new workflow in n8n, import the broken file named below (as in the lab guide,
*How every stage works*), publish it, and use the form address given. Choose **Reset the office** in the office window
first, so that what you see belongs to this repair.

> The steps for n8n's own screen were written from n8n's documentation and the workflow files, and were not walked through
> on a screen by a person. Every symptom quoted here is what the broken file did in the lab's automated tests on n8n 2.48.8.

---

## Repair A: nothing happens

**The file:** `workflows/repair-a-broken.json`. **The form address:** `http://localhost:3333/form?path=repair-a` (this is
the path the website's form sends to; do not change it in the form).

**The symptom.** The flow is published, but sending the sample enquiry does nothing that the office can see: no contact,
no call from n8n. The form shows:

<!-- run: offline repair-a-fixed; reset; form repair-a maya; online repair-a-fixed -->
```text
Status:    404
Answer:    {"code":404,"message":"The requested webhook \"POST repair-a\" is not registered.","hint":"The workflow must be active for a production URL to run successfully. You can activate the workflow using the toggle in the top-right of the editor. Note that unlike test URL calls, production URL calls aren't shown on the canvas (only in the executions list)"}
```

(n8n's hint still speaks of a toggle; in this version of n8n it is the **Publish** button.) On a real website, the person
who filled in the form would see nothing at all, and nobody would know an enquiry was lost.

<details><summary>Hint 1</summary>

The answer came from n8n, not from your flow: your flow never ran. Look at the **Executions** tab: is there a run? What
does it mean when an address answers 404?

</details>

<details><summary>Hint 2</summary>

The form sends to one address; your flow listens at one address. Find where your flow says where it listens, and compare
the two, character by character.

</details>

<details><summary>Hint 3</summary>

Open **Enquiry arrives** and read its **Path**. Now read the form's path again.

</details>

<details><summary>The cause, and the fix</summary>

**The cause.** The webhook's path is `repiar-a`, two letters swapped. The flow works, at an address nobody uses.

**The fix.** Set the **Path** of *Enquiry arrives* to `repair-a` and publish again. Send the sample: the flow records it,
and the form shows `"status":"recorded"`. The repaired file is `workflows/repair-a-fixed.json`; it listens at `repair-a`.

**What to take away.** When nothing happens, first prove that the flow ran at all. A 404 from n8n means "nobody listens
here": the problem is the address, not the steps.

</details>

---

## Repair B: the second enquiry from a known person crashes

**The file:** `workflows/repair-b-broken.json`. **The form address:** `http://localhost:3333/form?path=repair-b`.

**The symptom.** Send the sample enquiry: it is recorded. Now Maya writes again, signing as `M. Rivers` this time: in the
form, change the name to `M. Rivers`, keep the same e-mail, and send. The form shows:

<!-- run: reset; send repair-b maya; send repair-b m-rivers -->
```text
Status:    500
Answer:    {"message":"Error in workflow"}
```

<details><summary>Hint 1</summary>

Look at the office window's call list. Which call failed, and what did the practice CRM say about it?

</details>

<details><summary>Hint 2</summary>

The CRM refused with 409: it was asked to create a contact that already exists. So the flow thought this was a new
person. Look at the lookup call just before it, in the call list: what did it look the person up by?

</details>

<details><summary>Hint 3</summary>

Open **Look up the contact** and read its query parameter. People write their names in many ways; what is the one thing
that stays the same for this person?

</details>

<details><summary>The cause, and the fix</summary>

**The cause.** The lookup searches by `name`. "Maya Rivers" and "M. Rivers" are different names, so the lookup finds
nobody, the flow tries to create a second contact with the same e-mail, the CRM refuses with 409, and the run stops.

**The fix.** In *Look up the contact*, change the query parameter's Name to `email` and its Value (Expression) to
`{{ $('Enquiry arrives').item.json.body.email }}`. Publish and send `M. Rivers` again: a note is added to Maya's contact.
The repaired file is `workflows/repair-b-fixed.json`.

**What to take away.** Match a person by a key that does not change, such as an e-mail address, never by a name.

</details>

---

## Repair C: a rejected enquiry is written anyway

**The file:** `workflows/repair-c-broken.json`. **The form address:** `http://localhost:3333/form?path=repair-c`. **The
inbox:** `http://localhost:3333/inbox`.

**The symptom.** Send the sample enquiry; it waits in the inbox. Choose **Reject**. The inbox shows what the flow answered
to your decision:

<!-- run: reset; send repair-c maya; reject -->
```text
Status:    200
Answer:    {"status":"recorded","contact":"C1"}
```

and the office window shows the contact. A person said no, and the flow wrote anyway.

<details><summary>Hint 1</summary>

Which node decides what happens after the decision? Open the **Executions** tab and the run that carried on after your
Reject: which way did that node send it?

</details>

<details><summary>Hint 2</summary>

In that run, open **Wait for the decision** and look at what it received from the inbox. Which field holds the decision
itself, and which fields hold something else?

</details>

<details><summary>Hint 3</summary>

Open **Approved?**. Which field does it read, and what does it ask of it? Would that be true for a rejected enquiry too?

</details>

<details><summary>The cause, and the fix</summary>

**The cause.** *Approved?* asks whether `{{ $json.body.approval }}` is not empty. That field is the approval's number,
such as `A1`, and it is filled in for every decision, so the answer is always "true".

**The fix.** In *Approved?*, set value1 to `{{ $json.body.decision }}`, the operator to String, `is equal to`, and value2
to `approve`. Publish, send, Reject: nothing is written. The repaired file is `workflows/repair-c-fixed.json`.

**What to take away.** Test the "no" path, not only the "yes" path. A check that is true for every input checks nothing.

</details>

---

## Repair D: the flow says done, and no note exists

**The file:** `workflows/repair-d-broken.json`. **The form address:** `http://localhost:3333/form?path=repair-d`.

**The symptom.** Send the sample enquiry twice. The second answer says the enquiry was recorded:

<!-- run: reset; send repair-d maya; send repair-d maya -->
```text
Status:    200
Answer:    {"status":"recorded","contact":""}
```

but in the office window Maya's contact has one note, not two.

<details><summary>Hint 1</summary>

The answer said "recorded", yet the contact number in it is empty. Look at the office window's call list: which call did
the CRM refuse, and with what status?

</details>

<details><summary>Hint 2</summary>

The CRM refused the note with 401: the call carried no badge header. Find the node that made that call, and also look at
its **Settings** tab: what does it do **On Error**?

</details>

<details><summary>Hint 3</summary>

Open **Add a note**. *Send Headers* is off. And *On Error* is `Continue`, which passes the failure on to the next node as
if it were a result, so the flow answers "recorded".

</details>

<details><summary>The cause, and the fix</summary>

**The cause.** Two faults that hide each other: the note call has no `X-Office-Badge` header, so the CRM refuses it; and
its failure is ignored, so the flow reports success.

**The fix.** In *Add a note*, turn **Send Headers** on with Name `X-Office-Badge` and Value `practice-badge`. In its
**Settings**, set **On Error** to `Continue (using error output)`, and connect its error output to a branch that tells the
office and answers with the failure, as in stage 6. Give *Look up the contact* and *Create the contact* the same setting,
so that no CRM call can fail silently. The repaired file is `workflows/repair-d-fixed.json`. With the CRM told to fail, it
answers:

<!-- run: reset; fault crm=fail; send repair-d-fixed maya -->
```text
Status:    502
Answer:    {"status":"failed","step":"Look up the contact","written":"nothing","alert":"F1"}
```

**What to take away.** "Continue" on error is not handling an error; it is hiding one. A failure must change the answer.

</details>

---

*Teaching text licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/); the workflow files under
the MIT licence. From the n8n automation workshop lab by Evgeny Blekhman.*
