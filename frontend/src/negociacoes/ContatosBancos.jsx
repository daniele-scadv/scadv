import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Save, Phone, Mail, MessageCircle, MapPin, Globe, Clock, Copy, Pencil } from 'lucide-react'
import {
  getContatosBancos, getTiposContato, criarContatoBanco, atualizarContatoBanco, apagarContatoBanco,
  getHistoricoContatoBanco,
} from '../api'
import { Modal, Campo, Secao, Rastreio, ListaHistorico, erroApi } from './comum'

const VAZIO = {
  banco: '', tipo: '', nome: '', cargo: '', telefone: '', whatsapp: '', email: '', endereco: '', site: '',
  horario: '', regiao: '', observacoes: '', ativo: true,
}

function linkWhatsapp(numero) {
  const d = (numero || '').replace(/\D/g, '')
  return `https://wa.me/${d.length <= 11 ? '55' + d : d}`
}

function Copiar({ texto }) {
  return (
    <button type="button" onClick={() => navigator.clipboard.writeText(texto)} className="p-0.5 hover:bg-navy-700 rounded" title="Copiar">
      <Copy className="w-3 h-3 text-navy-500" />
    </button>
  )
}

export function CartaoContato({ c, onEditar }) {
  return (
    <div className={`rounded-xl border p-3 text-sm space-y-1 ${c.ativo ? 'border-navy-700 bg-navy-900' : 'border-navy-800 bg-navy-900/40 opacity-60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-gold-400 text-xs font-semibold uppercase tracking-wide">{c.tipo}{!c.ativo && ' · inativo'}</p>
          <p className="text-white font-medium">{c.nome || '—'}{c.cargo && <span className="text-navy-400 font-normal"> · {c.cargo}</span>}</p>
          {c.regiao && <p className="text-xs text-navy-400">{c.regiao}</p>}
        </div>
        {onEditar && (
          <button onClick={() => onEditar(c)} className="p-1.5 hover:bg-navy-700 rounded-lg" title="Editar">
            <Pencil className="w-3.5 h-3.5 text-navy-400" />
          </button>
        )}
      </div>
      {c.telefone && <p className="flex items-center gap-2 text-navy-200"><Phone className="w-3.5 h-3.5 text-navy-400" />{c.telefone}<Copiar texto={c.telefone} /></p>}
      {c.whatsapp && (
        <p className="flex items-center gap-2 text-navy-200">
          <MessageCircle className="w-3.5 h-3.5 text-navy-400" />
          <a href={linkWhatsapp(c.whatsapp)} target="_blank" rel="noreferrer" className="hover:underline">{c.whatsapp}</a>
          <Copiar texto={c.whatsapp} />
        </p>
      )}
      {c.email && (
        <p className="flex items-center gap-2 text-navy-200 break-all">
          <Mail className="w-3.5 h-3.5 text-navy-400 shrink-0" /><a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a><Copiar texto={c.email} />
        </p>
      )}
      {c.site && (
        <p className="flex items-center gap-2 text-navy-200 break-all">
          <Globe className="w-3.5 h-3.5 text-navy-400 shrink-0" /><a href={c.site.startsWith('http') ? c.site : `https://${c.site}`} target="_blank" rel="noreferrer" className="hover:underline">{c.site}</a>
        </p>
      )}
      {c.endereco && <p className="flex items-start gap-2 text-navy-200"><MapPin className="w-3.5 h-3.5 text-navy-400 mt-0.5 shrink-0" /><span className="whitespace-pre-wrap">{c.endereco}</span><Copiar texto={c.endereco} /></p>}
      {c.horario && <p className="flex items-center gap-2 text-navy-400 text-xs"><Clock className="w-3.5 h-3.5" />{c.horario}</p>}
      {c.observacoes && <p className="text-xs text-amber-200/90 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2 whitespace-pre-wrap">{c.observacoes}</p>}
      <p className="text-[10px] text-navy-500">Atualizado por {c.atualizado_por} em {new Date((c.atualizado_em || '') + 'Z').toLocaleDateString('pt-BR')}</p>
    </div>
  )
}

