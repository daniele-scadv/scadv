"""Importação de clientes a partir das planilhas de contratos fechados (.xlsx).

Fluxo em duas etapas: /previa mostra o que vai acontecer sem gravar nada;
/confirmar grava. Reimportar a mesma planilha não duplica: clientes são casados
por CPF/CNPJ, depois por nome normalizado e, por fim, por nome muito parecido.
Cada cliente importado recebe uma negociação "a definir" para a equipe levantar
bancos, contratos e valores; quem já tem negociação em andamento não ganha outra.
"""
import io
import json
from datetime import date, datetime
from difflib import SequenceMatcher
from typing import Optional

import openpyxl
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from cofre import responsaveis_acordos
from models import Cliente, Historico, Negociacao, get_db
from negociacoes import ETAPAS_ENCERRADAS, _cpf_valido, _cnpj_valido, _digitos, normalizar_nome

router = APIRouter(prefix="/api/importacao")

SIMILARIDADE_MINIMA = 0.9

# Cabeçalho normalizado (sem acento, minúsculo) → campo
COLUNAS = {
    "cliente": "nome", "nome": "nome", "nome completo": "nome",
    "cpf": "cpf_cnpj", "cnpj": "cpf_cnpj", "cpf/cnpj": "cpf_cnpj",
    "nicho": "nicho",
    "data": "data", "data que fechou": "data",
    "%": "percentual",
    "e-mail": "email", "email": "email",
    "telefone": "telefone", "celular": "telefone", "whatsapp": "telefone",
    "rg": "rg", "data de nascimento": "data_nascimento", "nascimento": "data_nascimento",
    "nome da mae": "nome_mae", "mae": "nome_mae", "nome do pai": "nome_pai", "pai": "nome_pai",
    "endereco": "logradouro", "logradouro": "logradouro", "numero": "numero", "complemento": "complemento",
    "cep": "cep", "cidade": "cidade", "uf": "uf", "bairro": "bairro",
    "orgao emissor": "rg_orgao_emissor", "estado civil": "estado_civil", "profissao": "profissao",
    "tipo": "tipo", "representante legal": "representante_legal", "cpf do representante": "representante_cpf",
    "banco": "banco", "contrato": "contrato", "modalidade": "modalidade",
    "valor cobrado": "valor_divida", "valor da divida": "valor_divida",
}
CAMPOS_ENRIQUECIVEIS = ["email", "telefone", "rg", "rg_orgao_emissor", "data_nascimento", "estado_civil",
                        "profissao", "nome_mae", "nome_pai", "logradouro", "numero", "complemento", "cep",
                        "bairro", "cidade", "uf", "representante_legal", "representante_cpf"]


