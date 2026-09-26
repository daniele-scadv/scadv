"""Proteção de acesso por usuário e senha (HTTP Basic).

Credenciais vêm das variáveis de ambiente APP_USUARIO e APP_SENHA.
Sem APP_SENHA configurada o sistema fica bloqueado (falha fechada), exceto
se AUTH_DESABILITADA=1 — use isso apenas para testes locais.
"""
import base64
import os
import secrets
import time

from starlette.responses import PlainTextResponse

MAX_TENTATIVAS = 10
JANELA_BLOQUEIO = 15 * 60  # segundos

_falhas = {}  # ip -> lista de timestamps de tentativas erradas


def _ip(request):
    encaminhado = request.headers.get("x-forwarded-for")
    if encaminhado:
        return encaminhado.split(",")[0].strip()
    return request.client.host if request.client else "desconhecido"


def _bloqueado(ip):
    agora = time.time()
    recentes = [t for t in _falhas.get(ip, []) if agora - t < JANELA_BLOQUEIO]
    _falhas[ip] = recentes
    return len(recentes) >= MAX_TENTATIVAS


def _credenciais_validas(cabecalho, usuario, senha):
    if not cabecalho or not cabecalho.lower().startswith("basic "):
        return False
    try:
        decodificado = base64.b64decode(cabecalho[6:]).decode("utf-8")
    except Exception:
        return False
    u, _, s = decodificado.partition(":")
    usuario_ok = secrets.compare_digest(u.encode(), usuario.encode())
    senha_ok = secrets.compare_digest(s.encode(), senha.encode())
    return usuario_ok and senha_ok


def _pedir_login():
    return PlainTextResponse(
        "Acesso restrito.",
        status_code=401,
        headers={"WWW-Authenticate": 'Basic realm="Santiago Cabral Advocacia", charset="UTF-8"'},
    )


async def middleware_autenticacao(request, call_next):
    if os.getenv("AUTH_DESABILITADA") == "1":
        return await call_next(request)

    senha = os.getenv("APP_SENHA")
    usuario = os.getenv("APP_USUARIO", "admin")
    if not senha:
        return PlainTextResponse(
            "Sistema bloqueado: configure a variável de ambiente APP_SENHA.",
            status_code=503,
        )

    ip = _ip(request)
    if _bloqueado(ip):
        return PlainTextResponse(
            "Muitas tentativas incorretas. Tente novamente em 15 minutos.",
            status_code=429,
        )

    cabecalho = request.headers.get("authorization")
    if not _credenciais_validas(cabecalho, usuario, senha):
        if cabecalho:
            _falhas.setdefault(ip, []).append(time.time())
        return _pedir_login()

    return await call_next(request)
