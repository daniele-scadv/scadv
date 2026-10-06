"""Clientes, negociações extrajudiciais com bancos e dashboard de acordos."""
import unicodedata
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import usuarios_configurados
from models import Cliente, Historico, Negociacao, Tentativa, get_db

router = APIRouter(prefix="/api")

ETAPAS = [
    "diagnostico",
    "notificacao_enviada",
    "aguardando_banco",
    "em_negociacao",
    "aprovacao_cliente",
    "formalizacao",
    "pagamento",
    "quitado",
    "sem_acordo",
    "desistencia",
]
ETAPA_ROTULOS = {
    "diagnostico": "Diagnóstico", "notificacao_enviada": "Notificação enviada",
    "aguardando_banco": "Aguardando banco", "em_negociacao": "Em negociação",
    "aprovacao_cliente": "Aprovação do cliente", "formalizacao": "Formalização",
    "pagamento": "Acompanhamento de pagamento", "quitado": "Quitado",
    "sem_acordo": "Sem acordo (judicializar)", "desistencia": "Cliente desistiu",
}
ETAPAS_ENCERRADAS = {"quitado", "sem_acordo", "desistencia"}
ETAPAS_COM_ACORDO = {"pagamento", "quitado"}
ETAPAS_SEM_ACORDO = {"sem_acordo", "desistencia"}


def _usuario(request: Request) -> str:
    return getattr(request.state, "usuario", None) or "desconhecido"


def _registrar(db, entidade, entidade_id, acao, descricao, usuario):
    db.add(Historico(entidade=entidade, entidade_id=entidade_id, acao=acao,
                     descricao=descricao, usuario=usuario))


def _digitos(valor):
    return "".join(c for c in (valor or "") if c.isdigit())


def _cpf_valido(cpf):
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    for tamanho in (9, 10):
        soma = sum(int(cpf[i]) * (tamanho + 1 - i) for i in range(tamanho))
        digito = (soma * 10) % 11 % 10
        if digito != int(cpf[tamanho]):
            return False
    return True


def _cnpj_valido(cnpj):
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False
    pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    for tamanho in (12, 13):
        soma = sum(int(cnpj[i]) * pesos[i + 13 - tamanho] for i in range(tamanho))
        resto = soma % 11
        digito = 0 if resto < 2 else 11 - resto
        if digito != int(cnpj[tamanho]):
            return False
    return True


# ─── Usuário logado ─────────────────────────────────────────────────────────

@router.get("/eu")
def usuario_logado(request: Request):
    usuario = _usuario(request)
    equipe = sorted(set(usuarios_configurados()) | {usuario})
    return {"usuario": usuario, "equipe": equipe}


# ─── Clientes ───────────────────────────────────────────────────────────────

CAMPOS_CLIENTE_ROTULOS = {
    "tipo": "Tipo", "nome": "Nome", "cpf_cnpj": "CPF/CNPJ", "rg": "RG", "rg_orgao_emissor": "Órgão emissor",
    "data_nascimento": "Data de nascimento", "nome_pai": "Nome do pai", "nome_mae": "Nome da mãe",
    "estado_civil": "Estado civil", "profissao": "Profissão", "telefone": "Telefone", "email": "E-mail",
    "cep": "CEP", "logradouro": "Logradouro", "numero": "Número", "complemento": "Complemento",
    "bairro": "Bairro", "cidade": "Cidade", "uf": "UF", "representante_legal": "Representante legal",
    "representante_cpf": "CPF do representante", "observacoes": "Observações",
}


class DadosCliente(BaseModel):
    tipo: Optional[str] = None
    nome: Optional[str] = None
    cpf_cnpj: Optional[str] = None
    rg: Optional[str] = None
    rg_orgao_emissor: Optional[str] = None
    data_nascimento: Optional[date] = None
    nome_pai: Optional[str] = None
    nome_mae: Optional[str] = None
    estado_civil: Optional[str] = None
    profissao: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    representante_legal: Optional[str] = None
    representante_cpf: Optional[str] = None
    observacoes: Optional[str] = None