export function ModalContatoBanco({ contato, bancoInicial, onFechar, onSalvo }) {
  const novo = !contato?.id
  const [form, setForm] = useState(() => ({ ...VAZIO, banco: bancoInicial || '', ...Object.fromEntries(Object.entries(contato || {}).map(([k, v]) => [k, v ?? ''])) }))
  const [tipos, setTipos] = useState([])
  const [historico, setHistorico] = useState([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    getTiposContato().then((r) => setTipos(r.data))
    if (!novo) getHistoricoContatoBanco(contato.id).then((r) => setHistorico(r.data))
  }, [])

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    const dados = Object.fromEntries(Object.entries(form).filter(([k]) => k in VAZIO).map(([k, v]) => [k, v === '' ? null : v]))
    try {
      const r = novo ? await criarContatoBanco(dados) : await atualizarContatoBanco(contato.id, dados)
      onSalvo(r.data)
    } catch (err) {
      setErro(erroApi(err))
    } finally {
      setSalvando(false)
    }
  }

  async function apagar() {
    if (!confirm('Apagar este contato definitivamente? Se ele só parou de funcionar, prefira desmarcar "Ativo".')) return
    try {
      await apagarContatoBanco(contato.id)
      onSalvo(null)
    } catch (err) {
      setErro(erroApi(err))
    }
  }

  return (
    <Modal titulo={novo ? 'Novo contato de banco' : `${contato.banco} · ${contato.tipo}`} onFechar={onFechar} largura="max-w-3xl">
      <form onSubmit={salvar} className="space-y-5">
        {!novo && <Rastreio item={contato} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Campo label="Banco" obrigatorio>
            <input value={form.banco} onChange={set('banco')} placeholder="Ex.: Itaú" className="input-field w-full" required />
          </Campo>
          <Campo label="Tipo de contato" obrigatorio>
            <select value={form.tipo} onChange={set('tipo')} className="input-field w-full" required>
              <option value="">Selecione</option>
              {tipos.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo label="Nome da pessoa ou setor">
            <input value={form.nome} onChange={set('nome')} className="input-field w-full" />
          </Campo>
          <Campo label="Cargo">
            <input value={form.cargo} onChange={set('cargo')} className="input-field w-full" />
          </Campo>
          <Campo label="Telefone">
            <input value={form.telefone} onChange={set('telefone')} className="input-field w-full" />
          </Campo>
          <Campo label="WhatsApp">
            <input value={form.whatsapp} onChange={set('whatsapp')} className="input-field w-full" />
          </Campo>
          <Campo label="E-mail">
            <input type="email" value={form.email} onChange={set('email')} className="input-field w-full" />
          </Campo>
          <Campo label="Site / portal / formulário">
            <input value={form.site} onChange={set('site')} className="input-field w-full" />
          </Campo>
          <Campo label="Endereço para notificação (AR)" className="md:col-span-2">
            <textarea value={form.endereco} onChange={set('endereco')} rows={2} className="input-field w-full resize-none" />
          </Campo>
          <Campo label="Horário de atendimento">
            <input value={form.horario} onChange={set('horario')} placeholder="Seg a sex, 9h às 18h" className="input-field w-full" />
          </Campo>
          <Campo label="Abrangência">
            <input value={form.regiao} onChange={set('regiao')} placeholder="Nacional, agência 1234, Boa Vista/RR..." className="input-field w-full" />
          </Campo>
          <Campo label="O que funciona com esse contato" className="md:col-span-2">
            <textarea value={form.observacoes} onChange={set('observacoes')} rows={3} placeholder="Ex.: responde em 48h; exige procuração com firma reconhecida; só negocia acima de 90 dias de atraso" className="input-field w-full resize-none" />
          </Campo>
          <label className="flex items-center gap-2 text-sm text-navy-300">
            <input type="checkbox" checked={form.ativo} onChange={set('ativo')} /> Ativo (desmarque se deixou de funcionar)
          </label>
        </div>
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <div className="flex justify-between">
          {!novo ? <button type="button" onClick={apagar} className="text-navy-500 hover:text-red-400 text-xs">Apagar contato</button> : <span />}
          <button type="submit" disabled={salvando} className="btn-primary disabled:opacity-50">
            <Save className="w-4 h-4" /> {salvando ? 'Salvando...' : 'Salvar contato'}
          </button>
        </div>
      </form>
      {!novo && (
        <div className="mt-6">
          <Secao titulo="Histórico"><ListaHistorico itens={historico} /></Secao>
        </div>
      )}
    </Modal>
  )
}

// Bloco usado dentro da negociação: contatos do mesmo banco
export function ContatosDoBanco({ banco }) {
  const [contatos, setContatos] = useState([])
  const [editando, setEditando] = useState(null)
  const carregar = useCallback(() => {
    if (banco && banco.toLowerCase() !== 'a definir') getContatosBancos({ banco }).then((r) => setContatos(r.data))
  }, [banco])
  useEffect(() => { carregar() }, [carregar])

  return (
    <Secao
      titulo={`Contatos do banco (${contatos.length})`}
      acao={<button onClick={() => setEditando({})} className="btn-secondary text-xs py-1.5"><Plus className="w-3.5 h-3.5" /> Novo contato</button>}
    >
      {contatos.length === 0 ? (
        <p className="text-navy-500 text-sm">Nenhum contato cadastrado para este banco. Cadastre o primeiro ao descobrir um canal que funciona.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contatos.map((c) => <CartaoContato key={c.id} c={c} onEditar={setEditando} />)}
        </div>
      )}
      {editando && (
        <ModalContatoBanco
          contato={editando.id ? editando : null}
          bancoInicial={banco}
          onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); carregar() }}
        />
      )}
    </Secao>
  )
}

