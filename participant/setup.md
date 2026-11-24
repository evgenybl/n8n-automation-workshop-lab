# Setup: before the session

Do this at home or at work, before the session, on the laptop you will bring. It takes a while the first time, because
it downloads n8n; after that, the lab starts in under a minute on most laptops. Nothing here needs an account with any
service, a key, or a payment.

## What you need

- **A laptop** with Windows, macOS or Linux, where you are allowed to install software.
- **Docker Desktop**, installed and running. Docker runs programs in *containers*: each program comes with everything it
  needs, so nothing else is installed on your laptop. Install it from Docker's own site, docs.docker.com, following its
  guide for your system, and start it once so that it finishes its own setup.
- **A web browser.**
- **The lab's folder.** Your instructor gives it to you, or you download it from the lab's page on GitHub: the green
  **Code** button, then **Download ZIP**. Unzip it to a place you can find, such as your Documents folder. (Do not work
  inside the ZIP file itself: unzip it first.)

## Start the lab

1. **Open a terminal in the lab's folder.** A terminal is a window where you type commands. On Windows, open the lab's
   folder in File Explorer, right-click an empty part of the folder, and choose **Open in Terminal**. On macOS, open the
   Terminal app, type `cd ` (with a space), drag the lab's folder into the window, and press Enter.
2. **Check that Docker answers.** Type this and press Enter:

   ```bash
   docker compose version
   ```

   It prints one line with Docker Compose's version. On the GitHub runner that tested this lab on 24 November 2026, it printed:

   <!-- pasted from: the CI run's "Start n8n and the practice office" step -->
   ```text
   Docker Compose version v5.1.3
   ```

   Your version number may differ; any line like it is fine. If you see "command not found" or "cannot connect", Docker
   Desktop is not installed or not running: start it, wait until it says it is running, and try again.
3. **Start the lab.** Type:

   ```bash
   docker compose up -d
   ```

   The first time, this downloads n8n. When it ends, two containers run: **n8n**, and the **practice office** (a lead form,
   a practice CRM, a practice AI step, an approval inbox and an office window, all on your laptop).

## The check

Open this address in your browser: `http://localhost:3333/api/check`. When everything is ready, it shows:

<!-- run: check -->
```text
{"office":"open","n8n":"ready","n8nAddress":"http://n8n:5678"}
```

- If the page does not open at all, the office is not running: go back to step 3, and look at what the terminal printed.
- If it says `"n8n":"not reachable"` or `"starting"`, n8n is still starting: wait half a minute and reload the page.

Then:

1. Open n8n at `http://localhost:5678`. The first time, n8n asks you to set up an **owner account**. This account lives
   only in the n8n on your laptop. Use any name, an invented address such as `you@example.com`, and a password of at
   least eight characters with a number and a capital letter (n8n's own rule). Write the password down.
2. Open the office window at `http://localhost:3333` and the lead form at `http://localhost:3333/form`. Keep both open in
   their own tabs during the session.

You are ready. Bring the laptop with Docker Desktop installed; the lab's folder; and the password you chose.

## Stopping and starting again

| To | Type |
|---|---|
| Stop the lab and keep your flows | `docker compose down` |
| Start it again | `docker compose up -d` |
| Stop it and delete your flows and your n8n account | `docker compose down -v` |

The practice office keeps nothing when it stops: its contacts, notes and approvals start empty every time.

## If something does not work

- **"port is already allocated"** when you start the lab: another program on your laptop already uses port 5678 or 3333.
  Tell your instructor; the instructor guide has the fix.
- **Docker Desktop will not start**: see whether your laptop asks for an update or a restart, and tell your instructor
  before the session, not during it.
- Everything else: your instructor has a page called *When things go wrong*.

---

*Teaching text licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/). From the n8n automation
workshop lab by Evgeny Blekhman.*