class RespostaCliente(DadosCliente):
    model_config = ConfigDict(from_attributes=True)

    id: int
    origem: Optional[str] = None
    criado_por: Optional[str]
    criado_em: Optional[datetime]
    atualizado_por: Optional[str]
    atualizado_em: Optional[datetime]


def normalizar_nome(nome):
    sem_acento = unicodedata.normalize("NFKD", nome or "").encode("ascii", "ignore").decode()
    return " ".join(sem_acento.lower().split())


def _validar_cliente(db, cliente: Cliente):
    if not (cliente.nome or "").strip():
        raise HTTPException(422, "Informe o nome completo / razão social.")
    cliente.nome = " ".join(cliente.nome.split())
    cliente.tipo = cliente.tipo if cliente.tipo in ("PF", "PJ") else "PF"
    cliente.cpf_cnpj = _digitos(cliente.cpf_cnpj) or None
    if cliente.cpf_cnpj:
        if cliente.tipo == "PF" and not _cpf_valido(cliente.cpf_cnpj):
            raise HTTPException(422, "CPF inválido. Confira os números.")
        if cliente.tipo == "PJ" and not _cnpj_valido(cliente.cpf_cnpj):
            raise HTTPException(422, "CNPJ inválido. Confira os números.")
        duplicado = db.query(Cliente).filter(
            Cliente.cpf_cnpj == cliente.cpf_cnpj, Cliente.id != cliente.id
        ).first()
        if duplicado:
            raise HTTPException(409, f"Já existe cliente com este CPF/CNPJ: {duplicado.nome} (nº {duplicado.id}).")
    else:
        # Sem CPF não há como distinguir homônimos: bloqueia nome idêntico para não duplicar
        nome = normalizar_nome(cliente.nome)
        for outro in db.query(Cliente).filter(Cliente.id != cliente.id).all():
            if normalizar_nome(outro.nome) == nome:
                raise HTTPException(409, f"Já existe cliente com este nome: {outro.nome} (nº {outro.id}). Informe o CPF ou abra o cadastro existente.")
    if cliente.uf:
        cliente.uf = cliente.uf.strip().upper()[:2]


@router.get("/clientes", response_model=List[RespostaCliente])
def listar_clientes(busca: Optional[str] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Cliente)
    if busca:
        termo = f"%{busca}%"
        filtros = [Cliente.nome.ilike(termo), Cliente.telefone.ilike(termo), Cliente.email.ilike(termo)]
        if _digitos(busca):
            filtros.append(Cliente.cpf_cnpj.like(f"%{_digitos(busca)}%"))
        q = q.filter(or_(*filtros))
    return q.order_by(Cliente.nome.asc()).all()


@router.get("/clientes/{cliente_id}", response_model=RespostaCliente)
def detalhe_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(404, "Cliente não encontrado.")
    return cliente


@router.post("/clientes", response_model=RespostaCliente, status_code=201)
def criar_cliente(dados: DadosCliente, request: Request, db: Session = Depends(get_db)):
    usuario = _usuario(request)
    cliente = Cliente(**dados.model_dump(), criado_por=usuario, atualizado_por=usuario)
    _validar_cliente(db, cliente)
    db.add(cliente)
    db.flush()
    _registrar(db, "cliente", cliente.id, "criado", f"Cliente cadastrado: {cliente.nome}", usuario)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.patch("/clientes/{cliente_id}", response_model=RespostaCliente)
def atualizar_cliente(cliente_id: int, dados: DadosCliente, request: Request, db: Session = Depends(get_db)):
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(404, "Cliente não encontrado.")
    usuario = _usuario(request)
    alterados = []
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        if getattr(cliente, campo) != valor:
            setattr(cliente, campo, valor)
            alterados.append(campo)
    if not alterados:
        return cliente
    _validar_cliente(db, cliente)
    cliente.atualizado_por = usuario
    cliente.atualizado_em = datetime.utcnow()
    # Dados pessoais não vão para o histórico, só o nome dos campos alterados
    _registrar(db, "cliente", cliente.id, "alterado", "Campos alterados: " + ", ".join(
        CAMPOS_CLIENTE_ROTULOS.get(c, c) for c in alterados), usuario)
    db.commit()
    db.refresh(cliente)
    return cliente


