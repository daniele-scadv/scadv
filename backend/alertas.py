"""Alerta por e-mail de novas movimentações processuais.

Envio por uma de duas vias, conforme as variáveis de ambiente:
- RESEND_API_KEY (+ ALERTA_REMETENTE): API HTTP do Resend — funciona em qualquer plano do Railway.
- SMTP_HOST, SMTP_PORT, SMTP_USUARIO, SMTP_SENHA: servidor SMTP (ex.: Google Workspace).
Destinatários em ALERTA_EMAILS, separados por vírgula. Sem configuração, o alerta é ignorado.
"""
import html
import os
import smtplib
import ssl
from datetime import datetime
from email.message import EmailMessage
from typing import List, Optional
from zoneinfo import ZoneInfo

import httpx


def _normalizar_data(valor: Optional[str]) -> str:
    # DataJud mistura "2024-03-12T14:22:10.000Z" e "2024-03-12T14:22:10"; compara só até os segundos
    return (valor or "")[:19]


def houve_movimentacao(data_antiga: Optional[str], mov_antigo: Optional[str],
                       data_nova: Optional[str], mov_novo: Optional[str]) -> bool:
    antiga, nova = _normalizar_data(data_antiga), _normalizar_data(data_nova)
    if not nova:
        return False
    if nova > antiga:
        return True
    return nova == antiga and (mov_novo or "") != (mov_antigo or "")


def _formatar_data(valor: Optional[str]) -> str:
    try:
        return datetime.fromisoformat(_normalizar_data(valor)).strftime("%d/%m/%Y %H:%M")
    except ValueError:
        return valor or ""


def destinatarios() -> List[str]:
    return [e.strip() for e in os.getenv("ALERTA_EMAILS", "").split(",") if e.strip()]


def alerta_configurado() -> bool:
    if not destinatarios():
        return False
    if os.getenv("RESEND_API_KEY"):
        return bool(os.getenv("ALERTA_REMETENTE"))
    return all(os.getenv(v) for v in ("SMTP_HOST", "SMTP_USUARIO", "SMTP_SENHA"))


