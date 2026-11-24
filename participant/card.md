# Six questions to ask of any automation

*A one-page card. Keep it beside you when you build a flow, or when someone shows you one.*

**A flow that works once is a demo; a flow that says what happened when it fails is automation.**

| # | Ask | In this lab |
|---|---|---|
| 1 | **What starts it, and where does it write?** Name the trigger and every system it changes. | Stage 1, stage 3 |
| 2 | **What does it do with an input it cannot use?** It should refuse it with a reason, not pass it on. | Stage 2 |
| 3 | **What happens when the same thing arrives twice?** One record, or two? | Stage 3 |
| 4 | **What does it check before it uses what an AI step returned?** An AI answer is a suggestion until something checks it. | Stage 4 |
| 5 | **Where does a person decide, and is anything written before they do?** | Stage 5 |
| 6 | **When a step fails, who finds out, and is anything left half-done?** Silence is the worst answer. | Stage 6, the repairs |

When a flow is broken, start from what you can see (the symptom), not from what you suspect. Read the answer it gave, then
the record of what it did, and only then open the node you think is wrong.

---

*From the n8n automation workshop lab by Evgeny Blekhman. Teaching text licensed under CC BY-NC 4.0
(https://creativecommons.org/licenses/by-nc/4.0/).*
