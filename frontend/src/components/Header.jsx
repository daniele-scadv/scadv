import { Scale, RefreshCw, Download, Clock } from 'lucide-react'
import { sincronizar, getExportUrl } from '../api'
import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Header({ status, onSincronizou }) {
  const [carregando, setCarregando] = useState(false)

  async function handleSincronizar() {
    setCarregando(true)
    try {
      await sincronizar()
      // Aguarda um pouco e notifica pai para recarregar
      setTimeout(() => {
        onSincronizou()
        setCarregando(false)
      }, 3000)
    } catch (e) {
      alert('Erro ao iniciar sincronização: ' + (e.response?.data?.detail || e.message))
      setCarregando(false)
    }
  }

  const ultimaVez = status?.sincronizacao?.ultima_vez
    ? format(new Date(status.sincronizacao.ultima_vez), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null

  const emAndamento = status?.sincronizacao?.em_andamento

  return (
    <header className="bg-navy-800 border-b border-navy-700/50 shadow-2xl">
      <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo e identidade */}
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center shadow-lg">
            <Scale className="w-6 h-6 text-navy-950" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Gestão Processual
            </h1>
            <p className="text-xs text-navy-400 font-medium">
              Dra. Daniele Cabral · OAB/RR 617 · OAB/AM 1.404-A
            </p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3">
          {ultimaVez && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-navy-400 bg-navy-900 px-3 py-1.5 rounded-lg border border-navy-700">
              <Clock className="w-3.5 h-3.5" />
              <span>Atualizado {ultimaVez}</span>
            </div>
          )}

          {emAndamento && (
            <div className="flex items-center gap-2 text-xs text-gold-400 bg-gold-500/10 px-3 py-1.5 rounded-lg border border-gold-500/30 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Sincronizando tribunais...</span>
            </div>
          )}

          <a
            href={getExportUrl()}
            download
            className="btn-secondary"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </a>

          <button
            onClick={handleSincronizar}
            disabled={carregando || emAndamento}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${(carregando || emAndamento) ? 'animate-spin' : ''}`} />
            {carregando || emAndamento ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      </div>
    </header>
  )
}
