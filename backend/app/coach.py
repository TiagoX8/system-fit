"""Conselheiro do Sistema: chat de dúvidas sobre treino via Gemini.

A chave nunca chega ao frontend: o navegador fala somente com este backend,
que encaminha para a API do Gemini e devolve o texto.
"""

import logging
import os
import random
import time

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURAÇÃO
# ============================================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Modelo principal configurável pelo .env
GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.6-flash",
)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
)

# Modelos utilizados como fallback caso o principal esteja indisponível.
#
# Você pode alterar essa lista futuramente sem mexer na lógica do Conselheiro.
FALLBACK_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
]


# ============================================================================
# LIMITES DA APLICAÇÃO
# ============================================================================

# Limite interno por usuário para evitar abuso e consumo excessivo da API.
COACH_MESSAGES_PER_DAY = int(
    os.getenv("COACH_MESSAGES_PER_DAY", "40")
)

DAY_SECONDS = 24 * 60 * 60

# Quantidade máxima de mensagens antigas enviadas ao Gemini.
MAX_HISTORY_MESSAGES = 12

# Timeout de cada requisição HTTP.
REQUEST_TIMEOUT_SECONDS = 30

# Número máximo de tentativas para erros temporários.
MAX_RETRIES = 3

# Teto de saída. Nos modelos Gemini 3 os tokens de raciocínio saem daqui
# junto com o texto, então um teto curto corta a resposta no meio.
MAX_OUTPUT_TOKENS = 1600

# Raciocínio mínimo: o Conselheiro responde dúvida de treino, não precisa
# planejar em várias etapas, e o padrão ("medium" no Gemini 3) dobra a espera.
THINKING_LEVEL = "minimal"


# ============================================================================
# PROMPT DO CONSELHEIRO
# ============================================================================

SYSTEM_PROMPT = """Você é o "Conselheiro do Sistema", a IA que orienta um Caçador
em treinos de peso corporal feitos em casa, sem equipamento.

Fale em português do Brasil, em tom de painel de RPG:
direto, motivador e objetivo.

Limite sua resposta a no máximo 150 palavras.

Regras:

- Só responda sobre exercício, execução, progressão, alongamento,
  descanso, sono e alimentação em linhas gerais.

- Nunca dê diagnóstico, tratamento, dieta com calorias fechadas,
  dose de suplemento ou orientação sobre dor persistente/lesão.

- Nesses casos, recomende procurar um profissional de saúde.

- Ao sugerir exercícios, entregue:
  nome, séries, repetições e um cuidado de execução.

- Prefira exercícios que possam ser feitos em casa e sem equipamentos.

- Se o Caçador pedir uma dica de treino novo, considere a rotina dele
  listada no contexto e sugira o que está faltando.

- Não invente informações sobre a rotina do Caçador.

- Seja prático e evite explicações desnecessariamente longas.
"""


# ============================================================================
# MENSAGENS DE ERRO
# ============================================================================

DISABLED_MESSAGE = (
    "O Conselheiro do Sistema está offline: "
    "configure GEMINI_API_KEY no servidor."
)


class CoachUnavailable(RuntimeError):
    """Erro de configuração ou indisponibilidade do provedor."""


class CoachQuotaExceeded(RuntimeError):
    """Usuário atingiu o limite diário do Conselheiro."""


# ============================================================================
# UTILITÁRIOS
# ============================================================================

def provider_error_message(response: httpx.Response) -> str:
    """
    Extrai uma mensagem legível do erro retornado pelo Gemini.
    """

    try:
        error = response.json().get("error") or {}

    except ValueError:
        return "resposta ilegível do provedor"

    message = (
        error.get("message")
        or error.get("status")
        or "erro desconhecido"
    )

    return str(message)[:200]


def is_enabled() -> bool:
    """
    Verifica se a chave da API está configurada.
    """

    return bool(GEMINI_API_KEY)


# ============================================================================
# CONTROLE DE USO
# ============================================================================