# ─── Negociações ────────────────────────────────────────────────────────────

class DadosNegociacao(BaseModel):
    cliente_id: Optional[int] = None
    banco: Optional[str] = None
    contrato: Optional[str] = None
    modalidade: Optional[str] = None
    segmento: Optional[str] = None
    etapa: Optional[str] = None
    responsavel: Optional[str] = None
    valor_divida: Optional[float] = None
    valor_alvo: Optional[float] = None
    ultima_proposta_valor: Optional[float] = None
    ultima_proposta_condicoes: Optional[str] = None
    ultima_proposta_data: Optional[date] = None
    data_notificacao: Optional[date] = None
    protocolo_notificacao: Optional[str] = None
    prazo_resposta: Optional[date] = None
    proxima_acao: Optional[str] = None
    data_proxima_acao: Optional[date] = None
    percentual_exito: Optional[float] = None
    valor_acordo: Optional[float] = None
    data_acordo: Optional[date] = None
    motivo_encerramento: Optional[str] = None


class RespostaNegociacao(DadosNegociacao):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cliente_id: int
    cliente_nome: Optional[str] = None
    cliente_cpf_cnpj: Optional[str] = None
    total_tentativas: int = 0
    ultimo_contato: Optional[date] = None
    criado_por: Optional[str]
    criado_em: Optional[datetime]
    atualizado_por: Optional[str]
    atualizado_em: Optional[datetime]


class DadosTentativa(BaseModel):
    data_contato: date
    canal: str
    tipo: Optional[str] = None
    interlocutor: Optional[str] = None
    protocolo: Optional[str] = None
    resumo: str
    proposta_valor: Optional[float] = None
    proposta_condicoes: Optional[str] = None
    link_anexo: Optional[str] = None
    # Opcional: já atualiza a negociação no mesmo lançamento
    nova_etapa: Optional[str] = None
    proxima_acao: Optional[str] = None
    data_proxima_acao: Optional[date] = None


