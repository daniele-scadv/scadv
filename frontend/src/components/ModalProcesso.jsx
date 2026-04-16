import { useState, useEffect } from 'react'
import { X, Save, AlertCircle, Scale, Calendar, Building2, Users, DollarSign, Activity, FileText } from 'lucide-react'
import { updateProcesso } from '../api'
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

function InfoRow({ icon: Icon, label, value, mono = false }) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-3 border-b border-navy-700/50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-navy-700 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-navy-400" />
      </div>
      <div>
        <p className="text-navy-400 text-xs font-medium mb-0.5">{label}</p>
        <p className={`text-white text-sm ${mono ? 'font-mono text-gold-400' : ''}`}>{value}</p>
      </div>
    </div>
  )
}

export default function ModalProcesso({ processo, onFechar, onAtualizado }) {
  const [oQueFazer, setOQueFazer] = useState(processo.o_que_fazer || '')
  const [prioridade, setPrioridade] = useState(processo.prioridade || 'normal')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    setOQueFazer(processo.o_que_fazer || '')
    setPrioridade(processo.prioridade || 'normal')
  }, [processo])

  async function handleSalvar() {
    setSalvando(true)
    try {
      const atualizado = await updateProcesso(processo.numero, {
        o_que_fazer: oQueFazer,
        prioridade,
      })
      onAtualizado(atualizado.data)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2000)
    } catch (e) {
      alert('Erro ao salvar: ' + (e.response?.data?.detail || e.message))
    } finally {
      setSalvando(false)
    }
  }

  async function handleOcultar() {
    if (!confirm('Deseja ocultar este processo do dashboard? Você pode reativá-lo nos filtros.')) return
    await updateProcesso(processo.numero, { oculto: true })
    onFechar()
    onAtualizado(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative bg-navy-800 border border-navy-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do modal */}
        <div className="sticky top-0 bg-navy-800 border-b border-navy-700 px-6 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Scale className="w-4 h-4 text-gold-400" />
              <code className="text-gold-400 text-sm font-mono">{processo.numero}</code>
            </div>
            <p className="text-navy-400 text-xs">{processo.tribunal}</p>
          </div>
          <button onClick={onFechar} className="p-2 hover:bg-navy-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-navy-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Informações do processo */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-navy-300 mb-3 uppercase tracking-wider">
              Dados do Processo
            </h3>
            <div>
              <InfoRow icon={Building2} label="Vara / Órgão Julgador" value={processo.vara} />
              <InfoRow icon={Calendar} label="Data de Distribuição" value={formatarData(processo.data_distribuicao)} />
              <InfoRow icon={Scale} label="Classe Processual" value={processo.classe} />
              <InfoRow icon={FileText} label="Assunto" value={processo.assunto} />
              <InfoRow icon={DollarSign} label="Valor da Causa" value={formatarValor(processo.valor_causa)} />
              <InfoRow icon={Activity} label="Situação Atual" value={processo.situacao} />
            </div>
          </div>

          {/* Partes */}
          {(processo.polo_ativo || processo.polo_passivo) && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-navy-300 mb-3 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4" /> Partes
              </h3>
              {processo.polo_ativo && (
                <div className="mb-3">
                  <p className="text-xs text-green-400 font-semibold uppercase tracking-wide mb-1">Polo Ativo</p>
                  <p className="text-white text-sm">{processo.polo_ativo}</p>
                </div>
              )}
              {processo.polo_passivo && (
                <div>
                  <p className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-1">Polo Passivo</p>
                  <p className="text-white text-sm">{processo.polo_passivo}</p>
                </div>
              )}
            </div>
          )}

          {/* Último movimento */}
          {processo.ultimo_movimento && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-navy-300 mb-2 uppercase tracking-wider">
                Último Movimento
              </h3>
              <p className="text-navy-300 text-sm">{processo.ultimo_movimento}</p>
              {processo.data_ultimo_movimento && (
                <p className="text-navy-500 text-xs mt-1">{formatarData(processo.data_ultimo_movimento)}</p>
              )}
            </div>
          )}

          {/* Prioridade */}
          <div>
            <label className="block text-sm font-semibold text-navy-300 mb-2 uppercase tracking-wider">
              Prioridade
            </label>
            <div className="flex gap-2 flex-wrap">
              {['urgente', 'alta', 'normal', 'baixa'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPrioridade(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                    prioridade === p
                      ? 'ring-2 ring-gold-400 ring-offset-2 ring-offset-navy-800 scale-105'
                      : 'opacity-60 hover:opacity-90'
                  }`}
                  style={{ borderColor: 'transparent' }}
                >
                  <BadgePrioridade prioridade={p} />
                </button>
              ))}
            </div>
          </div>

          {/* O que fazer */}
          <div>
            <label className="block text-sm font-semibold text-navy-300 mb-2 uppercase tracking-wider">
              O que fazer / Anotações
            </label>
            <textarea
              value={oQueFazer}
              onChange={(e) => setOQueFazer(e.target.value)}
              placeholder="Descreva as próximas ações, prazos, estratégias ou observações sobre este processo..."
              rows={5}
              className="input-field w-full resize-none"
            />
          </div>

          {/* Botões */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleOcultar}
              className="text-navy-500 hover:text-red-400 text-xs transition-colors"
            >
              Ocultar processo
            </button>

            <button
              onClick={handleSalvar}
              disabled={salvando}
              className="btn-primary disabled:opacity-50"
            >
              {salvo ? (
                <>✓ Salvo!</>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {salvando ? 'Salvando...' : 'Salvar anotações'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
