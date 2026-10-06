from sqlalchemy import create_engine, Column, String, Text, DateTime, Float, Boolean, Integer, Date, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()


def _normalizar_url(url: str) -> str:
    # Railway/Heroku entregam "postgres://" ou "postgresql://"; o SQLAlchemy precisa do driver explícito
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DATABASE_URL = _normalizar_url(os.getenv("DATABASE_URL", "sqlite:///./juridico.db"))

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Processo(Base):
    __tablename__ = "processos"

    numero = Column(String, primary_key=True, index=True)
    tribunal = Column(String, nullable=True)
    vara = Column(String, nullable=True)
    classe = Column(String, nullable=True)
    assunto = Column(String, nullable=True)
    data_distribuicao = Column(String, nullable=True)
    valor_causa = Column(Float, nullable=True)
    situacao = Column(String, nullable=True)
    ultimo_movimento = Column(Text, nullable=True)
    data_ultimo_movimento = Column(String, nullable=True)
    partes = Column(Text, nullable=True)
    polo_ativo = Column(Text, nullable=True)
    polo_passivo = Column(Text, nullable=True)
    o_que_fazer = Column(Text, nullable=True)
    prioridade = Column(String, default="normal")
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    criado_em = Column(DateTime, default=datetime.utcnow)
    oculto = Column(Boolean, default=False)
    fonte_oab = Column(String, nullable=True)


class Cliente(Base):
    """Qualificação completa do cliente — os dados que o banco sempre pede."""
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String, default="PF")  # PF | PJ
    nome = Column(String, nullable=False, index=True)  # nome completo ou razão social
    cpf_cnpj = Column(String, unique=True, index=True, nullable=False)  # só dígitos
    rg = Column(String, nullable=True)
    rg_orgao_emissor = Column(String, nullable=True)
    data_nascimento = Column(Date, nullable=True)
    nome_pai = Column(String, nullable=True)
    nome_mae = Column(String, nullable=True)
    estado_civil = Column(String, nullable=True)
    profissao = Column(String, nullable=True)
    telefone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    cep = Column(String, nullable=True)
    logradouro = Column(String, nullable=True)
    numero = Column(String, nullable=True)
    complemento = Column(String, nullable=True)
    bairro = Column(String, nullable=True)
    cidade = Column(String, nullable=True)
    uf = Column(String, nullable=True)
    representante_legal = Column(String, nullable=True)  # PJ
    representante_cpf = Column(String, nullable=True)  # PJ
    observacoes = Column(Text, nullable=True)
    criado_por = Column(String, nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_por = Column(String, nullable=True)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Negociacao(Base):
    """Uma negociação = 1 cliente × 1 banco × 1 contrato."""
    __tablename__ = "negociacoes"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False, index=True)
    banco = Column(String, nullable=False, index=True)
    contrato = Column(String, nullable=True)
    modalidade = Column(String, nullable=True)  # cartão, CCB, capital de giro, crédito rural...
    segmento = Column(String, default="PF")  # PF | PJ | Rural
    etapa = Column(String, default="diagnostico", index=True)
    responsavel = Column(String, nullable=True, index=True)
    valor_divida = Column(Float, nullable=True)  # valor cobrado pelo banco
    valor_alvo = Column(Float, nullable=True)
    ultima_proposta_valor = Column(Float, nullable=True)
    ultima_proposta_condicoes = Column(Text, nullable=True)
    ultima_proposta_data = Column(Date, nullable=True)
    data_notificacao = Column(Date, nullable=True)
    protocolo_notificacao = Column(String, nullable=True)
    prazo_resposta = Column(Date, nullable=True)
    proxima_acao = Column(String, nullable=True)
    data_proxima_acao = Column(Date, nullable=True, index=True)
    percentual_exito = Column(Float, nullable=True)  # % sobre a economia obtida
    valor_acordo = Column(Float, nullable=True)
    data_acordo = Column(Date, nullable=True)
    motivo_encerramento = Column(Text, nullable=True)
    criado_por = Column(String, nullable=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_por = Column(String, nullable=True)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Tentativa(Base):
    """Registro de cada contato/tentativa de acordo. Não pode ser editado depois de lançado."""
    __tablename__ = "tentativas"

    id = Column(Integer, primary_key=True, index=True)
    negociacao_id = Column(Integer, ForeignKey("negociacoes.id"), nullable=False, index=True)
    data_contato = Column(Date, nullable=False)
    canal = Column(String, nullable=False)  # telefone, email, whatsapp, notificação, ouvidoria...
    tipo = Column(String, nullable=True)  # notificação, follow-up, proposta recebida, contraproposta...
    interlocutor = Column(String, nullable=True)  # nome e setor de quem atendeu no banco
    protocolo = Column(String, nullable=True)
    resumo = Column(Text, nullable=False)
    proposta_valor = Column(Float, nullable=True)
    proposta_condicoes = Column(Text, nullable=True)
    link_anexo = Column(String, nullable=True)  # print/e-mail no Drive
    lancado_por = Column(String, nullable=False)
    lancado_em = Column(DateTime, default=datetime.utcnow, nullable=False)


class Historico(Base):
    """Trilha de auditoria: quem criou/alterou o quê e quando."""
    __tablename__ = "historico"

    id = Column(Integer, primary_key=True, index=True)
    entidade = Column(String, nullable=False, index=True)  # cliente | negociacao
    entidade_id = Column(Integer, nullable=False, index=True)
    acao = Column(String, nullable=False)
    descricao = Column(Text, nullable=True)
    usuario = Column(String, nullable=False)
    data = Column(DateTime, default=datetime.utcnow, nullable=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
