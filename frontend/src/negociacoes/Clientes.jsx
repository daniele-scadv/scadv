import { useState, useEffect, useCallback } from 'react'
import { Search, UserPlus, Copy, Check, Save, Plus, FileSpreadsheet } from 'lucide-react'
import CofreGov from './CofreGov'
import Importacao from './Importacao'
import {
  getClientes, criarCliente, atualizarCliente, getHistoricoCliente, getNegociacoes,
} from '../api'
import {
  Modal, Campo, Secao, Rastreio, ListaHistorico, BadgeEtapa, dataBR, moeda,
  formatarDocumento, erroApi,
} from './comum'

const VAZIO = {
  tipo: 'PF', nome: '', cpf_cnpj: '', rg: '', rg_orgao_emissor: '', data_nascimento: '',
  nome_pai: '', nome_mae: '', estado_civil: '', profissao: '', telefone: '', email: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  representante_legal: '', representante_cpf: '', observacoes: '',
}

export function textoQualificacao(c) {
  const endereco = [
    [c.logradouro, c.numero].filter(Boolean).join(', '),
    c.complemento, c.bairro, [c.cidade, c.uf].filter(Boolean).join('/'), c.cep && `CEP ${c.cep}`,
  ].filter(Boolean).join(' – ')
  const linhas = c.tipo === 'PJ'
    ? [
        `Razão social: ${c.nome}`,
        `CNPJ: ${formatarDocumento(c.cpf_cnpj)}`,
        c.representante_legal && `Representante legal: ${c.representante_legal}`,
        c.representante_cpf && `CPF do representante: ${formatarDocumento(c.representante_cpf)}`,
      ]
    : [
        `Nome completo: ${c.nome}`,
        `CPF: ${formatarDocumento(c.cpf_cnpj)}`,
        c.rg && `RG: ${c.rg}${c.rg_orgao_emissor ? ' – ' + c.rg_orgao_emissor : ''}`,
        c.data_nascimento && `Data de nascimento: ${dataBR(c.data_nascimento)}`,
        c.nome_pai && `Nome do pai: ${c.nome_pai}`,
        c.nome_mae && `Nome da mãe: ${c.nome_mae}`,
        c.estado_civil && `Estado civil: ${c.estado_civil}`,
        c.profissao && `Profissão: ${c.profissao}`,
      ]
  linhas.push(c.telefone && `Telefone: ${c.telefone}`, c.email && `E-mail: ${c.email}`, endereco && `Endereço: ${endereco}`)
  return linhas.filter(Boolean).join('\n')
}

