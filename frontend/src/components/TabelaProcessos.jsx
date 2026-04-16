import { ChevronRight, ClipboardEdit, Eye, EyeOff, ArrowUpDown } from 'lucide-react'
import BadgePrioridade from './BadgePrioridade'

function formatarValor(valor) {
  if (!valor) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function formatarData(data) {
  if (!data) return '—'
  const d = data.split('T')[0]
  const [ano, mes, dia] = d.split('-')
  if (!ano || !mes || !dia) return data
  return `${dia}/${mes}/${ano}`
}

function truncar(texto, max = 60) {
  if (!texto) return '—'
  return texto.length > max ? texto.substring(0, max) + '...' : texto
}

export default function TabelaProcessos({ processos, onDetalhe, ordenacao, onOrdenar }) {
  function ColHeader({ campo, children }) {
    const ativo = ordenacao.campo === campo
    return (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-navy-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none whitespace-nowrap"
        onClick={() => onOrdenar(campo)}
      >
        <div className="flex items-center gap-1">
          {children}
          <ArrowUpDown className={`w-3 h-3 ${ativo ? 'text-gold-400' : 'text-navy-600'}`} />
        </div>
      </th>
    )
  }

  if (processos.length === 0) {
    return (
      <div className="card p-16 text-center">
        <div className="text-6xl mb-4">⚖️</div>
        <p className="text-navy-300 text-lg font-medium">Nenhum processo encontrado</p>
        <p className="text-navy-500 text-sm mt-1">
          Clique em "Sincronizar" para buscar processos nos tribunais, ou ajuste os filtros.
        </p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-navy-900/70 border-b border-navy-700">
            <tr>
              <ColHeader campo="numero">Nº Processo</ColHeader>
              <th className="px-4 py-3 text-left text-xs font-semibold text-navy-400 uppercase tracking-wider">Tribunal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-navy-400 uppercase tracking-wider">Vara</th>
              <ColHeader campo="data_distribuicao">Distribuição</ColHeader>
              <th className="px-4 py-3 text-left text-xs font-semibold text-navy-400 uppercase tracking-wider">Partes</th>
              <ColHeader campo="valor_causa">Valor</ColHeader>
              <th className="px-4 py-3 text-left text-xs font-semibold text-navy-400 uppercase tracking-wider">Situação</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-navy-400 uppercase tracking-wider">Prioridade</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-navy-400 uppercase tracking-wider">O que fazer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-navy-400 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/50">
            {processos.map((p, idx) => (
              <tr
                key={p.numero}
                className={`
                  hover:bg-navy-700/30 transition-colors duration-150 group
                  ${p.prioridade === 'urgente' ? 'border-l-2 border-l-red-500' : ''}
                  ${p.prioridade === 'alta' ? 'border-l-2 border-l-orange-500' : ''}
                  ${idx % 2 === 0 ? 'bg-navy-800/20' : ''}
                `}
              >
                {/* Número */}
                <td className="px-4 py-3">
                  <code className="text-gold-400 text-xs font-mono bg-navy-900/50 px-2 py-1 rounded">
                    {p.numero}
                  </code>
                </td>

                {/* Tribunal */}
                <td className="px-4 py-3">
                  <span className="text-navy-200 text-xs font-medium">
                    {p.tribunal?.split(' - ')[0] || '—'}
                  </span>
                  {p.fonte_oab && (
                    <div className="text-navy-500 text-xs">{p.fonte_oab}</div>
                  )}
                </td>

                {/* Vara */}
                <td className="px-4 py-3 max-w-[180px]">
                  <span className="text-navy-300 text-xs">{truncar(p.vara, 45)}</span>
                </td>

                {/* Data */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-navy-300 text-xs">{formatarData(p.data_distribuicao)}</span>
                </td>

                {/* Partes */}
                <td className="px-4 py-3 max-w-[200px]">
                  {p.polo_ativo && (
                    <div className="text-xs">
                      <span className="text-green-400 font-semibold">A: </span>
                      <span className="text-navy-200">{truncar(p.polo_ativo, 40)}</span>
                    </div>
                  )}
                  {p.polo_passivo && (
                    <div className="text-xs mt-0.5">
                      <span className="text-red-400 font-semibold">P: </span>
                      <span className="text-navy-200">{truncar(p.polo_passivo, 40)}</span>
                    </div>
                  )}
                </td>

                {/* Valor */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-navy-200 text-xs font-mono">{formatarValor(p.valor_causa)}</span>
                </td>

                {/* Situação */}
                <td className="px-4 py-3 max-w-[150px]">
                  <span className="text-navy-200 text-xs">{truncar(p.situacao, 35)}</span>
                </td>

                {/* Prioridade */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <BadgePrioridade prioridade={p.prioridade} />
                </td>

                {/* O que fazer */}
                <td className="px-4 py-3 max-w-[200px]">
                  {p.o_que_fazer ? (
                    <div className="flex items-start gap-1.5">
                      <ClipboardEdit className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span className="text-purple-300 text-xs italic">{truncar(p.o_que_fazer, 50)}</span>
                    </div>
                  ) : (
                    <span className="text-navy-600 text-xs">—</span>
                  )}
                </td>

                {/* Ação */}
                <td className="px-4 py-3">
                  <button
                    onClick={() => onDetalhe(p)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-navy-600 rounded-lg"
                  >
                    <ChevronRight className="w-4 h-4 text-gold-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-navy-700 bg-navy-900/30 flex items-center justify-between">
        <p className="text-navy-400 text-xs">
          {processos.length} processo{processos.length !== 1 ? 's' : ''} exibido{processos.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}
