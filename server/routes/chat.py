import os
import traceback
import anthropic
from typing import Literal
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from limiter import limiter
from logger import log_event
from notify import report_server_error

router = APIRouter()


def get_knowledge_base() -> str:
    kb_path = os.path.join(os.path.dirname(__file__), "..", "knowledge_base.md")
    with open(kb_path, "r", encoding="utf-8") as f:
        return f.read()


SYSTEM_PROMPT = """You are the assistant for Cavalier Flooring Systems. The context below is your authoritative source — follow its guidance on how to answer questions, what tone to use, and what to avoid saying.

{knowledge_base}"""


# Limits on what a visitor can send. Every message goes to the AI, which is
# billed by length, so without these one visitor could run up the bill.
MAX_MESSAGE_CHARS = 2000      # one message (the chat box has the same limit)
MAX_MESSAGES = 70             # both sides; the 30/day limit allows ~60
MAX_TOTAL_CHARS = 60000       # both sides (about 15k tokens)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)  # AI replies are capped by max_tokens


class ChatPayload(BaseModel):
    messages: list[ChatMessage] = Field(max_length=MAX_MESSAGES)


@router.post("/chat")
@limiter.limit("30/day")
async def chat(request: Request, payload: ChatPayload):
    # 422 for "too long": the chat widget shows its "too long" message for it.
    msgs = payload.messages
    if not msgs or msgs[-1].role != "user" or not msgs[-1].content.strip():
        raise HTTPException(status_code=400, detail="Please type a message.")
    if any(m.role == "user" and len(m.content) > MAX_MESSAGE_CHARS for m in msgs):
        raise HTTPException(status_code=422, detail=f"Please keep messages under {MAX_MESSAGE_CHARS} characters.")
    if sum(len(m.content) for m in msgs) > MAX_TOTAL_CHARS:
        raise HTTPException(status_code=422, detail="This conversation is too long. Please refresh the page to start a new one, or use the contact form.")

    knowledge_base = get_knowledge_base()
    system = SYSTEM_PROMPT.format(knowledge_base=knowledge_base)

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    user_turns = sum(1 for m in payload.messages if m.role == "user")
    log_event("chat.started" if user_turns <= 1 else "chat.message", route="/api/chat",
              metadata={"turn": user_turns})

    def generate():
        try:
            with client.messages.stream(
                model="claude-haiku-4-5",
                max_tokens=512,
                system=system,
                messages=[
                    {"role": m.role, "content": m.content} for m in payload.messages
                ],
            ) as stream:
                for text in stream.text_stream:
                    yield text
        except anthropic.APIStatusError as e:
            err = str(e)
            report_server_error("POST /api/chat (AI)", f"{type(e).__name__}: {err[:300]}")
            if "credit" in err.lower() or "billing" in err.lower():
                yield "__CREDITS_EXHAUSTED__"
            else:
                yield "__SERVICE_ERROR__"
        except Exception as e:
            traceback.print_exc()
            report_server_error("POST /api/chat (AI)", f"{type(e).__name__}: {e}", traceback.format_exc())
            yield "__SERVICE_ERROR__"

    return StreamingResponse(generate(), media_type="text/plain")
