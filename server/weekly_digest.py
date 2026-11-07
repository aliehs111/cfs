"""Weekly job: send the digest email, then delete logs older than 90 days.

Run by a Railway cron service (same repo, root directory `server`):
  Start command:  python weekly_digest.py
  Schedule:       0 12 * * 1   (Mondays 12:00 UTC = 7am EST / 8am EDT)
It needs the same variables as cfs-server. Run it locally the same way to test.
"""

import sys
import traceback
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

import mailer  # noqa: E402
from digest import build_digest  # noqa: E402
from logger import log_event  # noqa: E402
from notify import send_now  # noqa: E402
from supabase_client import get_supabase  # noqa: E402

LOG_RETENTION_DAYS = 90


def main() -> int:
    ok = True
    try:
        if not mailer.configured():
            print("Email is not set up (SMTP_USER/SMTP_PASS); skipping digest.")
        else:
            subject, text, html = build_digest()
            result = send_now("weekly_digest", subject, text, html)
            print(f"Digest: {result}")
    except Exception as exc:
        ok = False
        traceback.print_exc()
        log_event("alert.failed", level="error", message=f"Weekly digest: {type(exc).__name__}: {exc}",
                  metadata={"alert_type": "weekly_digest"}, wait=True)

    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=LOG_RETENTION_DAYS)
        get_supabase().table("logs").delete().lt("created_at", cutoff.isoformat()).execute()
        print(f"Deleted logs older than {cutoff.date()}")
    except Exception:
        ok = False
        traceback.print_exc()

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
