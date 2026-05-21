import os
import traceback
import anthropic
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from limiter import limiter

router = APIRouter()


def get_knowledge_base() -> str:
    kb_path = os.path.join(os.path.dirname(__file__), "..", "knowledge_base.md")
    with open(kb_path, "r", encoding="utf-8") as f:
        return f.read()


SYSTEM_PROMPT = """You are the assistant for Cavalier Flooring Systems. The context below is your authoritative source — follow its guidance on how to answer questions, what tone to use, and what to avoid saying.

{knowledge_base}"""


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatPayload(BaseModel):
    messages: list[ChatMessage]


@router.post("/chat")
@limiter.limit("30/day")
async def chat(request: Request, payload: ChatPayload):
    knowledge_base = get_knowledge_base()
    system = SYSTEM_PROMPT.format(knowledge_base=knowledge_base)

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

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
            if "credit" in err.lower() or "billing" in err.lower():
                yield "__CREDITS_EXHAUSTED__"
            else:
                yield "__SERVICE_ERROR__"
        except Exception:
            traceback.print_exc()
            yield "__SERVICE_ERROR__"

    return StreamingResponse(generate(), media_type="text/plain")
