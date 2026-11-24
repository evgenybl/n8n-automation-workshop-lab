# The practical check: a seventh flow, unseen if you keep it so

**This check has not been given to anyone yet.** It shows objective O7 (and O4) on a flow the participant has not seen.
Give only the file and the task below; keep the answer. It is handed out by the instructor only: no participant page
mentions it.

**The file and its answer are in the lab's folder**, which every participant has: `workflows/check-g-broken.json`, the
repaired `workflows/check-g-fixed.json`, their pictures in `docs/pictures/`, and this page. So the check is unseen only
if you make it so, in one of two ways. Either hand out the lab's folder yourself, without `workflows/check-g-fixed.json`,
`docs/pictures/check-g-fixed.svg` and this page (a participant who downloaded the lab from its page on GitHub has them
all). Or change the fault in your own copy of the broken file, so that this page's answer no longer fits it; then do the
check yourself first, because the lab's tests run only the file in this repository.

**Planned minutes:** 15. When you assess, the practical check (`instructor/practical-check.md`) takes the place of repair D, and the part *Repairs C and D* takes 30 planned minutes instead of 20: repair C in 15, then the practical check in 15, so session 2 takes 130 (`instructor/variants.md`).

## What you give

The file `workflows/check-g-broken.json`, and this text:

> This flow records enquiries in the practice CRM, with a note that should only carry an AI summary that has been
> checked. A colleague says that a note in the CRM mentions a budget that the person never wrote. Import the flow, publish
> it, and use the form at `http://localhost:3333/form?path=check-g`. In the office window, choose Reset the office, then
> set the practice AI step to `invents a figure`. Find the cause from the symptom, repair it, and write two sentences: what you saw, and what you
> changed. You have fifteen minutes. No hints.

## What a participant sees

With the fault on, the note that the flow writes reads:

<!-- run: reset; fault ai=invent; send check-g maya; note -->
```text
Maya Rivers asks for a price. The message begins: Hello, how much would 12 workshop seats cost for our team in March? The budget is 4800.
```

The enquiry never mentions 4800.

## The answer

**The cause.** The flow has the check, *Check the AI figures*, and it runs; but *Add a note* and *Create the contact* do
not use its result. Their note field reads `{{ $('Ask the AI step').item.json.summary }}`: the AI step's summary as it
came, unchecked.

**The repair.** In both nodes, set the note field (*text* in *Add a note*, *note* in *Create the contact*) to
`{{ $('Check the AI figures').item.json.note }}`, and publish. With the fault on, the note now reads:

<!-- run: reset; fault ai=invent; send check-g-fixed maya; note -->
```text
Message: Hello, how much would 12 workshop seats cost for our team in March?
AI summary not used: it gives figures that are not in the enquiry (4800).
```

The repaired file is `workflows/check-g-fixed.json`.

## Marking

| Level | What you see |
|---|---|
| 1 | No repair, or a repair that removes the AI step altogether |
| 2 | Repairs one of the two nodes only, so a new contact or a known one still gets the unchecked summary |
| 3 | Repairs both nodes; the note with the fault on says the summary was not used |
| 4 | As 3, and the two sentences name the symptom (a figure nobody wrote), the cause (the check ran but its result was not used) and say why a check whose result is not used is no check |

---

*Teaching text licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/).*
