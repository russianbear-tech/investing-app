# Setting this up on your computer

Works on **Windows and Mac**. You only do this once — after that, updating is
one double-click.

Your own numbers stay on your own machine. This gives you the app, empty, and
you fill it in yourself. Nobody else can see what you put in it.

---

## 1. Install two things

**Node.js** — [nodejs.org](https://nodejs.org). Take the big green **LTS**
button and click through the installer with all the defaults.

**Git**

- *Windows:* [git-scm.com/download/win](https://git-scm.com/download/win),
  defaults all the way through.
- *Mac:* you may already have it. Open **Terminal** (Cmd+Space, type
  "Terminal") and run `git --version`. If it offers to install developer
  tools, say yes. Otherwise there's nothing to do.

On Windows, restart afterwards — or at least close any black command windows
you have open, since they won't notice the new programs until reopened.

---

## 2. Get the app

Pick where you want it to live — `Documents` is fine.

- *Windows:* open that folder in File Explorer, right-click empty space, choose
  **Open Git Bash here** (or **Open in Terminal**).
- *Mac:* open **Terminal** and type `cd Documents` then press Enter.

Paste this in and press Enter:

```bash
git clone https://github.com/russianbear-tech/investing-app.git
```

That makes a folder called `investing-app`. You can close the window.

You don't need a GitHub account and it won't ask you to sign in.

---

## 3. Run it

Open the new `investing-app` folder and double-click:

- **`start.bat`** on Windows
- **`start.command`** on Mac

The first time, it spends a minute or two installing what it needs. When the
window says **Ready**, open your browser and go to:

**http://localhost:3000**

That's it — the app is running.

Leave that window open while you're using the app. Closing it stops the app.
To start it again another day, double-click the same file.

> **First-run warnings are normal.** Windows may show "Windows protected your
> PC" — click **More info** → **Run anyway**. Mac may refuse to open it — 
> right-click the file and choose **Open**, then confirm. Both appear for any
> script that didn't come from an app store.

---

## 4. Getting updates

**Nothing to do.** Every time you start the app it checks for a new version
first and picks one up if there is one. Just open it as usual.

If you're offline, or the check can't reach the internet for any reason, it
quietly starts the version you already have rather than refusing to run.

There's also **`update.bat`** (Windows) and **`update.command`** (Mac) if you
ever want to update without starting the app. You won't normally need them.

You never need to be sent files, and updating never touches what you've
entered.

---

## The AI features are optional

Three parts of the app — Research, the morning Briefing, and the sparkle
explanations on the Watchlist — talk to Claude and need your own API key.
Everything else works fully without one.

If you want them:

1. Get a key at
   [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. In the app folder, make a copy of `.env.local.example` and rename the copy
   to exactly `.env.local`.
3. Open it in a text editor and replace `sk-ant-your-key-here` with your key.
4. Stop the app and start it again.

It's your key and your account, so the cost is yours — it's small, a few cents
for a briefing or a handful of questions.

---

## Where your data lives

Everything you enter goes into one file: `data/portfolio.json`, inside the app
folder. It's plain text you can open and read.

It never leaves your computer. Updates don't overwrite it. If you ever move to
a new machine, copy that one file across.

Worth backing it up somewhere occasionally — a cloud drive, an email to
yourself. It's a few kilobytes.

---

## If something breaks

Take a screenshot of the Terminal or command window and send it over. The error
text in there usually says exactly what's wrong.
