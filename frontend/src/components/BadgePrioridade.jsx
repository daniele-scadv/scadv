const MAP = {
  urgente: 'badge-urgente',
  alta: 'badge-alta',
  normal: 'badge-normal',
  baixa: 'badge-baixa',
}

const LABELS = {
  urgente: '🔴 Urgente',
  alta: '🟠 Alta',
  normal: '🔵 Normal',
  baixa: '⚪ Baixa',
}

export default function BadgePrioridade({ prioridade }) {
  const cls = MAP[prioridade] || 'badge-normal'
  return <span className={cls}>{LABELS[prioridade] || prioridade}</span>
}
