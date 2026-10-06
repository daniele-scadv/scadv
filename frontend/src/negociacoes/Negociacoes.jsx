import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Save, AlertTriangle, CalendarClock, MessageSquarePlus, ExternalLink, ShieldAlert } from 'lucide-react'
import {
  getNegociacoes, getNegociacao, criarNegociacao, atualizarNegociacao, getTentativas,
  registrarTentativa, getHistoricoNegociacao, getClientes, getCliente,
} from '../api'
import {
  ETAPAS, ETAPAS_COM_ACORDO, ETAPAS_SEM_ACORDO, ETAPAS_ENCERRADAS, CANAIS, TIPOS_CONTATO, MODALIDADES,
  Modal, Campo, Secao, Rastreio, ListaHistorico, BadgeEtapa, moeda, dataBR, dataHoraBR, hojeISO,
  situacaoPrazo, erroApi, paraNumero, formatarDocumento,
} from './comum'
import { textoQualificacao, BotaoCopiar } from './Clientes'

const SITUACOES = [
  { value: 'hoje', label: 'Para hoje e atrasadas' },
  { value: 'atrasadas', label: 'Só atrasadas' },
  { value: 'ativas', label: 'Todas em andamento' },
  { value: 'encerradas', label: 'Encerradas' },
  { value: 'todas', label: 'Todas' },
]

function vazioParaNulo(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v]))
}

// ─── Formulário de dados da negociação (novo e edição) ─────────────────────

