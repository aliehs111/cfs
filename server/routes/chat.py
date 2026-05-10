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


SYSTEM_PROMPT = """You are a helpful assistant for Cavalier Flooring Systems, a commercial flooring contractor based in Virginia.

Answer questions about Cavalier using only the information in the knowledge base below. Be direct, warm, and plainspoken — match Cavalier's calm, expert voice. Never use corporate jargon or salesy language.

If someone asks something not covered in the knowledge base, say plainly that you don't have that information and suggest they reach out via the contact page or call (804) 254-7700.

Keep responses concise — 2 to 4 sentences unless the question genuinely requires more detail.

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
