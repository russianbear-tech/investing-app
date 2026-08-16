# Setting this up on your computer

You only do this once. After that, updating is one double-click.

Your own numbers stay on your own machine — this gives you the app, empty, and
you fill it in yourself. Nobody else can see what you put in it.

---

## 1. Install two things

**Node.js** — [nodejs.org](https://nodejs.org). Take the big green **LTS**
button and click through the installer with all the defaults.

**Git** — [git-scm.com/download/win](https://git-scm.com/download/win). Again,
defaults are fine all the way through.

Restart your computer afterwards, or at least close any black command windows
you have open — they won't notice the new programs until they're reopened.

---

## 2. Get the app

Pick where you want it to live — `Documents` is fine. Open that folder in File
Explorer, right-click on empty space, and choose **Open Git Bash here** (or
**Open in Terminal**).

Paste this in and press Enter:

```bash
git clone https://github.com/russianbear-tech/investing-app.git
```

That makes a folder called `investing-app`. You can close the window.

You don't need a GitHub account and it won't ask you to sign in.

---

## 3. Run it

Open the new folder and double-click **start.bat**.

The first time, it spends a minute or two installing what it needs. When the
window says **Ready**, open your browser and go to:

**http://localhost:3000**

That's it — the app is running.

Leave that black window open while you're using the app. Closing it stops the
app. To start it again another day, double-click `start.bat` again.

> Windows may show a "Windows protected your PC" box the first time. Click
> **More info** → **Run anyway**. That warning appears for any script that
> didn't come from an app store.

---

## 4. Getting updates

When there's a new version, double-click **update.bat**. It fetches the changes
and installs anything new. Then start the app as usual.

You never need to be sent files, and updating never touches what you've
entered.

---

## The AI features are optional

Three parts of the app — Research, the morning Briefing, and the ✨ explanations
on the Watchlist — talk to Claude and need your own API key. Everything else
works fully without one.

If you want them:

1. Get a key at
   [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. In the app folder, make a copy of `.env.local.example` and rename the copy to
   exactly `.env.local`.
3. Open it in Notepad and replace `sk-ant-your-key-here` with your key.
4. Stop the app and start it again.

It's your key and your account, so the cost is yours — it's small, a few cents
for a briefing or a handful of questions.

---

## Where your data lives

Everything you enter goes into one file: `data/portfolio.json`, inside the app
folder. It's plain text you can open and read.

It never leaves your computer. Updates don't overwrite it. If you ever move to
a new machine, copy that one file across.

Worth backing it up somewhere occasionally — OneDrive, Google Drive, an email
to yourself. It's a few kilobytes.

---

## If something breaks

Take a screenshot of the black window and send it over. The error text in there
usually says exactly what's wrong.
