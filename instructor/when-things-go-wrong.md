# When things go wrong in the room

**This lab has not been taught to a class of people;** these are the problems its design expects, with what to do. Each
starts from what you see. The steps for n8n's own screen were written from n8n's documentation and the workflow files,
and were not walked through on a screen by a person.

## Docker will not start

*You see:* Docker Desktop shows an error, or `docker info` or `docker compose up -d` ends with an error that it cannot
connect to the Docker daemon (Docker's background service).

- Ask whether Docker Desktop is running at all: its icon, its window. Start it and wait until it says it is running.
- On Windows, Docker Desktop needs its own Linux layer (WSL 2) and may ask to update it or to restart the laptop. A restart
  takes the laptop out of the session for a while; it is still the fastest fix.
- A work laptop may forbid Docker. Then pair the person with a neighbour for the session, and say so without fuss.

*Prevent it:* the setup check two weeks before (`participant/setup.md`).

## A port is taken

*You see:* `docker compose up -d` ends with a message that a port (5678 or 3333) is already in use or not available. The
wording differs between systems.

- Another program uses that port; often an earlier n8n. `docker ps` lists running containers: stop the other one with
  `docker stop <its name>`.
- If a different program needs the port, start the lab on other ports. In the lab's folder, create a file named `.env`
  holding two lines, `LAB_N8N_PORT=5679` and `LAB_OFFICE_PORT=3334`, then `docker compose up -d` again. The person then
  uses `http://localhost:5679` for n8n and `http://localhost:3334` for the office, form and inbox. Inside the lab nothing
  changes: n8n still reaches the office at `http://office:3333`.

## A firewall or a security program

*You see:* the check page does not open, or n8n's page does not load, while Docker says the containers run.

- The lab uses only the laptop's own addresses (`localhost`), and its ports are bound to the laptop alone, so a firewall
  rule for outside traffic should not matter. Some security programs block local ports anyway: try another browser, then
  ask whether the program can allow `localhost`.
- If nothing helps in five minutes, pair the person with a neighbour.

## n8n will not let someone sign in

*You see:* the owner account or the sign-in page of n8n at `http://localhost:5678` does not get past the sign-in, in
Safari.

- Safari is reported, in a community report the lab has not verified, to refuse n8n's sign-in on `http://localhost`. Use
  Chrome, Edge or Firefox. Do not change n8n's cookie settings in `compose.yaml` for this: the lab's tests have not run
  with them changed.

## A slow laptop

*You see:* the first `docker compose up -d` takes many minutes; n8n is "starting" for a long time; the canvas is sluggish.

- The first start downloads n8n, several hundred megabytes. That is why the setup is done before the session; a laptop
  that skipped it downloads in the room, on the room's network.
- Close other programs. Keep the office window open in one tab only: it refreshes itself every two seconds.

## Someone far ahead

- Give them repairs B and D, then the practical check (`instructor/practical-check.md`) as an extra exercise, not as a test.
- Or ask them to break their own stage-6 flow in one place and let a neighbour find it from the symptom alone.

## Someone lost

- Every stage has a starter file. A person who is lost imports the next stage's starter and goes on from there: they lose
  one stage, not the session. A person who restarts the *same* stage should unpublish or delete their earlier copy first,
  so that only one flow listens at that stage's path.
- If they are lost inside a stage, compare their canvas with the stage's picture (`docs/pictures/stage-N-solution.svg`) or
  import the solution file into a second workflow and look at both side by side. A solution listens at its own path,
  `stage-N-solution`, so it does not clash with theirs.

## Someone reads raw Markdown

*You see:* tables made of `|` signs, and `<details>` tags around the hints.

- They opened a page from the lab's folder in a text editor. Send them to the lab's page on GitHub, which shows the same
  page laid out, or give them the printed copy (the run sheet's preparation).

## The office was reset by mistake

*You see:* the contacts, approvals and calls are gone.

- Nothing is broken: the office keeps everything in memory, and *Reset the office* empties it. The flows in n8n are not
  touched. Send the enquiry again.
- An approval that waited in the inbox before the reset is gone from the inbox, but its run in n8n still waits; it does
  no harm. Send a new enquiry.

## The office refuses with 403

*You see:* the office answers 403, "The office takes changes only from its own pages, n8n and command-line tools".

- A page on another site sent a change to the office. The office refuses changes sent from another
  site, so that a web page cannot reset it or decide an approval. Use the office's own pages at `http://localhost:3333`.

## n8n's screen differs from the guide because the version moved

*You see:* a label, a button or a menu is not where the guide says.

- The lab pins n8n 2.48.8 in `compose.yaml`, so on a laptop that pulled the pinned image the version does not move. Check
  with `docker compose exec n8n n8n --version`.
- If you deliberately run a newer n8n, expect labels to move. The node types and settings in the workflow files may still
  import; run the lab's CI against the new version first (change the image line in `compose.yaml`, push to a copy of the
  repository) and read what fails. Do not teach a version the lab's tests have not run.
- When your screen and the guide disagree on the pinned version, trust the screen, and note the difference so the guide
  can be corrected.

---

*Teaching text licensed under CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/).*
