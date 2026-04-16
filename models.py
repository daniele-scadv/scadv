from sqlalchemy import create_engine, Column, String, Text, DateTime, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./juridico.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
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
    partes = Column(Text, nullable=True)  # JSON string
    polo_ativo = Column(Text, nullable=True)
    polo_passivo = Column(Text, nullable=True)
    o_que_fazer = Column(Text, nullable=True)
    prioridade = Column(String, default="normal")  # urgente, alta, normal, baixa
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    criado_em = Column(DateTime, default=datetime.utcnow)
    oculto = Column(Boolean, default=False)
    fonte_oab = Column(String, nullable=True)  # qual OAB trouxe esse processo


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
