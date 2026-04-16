import { Search, SlidersHorizontal, X } from 'lucide-react'

const PRIORIDADES = [
  { value: '', label: 'Todas as prioridades' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'alta', label: 'Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'baixa', label: 'Baixa' },
]

export default function Filtros({ filtros, onChange, tribunais }) {
  function set(campo, valor) {
    onChange({ ...filtros, [campo]: valor })
  }

  function limpar() {
    onChange({ busca: '', tribunal: '', prioridade: '', situacao: '' })
  }

  const temFiltro = filtros.busca || filtros.tribunal || filtros.prioridade || filtros.situacao

  return (
    <div className="card p-4">
      <div className="flex flex-wrap gap-3 items-center">
        <SlidersHorizontal className="w-4 h-4 text-navy-400 shrink-0" />

        {/* Busca geral */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
          <input
            type="text"
            placeholder="Buscar por número, parte, vara, assunto..."
            value={filtros.busca}
            onChange={(e) => set('busca', e.target.value)}
            className="input-field w-full pl-9"
          />
        </div>

        {/* Tribunal */}
        <select
          value={filtros.tribunal}
          onChange={(e) => set('tribunal', e.target.value)}
          className="input-field min-w-[180px]"
        >
          <option value="">Todos os tribunais</option>
          {tribunais.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Prioridade */}
        <select
          value={filtros.prioridade}
          onChange={(e) => set('prioridade', e.target.value)}
          className="input-field"
        >
          {PRIORIDADES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Situação */}
        <input
          type="text"
          placeholder="Situação..."
          value={filtros.situacao}
          onChange={(e) => set('situacao', e.target.value)}
          className="input-field w-36"
        />

        {/* Limpar */}
        {temFiltro && (
          <button onClick={limpar} className="btn-secondary text-red-400 border-red-500/30 hover:border-red-400">
            <X className="w-4 h-4" />
            Limpar
          </button>
        )}
      </div>
    </div>
  )
}