export function BotaoCopiar({ texto, rotulo = 'Copiar qualificação' }) {
  const [ok, setOk] = useState(false)
  async function copiar() {
    await navigator.clipboard.writeText(texto)
    setOk(true)
    setTimeout(() => setOk(false), 2000)
  }
  return (
    <button type="button" onClick={copiar} className="btn-secondary text-xs py-1.5">
      {ok ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {ok ? 'Copiado' : rotulo}
    </button>
  )
}

export function ModalCliente({ cliente, onFechar, onSalvo, onAbrirNegociacao, onNovaNegociacao }) {
  const novo = !cliente?.id
  const [form, setForm] = useState(() => ({ ...VAZIO, ...limparNulos(cliente || {}) }))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [historico, setHistorico] = useState([])
  const [negociacoes, setNegociacoes] = useState([])

  useEffect(() => {
    if (novo) return
    getHistoricoCliente(cliente.id).then((r) => setHistorico(r.data))
    getNegociacoes({ cliente_id: cliente.id, situacao: 'todas' }).then((r) => setNegociacoes(r.data))
  }, [cliente?.id])

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    const dados = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]))
    try {
      const r = novo ? await criarCliente(dados) : await atualizarCliente(cliente.id, dados)
      onSalvo(r.data)
    } catch (err) {
      setErro(erroApi(err))
    } finally {
      setSalvando(false)
    }
  }

  const pj = form.tipo === 'PJ'

  return (
    <Modal
      titulo={novo ? 'Novo cliente' : form.nome}
      subtitulo={novo ? 'Dados de qualificação exigidos pelos bancos' : cliente.cpf_cnpj ? formatarDocumento(cliente.cpf_cnpj) : 'Cadastro incompleto: sem CPF/CNPJ'}
      onFechar={onFechar}
      largura="max-w-4xl"
    >
      <form onSubmit={salvar} className="space-y-5">
        {!novo && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Rastreio item={cliente} />
            <BotaoCopiar texto={textoQualificacao(cliente)} />
          </div>
        )}

        <Secao titulo="Identificação">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Campo label="Tipo" obrigatorio>
              <select value={form.tipo} onChange={set('tipo')} className="input-field w-full">
                <option value="PF">Pessoa Física</option>
                <option value="PJ">Pessoa Jurídica</option>
              </select>
            </Campo>
            <Campo label={pj ? 'Razão social' : 'Nome completo'} obrigatorio className="md:col-span-2">
              <input value={form.nome} onChange={set('nome')} className="input-field w-full" required />
            </Campo>
            <Campo label={pj ? 'CNPJ' : 'CPF'}>
              <input value={form.cpf_cnpj} onChange={set('cpf_cnpj')} placeholder="pendente" className="input-field w-full" />
            </Campo>
            {pj ? (
              <>
                <Campo label="Representante legal" className="md:col-span-2">
                  <input value={form.representante_legal} onChange={set('representante_legal')} className="input-field w-full" />
                </Campo>
                <Campo label="CPF do representante">
                  <input value={form.representante_cpf} onChange={set('representante_cpf')} className="input-field w-full" />
                </Campo>
              </>
            ) : (
              <>
                <Campo label="RG">
                  <input value={form.rg} onChange={set('rg')} className="input-field w-full" />
                </Campo>
                <Campo label="Órgão emissor / UF">
                  <input value={form.rg_orgao_emissor} onChange={set('rg_orgao_emissor')} placeholder="SSP/RR" className="input-field w-full" />
                </Campo>
                <Campo label="Data de nascimento">
                  <input type="date" value={form.data_nascimento} onChange={set('data_nascimento')} className="input-field w-full" />
                </Campo>
                <Campo label="Estado civil">
                  <input value={form.estado_civil} onChange={set('estado_civil')} className="input-field w-full" />
                </Campo>
                <Campo label="Nome do pai" className="md:col-span-2">
                  <input value={form.nome_pai} onChange={set('nome_pai')} className="input-field w-full" />
                </Campo>
                <Campo label="Nome da mãe" className="md:col-span-2">
                  <input value={form.nome_mae} onChange={set('nome_mae')} className="input-field w-full" />
                </Campo>
                <Campo label="Profissão" className="md:col-span-2">
                  <input value={form.profissao} onChange={set('profissao')} className="input-field w-full" />
                </Campo>
              </>
            )}
          </div>
        </Secao>

        <Secao titulo="Contato e endereço">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Campo label="Telefone" className="md:col-span-2">
              <input value={form.telefone} onChange={set('telefone')} className="input-field w-full" />
            </Campo>
            <Campo label="E-mail" className="md:col-span-4">
              <input type="email" value={form.email} onChange={set('email')} className="input-field w-full" />
            </Campo>
            <Campo label="CEP">
              <input value={form.cep} onChange={set('cep')} className="input-field w-full" />
            </Campo>
            <Campo label="Logradouro" className="md:col-span-4">
              <input value={form.logradouro} onChange={set('logradouro')} className="input-field w-full" />
            </Campo>
            <Campo label="Número">
              <input value={form.numero} onChange={set('numero')} className="input-field w-full" />
            </Campo>
            <Campo label="Complemento" className="md:col-span-2">
              <input value={form.complemento} onChange={set('complemento')} className="input-field w-full" />
            </Campo>
            <Campo label="Bairro" className="md:col-span-2">
              <input value={form.bairro} onChange={set('bairro')} className="input-field w-full" />
            </Campo>
            <Campo label="Cidade">
              <input value={form.cidade} onChange={set('cidade')} className="input-field w-full" />
            </Campo>
            <Campo label="UF">
              <input value={form.uf} onChange={set('uf')} maxLength={2} className="input-field w-full uppercase" />
            </Campo>
            <Campo label="Observações" className="md:col-span-6">
              <textarea value={form.observacoes} onChange={set('observacoes')} rows={2} className="input-field w-full resize-none" />
            </Campo>
          </div>
        </Secao>

        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={salvando} className="btn-primary disabled:opacity-50">
            <Save className="w-4 h-4" /> {salvando ? 'Salvando...' : novo ? 'Cadastrar cliente' : 'Salvar alterações'}
          </button>
        </div>
      </form>

      {!novo && (
        <div className="space-y-5 mt-6">
          <Secao
            titulo={`Negociações (${negociacoes.length})`}
            acao={
              <button onClick={() => onNovaNegociacao(cliente)} className="btn-secondary text-xs py-1.5">
                <Plus className="w-3.5 h-3.5" /> Nova negociação
              </button>
            }
          >
            {negociacoes.length === 0 ? (
              <p className="text-navy-500 text-sm">Nenhuma negociação aberta para este cliente.</p>
            ) : (
              <ul className="divide-y divide-navy-700/50">
                {negociacoes.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => onAbrirNegociacao(n)}
                    className="py-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-navy-700/30 px-2 rounded"
                  >
                    <span className="text-sm text-white">
                      {n.banco} <span className="text-navy-400">{n.contrato && `· ${n.contrato}`}</span>
                    </span>
                    <span className="flex items-center gap-3 text-xs text-navy-400">
                      {moeda(n.valor_divida)} <BadgeEtapa etapa={n.etapa} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
          <CofreGov clienteId={cliente.id} onAlterado={() => getHistoricoCliente(cliente.id).then((r) => setHistorico(r.data))} />
          <Secao titulo="Histórico de alterações">
            <ListaHistorico itens={historico} />
          </Secao>
        </div>
      )}
    </Modal>
  )
}

