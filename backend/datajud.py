import httpx
import os
import json
import asyncio
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("DATAJUD_API_KEY")
BASE_URL = "https://api-publica.datajud.cnj.jus.br"

# Todos os tribunais disponíveis no DataJud
TRIBUNAIS = [
    "tjac", "tjal", "tjap", "tjam", "tjba", "tjce", "tjdft", "tjes",
    "tjgo", "tjma", "tjmt", "tjms", "tjmg", "tjpa", "tjpb", "tjpr",
    "tjpe", "tjpi", "tjrj", "tjrn", "tjrs", "tjro", "tjrr", "tjsc",
    "tjsp", "tjse", "tjto",
    "trf1", "trf2", "trf3", "trf4", "trf5", "trf6",
    "trt1", "trt2", "trt3", "trt4", "trt5", "trt6", "trt7", "trt8",
    "trt9", "trt10", "trt11", "trt12", "trt13", "trt14", "trt15",
    "trt16", "trt17", "trt18", "trt19", "trt20", "trt21", "trt22",
    "trt23", "trt24",
    "stj", "tst",
]

NOMES_TRIBUNAIS = {
    "tjac": "TJAC - Tribunal de Justiça do Acre",
    "tjal": "TJAL - Tribunal de Justiça de Alagoas",
    "tjap": "TJAP - Tribunal de Justiça do Amapá",
    "tjam": "TJAM - Tribunal de Justiça do Amazonas",
    "tjba": "TJBA - Tribunal de Justiça da Bahia",
    "tjce": "TJCE - Tribunal de Justiça do Ceará",
    "tjdft": "TJDFT - Tribunal de Justiça do Distrito Federal",
    "tjes": "TJES - Tribunal de Justiça do Espírito Santo",
    "tjgo": "TJGO - Tribunal de Justiça de Goiás",
    "tjma": "TJMA - Tribunal de Justiça do Maranhão",
    "tjmt": "TJMT - Tribunal de Justiça do Mato Grosso",
    "tjms": "TJMS - Tribunal de Justiça do Mato Grosso do Sul",
    "tjmg": "TJMG - Tribunal de Justiça de Minas Gerais",
    "tjpa": "TJPA - Tribunal de Justiça do Pará",
    "tjpb": "TJPB - Tribunal de Justiça da Paraíba",
    "tjpr": "TJPR - Tribunal de Justiça do Paraná",
    "tjpe": "TJPE - Tribunal de Justiça de Pernambuco",
    "tjpi": "TJPI - Tribunal de Justiça do Piauí",
    "tjrj": "TJRJ - Tribunal de Justiça do Rio de Janeiro",
    "tjrn": "TJRN - Tribunal de Justiça do Rio Grande do Norte",
    "tjrs": "TJRS - Tribunal de Justiça do Rio Grande do Sul",
    "tjro": "TJRO - Tribunal de Justiça de Rondônia",
    "tjrr": "TJRR - Tribunal de Justiça de Roraima",
    "tjsc": "TJSC - Tribunal de Justiça de Santa Catarina",
    "tjsp": "TJSP - Tribunal de Justiça de São Paulo",
    "tjse": "TJSE - Tribunal de Justiça de Sergipe",
    "tjto": "TJTO - Tribunal de Justiça do Tocantins",
    "trf1": "TRF1 - Tribunal Regional Federal da 1ª Região",
    "trf2": "TRF2 - Tribunal Regional Federal da 2ª Região",
    "trf3": "TRF3 - Tribunal Regional Federal da 3ª Região",
    "trf4": "TRF4 - Tribunal Regional Federal da 4ª Região",
    "trf5": "TRF5 - Tribunal Regional Federal da 5ª Região",
    "trf6": "TRF6 - Tribunal Regional Federal da 6ª Região",
    "tst": "TST - Tribunal Superior do Trabalho",
    "stj": "STJ - Superior Tribunal de Justiça",
}
for i in range(1, 25):
    NOMES_TRIBUNAIS[f"trt{i}"] = f"TRT{i} - Tribunal Regional do Trabalho da {i}ª Região"


