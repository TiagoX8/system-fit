"""Conselheiro do Sistema: chat de dúvidas sobre treino via Gemini (free tier).

A chave nunca chega ao frontend: o navegador fala só com este backend, que
encaminha para a API do Gemini e devolve o texto.
"""

import logging
import os
import time

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models"

# Usado quando o modelo configurado não existe para a chave (404).
FALLBACK_MODEL = "gemini-3.6-flash"

# Teto por usuário para não estourar a cota gratuita nem travar o app.
COACH_MESSAGES_PER_DAY = int(os.getenv("COACH_MESSAGES_PER_DAY", "40"))
DAY_SECONDS = 24 * 60 * 60

MAX_HISTORY_MESSAGES = 12
REQUEST_TIMEOUT_SECONDS = 30

SYSTEM_PROMPT = """Você é o "Conselheiro do Sistema", a IA que orienta um Caçador
em treinos de peso corporal feitos em casa, sem equipamento. Fale em português do
Brasil, em tom de painel de RPG (direto, motivador, sem exagero), com no máximo
150 palavras.

Regras:
- Só responda sobre exercício, execução, progressão, alongamento, descanso,
  sono e alimentação em linhas gerais.
- Nunca dê diagnóstico, tratamento, dieta com calorias fechadas, dose de
  suplemento ou orientação sobre dor persistente/lesão: nesses casos recomende
  procurar um profissional de saúde.
- Ao sugerir exercícios, entregue nome, séries, repetições e um cuidado de
  execução, preferindo o que dá para fazer em casa.
- Se o Caçador pedir dica de treino novo, considere a rotina dele listada no
  contexto e sugira o que está faltando."""

DISABLED_MESSAGE = (
    "O Conselheiro do Sistema está offline: configure GEMINI_API_KEY no servidor."
)


class CoachUnavailable(RuntimeError):
    """Erro de configuração ou do provedor, já com mensagem para o usuário."""


class CoachQuotaExceeded(RuntimeError):
    pass


def provider_error_message(response: httpx.Response) -> str:
    """Mensagem de erro do Gemini, para o usuário saber o que configurar."""
    try:
        error = response.json().get("error") or {}
    except ValueError:
        return "resposta ilegível do provedor"

    message = error.get("message") or error.get("status") or "erro desconhecido"

    return str(message)[:200]


def is_enabled() -> bool:
    return bool(GEMINI_API_KEY)


_usage: dict[int, tuple[float, int]] = {}


def check_and_count_usage(user_id: int) -> int:
    """Conta as mensagens do dia; devolve quantas ainda restam."""
    now = time.monotonic()
    window_start, count = _usage.get(user_id, (now, 0))

    if now - window_start > DAY_SECONDS:
        window_start, count = now, 0

    if count >= COACH_MESSAGES_PER_DAY:
        raise CoachQuotaExceeded(
            "Você atingiu o limite diário de mensagens do Conselheiro. "
            "Volte amanhã, Caçador."
        )

    _usage[user_id] = (window_start, count + 1)

    return COACH_MESSAGES_PER_DAY - (count + 1)


def refund_usage(user_id: int) -> None:
    """Devolve a mensagem quando a resposta não chegou."""
    window_start, count = _usage.get(user_id, (time.monotonic(), 0))

    if count > 0:
        _usage[user_id] = (window_start, count - 1)


def build_contents(history: list[dict], context: str) -> list[dict]:
    """Converte o histórico do chat no formato `contents` do Gemini."""
    contents: list[dict] = []

    for index, message in enumerate(history[-MAX_HISTORY_MESSAGES:]):
        text = message["content"]

        if index == 0 and context:
            text = f"[Rotina atual do Caçador]\n{context}\n\n{text}"

        contents.append(
            {
                "role": "model" if message["role"] == "assistant" else "user",
                "parts": [{"text": text}],
            }
        )

    return contents


def _call_gemini(model: str, payload: dict) -> httpx.Response:
    try:
        return httpx.post(
            f"{GEMINI_URL}/{model}:generateContent",
            headers={"x-goog-api-key": GEMINI_API_KEY},
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as error:
        raise CoachUnavailable("O Conselheiro não respondeu. Tente de novo.") from error


def ask_coach(history: list[dict], context: str) -> str:
    if not is_enabled():
        raise CoachUnavailable(DISABLED_MESSAGE)

    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": build_contents(history, context),
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 600},
    }

    response = _call_gemini(GEMINI_MODEL, payload)

    if response.status_code == 404 and GEMINI_MODEL != FALLBACK_MODEL:
        logger.warning(
            "Modelo %s indisponível para esta chave; usando %s",
            GEMINI_MODEL,
            FALLBACK_MODEL,
        )
        response = _call_gemini(FALLBACK_MODEL, payload)

    if response.status_code == 429:
        raise CoachUnavailable(
            "A cota gratuita da IA foi atingida. Tente novamente mais tarde."
        )

    if response.status_code >= 400:
        reason = provider_error_message(response)
        logger.warning("Gemini respondeu %s: %s", response.status_code, reason)

        raise CoachUnavailable(
            f"O Conselheiro falhou ({response.status_code}): {reason}"
        )

    data = response.json()
    candidates = data.get("candidates") or []

    if not candidates:
        raise CoachUnavailable("O Conselheiro não conseguiu formular uma resposta.")

    parts = candidates[0].get("content", {}).get("parts") or []
    text = "".join(part.get("text", "") for part in parts).strip()

    if not text:
        raise CoachUnavailable("O Conselheiro não conseguiu formular uma resposta.")

    return text