def _texto(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return " ".join(str(v).split())


def _data(v):
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    for formato in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(_texto(v), formato).date()
        except ValueError:
            pass
    return None


def ler_planilha(conteudo: bytes):
    """Devolve as linhas de clientes de todas as abas, com aba e linha de origem."""
    try:
        wb = openpyxl.load_workbook(io.BytesIO(conteudo), data_only=True, read_only=True)
    except Exception:
        raise HTTPException(422, "Arquivo inválido: envie a planilha em formato .xlsx.")
    linhas = []
    for ws in wb.worksheets:
        mapa = None
        for n, valores in enumerate(ws.iter_rows(values_only=True), 1):
            if mapa is None:
                cabecalho = [normalizar_nome(_texto(v)) for v in valores]
                if "cliente" in cabecalho or "nome" in cabecalho or "nome completo" in cabecalho:
                    mapa = {}
                    for i, c in enumerate(cabecalho):
                        campo = COLUNAS.get(c)
                        # "data que fechou" prevalece sobre "data que entrou"
                        if campo and (campo not in mapa or c == "data que fechou"):
                            mapa[campo] = i
                continue
            dados = {campo: valores[i] for campo, i in mapa.items() if i < len(valores)}
            nome = _texto(dados.get("nome"))
            if not nome or normalizar_nome(nome).startswith("total"):
                continue
            linhas.append({"aba": ws.title, "linha": n, **dados, "nome": nome})
    return linhas


def _parecido(a, b):
    return SequenceMatcher(None, a, b).ratio()


def planejar(db, conteudo, nichos_excluidos):
    excluidos = {normalizar_nome(n) for n in nichos_excluidos}
    existentes = db.query(Cliente).all()
    por_cpf = {c.cpf_cnpj: c for c in existentes if c.cpf_cnpj}
    por_nome = {normalizar_nome(c.nome): c for c in existentes}
    novos = {}  # nome normalizado → plano do cliente novo
    itens = []

    for l in ler_planilha(conteudo):
        nicho = _texto(l.get("nicho"))
        item = {"aba": l["aba"], "linha": l["linha"], "nome": l["nome"], "nicho": nicho or "—", "avisos": []}
        itens.append(item)
        if nicho and normalizar_nome(nicho) in excluidos:
            item["situacao"] = "excluido"
            continue

        nome_norm = normalizar_nome(l["nome"])
        cpf = _digitos(_texto(l.get("cpf_cnpj")))
        if cpf and not (_cpf_valido(cpf) or _cnpj_valido(cpf)):
            item["avisos"].append(f"CPF/CNPJ inválido na planilha ({_texto(l.get('cpf_cnpj'))}), ignorado")
            cpf = ""

        alvo = por_cpf.get(cpf) if cpf else None
        alvo = alvo or por_nome.get(nome_norm)
        if not alvo and nome_norm in novos:
            alvo = novos[nome_norm]
        if not alvo and len(nome_norm.split()) >= 2:
            candidatos = [(c.nome, c) for c in existentes] + [(p["nome"], p) for p in novos.values()]
            melhor = max(candidatos, key=lambda c: _parecido(normalizar_nome(c[0]), nome_norm), default=None)
            if melhor and _parecido(normalizar_nome(melhor[0]), nome_norm) >= SIMILARIDADE_MINIMA:
                alvo = melhor[1]
                item["avisos"].append(f"Nome parecido com \"{melhor[0]}\": tratado como o mesmo cliente")

        if len(nome_norm.split()) < 2:
            item["avisos"].append("Nome incompleto: complete o nome no cadastro")
        if " e " in f" {nome_norm} " or "/" in nome_norm:
            item["avisos"].append("Mais de uma pessoa na mesma linha: separe os cadastros se forem devedores distintos")
        if not cpf:
            item["avisos"].append("Sem CPF: cadastro fica incompleto")

        if isinstance(alvo, Cliente):
            item["situacao"] = "ja_cadastrado"
            item["cliente_existente"] = alvo.nome
            item["_cliente"] = alvo
            item["_linha"] = l
            if cpf and not alvo.cpf_cnpj:
                item["_cpf"] = cpf
        elif alvo:  # outra linha desta mesma planilha
            item["situacao"] = "mesmo_cliente_de_outra_linha"
            item["cliente_existente"] = alvo["nome"]
            alvo["linhas"].append(l)
        else:
            item["situacao"] = "novo"
            novos[nome_norm] = {"nome": l["nome"], "linhas": [l], "cpf": cpf}
    return itens, list(novos.values())


def _resumo(itens):
    contagem = {}
    for i in itens:
        contagem[i["situacao"]] = contagem.get(i["situacao"], 0) + 1
    return contagem


def _limpar(itens):
    return [{k: v for k, v in i.items() if not k.startswith("_")} for i in itens]


def _exigir_acesso(request: Request):
    if getattr(request.state, "usuario", None) not in responsaveis_acordos():
        raise HTTPException(403, "Importação restrita aos responsáveis pelos acordos.")


def _nichos(texto):
    try:
        lista = json.loads(texto) if texto else ["GPX"]
    except ValueError:
        raise HTTPException(422, "Lista de nichos excluídos inválida.")
    return [str(n) for n in lista]


@router.post("/previa")
async def previa(request: Request, arquivo: UploadFile = File(...), nichos_excluidos: Optional[str] = Form(None),
                 db: Session = Depends(get_db)):
    _exigir_acesso(request)
    itens, _ = planejar(db, await arquivo.read(), _nichos(nichos_excluidos))
    nichos = sorted({i["nicho"] for i in itens})
    return {"resumo": _resumo(itens), "nichos": nichos, "itens": _limpar(itens)}


@router.post("/confirmar")
async def confirmar(request: Request, arquivo: UploadFile = File(...), nichos_excluidos: Optional[str] = Form(None),
                    db: Session = Depends(get_db)):
    _exigir_acesso(request)
    usuario = request.state.usuario
    origem = f"Importação: {arquivo.filename}"
    itens, novos = planejar(db, await arquivo.read(), _nichos(nichos_excluidos))
    hoje = date.today()

    def negociacao_inicial(cliente, linhas):
        criadas = 0
        com_banco = [l for l in linhas if _texto(l.get("banco"))]
        for l in com_banco:
            banco, contrato = _texto(l.get("banco")), _texto(l.get("contrato")) or None
            ja_existe = [
                n for n in db.query(Negociacao).filter(Negociacao.cliente_id == cliente.id).all()
                if normalizar_nome(n.banco) == normalizar_nome(banco) and (n.contrato or None) == contrato
            ]
            if ja_existe:
                continue
            # A negociação provisória "A definir" vira a do primeiro banco encontrado
            provisoria = db.query(Negociacao).filter(
                Negociacao.cliente_id == cliente.id, Negociacao.banco == "A definir"
            ).first()
            valor = l.get("valor_divida") if isinstance(l.get("valor_divida"), (int, float)) else None
            if provisoria:
                provisoria.banco, provisoria.contrato = banco, contrato
                provisoria.modalidade = _texto(l.get("modalidade")) or provisoria.modalidade
                provisoria.valor_divida = valor if valor is not None else provisoria.valor_divida
                provisoria.proxima_acao = "Conferir dívida e enviar notificação extrajudicial"
                provisoria.atualizado_por = usuario
                db.add(Historico(entidade="negociacao", entidade_id=provisoria.id, acao="alterada",
                                 descricao=f"Banco definido pela importação de {arquivo.filename}: {banco}", usuario=usuario))
                continue
            n = Negociacao(
                cliente_id=cliente.id, banco=banco, contrato=contrato, modalidade=_texto(l.get("modalidade")) or None,
                segmento="PJ" if cliente.tipo == "PJ" else "PF", etapa="diagnostico", responsavel=usuario,
                valor_divida=valor, proxima_acao="Conferir dívida e enviar notificação extrajudicial",
                data_proxima_acao=hoje, criado_por=usuario, atualizado_por=usuario,
            )
            db.add(n)
            db.flush()
            db.add(Historico(entidade="negociacao", entidade_id=n.id, acao="criada",
                             descricao=f"Criada pela importação de {arquivo.filename}", usuario=usuario))
            criadas += 1
        if com_banco:
            return criadas
        ativa = db.query(Negociacao).filter(
            Negociacao.cliente_id == cliente.id, Negociacao.etapa.notin_(ETAPAS_ENCERRADAS)
        ).first()
        if ativa:
            return 0
        nichos = list(dict.fromkeys(_texto(l.get("nicho")) for l in linhas if l.get("nicho")))
        percentual = next((l["percentual"] for l in linhas if isinstance(l.get("percentual"), (int, float))), None)
        if percentual is not None and percentual <= 1:
            percentual *= 100
        segmento = "PJ" if "GPPJ" in [n.upper() for n in nichos] else "Rural" if "GPPR" in [n.upper() for n in nichos] else "PF"
        n = Negociacao(
            cliente_id=cliente.id, banco="A definir", modalidade=" + ".join(nichos) or None, segmento=segmento,
            etapa="diagnostico", responsavel=usuario, percentual_exito=percentual,
            proxima_acao="Completar cadastro e levantar bancos, contratos e valores das dívidas",
            data_proxima_acao=hoje, criado_por=usuario, atualizado_por=usuario,
        )
        db.add(n)
        db.flush()
        db.add(Historico(entidade="negociacao", entidade_id=n.id, acao="criada",
                         descricao=f"Criada pela importação de {arquivo.filename}", usuario=usuario))
        return 1

    def observacao(linhas):
        partes = []
        for l in linhas:
            d = _data(l.get("data"))
            partes.append(f"{_texto(l.get('nicho')) or 'nicho não informado'}"
                          f"{' · fechado em ' + d.strftime('%d/%m/%Y') if d else ''} ({l['aba']}, linha {l['linha']})")
        return "Contratos na planilha: " + "; ".join(partes)

    criados = negociacoes = enriquecidos = 0
    for plano in novos:
        primeira = plano["linhas"][0]
        nichos = [_texto(l.get("nicho")).upper() for l in plano["linhas"]]
        cliente = Cliente(
            tipo="PJ" if _texto(primeira.get("tipo")).upper() == "PJ" or "GPPJ" in nichos
            or (plano["cpf"] and len(plano["cpf"]) == 14) else "PF",
            nome=plano["nome"], cpf_cnpj=plano["cpf"] or None, origem=origem,
            observacoes=observacao(plano["linhas"]), criado_por=usuario, atualizado_por=usuario,
        )
        for campo in CAMPOS_ENRIQUECIVEIS:
            valor = _data(primeira.get(campo)) if campo == "data_nascimento" else _texto(primeira.get(campo))
            if valor:
                setattr(cliente, campo, valor)
        db.add(cliente)
        db.flush()
        db.add(Historico(entidade="cliente", entidade_id=cliente.id, acao="criado",
                         descricao=f"Importado de {arquivo.filename}", usuario=usuario))
        criados += 1
        negociacoes += negociacao_inicial(cliente, plano["linhas"])

    # Clientes já cadastrados: só preenche campos vazios (nunca sobrescreve) e garante a negociação
    for item in itens:
        cliente = item.get("_cliente")
        if not cliente:
            continue
        linha = item["_linha"]
        preenchidos = []
        if item.get("_cpf") and not db.query(Cliente).filter(Cliente.cpf_cnpj == item["_cpf"]).first():
            cliente.cpf_cnpj = item["_cpf"]
            preenchidos.append("CPF/CNPJ")
        for campo in CAMPOS_ENRIQUECIVEIS:
            valor = _data(linha.get(campo)) if campo == "data_nascimento" else _texto(linha.get(campo))
            if valor and not getattr(cliente, campo):
                setattr(cliente, campo, valor)
                preenchidos.append(campo)
        if preenchidos:
            cliente.atualizado_por = usuario
            cliente.atualizado_em = datetime.utcnow()
            db.add(Historico(entidade="cliente", entidade_id=cliente.id, acao="completado",
                             descricao=f"Campos preenchidos pela importação de {arquivo.filename}: " + ", ".join(preenchidos),
                             usuario=usuario))
            enriquecidos += 1
        negociacoes += negociacao_inicial(cliente, [linha])

    db.commit()
    return {"clientes_criados": criados, "negociacoes_criadas": negociacoes, "clientes_completados": enriquecidos,
            "resumo": _resumo(itens), "itens": _limpar(itens)}
