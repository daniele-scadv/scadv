"""Agenda de contatos dos bancos, alimentada pela equipe.

Todos da equipe consultam e cadastram; cada alteração fica no histórico com
quem e quando. Apagar é restrito aos responsáveis pelos acordos — no dia a dia,
contato que deixou de funcionar é marcado como inativo, para não perder o registro.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from cofre import responsaveis_acordos
from models import ContatoBanco, Historico, get_db
from negociacoes import banco_canonico

router = APIRouter(prefix="/api/contatos-bancos")

TIPOS = ["Ouvidoria", "Recuperação de crédito", "Jurídico", "Gerente / agência", "Assessoria de cobrança",
         "SAC", "Portal de negociação", "Outro"]
CAMPOS = ["banco", "tipo", "nome", "cargo", "telefone", "whatsapp", "email", "endereco", "site", "horario",
          "regiao", "observacoes", "ativo"]


def _usuario(request: Request) -> str:
    return getattr(request.state, "usuario", None) or "desconhecido"


class DadosContato(BaseModel):
    banco: Optional[str] = None
    tipo: Optional[str] = None
    nome: Optional[str] = None
    cargo: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    endereco: Optional[str] = None
    site: Optional[str] = None
    horario: Optional[str] = None
    regiao: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: Optional[bool] = None


class RespostaContato(DadosContato):
    model_config = ConfigDict(from_attributes=True)

    id: int
    banco_grupo: Optional[str] = None
    criado_por: Optional[str]
    criado_em: Optional[datetime]
    atualizado_por: Optional[str]
    atualizado_em: Optional[datetime]


def _resposta(c):
    r = RespostaContato.model_validate(c)
    r.banco_grupo = banco_canonico(c.banco)
    return r


def _validar(c):
    c.banco = " ".join((c.banco or "").split())
    if not c.banco:
        raise HTTPException(422, "Informe o banco.")
    if not (c.tipo or "").strip():
        raise HTTPException(422, "Informe o tipo de contato.")
    if not any((getattr(c, k) or "").strip() for k in ("telefone", "whatsapp", "email", "endereco", "site")):
        raise HTTPException(422, "Informe ao menos um meio de contato (telefone, WhatsApp, e-mail, endereço ou site).")


@router.get("/tipos")
def tipos():
    return TIPOS


@router.get("", response_model=List[RespostaContato])
def listar(banco: Optional[str] = Query(None), busca: Optional[str] = Query(None),
           inativos: bool = Query(False), db: Session = Depends(get_db)):
    q = db.query(ContatoBanco)
    if not inativos:
        q = q.filter(ContatoBanco.ativo == True)  # noqa: E712
    contatos = q.order_by(ContatoBanco.banco.asc(), ContatoBanco.tipo.asc()).all()
    if banco:  # "ITAU UNIBANCO S.A." encontra os contatos cadastrados como "Itaú"
        grupo = banco_canonico(banco)
        contatos = [c for c in contatos if banco_canonico(c.banco) == grupo]
    if busca:
        termo = busca.lower()
        contatos = [c for c in contatos if any(termo in (getattr(c, k) or "").lower()
                                               for k in ("banco", "tipo", "nome", "email", "telefone", "regiao", "observacoes"))
                    or termo in banco_canonico(c.banco).lower()]
    return [_resposta(c) for c in contatos]


@router.post("", response_model=RespostaContato, status_code=201)
def criar(dados: DadosContato, request: Request, db: Session = Depends(get_db)):
    usuario = _usuario(request)
    valores = dados.model_dump()
    valores["ativo"] = True if valores.get("ativo") is None else valores["ativo"]
    c = ContatoBanco(**valores, criado_por=usuario, atualizado_por=usuario)
    _validar(c)
    db.add(c)
    db.flush()
    db.add(Historico(entidade="contato_banco", entidade_id=c.id, acao="criado",
                     descricao=f"{c.banco} · {c.tipo}", usuario=usuario))
    db.commit()
    db.refresh(c)
    return _resposta(c)


@router.patch("/{contato_id}", response_model=RespostaContato)
def atualizar(contato_id: int, dados: DadosContato, request: Request, db: Session = Depends(get_db)):
    c = db.get(ContatoBanco, contato_id)
    if not c:
        raise HTTPException(404, "Contato não encontrado.")
    usuario = _usuario(request)
    alterados = []
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        if getattr(c, campo) != valor:
            antigo = getattr(c, campo)
            setattr(c, campo, valor)
            alterados.append(f"{campo}: {antigo if antigo not in (None, '') else '—'} → {valor if valor not in (None, '') else '—'}")
    if alterados:
        _validar(c)
        c.atualizado_por = usuario
        c.atualizado_em = datetime.utcnow()
        db.add(Historico(entidade="contato_banco", entidade_id=c.id, acao="alterado",
                         descricao="; ".join(alterados), usuario=usuario))
        db.commit()
        db.refresh(c)
    return _resposta(c)


@router.delete("/{contato_id}")
def apagar(contato_id: int, request: Request, db: Session = Depends(get_db)):
    if _usuario(request) not in responsaveis_acordos():
        raise HTTPException(403, "Só os responsáveis pelos acordos apagam contatos. Marque como inativo.")
    c = db.get(ContatoBanco, contato_id)
    if c:
        db.add(Historico(entidade="contato_banco", entidade_id=c.id, acao="apagado",
                         descricao=f"{c.banco} · {c.tipo} · {c.nome or ''}", usuario=_usuario(request)))
        db.delete(c)
        db.commit()
    return {"ok": True}


@router.get("/{contato_id}/historico")
def historico(contato_id: int, db: Session = Depends(get_db)):
    itens = db.query(Historico).filter(Historico.entidade == "contato_banco", Historico.entidade_id == contato_id) \
        .order_by(Historico.data.desc()).all()
    return [{"id": h.id, "acao": h.acao, "descricao": h.descricao, "usuario": h.usuario, "data": h.data} for h in itens]