class RespostaTentativa(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    negociacao_id: int
    data_contato: date
    canal: str
    tipo: Optional[str]
    interlocutor: Optional[str]
    protocolo: Optional[str]
    resumo: str
    proposta_valor: Optional[float]
    proposta_condicoes: Optional[str]
    link_anexo: Optional[str]
    lancado_por: str
    lancado_em: datetime


class RespostaHistorico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    acao: str
    descricao: Optional[str]
    usuario: str
    data: datetime


def _resposta_negociacao(db, n: Negociacao) -> RespostaNegociacao:
    r = RespostaNegociacao.model_validate(n)
    cliente = db.get(Cliente, n.cliente_id)
    if cliente:
        r.cliente_nome = cliente.nome
        r.cliente_cpf_cnpj = cliente.cpf_cnpj
    tentativas = db.query(Tentativa.data_contato).filter(Tentativa.negociacao_id == n.id).all()
    r.total_tentativas = len(tentativas)
    r.ultimo_contato = max((t[0] for t in tentativas), default=None)
    return r


def _validar_negociacao(db, n: Negociacao):
    if not db.get(Cliente, n.cliente_id):
        raise HTTPException(422, "Cliente não encontrado.")
    if not (n.banco or "").strip():
        raise HTTPException(422, "Informe o banco.")
    if n.etapa not in ETAPAS:
        raise HTTPException(422, "Etapa inválida.")
    if n.segmento not in ("PF", "PJ", "Rural"):
        n.segmento = "PF"
    # Regra de ouro: nenhuma negociação ativa sem próxima ação com data
    if n.etapa not in ETAPAS_ENCERRADAS and (not (n.proxima_acao or "").strip() or not n.data_proxima_acao):
        raise HTTPException(422, "Toda negociação em andamento precisa de próxima ação e data.")
    if n.etapa in ETAPAS_COM_ACORDO and (not n.valor_acordo or not n.data_acordo):
        raise HTTPException(422, "Para acordo fechado, informe o valor e a data do acordo.")
    if n.etapa in ETAPAS_SEM_ACORDO and not (n.motivo_encerramento or "").strip():
        raise HTTPException(422, "Informe o motivo do encerramento.")


ROTULOS = {
    "cliente_id": "Cliente", "banco": "Banco", "contrato": "Contrato", "modalidade": "Modalidade",
    "segmento": "Segmento", "etapa": "Etapa", "responsavel": "Responsável",
    "valor_divida": "Valor cobrado", "valor_alvo": "Valor-alvo",
    "ultima_proposta_valor": "Última proposta", "ultima_proposta_condicoes": "Condições da proposta",
    "ultima_proposta_data": "Data da proposta", "data_notificacao": "Data da notificação",
    "protocolo_notificacao": "Protocolo da notificação", "prazo_resposta": "Prazo de resposta",
    "proxima_acao": "Próxima ação", "data_proxima_acao": "Data da próxima ação",
    "percentual_exito": "% de êxito", "valor_acordo": "Valor do acordo", "data_acordo": "Data do acordo",
    "motivo_encerramento": "Motivo do encerramento",
}


def _fmt(valor):
    if valor is None or valor == "":
        return "—"
    if isinstance(valor, float):
        return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if isinstance(valor, date):
        return valor.strftime("%d/%m/%Y")
    return str(valor)


@router.get("/negociacoes", response_model=List[RespostaNegociacao])
def listar_negociacoes(
    busca: Optional[str] = Query(None),
    etapa: Optional[str] = Query(None),
    responsavel: Optional[str] = Query(None),
    banco: Optional[str] = Query(None),
    cliente_id: Optional[int] = Query(None),
    situacao: Optional[str] = Query("ativas"),  # ativas | atrasadas | hoje | encerradas | todas
    db: Session = Depends(get_db),
):
    q = db.query(Negociacao).join(Cliente, Cliente.id == Negociacao.cliente_id)
    hoje = date.today()
    if situacao == "ativas":
        q = q.filter(Negociacao.etapa.notin_(ETAPAS_ENCERRADAS))
    elif situacao == "atrasadas":
        q = q.filter(Negociacao.etapa.notin_(ETAPAS_ENCERRADAS), Negociacao.data_proxima_acao < hoje)
    elif situacao == "hoje":
        q = q.filter(Negociacao.etapa.notin_(ETAPAS_ENCERRADAS), Negociacao.data_proxima_acao <= hoje)
    elif situacao == "encerradas":
        q = q.filter(Negociacao.etapa.in_(ETAPAS_ENCERRADAS))
    if etapa:
        q = q.filter(Negociacao.etapa == etapa)
    if responsavel:
        q = q.filter(Negociacao.responsavel == responsavel)
    if banco:
        q = q.filter(Negociacao.banco.ilike(f"%{banco}%"))
    if cliente_id:
        q = q.filter(Negociacao.cliente_id == cliente_id)
    if busca:
        termo = f"%{busca}%"
        filtros = [Cliente.nome.ilike(termo), Negociacao.banco.ilike(termo), Negociacao.contrato.ilike(termo)]
        if _digitos(busca):
            filtros.append(Cliente.cpf_cnpj.like(f"%{_digitos(busca)}%"))
        q = q.filter(or_(*filtros))
    negociacoes = q.order_by(Negociacao.data_proxima_acao.asc(), Negociacao.id.asc()).all()
    return [_resposta_negociacao(db, n) for n in negociacoes]


@router.get("/negociacoes/dashboard")
def dashboard_negociacoes(responsavel: Optional[str] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Negociacao)
    if responsavel:
        q = q.filter(Negociacao.responsavel == responsavel)
    todas = q.all()
    hoje = date.today()

    ativas = [n for n in todas if n.etapa not in ETAPAS_ENCERRADAS]
    acordos = [n for n in todas if n.etapa in ETAPAS_COM_ACORDO]
    perdidas = [n for n in todas if n.etapa in ETAPAS_SEM_ACORDO]
    atrasadas = [n for n in ativas if n.data_proxima_acao and n.data_proxima_acao < hoje]
    para_hoje = [n for n in ativas if n.data_proxima_acao == hoje]

    def economia(n, referencia):
        if not n.valor_divida or referencia is None:
            return 0.0
        return max(n.valor_divida - referencia, 0.0)

    def honorario(n, referencia):
        return economia(n, referencia) * (n.percentual_exito or 0) / 100

    descontos = [economia(n, n.valor_acordo) / n.valor_divida for n in acordos if n.valor_divida and n.valor_acordo]
    dias_ate_acordo = [(n.data_acordo - n.criado_em.date()).days for n in acordos if n.data_acordo and n.criado_em]
    decididas = len(acordos) + len(perdidas)

    por_etapa = {e: 0 for e in ETAPAS}
    for n in todas:
        por_etapa[n.etapa] = por_etapa.get(n.etapa, 0) + 1

    por_responsavel = {}
    for n in ativas:
        nome = n.responsavel or "Sem responsável"
        item = por_responsavel.setdefault(nome, {"responsavel": nome, "ativas": 0, "atrasadas": 0, "hoje": 0})
        item["ativas"] += 1
        if n.data_proxima_acao and n.data_proxima_acao < hoje:
            item["atrasadas"] += 1
        elif n.data_proxima_acao == hoje:
            item["hoje"] += 1

    return {
        "ativas": len(ativas),
        "atrasadas": len(atrasadas),
        "para_hoje": len(para_hoje),
        "acordos_fechados": len(acordos),
        "sem_acordo": len(perdidas),
        "taxa_acordo": (len(acordos) / decididas) if decididas else None,
        "desconto_medio": (sum(descontos) / len(descontos)) if descontos else None,
        "dias_medios_ate_acordo": (sum(dias_ate_acordo) / len(dias_ate_acordo)) if dias_ate_acordo else None,
        "divida_em_negociacao": sum(n.valor_divida or 0 for n in ativas),
        "economia_obtida": sum(economia(n, n.valor_acordo) for n in acordos),
        # Potencial: % de êxito sobre a economia da última proposta do banco (ou do valor-alvo)
        "honorarios_potenciais": sum(
            honorario(n, n.ultima_proposta_valor if n.ultima_proposta_valor is not None else n.valor_alvo)
            for n in ativas if n.etapa not in ETAPAS_COM_ACORDO
        ),
        "honorarios_gerados": sum(honorario(n, n.valor_acordo) for n in acordos),
        "por_etapa": por_etapa,
        "por_responsavel": sorted(por_responsavel.values(), key=lambda i: -i["atrasadas"]),
    }


@router.get("/negociacoes/{negociacao_id}", response_model=RespostaNegociacao)
def detalhe_negociacao(negociacao_id: int, db: Session = Depends(get_db)):
    n = db.get(Negociacao, negociacao_id)
    if not n:
        raise HTTPException(404, "Negociação não encontrada.")
    return _resposta_negociacao(db, n)


@router.post("/negociacoes", response_model=RespostaNegociacao, status_code=201)
def criar_negociacao(dados: DadosNegociacao, request: Request, db: Session = Depends(get_db)):
    usuario = _usuario(request)
    valores = dados.model_dump()
    valores["etapa"] = valores.get("etapa") or "diagnostico"
    valores["responsavel"] = valores.get("responsavel") or usuario
    n = Negociacao(**valores, criado_por=usuario, atualizado_por=usuario)
    _validar_negociacao(db, n)
    db.add(n)
    db.flush()
    _registrar(db, "negociacao", n.id, "criada", f"Negociação aberta com {n.banco}", usuario)
    db.commit()
    db.refresh(n)
    return _resposta_negociacao(db, n)


def _aplicar_alteracoes(db, n: Negociacao, alteracoes: dict, usuario: str):
    descricoes = []
    for campo, valor in alteracoes.items():
        antigo = getattr(n, campo)
        if antigo != valor:
            setattr(n, campo, valor)
            if campo == "etapa":
                antigo, valor = ETAPA_ROTULOS.get(antigo, antigo), ETAPA_ROTULOS.get(valor, valor)
            descricoes.append(f"{ROTULOS.get(campo, campo)}: {_fmt(antigo)} → {_fmt(valor)}")
    if descricoes:
        _validar_negociacao(db, n)
        n.atualizado_por = usuario
        n.atualizado_em = datetime.utcnow()
        _registrar(db, "negociacao", n.id, "alterada", "; ".join(descricoes), usuario)
    return descricoes


@router.patch("/negociacoes/{negociacao_id}", response_model=RespostaNegociacao)
def atualizar_negociacao(negociacao_id: int, dados: DadosNegociacao, request: Request, db: Session = Depends(get_db)):
    n = db.get(Negociacao, negociacao_id)
    if not n:
        raise HTTPException(404, "Negociação não encontrada.")
    _aplicar_alteracoes(db, n, dados.model_dump(exclude_unset=True), _usuario(request))
    db.commit()
    db.refresh(n)
    return _resposta_negociacao(db, n)


@router.get("/negociacoes/{negociacao_id}/tentativas", response_model=List[RespostaTentativa])
def listar_tentativas(negociacao_id: int, db: Session = Depends(get_db)):
    return db.query(Tentativa).filter(Tentativa.negociacao_id == negociacao_id).order_by(
        Tentativa.data_contato.desc(), Tentativa.lancado_em.desc()
    ).all()


@router.post("/negociacoes/{negociacao_id}/tentativas", response_model=RespostaTentativa, status_code=201)
def registrar_tentativa(negociacao_id: int, dados: DadosTentativa, request: Request, db: Session = Depends(get_db)):
    n = db.get(Negociacao, negociacao_id)
    if not n:
        raise HTTPException(404, "Negociação não encontrada.")
    if not dados.resumo.strip() or not dados.canal.strip():
        raise HTTPException(422, "Informe o canal e o resumo do contato.")
    usuario = _usuario(request)

    t = Tentativa(
        negociacao_id=n.id, data_contato=dados.data_contato, canal=dados.canal, tipo=dados.tipo,
        interlocutor=dados.interlocutor, protocolo=dados.protocolo, resumo=dados.resumo.strip(),
        proposta_valor=dados.proposta_valor, proposta_condicoes=dados.proposta_condicoes,
        link_anexo=dados.link_anexo, lancado_por=usuario,
    )
    db.add(t)

    alteracoes = {}
    # A proposta mais recente (pela data do contato) vira a "última proposta" da negociação
    if dados.proposta_valor is not None and (
        not n.ultima_proposta_data or dados.data_contato >= n.ultima_proposta_data
    ):
        alteracoes.update(
            ultima_proposta_valor=dados.proposta_valor,
            ultima_proposta_condicoes=dados.proposta_condicoes,
            ultima_proposta_data=dados.data_contato,
        )
    if dados.nova_etapa:
        alteracoes["etapa"] = dados.nova_etapa
    if dados.proxima_acao:
        alteracoes["proxima_acao"] = dados.proxima_acao
    if dados.data_proxima_acao:
        alteracoes["data_proxima_acao"] = dados.data_proxima_acao
    _aplicar_alteracoes(db, n, alteracoes, usuario)

    db.commit()
    db.refresh(t)
    return t


@router.get("/negociacoes/{negociacao_id}/historico", response_model=List[RespostaHistorico])
def historico_negociacao(negociacao_id: int, db: Session = Depends(get_db)):
    return db.query(Historico).filter(
        Historico.entidade == "negociacao", Historico.entidade_id == negociacao_id
    ).order_by(Historico.data.desc()).all()


@router.get("/clientes/{cliente_id}/historico", response_model=List[RespostaHistorico])
def historico_cliente(cliente_id: int, db: Session = Depends(get_db)):
    return db.query(Historico).filter(
        Historico.entidade == "cliente", Historico.entidade_id == cliente_id
    ).order_by(Historico.data.desc()).all()