export function FormNegociacao({ negociacao, clienteInicial, equipe, usuario, onSalvo }) {
  const nova = !negociacao?.id
  const [form, setForm] = useState(() => {
    const base = {
      cliente_id: clienteInicial?.id || '', banco: '', contrato: '', modalidade: '', segmento: clienteInicial?.tipo === 'PJ' ? 'PJ' : 'PF',
      etapa: 'diagnostico', responsavel: usuario || '', valor_divida: '', valor_alvo: '', percentual_exito: '',
      data_notificacao: '', protocolo_notificacao: '', prazo_resposta: '', proxima_acao: '', data_proxima_acao: '',
      valor_acordo: '', data_acordo: '', motivo_encerramento: '',
    }
    if (!negociacao) return base
    return Object.fromEntries(Object.keys(base).map((k) => [k, negociacao[k] ?? '']))
  })
  const [buscaCliente, setBuscaCliente] = useState('')
  const [opcoesClientes, setOpcoesClientes] = useState(clienteInicial ? [clienteInicial] : [])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!nova || clienteInicial) return
    const t = setTimeout(() => getClientes(buscaCliente ? { busca: buscaCliente } : {}).then((r) => setOpcoesClientes(r.data)), 250)
    return () => clearTimeout(t)
  }, [buscaCliente])

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    const dados = vazioParaNulo({
      ...form,
      cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
      valor_divida: paraNumero(form.valor_divida),
      valor_alvo: paraNumero(form.valor_alvo),
      percentual_exito: paraNumero(form.percentual_exito),
      valor_acordo: paraNumero(form.valor_acordo),
    })
    try {
      const r = nova ? await criarNegociacao(dados) : await atualizarNegociacao(negociacao.id, dados)
      onSalvo(r.data)
    } catch (err) {
      setErro(erroApi(err))
    } finally {
      setSalvando(false)
    }
  }

  const comAcordo = ETAPAS_COM_ACORDO.includes(form.etapa)
  const semAcordo = ETAPAS_SEM_ACORDO.includes(form.etapa)
  const encerrada = ETAPAS_ENCERRADAS.includes(form.etapa)

  return (
    <form onSubmit={salvar} className="space-y-5">
      {nova && (
        <Secao titulo="Cliente">
          {clienteInicial ? (
            <p className="text-white text-sm">{clienteInicial.nome} · {formatarDocumento(clienteInicial.cpf_cnpj)}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Buscar cliente por nome ou CPF..." className="input-field w-full" />
              <select value={form.cliente_id} onChange={set('cliente_id')} className="input-field w-full" required>
                <option value="">Selecione o cliente</option>
                {opcoesClientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} · {formatarDocumento(c.cpf_cnpj)}</option>
                ))}
              </select>
              <p className="text-xs text-navy-500 md:col-span-2">Cliente ainda não cadastrado? Cadastre primeiro na aba Clientes.</p>
            </div>
          )}
        </Secao>
      )}

      <Secao titulo="Dívida e contrato">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Campo label="Banco" obrigatorio>
            <input value={form.banco} onChange={set('banco')} className="input-field w-full" required />
          </Campo>
          <Campo label="Nº do contrato">
            <input value={form.contrato} onChange={set('contrato')} className="input-field w-full" />
          </Campo>
          <Campo label="Modalidade">
            <input list="modalidades" value={form.modalidade} onChange={set('modalidade')} className="input-field w-full" />
            <datalist id="modalidades">{MODALIDADES.map((m) => <option key={m} value={m} />)}</datalist>
          </Campo>
          <Campo label="Segmento">
            <select value={form.segmento} onChange={set('segmento')} className="input-field w-full">
              <option value="PF">Pessoa Física</option>
              <option value="PJ">Pessoa Jurídica</option>
              <option value="Rural">Produtor rural</option>
            </select>
          </Campo>
          <Campo label="Valor cobrado pelo banco (R$)">
            <input value={form.valor_divida} onChange={set('valor_divida')} placeholder="0,00" className="input-field w-full" />
          </Campo>
          <Campo label="Valor-alvo do acordo (R$)">
            <input value={form.valor_alvo} onChange={set('valor_alvo')} placeholder="0,00" className="input-field w-full" />
          </Campo>
          <Campo label="Honorários de êxito (%)">
            <input value={form.percentual_exito} onChange={set('percentual_exito')} placeholder="sobre a economia" className="input-field w-full" />
          </Campo>
          <Campo label="Responsável">
            <select value={form.responsavel} onChange={set('responsavel')} className="input-field w-full">
              <option value="">—</option>
              {equipe.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Notificação">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Campo label="Data de envio">
            <input type="date" value={form.data_notificacao} onChange={set('data_notificacao')} className="input-field w-full" />
          </Campo>
          <Campo label="Protocolo / AR">
            <input value={form.protocolo_notificacao} onChange={set('protocolo_notificacao')} className="input-field w-full" />
          </Campo>
          <Campo label="Prazo de resposta do banco">
            <input type="date" value={form.prazo_resposta} onChange={set('prazo_resposta')} className="input-field w-full" />
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Andamento">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Campo label="Etapa" obrigatorio>
            <select value={form.etapa} onChange={set('etapa')} className="input-field w-full">
              {ETAPAS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </Campo>
          <Campo label="Próxima ação" obrigatorio={!encerrada} className="md:col-span-2">
            <input value={form.proxima_acao} onChange={set('proxima_acao')} placeholder="Ex.: cobrar resposta da contraproposta" className="input-field w-full" required={!encerrada} />
          </Campo>
          <Campo label="Data da próxima ação" obrigatorio={!encerrada}>
            <input type="date" value={form.data_proxima_acao} onChange={set('data_proxima_acao')} className="input-field w-full" required={!encerrada} />
          </Campo>
          {comAcordo && (
            <>
              <Campo label="Valor do acordo (R$)" obrigatorio>
                <input value={form.valor_acordo} onChange={set('valor_acordo')} className="input-field w-full" required />
              </Campo>
              <Campo label="Data do acordo" obrigatorio>
                <input type="date" value={form.data_acordo} onChange={set('data_acordo')} className="input-field w-full" required />
              </Campo>
            </>
          )}
          {semAcordo && (
            <Campo label="Motivo do encerramento" obrigatorio className="md:col-span-4">
              <textarea value={form.motivo_encerramento} onChange={set('motivo_encerramento')} rows={2} className="input-field w-full resize-none" required />
            </Campo>
          )}
        </div>
      </Secao>

      {erro && <p className="text-red-400 text-sm">{erro}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={salvando} className="btn-primary disabled:opacity-50">
          <Save className="w-4 h-4" /> {salvando ? 'Salvando...' : nova ? 'Abrir negociação' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}

// ─── Registro de tentativa de acordo ───────────────────────────────────────

function FormTentativa({ negociacao, onRegistrada }) {
  const [form, setForm] = useState({
    data_contato: hojeISO(), canal: 'Telefone', tipo: '', interlocutor: '', protocolo: '', resumo: '',
    proposta_valor: '', proposta_condicoes: '', link_anexo: '', nova_etapa: '', proxima_acao: '', data_proxima_acao: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    try {
      await registrarTentativa(negociacao.id, vazioParaNulo({ ...form, proposta_valor: paraNumero(form.proposta_valor) }))
      onRegistrada()
    } catch (err) {
      setErro(erroApi(err))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="card p-4 space-y-3 border-gold-500/30">
      <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span>Contato sem protocolo não conta. Em toda comunicação escrita, deixe registrado que a proposta é feita para fins de composição, <b>sem reconhecimento de débito</b>.</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Campo label="Data do contato" obrigatorio>
          <input type="date" value={form.data_contato} onChange={set('data_contato')} className="input-field w-full" required />
        </Campo>
        <Campo label="Canal" obrigatorio>
          <select value={form.canal} onChange={set('canal')} className="input-field w-full">
            {CANAIS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Campo>
        <Campo label="Tipo">
          <select value={form.tipo} onChange={set('tipo')} className="input-field w-full">
            <option value="">—</option>
            {TIPOS_CONTATO.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo label="Protocolo">
          <input value={form.protocolo} onChange={set('protocolo')} className="input-field w-full" />
        </Campo>
        <Campo label="Quem atendeu no banco (nome / setor)" className="md:col-span-2">
          <input value={form.interlocutor} onChange={set('interlocutor')} className="input-field w-full" />
        </Campo>
        <Campo label="Link do print / e-mail (Drive)" className="md:col-span-2">
          <input value={form.link_anexo} onChange={set('link_anexo')} placeholder="https://drive.google.com/..." className="input-field w-full" />
        </Campo>
        <Campo label="O que aconteceu" obrigatorio className="md:col-span-4">
          <textarea value={form.resumo} onChange={set('resumo')} rows={3} className="input-field w-full resize-none" required />
        </Campo>
        <Campo label="Proposta do banco (R$)">
          <input value={form.proposta_valor} onChange={set('proposta_valor')} placeholder="se houve proposta" className="input-field w-full" />
        </Campo>
        <Campo label="Condições (parcelas, entrada, vencimento)" className="md:col-span-3">
          <input value={form.proposta_condicoes} onChange={set('proposta_condicoes')} className="input-field w-full" />
        </Campo>
      </div>
      <p className="text-xs text-navy-400 pt-1">Atualizar a negociação junto com este registro (opcional):</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Campo label="Mudar etapa para">
          <select value={form.nova_etapa} onChange={set('nova_etapa')} className="input-field w-full">
            <option value="">Manter ({ETAPAS.find((e) => e.value === negociacao.etapa)?.label})</option>
            {ETAPAS.filter((e) => !ETAPAS_COM_ACORDO.includes(e.value) && !ETAPAS_SEM_ACORDO.includes(e.value)).map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Nova próxima ação" className="md:col-span-2">
          <input value={form.proxima_acao} onChange={set('proxima_acao')} placeholder={negociacao.proxima_acao || ''} className="input-field w-full" />
        </Campo>
        <Campo label="Data">
          <input type="date" value={form.data_proxima_acao} onChange={set('data_proxima_acao')} className="input-field w-full" />
        </Campo>
      </div>
      {erro && <p className="text-red-400 text-sm">{erro}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={salvando} className="btn-primary disabled:opacity-50">
          <Save className="w-4 h-4" /> {salvando ? 'Registrando...' : 'Registrar tentativa'}
        </button>
      </div>
    </form>
  )
}

// ─── Ficha da negociação ───────────────────────────────────────────────────

export function ModalNegociacao({ negociacaoInicial, equipe, usuario, onFechar, onAlterada, onAbrirCliente }) {
  const [n, setN] = useState(negociacaoInicial)
  const [aba, setAba] = useState('tentativas')
  const [tentativas, setTentativas] = useState([])
  const [historico, setHistorico] = useState([])
  const [cliente, setCliente] = useState(null)
  const [registrando, setRegistrando] = useState(false)

  const recarregar = useCallback(async () => {
    const [rn, rt, rh] = await Promise.all([
      getNegociacao(negociacaoInicial.id), getTentativas(negociacaoInicial.id), getHistoricoNegociacao(negociacaoInicial.id),
    ])
    setN(rn.data)
    setTentativas(rt.data)
    setHistorico(rh.data)
  }, [negociacaoInicial.id])

  useEffect(() => {
    recarregar()
    getCliente(negociacaoInicial.cliente_id).then((r) => setCliente(r.data))
  }, [recarregar])

  const prazo = situacaoPrazo(n)
  const ref = n.valor_acordo ?? n.ultima_proposta_valor
  const desconto = n.valor_divida && ref != null ? (n.valor_divida - ref) / n.valor_divida : null

  const abas = [
    { id: 'tentativas', label: `Tentativas de acordo (${tentativas.length})` },
    { id: 'dados', label: 'Dados da negociação' },
    { id: 'cliente', label: 'Qualificação do cliente' },
    { id: 'historico', label: 'Histórico' },
  ]

  return (
    <Modal
      titulo={`${n.cliente_nome} × ${n.banco}`}
      subtitulo={[n.contrato && `Contrato ${n.contrato}`, n.modalidade, `Responsável: ${n.responsavel || '—'}`].filter(Boolean).join(' · ')}
      onFechar={onFechar}
      largura="max-w-5xl"
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <BadgeEtapa etapa={n.etapa} />
          <Rastreio item={n} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Indicador rotulo="Cobrado pelo banco" valor={moeda(n.valor_divida)} />
          <Indicador rotulo="Valor-alvo" valor={moeda(n.valor_alvo)} />
          <Indicador
            rotulo={n.valor_acordo ? 'Acordo fechado' : 'Última proposta do banco'}
            valor={moeda(n.valor_acordo ?? n.ultima_proposta_valor)}
            detalhe={n.valor_acordo ? dataBR(n.data_acordo) : n.ultima_proposta_data && `${dataBR(n.ultima_proposta_data)}${n.ultima_proposta_condicoes ? ' · ' + n.ultima_proposta_condicoes : ''}`}
            destaque
          />
          <Indicador rotulo="Desconto" valor={desconto != null ? `${Math.round(desconto * 100)}%` : '—'} />
        </div>

        {!ETAPAS_ENCERRADAS.includes(n.etapa) && (
          <div className={`rounded-xl border p-3 flex items-center gap-3 ${
            prazo === 'atrasada' ? 'bg-red-500/10 border-red-500/40' : prazo === 'hoje' ? 'bg-amber-500/10 border-amber-500/40' : 'bg-navy-900 border-navy-700'
          }`}>
            {prazo === 'atrasada' ? <AlertTriangle className="w-5 h-5 text-red-400" /> : <CalendarClock className="w-5 h-5 text-gold-400" />}
            <div className="text-sm">
              <p className="text-navy-400 text-xs">Próxima ação {prazo === 'atrasada' && <b className="text-red-400">· ATRASADA</b>}{prazo === 'hoje' && <b className="text-amber-300">· HOJE</b>}</p>
              <p className="text-white">{n.proxima_acao} <span className="text-navy-400">· {dataBR(n.data_proxima_acao)}</span></p>
            </div>
          </div>
        )}

        <div className="flex gap-1 border-b border-navy-700 overflow-x-auto">
          {abas.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                aba === a.id ? 'border-gold-400 text-white' : 'border-transparent text-navy-400 hover:text-white'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {aba === 'tentativas' && (
          <div className="space-y-4">
            {registrando ? (
              <FormTentativa
                negociacao={n}
                onRegistrada={async () => { setRegistrando(false); await recarregar(); onAlterada() }}
              />
            ) : (
              <button onClick={() => setRegistrando(true)} className="btn-primary">
                <MessageSquarePlus className="w-4 h-4" /> Registrar tentativa de acordo
              </button>
            )}
            {tentativas.length === 0 ? (
              <p className="text-navy-500 text-sm">Nenhuma tentativa registrada ainda.</p>
            ) : (
              <ol className="space-y-3">
                {tentativas.map((t) => (
                  <li key={t.id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <p className="text-sm text-white font-medium">
                        {dataBR(t.data_contato)} · {t.canal}{t.tipo && <span className="text-navy-400"> · {t.tipo}</span>}
                      </p>
                      {t.protocolo
                        ? <span className="text-xs font-mono text-gold-400">Protocolo {t.protocolo}</span>
                        : <span className="text-xs text-red-400">Sem protocolo</span>}
                    </div>
                    {t.interlocutor && <p className="text-xs text-navy-400 mb-1">Atendido por: {t.interlocutor}</p>}
                    <p className="text-sm text-navy-200 whitespace-pre-wrap">{t.resumo}</p>
                    {t.proposta_valor != null && (
                      <p className="text-sm mt-2 text-emerald-300">
                        Proposta: <b>{moeda(t.proposta_valor)}</b>{t.proposta_condicoes && ` · ${t.proposta_condicoes}`}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                      <p className="text-[11px] text-navy-500">
                        Lançado por <b className="text-navy-400">{t.lancado_por}</b> em {dataHoraBR(t.lancado_em)}
                      </p>
                      {t.link_anexo && (
                        <a href={t.link_anexo} target="_blank" rel="noreferrer" className="text-xs text-gold-400 flex items-center gap-1 hover:underline">
                          <ExternalLink className="w-3 h-3" /> Ver anexo
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {aba === 'dados' && (
          <FormNegociacao
            key={n.atualizado_em}
            negociacao={n}
            equipe={equipe}
            usuario={usuario}
            onSalvo={async () => { await recarregar(); onAlterada() }}
          />
        )}

        {aba === 'cliente' && cliente && (
          <Secao
            titulo="Dados para informar ao banco"
            acao={
              <div className="flex gap-2">
                <BotaoCopiar texto={textoQualificacao(cliente)} />
                <button onClick={() => onAbrirCliente(cliente)} className="btn-secondary text-xs py-1.5">Editar cadastro</button>
              </div>
            }
          >
            <pre className="text-sm text-navy-200 whitespace-pre-wrap font-sans">{textoQualificacao(cliente)}</pre>
          </Secao>
        )}

        {aba === 'historico' && (
          <Secao titulo="Quem alterou o quê">
            <ListaHistorico itens={historico} />
          </Secao>
        )}
      </div>
    </Modal>
  )
}

function Indicador({ rotulo, valor, detalhe, destaque }) {
  return (
    <div className={`rounded-xl border p-3 ${destaque ? 'border-gold-500/40 bg-gold-500/5' : 'border-navy-700 bg-navy-900'}`}>
      <p className="text-[11px] text-navy-400 uppercase tracking-wider">{rotulo}</p>
      <p className={`text-lg font-bold tabular-nums ${destaque ? 'text-gold-400' : 'text-white'}`}>{valor}</p>
      {detalhe && <p className="text-[11px] text-navy-400 mt-0.5">{detalhe}</p>}
    </div>
  )
}

// ─── Lista ─────────────────────────────────────────────────────────────────

export default function Negociacoes({ equipe, usuario, onAbrir, onNova, versao, situacaoInicial }) {
  const [filtros, setFiltros] = useState({ busca: '', situacao: situacaoInicial || 'hoje', etapa: '', responsavel: '' })
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v))
      const r = await getNegociacoes(params)
      setLista(r.data)
    } finally {
      setCarregando(false)
    }
  }, [filtros])

  useEffect(() => {
    const t = setTimeout(carregar, 250)
    return () => clearTimeout(t)
  }, [carregar, versao])

  const set = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.value })

  return (
    <div className="space-y-5">
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
          <input value={filtros.busca} onChange={set('busca')} placeholder="Buscar por cliente, CPF, banco ou contrato..." className="input-field w-full pl-9" />
        </div>
        <select value={filtros.situacao} onChange={set('situacao')} className="input-field">
          {SITUACOES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filtros.etapa} onChange={set('etapa')} className="input-field">
          <option value="">Todas as etapas</option>
          {ETAPAS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <select value={filtros.responsavel} onChange={set('responsavel')} className="input-field">
          <option value="">Toda a equipe</option>
          {equipe.map((u) => <option key={u} value={u}>{u === usuario ? `${u} (eu)` : u}</option>)}
        </select>
        <button onClick={onNova} className="btn-primary">
          <Plus className="w-4 h-4" /> Nova negociação
        </button>
      </div>

      <div className="card overflow-hidden relative">
        {carregando && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold-400 animate-pulse" />}
        {lista.length === 0 ? (
          <p className="p-12 text-center text-navy-400">
            {filtros.situacao === 'hoje' ? 'Nenhuma ação pendente para hoje. Tudo em dia.' : 'Nenhuma negociação encontrada.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy-900/70 border-b border-navy-700">
                <tr className="text-left text-xs text-navy-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Próxima ação</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Banco</th>
                  <th className="px-4 py-3">Etapa</th>
                  <th className="px-4 py-3 text-right">Cobrado</th>
                  <th className="px-4 py-3 text-right">Última proposta</th>
                  <th className="px-4 py-3">Último contato</th>
                  <th className="px-4 py-3">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/50">
                {lista.map((n) => {
                  const prazo = situacaoPrazo(n)
                  return (
                    <tr
                      key={n.id}
                      onClick={() => onAbrir(n)}
                      className={`hover:bg-navy-700/30 cursor-pointer ${prazo === 'atrasada' ? 'border-l-2 border-l-red-500' : prazo === 'hoje' ? 'border-l-2 border-l-amber-400' : ''}`}
                    >
                      <td className="px-4 py-3 max-w-[260px]">
                        {ETAPAS_ENCERRADAS.includes(n.etapa) ? (
                          <span className="text-navy-500">Encerrada</span>
                        ) : (
                          <>
                            <p className={`text-xs font-semibold ${prazo === 'atrasada' ? 'text-red-400' : prazo === 'hoje' ? 'text-amber-300' : 'text-navy-400'}`}>
                              {dataBR(n.data_proxima_acao)}{prazo === 'atrasada' && ' · atrasada'}{prazo === 'hoje' && ' · hoje'}
                            </p>
                            <p className="text-white truncate">{n.proxima_acao}</p>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white">{n.cliente_nome}</td>
                      <td className="px-4 py-3 text-navy-200">{n.banco}{n.contrato && <span className="block text-xs text-navy-500">{n.contrato}</span>}</td>
                      <td className="px-4 py-3"><BadgeEtapa etapa={n.etapa} /></td>
                      <td className="px-4 py-3 text-right tabular-nums text-navy-200">{moeda(n.valor_divida)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gold-400">{moeda(n.valor_acordo ?? n.ultima_proposta_valor)}</td>
                      <td className="px-4 py-3 text-navy-400 text-xs">{n.ultimo_contato ? dataBR(n.ultimo_contato) : 'nenhum'} · {n.total_tentativas} tent.</td>
                      <td className="px-4 py-3 text-navy-300 text-xs">{n.responsavel || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
