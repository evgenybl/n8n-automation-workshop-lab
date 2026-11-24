# The rubric: four levels per objective

**This lab has not been taught to a class of people;** the rubric has not been used to mark anyone yet. Each level
describes what you can see a participant do, in their flow, in the office window or in what they say, within the parts of
the run sheet. When you assess, the practical check (`instructor/practical-check.md`, scheduled as `instructor/variants.md`
says) shows O7 and O4 on a flow the participant has not seen.

| Objective | 1: Not yet | 2: With help | 3: On their own | 4: Can explain and transfer |
|---|---|---|---|---|
| **O1** Build a flow from a trigger to a record in another system | After stage 3, the flow does not answer, or answers "recorded" while the office window shows no contact | Builds it by following the table, with help at one or more steps | Builds it from the table alone; the office window shows the record | Says which node writes to which system, and what the sender is told and when: after the write in stage 3, before it (202, waiting) in stage 5 |
| **O2** Validate an input and refuse a bad one with a reason | Bad enquiries pass, or good ones are refused | The checks work after help with true and false outputs | Each bad enquiry gets 400 and its reason; a good one passes | Names a check their own work needs, and what the refusal should say |
| **O3** Stop a duplicate before it is written | The second of two identical enquiries tries to create the contact again, which the practice CRM refuses with 409, so the run ends in n8n's own error; or the flow fails another way | Works after help with the lookup or the expression | Twice gives one contact and two notes | Explains why the match is by e-mail, not name, and where that matters in their own work |
| **O4** Check what an AI step returned before using it | The AI summary is used as it came | The check works after help pasting or connecting | With the fault on, the note carries no AI summary and says why | Names another thing an AI step could get wrong, and how a check could catch it |
| **O5** Put a person's approval before a write | Something is written before a decision, or after Reject | Works after help with the Wait node or the decision check | Nothing before the decision; nothing after Reject; the contact after Approve | Explains the resume address in their own words, and which step in their own work needs a person |
| **O6** Make a failure visible instead of silent | With the CRM failing, the flow says nothing useful, or says "recorded" | Works for one CRM call, or after help | Each fault gives 502 with its step and a reported failure; the answer says "nothing" for a failed lookup and "unknown: check the CRM" for a failed write | Explains why a failed write may have written, why 200 is not proof, and why the answer does not repeat the error text |
| **O7** Find and repair a broken flow from its symptoms | Changes things until something works, without knowing why | Repairs with the hints | Repairs A and C from the symptom, with one hint or none | Repairs A and C with no hint, and says what each symptom pointed to before opening a node (repair B or D, for those who finish, is further evidence, not needed) |

When you assess, the practical check's four levels (`instructor/practical-check.md`, *Marking*) stand for O7's four levels
on that one flow, and the check's level is the one you record for O7; when you do not assess, O7 is marked from repairs A
and C.

---

*Teaching text licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/).*
