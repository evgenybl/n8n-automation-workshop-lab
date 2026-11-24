# Run sheet: the planned three hours

**This lab has not been taught to a class of people. Every minute on this page is planned, not measured.** Adjust after
the first session, and keep a note of what took longer.

**Group:** 4 to 12 people, each on a laptop with the setup done (`participant/setup.md`). **Room:** a projector for your
screen, power for every laptop, and a network for nothing but the room's own needs: the lab runs on each laptop.

## Before the session

- A week before: send `participant/setup.md`, and ask each person to send you the line the setup check shows. Chase
  those who did not; a laptop that cannot run Docker is the one problem the room cannot fix on the day.
- On your own laptop: `docker compose up -d`, then `node tools/load.js` (it needs Node; the lab's tools are tested with Node 24), which loads and
  publishes every solution and repair, so you can show any of them. Do not run the load script on a participant's laptop:
  its published files would take the webhook paths the participant needs.
- Print `participant/card.md`, one per person.

## The plan

| Part | Planned minutes | What happens | Debrief question |
|---|---|---|---|
| Opening | 10 | The idea; the practice office on the projector; everyone opens the check page | |
| Stage 1: Catch an enquiry | 15 | The first webhook and its answer | What did the sender learn from n8n's first answer, and what does it learn now? |
| Stage 2: Refuse a bad one | 20 | Three checks, three refusals with reasons | Which of the three refusals would you most want to know about in your own work, and why? |
| Stage 3: No duplicates | 25 | Look up, then note or create | What in your own work is matched by a name today, that should be matched by something that does not change? |
| Break | 10 | | |
| Stage 4: Ask the AI step, and check it | 20 | The stand-in AI step, and a check of its figures | What else could an AI step get wrong that a simple check could catch before it is used? |
| Stage 5: A person approves | 25 | The inbox, the resume address, the Wait node | Which step in your own work should never happen without a person saying yes? |
| Stage 6: When it fails | 20 | Error outputs, a timeout, and "200 is not proof" | When something fails in one of your own flows today, who finds out, and how long does it take? |
| The repairs | 25 | Repairs A and C for everyone; B and D for those ahead, or at home | Which symptom misled you first, and what showed you the real cause? |
| Close | 10 | The card; what each person will look at in their own work | |

The planned total is 180 minutes. The instructor guide, `instructor/guide.md`, has what to say in each part and the
mistakes to expect.

## If you fall behind

Cut in this order: the repairs to A only (repair C goes home); stage 6's *answers wrongly* fault (keep *fails*); stage 4's
second fault run (show it on the projector instead). Do not cut stage 5's Reject: it is the moment the approval proves
itself.

---

*Teaching text licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/).*
