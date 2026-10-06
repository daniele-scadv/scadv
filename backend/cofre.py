"""Cofre do acesso gov.br dos clientes.

- Login, senha e observações são gravados criptografados (Fernet/AES) com a chave
  da variável APP_CHAVE_COFRE; sem a chave, nem quem acessa o banco de dados lê.
- Só os usuários listados em APP_RESPONSAVEIS_ACORDOS (ex.: "daniele;ana") podem
  cadastrar, ver ou apagar. Os demais veem apenas que o acesso existe.
- Toda visualização, alteração e exclusão fica no histórico do cliente.
"""
import os
from datetime import datetime
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models import Cliente, CredencialGov, Historico, get_db

router = APIRouter(prefix="/api/clientes/{cliente_id}/gov")


def responsaveis_acordos():
    return {n.strip() for n in os.getenv("APP_RESPONSAVEIS_ACORDOS", "").split(";") if n.strip()}


def _usuario(request: Request) -> str:
    return getattr(request.state, "usuario", None) or "desconhecido"


def _pode_acessar(request: Request) -> bool:
    return _usuario(request) in responsaveis_acordos()


def _exigir_acesso(request: Request):
    if not _pode_acessar(request):
        raise HTTPException(403, "Acesso gov.br restrito aos responsáveis pelos acordos.")


def _fernet():
    chave = os.getenv("APP_CHAVE_COFRE")
    if not chave:
        raise HTTPException(503, "Cofre desativado: configure a variável APP_CHAVE_COFRE.")
    try:
        return Fernet(chave.encode())
    except ValueError:
        raise HTTPException(503, "APP_CHAVE_COFRE inválida.")


def _cliente(db, cliente_id):
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(404, "Cliente não encontrado.")
    return cliente


def _registrar(db, cliente_id, acao, usuario):
    db.add(Historico(entidade="cliente", entidade_id=cliente_id, acao=acao, usuario=usuario))


def _sem_cache(response: Response):
    response.headers["Cache-Control"] = "no-store"


class DadosGov(BaseModel):
    login: str
    senha: str
    observacoes: Optional[str] = None


@router.get("")
def situacao(cliente_id: int, request: Request, db: Session = Depends(get_db)):
    _cliente(db, cliente_id)
    cred = db.query(CredencialGov).filter(CredencialGov.cliente_id == cliente_id).first()
    return {
        "existe": cred is not None,
        "pode_acessar": _pode_acessar(request),
        "cofre_ativo": bool(os.getenv("APP_CHAVE_COFRE")),
        "atualizado_por": cred.atualizado_por if cred else None,
        "atualizado_em": cred.atualizado_em if cred else None,
    }


@router.post("/revelar")
def revelar(cliente_id: int, request: Request, response: Response, db: Session = Depends(get_db)):
    _exigir_acesso(request)
    _sem_cache(response)
    cred = db.query(CredencialGov).filter(CredencialGov.cliente_id == cliente_id).first()
    if not cred:
        raise HTTPException(404, "Acesso gov.br não cadastrado.")
    f = _fernet()
    try:
        dados = {
            "login": f.decrypt(cred.login_cifrado.encode()).decode(),
            "senha": f.decrypt(cred.senha_cifrada.encode()).decode(),
            "observacoes": f.decrypt(cred.observacoes_cifradas.encode()).decode() if cred.observacoes_cifradas else None,
        }
    except InvalidToken:
        raise HTTPException(500, "Não foi possível descriptografar: a APP_CHAVE_COFRE mudou.")
    _registrar(db, cliente_id, "acesso gov.br visualizado", _usuario(request))
    db.commit()
    return dados


@router.put("")
def salvar(cliente_id: int, dados: DadosGov, request: Request, response: Response, db: Session = Depends(get_db)):
    _exigir_acesso(request)
    _sem_cache(response)
    _cliente(db, cliente_id)
    if not dados.login.strip() or not dados.senha:
        raise HTTPException(422, "Informe login e senha.")
    f = _fernet()
    cred = db.query(CredencialGov).filter(CredencialGov.cliente_id == cliente_id).first()
    acao = "acesso gov.br alterado" if cred else "acesso gov.br cadastrado"
    if not cred:
        cred = CredencialGov(cliente_id=cliente_id)
        db.add(cred)
    cred.login_cifrado = f.encrypt(dados.login.strip().encode()).decode()
    cred.senha_cifrada = f.encrypt(dados.senha.encode()).decode()
    obs = (dados.observacoes or "").strip()
    cred.observacoes_cifradas = f.encrypt(obs.encode()).decode() if obs else None
    cred.atualizado_por = _usuario(request)
    cred.atualizado_em = datetime.utcnow()
    _registrar(db, cliente_id, acao, _usuario(request))
    db.commit()
    return {"ok": True}


@router.delete("")
def apagar(cliente_id: int, request: Request, db: Session = Depends(get_db)):
    _exigir_acesso(request)
    cred = db.query(CredencialGov).filter(CredencialGov.cliente_id == cliente_id).first()
    if cred:
        db.delete(cred)
        _registrar(db, cliente_id, "acesso gov.br apagado", _usuario(request))
        db.commit()
    return {"ok": True}