_usage: dict[int, tuple[float, int]] = {}


def check_and_count_usage(user_id: int) -> int:
    """
    Conta as mensagens do usuário dentro de uma janela de 24 horas.

    Retorna quantas mensagens ainda estão disponíveis.
    """

    now = time.monotonic()

    window_start, count = _usage.get(
        user_id,
        (now, 0),
    )

    # Reinicia a janela depois de 24 horas.
    if now - window_start > DAY_SECONDS:
        window_start = now
        count = 0

    if count >= COACH_MESSAGES_PER_DAY:
        raise CoachQuotaExceeded(
            "Você atingiu o limite diário de mensagens "
            "do Conselheiro. Volte amanhã, Caçador."
        )

    _usage[user_id] = (
        window_start,
        count + 1,
    )

    return COACH_MESSAGES_PER_DAY - (count + 1)


def refund_usage(user_id: int) -> None:
    """
    Devolve uma mensagem ao usuário quando a resposta não chegou.
    """

    window_start, count = _usage.get(
        user_id,
        (time.monotonic(), 0),
    )

    if count > 0:
        _usage[user_id] = (
            window_start,
            count - 1,
        )


# ============================================================================
# HISTÓRICO
# ============================================================================

def build_contents(
    history: list[dict],
    context: str,
) -> list[dict]:
    """
    Converte o histórico do chat para o formato `contents` da API Gemini.
    """

    contents: list[dict] = []

    recent_history = history[-MAX_HISTORY_MESSAGES:]

    for index, message in enumerate(recent_history):

        text = message["content"]

        # O contexto da rotina é enviado junto da primeira mensagem
        # do histórico.
        if index == 0 and context:
            text = (
                "[Rotina atual do Caçador]\n"
                f"{context}\n\n"
                f"{text}"
            )

        contents.append(
            {
                "role": (
                    "model"
                    if message["role"] == "assistant"
                    else "user"
                ),
                "parts": [
                    {
                        "text": text
                    }
                ],
            }
        )

    return contents


# ============================================================================
# CHAMADA À API GEMINI
# ============================================================================

def thinking_config(model: str) -> dict:
    """
    Configuração de raciocínio aceita pela família do modelo.

    Gemini 3 usa `thinkingLevel`; a série 2.5 só entende `thinkingBudget`.
    """

    if model.startswith("gemini-2"):
        return {"thinkingBudget": 0}

    return {"thinkingLevel": THINKING_LEVEL}


def build_payload(
    model: str,
    history: list[dict],
    context: str,
) -> dict:
    """
    Monta o corpo da requisição para um modelo específico.
    """

    return {
        "systemInstruction": {
            "parts": [
                {
                    "text": SYSTEM_PROMPT
                }
            ]
        },

        "contents": build_contents(
            history,
            context,
        ),

        "generationConfig": {
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "thinkingConfig": thinking_config(model),
        },
    }


def without_thinking_config(payload: dict) -> dict:
    """
    Remove a configuração de raciocínio, para o caso de o modelo não aceitá-la.
    """

    generation_config = {
        key: value
        for key, value in payload["generationConfig"].items()
        if key != "thinkingConfig"
    }

    return {
        **payload,
        "generationConfig": generation_config,
    }


