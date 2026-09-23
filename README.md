# Classroom Peer Review

A lightweight web app for running live peer review sessions in a classroom, built for teachers who want students to grade each other's presentations against a rubric, in real time, on their own phones.

## What it does

- **Teacher sets up a session**: enters their email, the presentation topic, the student roster, and a custom rubric (any number of criteria, each with its own point value).
- **Students join by code or QR scan**, then pick their own name from the roster, locking that identity so no one can grade themselves or double-claim a peer's name.
- **Grading is one-peer-at-a-time**: each student works through a personal queue of every classmate except themselves, scoring against the rubric on simple sliders.
- **The teacher starts and times the session**: a countdown window (set by the teacher) auto-closes grading, or the teacher can end it early.
- **A PDF report generates on demand**: per-student average scores, with any incomplete submissions clearly flagged rather than silently averaged away.
- **The teacher ends the session** after downloading the report, closing it out for good.

## Stack

- Static frontend (`public/`) — plain HTML/CSS/JS, no build step, no framework.
- Netlify Functions (`netlify/functions/`) — serverless API backing session state.
- Netlify Blobs — shared, persistent storage for sessions and scores, keyed so concurrent student submissions never collide.
- Client-side PDF generation (jsPDF) and QR codes (qrcodejs), loaded via CDN.

## Project structure

```
public/
  index.html      teacher: session setup (roster + rubric)
  dashboard.html  teacher: QR code, live roster, timer, report, end session
  join.html       student: enter code, pick name
  grade.html      student: one-peer-at-a-time grading queue
  style.css       shared design tokens and layout
  shared.js       small fetch/formatting helpers
netlify/functions/
  create-session.js
  join-session.js
  start-session.js
  submit-score.js
  get-session.js
  end-session.js
  _shared.js
netlify.toml      routes /api/* to functions, sets publish dir
```

## Deploying

No environment variables or manual setup needed. Netlify Blobs provisions automatically on first write. Connect this repo to a Netlify site and it deploys as-is — see `DEPLOY.md` for step-by-step instructions.

## Known limitations

- Name-claiming has a small race window under simultaneous joins (Netlify Blobs has no transactions); very unlikely in practice but not airtight.
- The grading auto-close timer is driven by the teacher's own dashboard tab polling — if that tab is closed, the timer won't auto-end the session until it's reopened or the teacher ends grading manually.
- Live updates are polled every ~3 seconds, not pushed, so there's a small lag between a student action and the teacher's dashboard reflecting it.
