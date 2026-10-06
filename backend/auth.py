"""Proteção de acesso por usuário e senha (HTTP Basic).

Credenciais vêm das variáveis de ambiente:
- APP_USUARIOS: um login por pessoa da equipe, no formato
  "daniele:senha1;ana:senha2" (o nome fica registrado em cada lançamento);
- APP_USUARIO e APP_SENHA: login único legado, continua aceito.
Sem nenhuma senha configurada o sistema fica bloqueado (falha fechada), exceto
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


def usuarios_configurados():
    """Retorna {usuario: senha} a partir das variáveis de ambiente."""
    usuarios = {}
    for item in os.getenv("APP_USUARIOS", "").split(";"):
        nome, sep, senha = item.strip().partition(":")
        if sep and nome.strip() and senha:
            usuarios[nome.strip()] = senha
    senha_legada = os.getenv("APP_SENHA")
    if senha_legada:
        usuarios.setdefault(os.getenv("APP_USUARIO", "admin"), senha_legada)
    return usuarios


def _usuario_autenticado(cabecalho, usuarios):
    """Devolve o nome do usuário se as credenciais conferem; senão None."""
    if not cabecalho or not cabecalho.lower().startswith("basic "):
        return None
    try:
        decodificado = base64.b64decode(cabecalho[6:]).decode("utf-8")
    except Exception:
        return None
    u, _, s = decodificado.partition(":")
    encontrado = None
    # Compara com todos para não vazar por tempo de resposta qual usuário existe
    for nome, senha in usuarios.items():
        usuario_ok = secrets.compare_digest(u.encode(), nome.encode())
        senha_ok = secrets.compare_digest(s.encode(), senha.encode())
        if usuario_ok and senha_ok:
            encontrado = nome
    return encontrado


def _pedir_login():
    return PlainTextResponse(
        "Acesso restrito.",
        status_code=401,
        headers={"WWW-Authenticate": 'Basic realm="Santiago Cabral Advocacia", charset="UTF-8"'},
    )


async def middleware_autenticacao(request, call_next):
    if os.getenv("AUTH_DESABILITADA") == "1":
        request.state.usuario = os.getenv("APP_USUARIO", "local")
        return await call_next(request)

    usuarios = usuarios_configurados()
    if not usuarios:
        return PlainTextResponse(
            "Sistema bloqueado: configure a variável de ambiente APP_USUARIOS (ou APP_SENHA).",
            status_code=503,
        )

    ip = _ip(request)
    if _bloqueado(ip):
        return PlainTextResponse(
            "Muitas tentativas incorretas. Tente novamente em 15 minutos.",
            status_code=429,
        )

    cabecalho = request.headers.get("authorization")
    usuario = _usuario_autenticado(cabecalho, usuarios)
    if not usuario:
        if cabecalho:
            _falhas.setdefault(ip, []).append(time.time())
        return _pedir_login()

    request.state.usuario = usuario
    return await call_next(request)