def _call_gemini(
    model: str,
    payload: dict,
) -> httpx.Response:
    """
    Faz uma chamada ao Gemini com retry automático para erros temporários.

    Erros tratados com retry:
    - 408 Request Timeout
    - 500 Internal Server Error
    - 502 Bad Gateway
    - 503 Service Unavailable
    - 504 Gateway Timeout
    """

    # 429 fica fora: é cota/limite de chave, esperar não resolve e só
    # aumenta o tempo que o Caçador passa olhando o "..".
    retry_status_codes = {
        408,
        500,
        502,
        503,
        504,
    }

    last_response: httpx.Response | None = None

    for attempt in range(MAX_RETRIES + 1):

        try:

            logger.info(
                "Chamando Gemini: modelo=%s tentativa=%s/%s",
                model,
                attempt + 1,
                MAX_RETRIES + 1,
            )

            response = httpx.post(
                f"{GEMINI_URL}/{model}:generateContent",
                headers={
                    "x-goog-api-key": GEMINI_API_KEY,
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )

            last_response = response

            # Sucesso ou erro que não deve sofrer retry.
            if response.status_code not in retry_status_codes:
                return response

            # Não há mais tentativas.
            if attempt >= MAX_RETRIES:
                return response

            # Exponential backoff:
            #
            # tentativa 1 -> ~1s
            # tentativa 2 -> ~2s
            # tentativa 3 -> ~4s
            #
            # Jitter evita que várias requisições sejam repetidas
            # exatamente ao mesmo tempo.
            delay = (
                min(2 ** attempt, 8)
                + random.uniform(0, 0.5)
            )

            logger.warning(
                "Gemini respondeu %s para o modelo %s. "
                "Tentando novamente em %.2f segundos.",
                response.status_code,
                model,
                delay,
            )

            time.sleep(delay)

        except httpx.TimeoutException as error:

            logger.warning(
                "Timeout ao chamar Gemini (%s), tentativa %s/%s.",
                model,
                attempt + 1,
                MAX_RETRIES + 1,
            )

            if attempt >= MAX_RETRIES:
                raise CoachUnavailable(
                    "O Conselheiro demorou demais para responder. "
                    "Tente novamente."
                ) from error

            delay = (
                min(2 ** attempt, 8)
                + random.uniform(0, 0.5)
            )

            time.sleep(delay)

        except httpx.HTTPError as error:

            logger.warning(
                "Erro HTTP ao chamar Gemini (%s): %s",
                model,
                error,
            )

            if attempt >= MAX_RETRIES:
                raise CoachUnavailable(
                    "O Conselheiro não respondeu. "
                    "Tente novamente."
                ) from error

            delay = (
                min(2 ** attempt, 8)
                + random.uniform(0, 0.5)
            )

            time.sleep(delay)

    # Segurança: normalmente nunca deve chegar aqui.
    if last_response is not None:
        return last_response

    raise CoachUnavailable(
        "O Conselheiro não conseguiu se conectar ao serviço de IA."
    )


# ============================================================================
# EXTRAÇÃO DA RESPOSTA
# ============================================================================

def extract_gemini_text(
    response: httpx.Response,
) -> str:
    """
    Extrai o texto da resposta do Gemini.
    """

    try:
        data = response.json()

    except ValueError as error:
        raise CoachUnavailable(
            "O Conselheiro recebeu uma resposta inválida da IA."
        ) from error

    candidates = data.get("candidates") or []

    if not candidates:
        raise CoachUnavailable(
            "O Conselheiro não conseguiu formular uma resposta."
        )

    candidate = candidates[0]

    if candidate.get("finishReason") == "MAX_TOKENS":
        logger.warning(
            "Gemini cortou a resposta em maxOutputTokens=%s (tokens de "
            "raciocínio: %s).",
            MAX_OUTPUT_TOKENS,
            (data.get("usageMetadata") or {}).get("thoughtsTokenCount"),
        )

    content = candidate.get("content") or {}

    parts = content.get("parts") or []

    text_parts = []

    for part in parts:

        text = part.get("text")

        if text:
            text_parts.append(text)

    text = "".join(text_parts).strip()

    if not text:
        raise CoachUnavailable(
            "O Conselheiro não conseguiu formular uma resposta."
        )

    return text


# ============================================================================
# LISTA DE MODELOS
# ============================================================================

def get_models_to_try() -> list[str]:
    """
    Monta a lista de modelos que serão tentados.

    O modelo definido no .env sempre tem prioridade.
    """

    models: list[str] = []

    candidates = [
        GEMINI_MODEL,
        *FALLBACK_MODELS,
    ]

    for model in candidates:

        if model and model not in models:
            models.append(model)

    return models


# ============================================================================
# CONSELHEIRO
# ============================================================================

def ask_coach(
    history: list[dict],
    context: str,
) -> str:
    """
    Envia a conversa para o Gemini e retorna a resposta do Conselheiro.
    """

    # ------------------------------------------------------------------------
    # Verificação da API Key
    # ------------------------------------------------------------------------

    if not is_enabled():
        raise CoachUnavailable(
            DISABLED_MESSAGE
        )

    # ------------------------------------------------------------------------
    # Modelos disponíveis
    # ------------------------------------------------------------------------

    models_to_try = get_models_to_try()

    if not models_to_try:
        raise CoachUnavailable(
            "Nenhum modelo Gemini foi configurado."
        )

    last_reason = None

    # ------------------------------------------------------------------------
    # Tentativa dos modelos
    # ------------------------------------------------------------------------

    for model in models_to_try:

        logger.info(
            "Tentando modelo Gemini: %s",
            model,
        )

        payload = build_payload(
            model,
            history,
            context,
        )

        response = _call_gemini(
            model,
            payload,
        )

        # --------------------------------------------------------------------
        # 400 - configuração de raciocínio não aceita por este modelo
        # --------------------------------------------------------------------

        if (
            response.status_code == 400
            and "thinking" in provider_error_message(response).lower()
        ):

            logger.warning(
                "Modelo %s não aceitou thinkingConfig; repetindo sem ele.",
                model,
            )

            response = _call_gemini(
                model,
                without_thinking_config(payload),
            )

        # --------------------------------------------------------------------
        # 404 - modelo inexistente
        # --------------------------------------------------------------------

        if response.status_code == 404:

            reason = provider_error_message(
                response
            )

            logger.warning(
                "Modelo %s indisponível: %s",
                model,
                reason,
            )

            last_reason = reason

            continue

        # --------------------------------------------------------------------
        # 429 - limite de requisições/cota
        # --------------------------------------------------------------------

        if response.status_code == 429:

            reason = provider_error_message(
                response
            )

            logger.warning(
                "Gemini retornou 429 no modelo %s: %s",
                model,
                reason,
            )

            raise CoachUnavailable(
                "A cota ou o limite de requisições da IA "
                "foi atingido. Tente novamente mais tarde."
            )

        # --------------------------------------------------------------------
        # 503 - serviço temporariamente indisponível
        # --------------------------------------------------------------------

        if response.status_code == 503:

            reason = provider_error_message(
                response
            )

            logger.warning(
                "Modelo %s continua indisponível após "
                "todas as tentativas: %s",
                model,
                reason,
            )

            last_reason = reason

            # Tenta o próximo modelo.
            continue

        # --------------------------------------------------------------------
        # Outros erros HTTP
        # --------------------------------------------------------------------

        if response.status_code >= 400:

            reason = provider_error_message(
                response
            )

            logger.warning(
                "Gemini respondeu %s no modelo %s: %s",
                response.status_code,
                model,
                reason,
            )

            raise CoachUnavailable(
                f"O Conselheiro falhou "
                f"({response.status_code}): {reason}"
            )

        # --------------------------------------------------------------------
        # Resposta bem-sucedida
        # --------------------------------------------------------------------

        try:

            text = extract_gemini_text(
                response
            )

        except CoachUnavailable:

            # Se o modelo respondeu mas não gerou texto,
            # tentamos o próximo modelo.
            last_reason = "resposta vazia"

            logger.warning(
                "Modelo %s retornou uma resposta sem texto.",
                model,
            )

            continue

        logger.info(
            "Resposta do Conselheiro gerada com sucesso pelo modelo %s.",
            model,
        )

        return text

    # ------------------------------------------------------------------------
    # Nenhum modelo funcionou
    # ------------------------------------------------------------------------

    logger.error(
        "Todos os modelos Gemini falharam. Último motivo: %s",
        last_reason,
    )

    raise CoachUnavailable(
        "O Conselheiro está temporariamente indisponível. "
        "Tente novamente em alguns segundos."
    )
