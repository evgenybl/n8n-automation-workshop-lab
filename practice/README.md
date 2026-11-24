# The practice office

One Node program, `server.js`, with no dependencies. It plays everything around the participant's flow, on their own
computer: the website form, a CRM, an AI step, an approval inbox, and a window that shows what the flow really did. It is
practice software, not a CRM product, and its AI step is a stand-in that is not a model. It keeps everything in memory.

`compose.yaml` starts it beside n8n on the n8n image's own Node, at `http://localhost:3333` for the browser and
`http://office:3333` for n8n. To run it alone: `node practice/server.js` (it listens on 127.0.0.1:3333; settings `HOST`,
`PORT` and `N8N_URL`, the address at which it reaches n8n). Started on a port another program uses, it says so in one
line and stops. Its tests: `node --test "practice/tests/*.test.js"`.

## Pages

| Address | What it is |
|---|---|
| `/` | The office window: contacts and notes, approvals, failures a flow reported, every call received (newest first), faults, reset |
| `/form` | The lead form; `?path=stage-3` fills in the webhook path |
| `/inbox` | The approval inbox |
| `/api/check` | The setup check: is the office open, and can it reach n8n |

## What a flow calls

| Call | What it does |
|---|---|
| `GET /crm/contacts?email=...` (or `?name=...`) | Looks a contact up: `{"found": false}`, or `{"found": true, "contact": {...}}` |
| `POST /crm/contacts` with `name`, `email`, `company`, `note` | Creates a contact with its first note in one call; 409 if the e-mail exists |
| `POST /crm/contacts/<id>/notes` with `text` | Adds a note |
| `POST /ai/read` with `name`, `message` | The practice AI step: a summary, an intent and a reply draft, from fixed rules |
| `POST /inbox` with `name`, `email`, `message`, `summary`, `resumeUrl` | Puts an enquiry in the approval inbox; a decision calls `resumeUrl` |
| `POST /alerts` with `step`, `reason`, `email` | Records a failure the flow reports |

Every `/crm/` call needs the header `X-Office-Badge: practice-badge`, a practice value printed in the lab guide, not a
secret; without it the CRM answers 401.

## Faults on request

`POST /faults` with `{"crm": "off" | "fail" | "slow" | "wrong" | "late-writes", "ai": "off" | "invent" | "fail",
"inbox": "off" | "fail"}`, or the office window's controls.

| Fault | What happens |
|---|---|
| CRM *fail* | Every CRM call answers 500 and writes nothing |
| CRM *slow* | The CRM waits 15 seconds before it reads or writes; a caller that hangs up first gets nothing written |
| CRM *wrong* | The CRM answers 200 and does nothing |
| CRM *late-writes* | Lookups work; a write is made at once, and its answer comes 15 seconds later. A caller that hangs up first is told nothing, and the write has happened |
| AI step *invent* | The summary gains a figure that is not in the enquiry |
| AI step *fail* | The AI step answers 500 |
| Inbox *fail* | The inbox answers 500 and queues nothing |

`POST /reset` empties everything and switches every fault off.

## What the office refuses

- A body that is not one JSON object: 400. A body over 100 KB: 413. An address it does not have, such as `//`: 404.
- A change (any request other than GET) sent by a page on another site: 403. The office tells such a request by its
  `Origin` header, when that names another host than the one the request was sent to, or by its `Sec-Fetch-Site` header,
  when that says `cross-site`. Its own pages send their own origin; n8n and command-line tools send neither header. This
  stops a web page from resetting the office or deciding an approval; the office has no login.

When a person decides in the inbox, the office calls the flow's resume address at the n8n it can reach, keeping the
address's path and its signature. If n8n answers 409 "running already" (the flow has answered the form but not yet
reached its Wait node), the office tries again for a few seconds.
