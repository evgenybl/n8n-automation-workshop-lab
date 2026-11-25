# Setup: before the session

Do this at home or at work, before the session, on the laptop you will bring. It takes a while the first time, because
it downloads n8n; after that, it starts without downloading anything. Nothing here needs an account with any online
service or a key.

**Read this page, and every page of the lab, on the lab's page on GitHub**, where the tables, the grey blocks and the
folded hints are laid out. Opened from the folder in a text editor, the same pages show raw text with `|` signs and tags.
If your room has no internet, your instructor gives you printed copies.

> **How these steps were written.** The steps for n8n's own screen were written from n8n's documentation and from the
> workflow files in this lab. They were not walked through on a screen by a person. The commands below were run by the
> lab's automated tests on a Linux machine; they were not tried on a newcomer's laptop. If your screen differs, tell your
> instructor.

## What you need

- **A laptop** with Windows, macOS or Linux, where you are allowed to install software and to start Docker.
- **Docker Desktop**, installed and running. Docker runs programs in *containers*: each program comes with everything it
  needs, so nothing else is installed on your laptop. Install it from Docker's own site, docs.docker.com, following its
  guide for your system, and start it once so that it finishes its own setup; it may ask for a restart.
  - **On Windows**, Docker's installation page (https://docs.docker.com/desktop/setup/install/windows-install/) asks
    for the WSL 2 feature turned on, and hardware virtualisation enabled in the BIOS/UEFI (the settings a computer offers
    as it starts, before Windows). It says the per-user installation it recommends needs no administrator rights, but
    that turning on WSL 2 the first time does, once per computer. On a work laptop, ask your IT department before you
    start.
  - **Docker Desktop's terms.** Under Docker's terms (https://docs.docker.com/subscription-billing/desktop-license/),
    Docker Desktop is free for personal use, for education, for non-commercial open source projects, and for small
    businesses (fewer than 250 employees and less than 10 million US dollars in annual revenue). If you work for a larger
    organisation and use your work laptop, your employer needs a paid Docker subscription that covers you: ask your IT
    department before you install it.
  - **On a Mac**, choose the Docker Desktop download for your Mac's chip (Apple silicon, or Intel). The pinned n8n
    image is published for Apple silicon too (linux/arm64; `docs/HOW-THIS-WAS-TESTED.md` shows what CI read, CI being
    the lab's automated tests, which GitHub runs whenever a change to the lab is pushed); n8n and Docker have not been tried
    on a Mac for this lab; only its tests that need no container were run on one.
- **A web browser: Chrome, Edge or Firefox.** Safari is reported, in a community report the lab has not verified, to
  refuse n8n's sign-in at `http://localhost:5678`; use one of the other three.
- **The lab's folder.** Your instructor gives it to you, or you download it from the lab's page on GitHub: the green
  **Code** button, then **Download ZIP**. Unzip it to a place you can find, such as your Documents folder. (Do not work
  inside the ZIP file itself: unzip it first.) Unzipping often makes a folder inside a folder: the lab's folder is **the
  folder where you can see `compose.yaml`**, beside `participant`, `practice` and `workflows`.

**About n8n.** This lab is not affiliated with or endorsed by n8n. n8n is used under its own licence, the Sustainable Use
License (see n8n's documentation page *Community license*, https://docs.n8n.io/n8n-community-license). The lab does not
redistribute n8n: when you start the lab, Docker downloads n8n's own image from n8n's registry, `docker.n8n.io`, onto your
laptop.

## Start the lab

1. **Open a terminal in the folder where you can see `compose.yaml`.** A terminal is a window where you type commands.
   On Windows 11, open that folder in File Explorer, right-click an empty part of the folder, and choose **Open in
   Terminal**. On Windows 10, click
   the folder's address bar in File Explorer, type `cmd`, and press Enter. On macOS, open the Terminal app, type `cd `
   (with a space), drag the lab's folder into the window, and press Enter.
2. **Check that Docker runs.** Type this and press Enter:

   ```bash
   docker info
   ```

   It prints a long report. When Docker Desktop runs, the report has a part headed `Server:` with a `Server Version:`
   line. On the GitHub runner that tested this lab (one of GitHub's computers, which ran the lab's CI), those lines
   were:

   <!-- pasted from: the step "The n8n image this run used" of CI run 45339281817, at commit b229a23 -->
   ```text
   Server:
    Server Version: 29.4.2
   ```

   Your version number may differ. If, instead, the report ends with an error about connecting to the Docker daemon
   (Docker's background service), Docker Desktop is not running: start it, wait until it says it is running, and try
   again. **If `docker info` still fails, send its last lines to your instructor before the session**: at home, nobody
   else can help, and in the room there is no time to.
3. **Start the lab.** Type:

   ```bash
   docker compose up -d
   ```

   The first time, this downloads n8n: several hundred megabytes (the sizes CI printed are on the testing page,
   `docs/HOW-THIS-WAS-TESTED.md`). Do it on a fast connection, before the session, not in the room. When it ends, two
   containers run: **n8n**, and the **practice office** (a lead form, a practice CRM, a practice AI step, an approval
   inbox and an office window, all on your laptop). On the GitHub runner that tested this lab, where the output is plain
   text, the first start ended with these lines (your terminal may draw the same steps differently):

   <!-- pasted from: the step "Start n8n and the practice office" of CI run 45339281817, at commit b229a23 -->
   ```text
    Network n8n-lab_default Creating 
    Network n8n-lab_default Created 
    Volume n8n-lab_n8n_data Creating 
    Volume n8n-lab_n8n_data Created 
    Container n8n-lab-n8n-1 Creating 
    Container n8n-lab-office-1 Creating 
    Container n8n-lab-office-1 Created 
    Container n8n-lab-n8n-1 Created 
    Container n8n-lab-office-1 Starting 
    Container n8n-lab-n8n-1 Starting 
    Container n8n-lab-n8n-1 Started 
    Container n8n-lab-office-1 Started 
   ```

   If it ends with an error that it found no configuration file, the terminal is not in the folder where you can see
   `compose.yaml`: go back to step 1. On the GitHub runner, in a folder without `compose.yaml`, that error read:

   <!-- pasted from: the step "What starting the lab prints in a folder without compose.yaml" of CI run 45345044613, at commit 2f3c4a7 -->
   ```text
   no configuration file provided: not found
   ```

   **Behind a company proxy?** A proxy is a computer that some companies put between their laptops and the internet.
   If your laptop reaches the internet through one, the download may fail or hang. Docker
   Desktop has its own proxy setting (in its **Settings**, among the resources settings, the **Proxies** section; Docker's
   documentation, *Change your Docker Desktop settings*). Ask your IT department for the proxy's address, or do the
   download on another network.

## The check

Open this address in your browser: `http://localhost:3333/api/check`. When everything is ready, it shows:

<!-- run: check -->
```text
{"office":"open","n8n":"ready","n8nAddress":"http://n8n:5678"}
```

`n8nAddress` is the address the office uses to reach n8n inside Docker; it does not open in your browser, and you do not
need it.

- If the page does not open at all, the office is not running: go back to step 3, and look at what the terminal printed.
- If it says `"n8n":"not reachable"` or `"starting"`, n8n is still starting: wait half a minute and reload the page.
- If it still says so after three minutes, type `docker compose ps` and `docker compose logs --tail 20 n8n` in the
  terminal, and send what they print to your instructor before the session.

When the check says `"n8n":"ready"`, send that line to your instructor: it tells them your laptop is ready.

## n8n's first screen

Open n8n at `http://localhost:5678`. The first time, n8n shows a sign-up screen to set up an **owner account**; when you
have entered your details and chosen **Next**, it signs you in (n8n's documentation, *Configure user management*). This
account lives only in the n8n on your laptop. Use any name, an invented address such as `you@example.com`, and a password
of at least eight characters with at least one number and one capital letter (n8n's documented rule). Write the password
down.

n8n's documentation says that, while you create this account, you can choose to register the Community edition for a free
licence key, sent by e-mail. It is optional, and the lab does not need it: you can skip it. (With an invented e-mail
address, nothing would arrive anyway.) On 25 November 2026 an AI agent, driving a browser, went through this screen on
n8n 2.48.8 (started without Docker, so the steps above were not part of it): the sign-up asked for an e-mail address,
a first name, a last name and a password, with a box *I want to receive security and product updates* that can stay
empty, and no question about a licence key appeared. After **Next**, n8n opened a page about its Assistant, *Build and
debug faster with the n8n Assistant*, with a **Get started** button. The lab does not use the Assistant: leave that page
as it is. When stage 1 begins, you go on from there with the create button, the plus sign in the upper-left corner (the
lab guide, *How every stage works*). If n8n shows a screen or a question that this page does not mention, and you
cannot see how to go on, ask your instructor.

Then open the office window at `http://localhost:3333` and the lead form at `http://localhost:3333/form`. Keep both open in
their own tabs during the session.

You are ready. Bring the laptop with Docker Desktop installed; the lab's folder; and the password you chose.

## On the day

1. Start **Docker Desktop**, and wait until it says it is running (on a laptop just switched on, this can take a while).
2. Open a terminal in the folder where you can see `compose.yaml`, as in step 1 above, and type `docker compose up -d`.
   It downloads nothing this time.
3. Open the check page, `http://localhost:3333/api/check`, and wait for `"n8n":"ready"`.

## Stopping and starting again

| To | Type |
|---|---|
| Stop the lab and keep your flows | `docker compose down` |
| Start it again | `docker compose up -d` |

**Only when you are finished with the lab for good:** `docker compose down -v` stops it and **deletes your n8n account
and every flow you built**. Never type it between the sessions.

The practice office keeps nothing when it stops: its contacts, notes and approvals start empty every time.

## If something does not work

- **A message that a port is already in use** when you start the lab: a port is a numbered door through which programs
  on your laptop are reached, and another program on your laptop already uses port 5678 or 3333. Tell your instructor before the session; the instructor's page *When things go wrong* has the fix.
- **Docker Desktop will not start**: see whether your laptop asks for an update or a restart, and tell your instructor
  before the session, not during it.
- Everything else: your instructor has a page called *When things go wrong*.

---

*Teaching text licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/). From the n8n automation
workshop lab by Evgeny Blekhman.*
