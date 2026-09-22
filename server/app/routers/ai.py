from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import ChatMessage, User
from ..schemas import ChatRequest
from ..security import get_current_user, require
from ..services.assistant import QUICK_ACTIONS, answer_question_llm
from ..services.llm import provider_name
from ..i18n import LANGUAGES

router = APIRouter(prefix="/ai", tags=["ai-assistant"])


@router.post("/chat")
async def ai_chat(body: ChatRequest, db: Session = Depends(get_db), user: User = Depends(require("ai:use"))):
    db.add(ChatMessage(user_id=user.id, mission_id=body.mission_id, role="user",
                       content=body.message,
                       channel="voice" if body.voice else "text",
                       language="", timestamp=datetime.now(timezone.utc)))
    db.commit()

    result = await answer_question_llm(db, user, body.message, body.mission_id, "voice" if body.voice else "text")

    db.add(ChatMessage(user_id=user.id, mission_id=body.mission_id, role="assistant",
                       content=result["reply"], language=result.get("language", "en"),
                       intent=result.get("intent", ""), channel="voice" if body.voice else "text",
                       timestamp=datetime.now(timezone.utc)))
    db.commit()
    audit(db, user, "chat", "ai", "", new={"intent": result.get("intent"), "language": result.get("language")})
    return result


@router.get("/languages")
def supported_languages(user: User = Depends(get_current_user)):
    return {"languages": LANGUAGES, "voice_enabled": ["en", "hi"]}


@router.get("/quick-actions")
def quick_actions(user: User = Depends(get_current_user)):
    return {"actions": [{"id": k, "label": v} for k, v in QUICK_ACTIONS.items()]}


@router.get("/status")
def ai_status(user: User = Depends(get_current_user)):
    return {"provider": provider_name(), "llm_configured": provider_name() == "gemini",
            "message": "Gemini LLM configured for natural answers." if provider_name() == "gemini"
                       else "Rule-engine active. Set GEMINI_API_KEY for natural LLM answers."}