"""Send email through Gmail SMTP with a Google App Password.

Ported from EventOps (backend/mailer.py). Python's built-in smtplib, no
third-party email service.

Railway variables (cfs-server):
  SMTP_USER  the Gmail address that sends
  SMTP_PASS  its Google App Password (not the normal Gmail password)
  SMTP_FROM  optional display form, e.g. "Cavalier Website <address@gmail.com>"
  SMTP_HOST / SMTP_PORT  optional, default smtp.gmail.com / 587

Who receives each alert is NOT set here: see notify.py and the Admin →
Notifications tab.
"""

import os
import smtplib
from email.message import EmailMessage

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))


def configured() -> bool:
    return bool(os.getenv("SMTP_USER") and os.getenv("SMTP_PASS"))


def send(
    to: list[str],
    subject: str,
    text: str,
    html: str | None = None,
    reply_to: str | None = None,
) -> None:
    """Send one message to every address in `to`. Raises on failure."""
    user, password = os.getenv("SMTP_USER", ""), os.getenv("SMTP_PASS", "")
    if not (user and password):
        raise RuntimeError("Email is not set up (SMTP_USER and SMTP_PASS)")
    if not to:
        raise ValueError("No recipients")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = os.getenv("SMTP_FROM") or user
    msg["To"] = ", ".join(to)
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
        server.starttls()
        server.login(user, password)
        server.send_message(msg)
