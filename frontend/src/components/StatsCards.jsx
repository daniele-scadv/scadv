import { Briefcase, AlertTriangle, ArrowUpCircle, ClipboardList } from 'lucide-react'

const cards = [
  {
    key: 'total_processos',
    label: 'Total de Processos',
    icon: Briefcase,
    cor: 'from-blue-600 to-blue-500',
    borda: 'border-blue-500/30',
  },
  {
    key: 'urgentes',
    label: 'Urgentes',
    icon: AlertTriangle,
    cor: 'from-red-600 to-red-500',
    borda: 'border-red-500/30',
  },
  {
    key: 'alta_prioridade',
    label: 'Alta Prioridade',
    icon: ArrowUpCircle,
    cor: 'from-orange-600 to-orange-500',
    borda: 'border-orange-500/30',
  },
  {
    key: 'com_tarefa_pendente',
    label: 'Com Tarefas',
    icon: ClipboardList,
    cor: 'from-purple-600 to-purple-500',
    borda: 'border-purple-500/30',
  },
]

export default function StatsCards({ status }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ key, label, icon: Icon, cor, borda }) => (
        <div key={key} className={`card p-5 border ${borda} relative overflow-hidden`}>
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-br ${cor} opacity-10 translate-x-8 -translate-y-8`} />
          <div className="flex items-start justify-between relative">
            <div>
              <p className="text-navy-400 text-xs font-medium uppercase tracking-wider mb-1">
                {label}
              </p>
              <p className="text-4xl font-bold text-white tabular-nums">
                {status?.[key] ?? '—'}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cor} flex items-center justify-center shadow-lg`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
