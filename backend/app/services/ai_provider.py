from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any

import httpx

from app.core.config import settings


class AIProvider(ABC):
    @abstractmethod
    def generate_json(self, *, system_prompt: str, user_prompt: str) -> dict[str, Any] | None:
        raise NotImplementedError

    @abstractmethod
    def generate_text(self, *, system_prompt: str, user_prompt: str) -> str | None:
        raise NotImplementedError


class OpenAICompatibleProvider(AIProvider):
    def __init__(self, api_key: str, model: str, base_url: str):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")

    def _chat_completion(self, *, system_prompt: str, user_prompt: str, json_mode: bool) -> str | None:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": self.model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            with httpx.Client(timeout=20) as client:
                response = client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
                response.raise_for_status()
                body = response.json()
        except Exception:
            return None

        try:
            return body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            return None

    def generate_json(self, *, system_prompt: str, user_prompt: str) -> dict[str, Any] | None:
        raw = self._chat_completion(system_prompt=system_prompt, user_prompt=user_prompt, json_mode=True)
        if not raw:
            return None

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return None

        return parsed if isinstance(parsed, dict) else None

    def generate_text(self, *, system_prompt: str, user_prompt: str) -> str | None:
        raw = self._chat_completion(system_prompt=system_prompt, user_prompt=user_prompt, json_mode=False)
        return raw.strip() if raw else None


class NullAIProvider(AIProvider):
    def generate_json(self, *, system_prompt: str, user_prompt: str) -> dict[str, Any] | None:
        del system_prompt, user_prompt
        return None

    def generate_text(self, *, system_prompt: str, user_prompt: str) -> str | None:
        del system_prompt, user_prompt
        return None


def get_ai_provider() -> AIProvider:
    if settings.llm_api_key:
        return OpenAICompatibleProvider(
            api_key=settings.llm_api_key,
            model=settings.llm_model,
            base_url=settings.llm_base_url,
        )
    return NullAIProvider()