// Aba "Bancos"
export default function ContatosBancos() {
  const [busca, setBusca] = useState('')
  const [inativos, setInativos] = useState(false)
  const [contatos, setContatos] = useState([])
  const [editando, setEditando] = useState(null)

  const carregar = useCallback(async () => {
    const r = await getContatosBancos({ ...(busca ? { busca } : {}), inativos })
    setContatos(r.data)
  }, [busca, inativos])

  useEffect(() => {
    const t = setTimeout(carregar, 250)
    return () => clearTimeout(t)
  }, [carregar])

  const grupos = contatos.reduce((acc, c) => {
    (acc[c.banco_grupo] = acc[c.banco_grupo] || []).push(c)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por banco, setor, pessoa, e-mail..." className="input-field w-full pl-9" />
        </div>
        <label className="flex items-center gap-2 text-sm text-navy-300">
          <input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.target.checked)} /> Mostrar inativos
        </label>
        <button onClick={() => setEditando({})} className="btn-primary"><Plus className="w-4 h-4" /> Novo contato</button>
      </div>

      {Object.keys(grupos).length === 0 ? (
        <div className="card p-12 text-center text-navy-400">
          Nenhum contato cadastrado. Cada ouvidoria, setor de recuperação ou gerente que responder vira um contato aqui.
        </div>
      ) : (
        Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b)).map(([banco, lista]) => (
          <div key={banco} className="card p-5">
            <h3 className="text-white font-semibold mb-3">{banco} <span className="text-navy-500 text-sm font-normal">· {lista.length} contato(s)</span></h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {lista.map((c) => <CartaoContato key={c.id} c={c} onEditar={setEditando} />)}
            </div>
          </div>
        ))
      )}

      {editando && (
        <ModalContatoBanco
          contato={editando.id ? editando : null}
          onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); carregar() }}
        />
      )}
    </div>
  )
}