def montar_email(itens: List[dict]) -> tuple:
    """itens: dicts com numero, tribunal, polo_ativo, polo_passivo, ultimo_movimento,
    data_ultimo_movimento, prioridade, o_que_fazer, novo (bool)."""
    ordem = {"urgente": 0, "alta": 1, "normal": 2, "baixa": 3}
    # Mais recentes primeiro, depois agrupa por prioridade (urgente no topo); sorted é estável
    itens = sorted(itens, key=lambda i: _normalizar_data(i.get("data_ultimo_movimento")), reverse=True)
    itens = sorted(itens, key=lambda i: ordem.get(i.get("prioridade") or "normal", 2))

    qtd = len(itens)
    assunto = f"[Processos] {qtd} {'nova movimentação' if qtd == 1 else 'novas movimentações'}"

    linhas_txt = []
    linhas_html = []
    cores = {"urgente": "#D32F2F", "alta": "#EF6C00", "normal": "#1565C0", "baixa": "#757575"}
    for i in itens:
        e = lambda v: html.escape(v or "")
        prioridade = (i.get("prioridade") or "normal")
        partes = " x ".join(p for p in (i.get("polo_ativo"), i.get("polo_passivo")) if p)
        rotulo = "NOVO PROCESSO" if i.get("novo") else prioridade.upper()
        linhas_txt.append(
            f"- {i['numero']} ({i.get('tribunal') or ''}) [{rotulo}]\n"
            f"  {partes}\n"
            f"  {_formatar_data(i.get('data_ultimo_movimento'))} — {i.get('ultimo_movimento') or ''}\n"
            + (f"  O que fazer: {i['o_que_fazer']}\n" if i.get("o_que_fazer") else "")
        )
        linhas_html.append(f"""
<tr>
  <td style="padding:8px;border-bottom:1px solid #e0e0e0;vertical-align:top">
    <b>{e(i['numero'])}</b><br><span style="color:#555">{e(i.get('tribunal'))}</span><br>
    <span style="color:#555">{e(partes)}</span>
  </td>
  <td style="padding:8px;border-bottom:1px solid #e0e0e0;vertical-align:top">
    <b>{e(i.get('ultimo_movimento'))}</b><br>
    <span style="color:#555">{e(_formatar_data(i.get('data_ultimo_movimento')))}</span>
    {f'<br><i>O que fazer: {e(i.get("o_que_fazer"))}</i>' if i.get('o_que_fazer') else ''}
  </td>
  <td style="padding:8px;border-bottom:1px solid #e0e0e0;vertical-align:top">
    <span style="background:{cores.get(prioridade, '#1565C0') if not i.get('novo') else '#2E7D32'};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">{e(rotulo)}</span>
  </td>
</tr>""")

    link = os.getenv("APP_URL", "")
    rodape_txt = f"\nAbrir o sistema: {link}\n" if link else ""
    rodape_html = f'<p><a href="{html.escape(link)}">Abrir o sistema</a></p>' if link else ""

    texto = f"{assunto}\n\n" + "\n".join(linhas_txt) + rodape_txt
    corpo_html = f"""<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
<h2 style="color:#1B2A4A;margin-bottom:4px">{html.escape(assunto)}</h2>
<p style="color:#555;margin-top:0">Sincronização de {datetime.now(ZoneInfo(os.getenv('FUSO_HORARIO', 'America/Boa_Vista'))).strftime('%d/%m/%Y às %H:%M')}</p>
<table style="border-collapse:collapse;width:100%">
<tr style="background:#1B2A4A;color:#fff">
  <th style="padding:8px;text-align:left">Processo</th>
  <th style="padding:8px;text-align:left">Movimentação</th>
  <th style="padding:8px;text-align:left">Prioridade</th>
</tr>{''.join(linhas_html)}
</table>
{rodape_html}
</div>"""
    return assunto, texto, corpo_html


def _enviar_resend(assunto: str, texto: str, corpo_html: str, para: List[str]) -> None:
    resposta = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {os.getenv('RESEND_API_KEY')}"},
        json={"from": os.getenv("ALERTA_REMETENTE"), "to": para,
              "subject": assunto, "text": texto, "html": corpo_html},
        timeout=30.0,
    )
    if resposta.status_code >= 300:
        raise RuntimeError(f"Resend recusou o envio ({resposta.status_code}): {resposta.text[:300]}")


def _enviar_smtp(assunto: str, texto: str, corpo_html: str, para: List[str]) -> None:
    msg = EmailMessage()
    msg["Subject"] = assunto
    msg["From"] = os.getenv("ALERTA_REMETENTE") or os.getenv("SMTP_USUARIO")
    msg["To"] = ", ".join(para)
    msg.set_content(texto)
    msg.add_alternative(corpo_html, subtype="html")

    host = os.getenv("SMTP_HOST")
    porta = int(os.getenv("SMTP_PORT", "587"))
    contexto = ssl.create_default_context()
    if porta == 465:
        with smtplib.SMTP_SSL(host, porta, context=contexto, timeout=30) as smtp:
            smtp.login(os.getenv("SMTP_USUARIO"), os.getenv("SMTP_SENHA"))
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(host, porta, timeout=30) as smtp:
            smtp.starttls(context=contexto)
            smtp.login(os.getenv("SMTP_USUARIO"), os.getenv("SMTP_SENHA"))
            smtp.send_message(msg)


def enviar_alerta(itens: List[dict]) -> bool:
    """Envia o resumo. Retorna False se não houver o que enviar ou se o alerta não estiver configurado."""
    if not itens or not alerta_configurado():
        return False
    assunto, texto, corpo_html = montar_email(itens)
    if os.getenv("RESEND_API_KEY"):
        _enviar_resend(assunto, texto, corpo_html, destinatarios())
    else:
        _enviar_smtp(assunto, texto, corpo_html, destinatarios())
    return True
