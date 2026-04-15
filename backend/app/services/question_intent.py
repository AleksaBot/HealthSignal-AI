from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

from app.core.config import settings
from app.services.ml_intent_classifier import load_intent_classifier, predict_with_intent_classifier
from app.schemas.note_intelligence import QuestionIntent

INTENT_PATTERNS: list[tuple[QuestionIntent, str]] = [
    ("medication", r"\b(medicine|medication|drug|prescription|pill|rx|dose|side effect)\b"),
    ("warning_signs", r"\b(warning sign|warning signs|red flag|danger|emergency|worry|when should i seek care)\b"),
    ("symptoms", r"\b(symptom|symptoms|pain|nausea|vomiting|dizzy|fatigue|fever|cough)\b"),
    ("seriousness", r"\b(serious|severity|how bad|dangerous|risk level)\b"),
    ("next_steps", r"\b(next step|next steps|what should i do|what should happen next|what now|plan|right now|today)\b"),
    ("tests", r"\b(test|tests|lab|labs|blood work|mri|ct|x-?ray|scan|result|results)\b"),
    ("referrals", r"\b(referral|referrals|referred|specialist|neurologist|cardiologist|endocrinologist)\b"),
    ("definitions", r"\b(what does .* mean|define|definition|meaning|explain this term|what is [a-z][a-z0-9 _-]{1,40}\?)\b"),
]


def classify_question_intent(question: str) -> QuestionIntent:
    if settings.intent_classifier_backend.lower() == "ml":
        ml_prediction = _predict_with_ml_classifier(question)
        if ml_prediction:
            return ml_prediction
    return classify_question_intent_rule(question)


def classify_question_intent_rule(question: str) -> QuestionIntent:
    lowered = question.lower()
    for intent, pattern in INTENT_PATTERNS:
        if re.search(pattern, lowered):
            return intent
    return "general"


@lru_cache(maxsize=1)
def _load_ml_classifier_cached():
    model_path = Path(settings.intent_classifier_model_path)
    return load_intent_classifier(model_path)


def _predict_with_ml_classifier(question: str) -> QuestionIntent | None:
    try:
        model = _load_ml_classifier_cached()
        prediction = predict_with_intent_classifier(question, model)
        return prediction
    except Exception:
        return None
