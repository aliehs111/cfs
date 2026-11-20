# CFS project notes for Claude

## Git
The user handles all git (commit, branch, merge, push). Never run git commands that change the repo. Answer git questions or give commands for the user to run.

## Reminder at the start of a session
At the start of a session, remind the user to reinstall the backend dependencies, especially on their Mac:

```
cd server
source venv/bin/activate
pip install -r requirements.txt
```

**Why:** `tzdata` was added to `server/requirements.txt` on 2026-11-20 (commit `8ed3159`). Without it, `ZoneInfo("America/New_York")` in `server/notify.py` crashes the server on startup on machines that have no system time zone database (Windows, slim Linux/Docker). macOS has its own database, but the Mac venv should stay in sync with `requirements.txt`.

Once the user confirms the Mac is updated, delete the `tzdata` part of this reminder. Keep the general rule: whenever `server/requirements.txt` changes, reinstall from it on each machine.
