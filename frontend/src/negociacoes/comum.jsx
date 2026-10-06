import { X } from 'lucide-react'
import { format } from 'date-fns'

export const ETAPAS = [
  { value: 'diagnostico', label: 'Diagnóstico', cor: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  { value: 'notificacao_enviada', label: 'Notificação enviada', cor: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'aguardando_banco', label: 'Aguardando banco', cor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { value: 'em_negociacao', label: 'Em negociação', cor: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { value: 'aprovacao_cliente', label: 'Aprovação do cliente', cor: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { value: 'formalizacao', label: 'Formalização', cor: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  { value: 'pagamento', label: 'Acompanhamento de pagamento', cor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { value: 'quitado', label: 'Quitado', cor: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { value: 'sem_acordo', label: 'Sem acordo (judicializar)', cor: 'bg-red-500/20 text-red-300 border-red-500/30' },
  { value: 'desistencia', label: 'Cliente desistiu', cor: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
]
export const ETAPAS_ENCERRADAS = ['quitado', 'sem_acordo', 'desistencia']
export const ETAPAS_COM_ACORDO = ['pagamento', 'quitado']
export const ETAPAS_SEM_ACORDO = ['sem_acordo', 'desistencia']

export const CANAIS = ['Telefone', 'WhatsApp', 'E-mail', 'Notificação extrajudicial', 'Ouvidoria', 'Reclamação BACEN', 'Consumidor.gov.br', 'Presencial (agência)']
export const TIPOS_CONTATO = ['Envio de notificação', 'Follow-up', 'Proposta recebida do banco', 'Contraproposta enviada', 'Banco sem resposta', 'Envio de documentos', 'Reclamação formal', 'Outro']
export const MODALIDADES = ['Cartão de crédito', 'Cheque especial', 'Crédito pessoal', 'Consignado', 'CCB', 'Capital de giro', 'Conta garantida', 'Financiamento de veículo', 'Financiamento imobiliário', 'Crédito rural / CPR', 'PRONAMPE', 'Outro']

export function rotuloEtapa(valor) {
  return ETAPAS.find((e) => e.value === valor)?.label || valor
}

export function BadgeEtapa({ etapa }) {
  const e = ETAPAS.find((x) => x.value === etapa)
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${e?.cor || ''}`}>
      {e?.label || etapa}
    </span>
  )
}

export function moeda(valor) {
  if (valor === null || valor === undefined || valor === '') return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

export function dataBR(data) {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('T')[0].split('-')
  return `${dia}/${mes}/${ano}`
}

export function dataHoraBR(data) {
  if (!data) return '—'
  // O servidor grava em UTC sem fuso; o "Z" faz o navegador converter para o horário local
  return format(new Date(data.endsWith('Z') ? data : data + 'Z'), "dd/MM/yyyy 'às' HH:mm")
}

export function hojeISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatarDocumento(doc) {
  const d = (doc || '').replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return doc || '—'
}

export function situacaoPrazo(n) {
  if (ETAPAS_ENCERRADAS.includes(n.etapa) || !n.data_proxima_acao) return null
  const hoje = hojeISO()
  if (n.data_proxima_acao < hoje) return 'atrasada'
  if (n.data_proxima_acao === hoje) return 'hoje'
  return 'em_dia'
}

export function erroApi(e) {
  const d = e.response?.data?.detail
  if (Array.isArray(d)) return d.map((x) => x.msg).join('; ')
  return d || e.message
}

export function Modal({ titulo, subtitulo, onFechar, largura = 'max-w-3xl', children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className={`relative bg-navy-800 border border-navy-700 rounded-2xl shadow-2xl w-full ${largura} max-h-[92vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-navy-800 border-b border-navy-700 px-6 py-4 flex items-start justify-between z-10">
          <div>
            <h2 className="text-white font-semibold">{titulo}</h2>
            {subtitulo && <p className="text-navy-400 text-xs mt-0.5">{subtitulo}</p>}
          </div>
          <button onClick={onFechar} className="p-2 hover:bg-navy-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-navy-400" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function Campo({ label, obrigatorio, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-navy-300 mb-1">
        {label} {obrigatorio && <span className="text-gold-400">*</span>}
      </span>
      {children}
    </label>
  )
}

export function Secao({ titulo, children, acao }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-navy-300 uppercase tracking-wider">{titulo}</h3>
        {acao}
      </div>
      {children}
    </div>
  )
}

export function Rastreio({ item }) {
  return (
    <p className="text-[11px] text-navy-500">
      Cadastrado por <b className="text-navy-400">{item.criado_por || '—'}</b> em {dataHoraBR(item.criado_em)}
      {item.atualizado_por && (
        <> · Última alteração por <b className="text-navy-400">{item.atualizado_por}</b> em {dataHoraBR(item.atualizado_em)}</>
      )}
    </p>
  )
}

export function ListaHistorico({ itens }) {
  if (!itens.length) return <p className="text-navy-500 text-sm">Sem registros.</p>
  return (
    <ul className="space-y-2">
      {itens.map((h) => (
        <li key={h.id} className="text-xs border-l-2 border-navy-600 pl-3">
          <p className="text-navy-400">
            <b className="text-navy-200">{h.usuario}</b> · {dataHoraBR(h.data)} · {h.acao}
          </p>
          {h.descricao && <p className="text-navy-300 mt-0.5">{h.descricao}</p>}
        </li>
      ))}
    </ul>
  )
}

// Valor digitado como "38.000,50" ou "38000.50" → número
export function paraNumero(texto) {
  if (texto === '' || texto === null || texto === undefined) return null
  if (typeof texto === 'number') return texto
  const limpo = String(texto).replace(/[^\d,.-]/g, '')
  let normalizado = limpo
  if (limpo.includes(',')) normalizado = limpo.replace(/\./g, '').replace(',', '.')
  // "70.000" ou "1.250.000" sem vírgula: pontos são separador de milhar
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) normalizado = limpo.replace(/\./g, '')
  const n = parseFloat(normalizado)
  return Number.isNaN(n) ? null : n
}