def _build_query_oab(numero_oab: str, sigla_estado: str, page: int = 0, size: int = 100) -> dict:
    return {
        "query": {
            "bool": {
                "must": [
                    {
                        "nested": {
                            "path": "partes",
                            "query": {
                                "nested": {
                                    "path": "partes.advogados",
                                    "query": {
                                        "bool": {
                                            "must": [
                                                {"match": {"partes.advogados.numeroOAB": numero_oab}},
                                                {"match": {"partes.advogados.ufOAB": sigla_estado.upper()}}
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                ]
            }
        },
        "sort": [{"@timestamp": {"order": "desc"}}],
        "size": size,
        "from": page * size,
    }


def _parse_processo(hit: dict, tribunal_sigla: str) -> dict:
    src = hit.get("_source", {})

    partes_ativo = []
    partes_passivo = []
    partes_texto = []

    for parte in src.get("partes", []):
        nome = parte.get("nome", "")
        polo = parte.get("polo", "").lower()
        partes_texto.append(f"{nome} ({polo.upper()})")
        if polo in ("ativo", "requerente", "autor", "reclamante", "impetrante", "exequente"):
            partes_ativo.append(nome)
        elif polo in ("passivo", "requerido", "reu", "réu", "reclamado", "impetrado", "executado"):
            partes_passivo.append(nome)

    movimentos = src.get("movimentos", [])
    ultimo_mov = ""
    data_ultimo_mov = ""
    if movimentos:
        mov = movimentos[0]
        ultimo_mov = mov.get("nome", "")
        data_ultimo_mov = mov.get("dataHora", "")

    valor_causa = src.get("valor", None)
    if valor_causa:
        try:
            valor_causa = float(valor_causa)
        except (ValueError, TypeError):
            valor_causa = None

    orgao = src.get("orgaoJulgador", {})
    vara = orgao.get("nome", "") if isinstance(orgao, dict) else ""

    assuntos = src.get("assuntos", [])
    assunto_str = "; ".join([a.get("nome", "") for a in assuntos if a.get("nome")]) if assuntos else ""

    classe = src.get("classeProcessual", {})
    classe_str = classe.get("nome", "") if isinstance(classe, dict) else ""

    return {
        "numero": src.get("numeroProcesso", hit.get("_id", "")),
        "tribunal": NOMES_TRIBUNAIS.get(tribunal_sigla, tribunal_sigla.upper()),
        "vara": vara,
        "classe": classe_str,
        "assunto": assunto_str,
        "data_distribuicao": src.get("dataAjuizamento", ""),
        "valor_causa": valor_causa,
        "situacao": src.get("situacao", {}).get("nome", "") if isinstance(src.get("situacao"), dict) else "",
        "ultimo_movimento": ultimo_mov,
        "data_ultimo_movimento": data_ultimo_mov,
        "partes": json.dumps(partes_texto, ensure_ascii=False),
        "polo_ativo": "; ".join(partes_ativo),
        "polo_passivo": "; ".join(partes_passivo),
    }


async def buscar_processos_tribunal(
    client: httpx.AsyncClient,
    tribunal: str,
    numero_oab: str,
    sigla_estado: str,
) -> list[dict]:
    url = f"{BASE_URL}/api_publica-{tribunal}/_search"
    headers = {
        "Authorization": f"ApiKey {API_KEY}",
        "Content-Type": "application/json",
    }

    processos = []
    page = 0

    while True:
        body = _build_query_oab(numero_oab, sigla_estado, page=page)
        try:
            response = await client.post(url, headers=headers, json=body, timeout=30.0)
            if response.status_code == 200:
                data = response.json()
                hits = data.get("hits", {}).get("hits", [])
                if not hits:
                    break
                for hit in hits:
                    parsed = _parse_processo(hit, tribunal)
                    processos.append(parsed)
                total = data.get("hits", {}).get("total", {}).get("value", 0)
                if (page + 1) * 100 >= total:
                    break
                page += 1
            else:
                break
        except Exception:
            break

    return processos


async def buscar_todos_processos() -> tuple[list[dict], list[str]]:
    """Busca processos em todos os tribunais para OAB/RR 617 e OAB/AM 1404A."""
    oab_rr = os.getenv("OAB_RR", "617")
    oab_am = os.getenv("OAB_AM", "1404A")

    # Normalizar OAB AM (remover letra final para busca)
    oab_am_numero = "".join(filter(str.isdigit, oab_am))

    todos_processos = []
    erros = []

    async with httpx.AsyncClient() as client:
        tarefas_rr = [
            buscar_processos_tribunal(client, t, oab_rr, "RR")
            for t in TRIBUNAIS
        ]
        tarefas_am = [
            buscar_processos_tribunal(client, t, oab_am_numero, "AM")
            for t in TRIBUNAIS
        ]

        resultados_rr = await asyncio.gather(*tarefas_rr, return_exceptions=True)
        resultados_am = await asyncio.gather(*tarefas_am, return_exceptions=True)

        numeros_vistos = set()

        for i, resultado in enumerate(resultados_rr):
            if isinstance(resultado, Exception):
                erros.append(f"{TRIBUNAIS[i]}/RR: {str(resultado)}")
            else:
                for p in resultado:
                    if p["numero"] not in numeros_vistos:
                        p["fonte_oab"] = f"OAB/RR {oab_rr}"
                        todos_processos.append(p)
                        numeros_vistos.add(p["numero"])

        for i, resultado in enumerate(resultados_am):
            if isinstance(resultado, Exception):
                erros.append(f"{TRIBUNAIS[i]}/AM: {str(resultado)}")
            else:
                for p in resultado:
                    if p["numero"] not in numeros_vistos:
                        p["fonte_oab"] = f"OAB/AM {oab_am}"
                        todos_processos.append(p)
                        numeros_vistos.add(p["numero"])

    return todos_processos, erros