// Campos mínimos que o banco costuma exigir
export function incompleto(c) {
  if (c.tipo === 'PJ') return !c.cpf_cnpj || !c.logradouro || !c.cidade
  return !c.cpf_cnpj || !c.rg || !c.data_nascimento || !c.nome_mae || !c.logradouro || !c.cidade || !c.telefone
}

function limparNulos(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v ?? '']))
}

export default function Clientes({ onAbrirCliente, onNovoCliente, versao, onImportado }) {
  const [busca, setBusca] = useState('')
  const [importando, setImportando] = useState(false)
  const [soIncompletos, setSoIncompletos] = useState(false)
  const [clientes, setClientes] = useState([])

  const carregar = useCallback(async () => {
    const r = await getClientes(busca ? { busca } : {})
    setClientes(r.data)
  }, [busca])

  useEffect(() => {
    const t = setTimeout(carregar, 250)
    return () => clearTimeout(t)
  }, [carregar, versao])

  return (
    <div className="space-y-5">
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail..."
            className="input-field w-full pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-navy-300">
          <input type="checkbox" checked={soIncompletos} onChange={(e) => setSoIncompletos(e.target.checked)} />
          Só cadastros incompletos
        </label>
        <button onClick={() => setImportando(true)} className="btn-secondary">
          <FileSpreadsheet className="w-4 h-4" /> Importar planilha
        </button>
        <button onClick={onNovoCliente} className="btn-primary">
          <UserPlus className="w-4 h-4" /> Novo cliente
        </button>
      </div>
      {importando && <Importacao onFechar={() => { setImportando(false); carregar() }} onImportado={onImportado} />}

      <div className="card overflow-hidden">
        {clientes.length === 0 ? (
          <p className="p-12 text-center text-navy-400">Nenhum cliente encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy-900/70 border-b border-navy-700">
                <tr className="text-left text-xs text-navy-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">CPF/CNPJ</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Cidade</th>
                  <th className="px-4 py-3">Cadastrado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/50">
                {clientes.filter((c) => !soIncompletos || incompleto(c)).map((c) => (
                  <tr key={c.id} onClick={() => onAbrirCliente(c)} className="hover:bg-navy-700/30 cursor-pointer">
                    <td className="px-4 py-3 text-white font-medium">{c.nome}</td>
                    <td className="px-4 py-3 text-navy-300 font-mono text-xs">
                      {c.cpf_cnpj ? formatarDocumento(c.cpf_cnpj) : <span className="text-amber-300 font-sans">pendente</span>}
                      {c.cpf_cnpj && incompleto(c) && <span className="block text-amber-300 font-sans text-[11px]">cadastro incompleto</span>}
                    </td>
                    <td className="px-4 py-3 text-navy-300">{c.telefone || '—'}</td>
                    <td className="px-4 py-3 text-navy-300">{[c.cidade, c.uf].filter(Boolean).join('/') || '—'}</td>
                    <td className="px-4 py-3 text-navy-400 text-xs">{c.criado_por} · {dataBR(c.criado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
