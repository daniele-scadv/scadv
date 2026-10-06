import { useState, useEffect } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { getDashboardNegociacoes } from '../api'
import { ETAPAS, moeda } from './comum'

function pct(v) {
  return v == null ? '—' : `${Math.round(v * 100)}%`
}

function Kpi({ rotulo, valor, detalhe, tom = 'text-white', onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`card p-4 text-left ${onClick ? 'hover:border-gold-500/40 cursor-pointer' : 'cursor-default'}`}
    >
      <p className="text-[11px] text-navy-400 uppercase tracking-wider">{rotulo}</p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${tom}`}>{valor}</p>
      {detalhe && <p className="text-xs text-navy-500 mt-1">{detalhe}</p>}
    </button>
  )
}

const COLUNAS_BANCO = [
  { campo: 'banco', rotulo: 'Banco', alinhar: 'text-left' },
  { campo: 'total', rotulo: 'Negociações' },
  { campo: 'taxa_acordo', rotulo: 'Taxa de acordo', fmt: (v, l) => v == null ? '—' : `${pct(v)} (${l.acordos}/${l.acordos + l.sem_acordo})` },
  { campo: 'desconto_primeira_proposta', rotulo: 'Desconto na 1ª proposta', fmt: (v) => pct(v) },
  { campo: 'desconto_medio', rotulo: 'Desconto no acordo', fmt: (v, l) => v == null ? '—' : `${pct(v)} (${l.base_desconto})`, destaque: true },
  { campo: 'dias_ate_primeira_proposta', rotulo: 'Dias até 1ª proposta', fmt: dias },
  { campo: 'dias_medios_ate_acordo', rotulo: 'Dias até o acordo', fmt: dias },
  { campo: 'divida_em_negociacao', rotulo: 'Dívida em negociação', fmt: (v) => moeda(v) },
  { campo: 'economia_obtida', rotulo: 'Economia obtida', fmt: (v) => moeda(v) },
]

function dias(v) {
  return v == null ? '—' : `${Math.round(v)} d`
}

function TabelaBancos({ linhas }) {
  const [ordem, setOrdem] = useState({ campo: 'total', desc: true })
  const ordenadas = [...linhas].sort((a, b) => {
    const va = a[ordem.campo], vb = b[ordem.campo]
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    const r = typeof va === 'string' ? va.localeCompare(vb) : va - vb
    return ordem.desc ? -r : r
  })
  return (
    <div className="card p-5">
      <h3 className="text-xs font-semibold text-navy-300 uppercase tracking-wider mb-1">Desempenho por banco</h3>
      <p className="text-xs text-navy-500 mb-4">
        Prazos contados da notificação ao banco (ou da abertura, se não houver notificação). Entre parênteses, a base de cálculo:
        poucas negociações ainda não permitem conclusão.
      </p>
      {linhas.length === 0 ? (
        <p className="text-navy-500 text-sm">Sem negociações com banco definido.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-navy-400 border-b border-navy-700">
                {COLUNAS_BANCO.map((c) => (
                  <th
                    key={c.campo}
                    onClick={() => setOrdem((o) => ({ campo: c.campo, desc: o.campo === c.campo ? !o.desc : true }))}
                    className={`pb-2 px-2 cursor-pointer select-none whitespace-nowrap ${c.alinhar || 'text-right'}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.rotulo}
                      <ArrowUpDown className={`w-3 h-3 ${ordem.campo === c.campo ? 'text-gold-400' : 'text-navy-600'}`} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/50">
              {ordenadas.map((l) => (
                <tr key={l.banco}>
                  {COLUNAS_BANCO.map((c) => (
                    <td
                      key={c.campo}
                      className={`py-2 px-2 tabular-nums whitespace-nowrap ${c.alinhar || 'text-right'} ${
                        c.campo === 'banco' ? 'text-white font-medium' : c.destaque ? 'text-emerald-300 font-semibold' : 'text-navy-200'
                      }`}
                    >
                      {c.fmt ? c.fmt(l[c.campo], l) : l[c.campo]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function PainelAcordos({ equipe, versao, onVerNegociacoes }) {
  const [responsavel, setResponsavel] = useState('')
  const [d, setD] = useState(null)

  useEffect(() => {
    getDashboardNegociacoes(responsavel ? { responsavel } : {}).then((r) => setD(r.data))
  }, [responsavel, versao])

  if (!d) return <p className="text-navy-400">Carregando painel...</p>

  const maxEtapa = Math.max(1, ...Object.values(d.por_etapa))

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <p className="text-sm text-navy-400">Números calculados automaticamente a partir dos lançamentos da equipe.</p>
        <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="input-field">
          <option value="">Toda a equipe</option>
          {equipe.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi rotulo="Ações atrasadas" valor={d.atrasadas} tom={d.atrasadas ? 'text-red-400' : 'text-green-400'} detalhe={`${d.para_hoje} para hoje`} onClick={() => onVerNegociacoes('hoje')} />
        <Kpi rotulo="Negociações em andamento" valor={d.ativas} detalhe={`${moeda(d.divida_em_negociacao)} em dívida`} onClick={() => onVerNegociacoes('ativas')} />
        <Kpi rotulo="Taxa de acordo" valor={pct(d.taxa_acordo)} detalhe={`${d.acordos_fechados} acordos · ${d.sem_acordo} sem acordo`} />
        <Kpi rotulo="Desconto médio obtido" valor={pct(d.desconto_medio)} detalhe={d.dias_medios_ate_acordo != null ? `${Math.round(d.dias_medios_ate_acordo)} dias em média até o acordo` : 'sem acordos ainda'} />
        <Kpi rotulo="Economia gerada aos clientes" valor={moeda(d.economia_obtida)} tom="text-emerald-300" />
        <Kpi rotulo="Honorários de êxito gerados" valor={moeda(d.honorarios_gerados)} tom="text-gold-400" />
        <Kpi rotulo="Honorários potenciais em negociação" valor={moeda(d.honorarios_potenciais)} tom="text-gold-400" detalhe="% de êxito sobre a última proposta (ou valor-alvo)" />
      </div>

      <TabelaBancos linhas={d.por_banco || []} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-navy-300 uppercase tracking-wider mb-4">Negociações por etapa</h3>
          <ul className="space-y-2">
            {ETAPAS.map((e) => {
              const qtd = d.por_etapa[e.value] || 0
              return (
                <li key={e.value} className="grid grid-cols-[170px_1fr_32px] items-center gap-3 text-sm">
                  <span className="text-navy-300 truncate">{e.label}</span>
                  <span className="h-2.5 bg-navy-900 rounded-full overflow-hidden">
                    <span className="block h-full bg-gold-500 rounded-full" style={{ width: `${(qtd / maxEtapa) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-white">{qtd}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="text-xs font-semibold text-navy-300 uppercase tracking-wider mb-4">Carga por responsável</h3>
          {d.por_responsavel.length === 0 ? (
            <p className="text-navy-500 text-sm">Sem negociações em andamento.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-navy-400 text-left">
                  <th className="pb-2">Responsável</th>
                  <th className="pb-2 text-right">Ativas</th>
                  <th className="pb-2 text-right">Hoje</th>
                  <th className="pb-2 text-right">Atrasadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/50">
                {d.por_responsavel.map((r) => (
                  <tr key={r.responsavel}>
                    <td className="py-2 text-white">{r.responsavel}</td>
                    <td className="py-2 text-right tabular-nums">{r.ativas}</td>
                    <td className="py-2 text-right tabular-nums text-amber-300">{r.hoje}</td>
                    <td className={`py-2 text-right tabular-nums ${r.atrasadas ? 'text-red-400 font-semibold' : 'text-navy-400'}`}>{r.atrasadas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
