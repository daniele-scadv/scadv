import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import StatsCards from './components/StatsCards'
import Filtros from './components/Filtros'
import TabelaProcessos from './components/TabelaProcessos'
import ModalProcesso from './components/ModalProcesso'
import Negociacoes, { ModalNegociacao, FormNegociacao } from './negociacoes/Negociacoes'
import Clientes, { ModalCliente } from './negociacoes/Clientes'
import PainelAcordos from './negociacoes/PainelAcordos'
import ContatosBancos from './negociacoes/ContatosBancos'
import { Modal } from './negociacoes/comum'
import { getStatus, getProcessos, getTribunais, getEu } from './api'

export default function App() {
  const [status, setStatus] = useState(null)
  const [processos, setProcessos] = useState([])
  const [tribunais, setTribunais] = useState([])
  const [processoselecionado, setProcessoSelecionado] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [filtros, setFiltros] = useState({
    busca: '',
    tribunal: '',
    prioridade: '',
    situacao: '',
  })
  const [ordenacao, setOrdenacao] = useState({ campo: 'atualizado_em', ordem: 'desc' })

  // Negociações e clientes
  const [aba, setAba] = useState('processos')
  const [eu, setEu] = useState({ usuario: '', equipe: [] })
  const [versao, setVersao] = useState(0) // incrementa para recarregar listas após salvar
  const [clienteAberto, setClienteAberto] = useState(null) // {} = novo cliente
  const [negociacaoAberta, setNegociacaoAberta] = useState(null)
  const [novaNegociacao, setNovaNegociacao] = useState(null) // { cliente } ou {}
  const [situacaoInicial, setSituacaoInicial] = useState(null)
  const recarregarListas = () => setVersao((v) => v + 1)

  useEffect(() => {
    getEu().then((r) => setEu(r.data)).catch(() => {})
  }, [])

  const carregarStatus = useCallback(async () => {
    try {
      const res = await getStatus()
      setStatus(res.data)
    } catch (e) {
      console.error('Erro ao carregar status', e)
    }
  }, [])

  const carregarProcessos = useCallback(async () => {
    setCarregando(true)
    try {
      const params = {
        ordenar_por: ordenacao.campo,
        ordem: ordenacao.ordem,
      }
      if (filtros.busca) params.busca = filtros.busca
      if (filtros.tribunal) params.tribunal = filtros.tribunal
      if (filtros.prioridade) params.prioridade = filtros.prioridade
      if (filtros.situacao) params.situacao = filtros.situacao

      const res = await getProcessos(params)
      setProcessos(res.data)
    } catch (e) {
      console.error('Erro ao carregar processos', e)
    } finally {
      setCarregando(false)
    }
  }, [filtros, ordenacao])

  const carregarTribunais = useCallback(async () => {
    try {
      const res = await getTribunais()
      setTribunais(res.data)
    } catch (e) {
      console.error('Erro ao carregar tribunais', e)
    }
  }, [])

  useEffect(() => {
    carregarStatus()
    carregarProcessos()
    carregarTribunais()
  }, [])

  useEffect(() => {
    carregarProcessos()
  }, [filtros, ordenacao])

  // Polling do status quando sincronizando
  useEffect(() => {
    if (!status?.sincronizacao?.em_andamento) return
    const interval = setInterval(() => {
      carregarStatus()
      carregarProcessos()
    }, 5000)
    return () => clearInterval(interval)
  }, [status?.sincronizacao?.em_andamento])

  function handleOrdenar(campo) {
    setOrdenacao((prev) =>
      prev.campo === campo
        ? { campo, ordem: prev.ordem === 'asc' ? 'desc' : 'asc' }
        : { campo, ordem: 'desc' }
    )
  }

  function handleAtualizado(processosAtualizado) {
    if (processosAtualizado) {
      setProcessos((prev) =>
        prev.map((p) => (p.numero === processosAtualizado.numero ? processosAtualizado : p))
      )
    } else {
      carregarProcessos()
    }
    carregarStatus()
  }

  function handleSincronizou() {
    carregarStatus()
    setTimeout(carregarProcessos, 6000)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header status={status} onSincronizou={handleSincronizou} aba={aba} onAba={setAba} usuario={eu.usuario} />

      {aba === 'negociacoes' && (
        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6">
          <Negociacoes
            key={situacaoInicial || 'padrao'}
            situacaoInicial={situacaoInicial}
            equipe={eu.equipe}
            usuario={eu.usuario}
            versao={versao}
            onAbrir={setNegociacaoAberta}
            onNova={() => setNovaNegociacao({})}
          />
        </main>
      )}

      {aba === 'clientes' && (
        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6">
          <Clientes versao={versao} onAbrirCliente={setClienteAberto} onNovoCliente={() => setClienteAberto({})} onImportado={recarregarListas} />
        </main>
      )}

      {aba === 'bancos' && (
        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6">
          <ContatosBancos />
        </main>
      )}

      {aba === 'painel' && (
        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6">
          <PainelAcordos
            equipe={eu.equipe}
            versao={versao}
            onVerNegociacoes={(situacao) => { setSituacaoInicial(situacao); setAba('negociacoes') }}
          />
        </main>
      )}

      {aba === 'processos' && (
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6 space-y-5">
        {/* Stats */}
        <StatsCards status={status} />

        {/* Filtros */}
        <Filtros filtros={filtros} onChange={setFiltros} tribunais={tribunais} />

        {/* Tabela */}
        <div className="relative">
          {carregando && (
            <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
              <div className="flex items-center gap-3 bg-navy-800 border border-navy-700 px-5 py-3 rounded-xl shadow-2xl">
                <div className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-navy-200">Carregando processos...</span>
              </div>
            </div>
          )}
          <TabelaProcessos
            processos={processos}
            onDetalhe={setProcessoSelecionado}
            ordenacao={ordenacao}
            onOrdenar={handleOrdenar}
          />
        </div>

        {/* Banners de erro de sincronização */}
        {status?.sincronizacao?.erros?.length > 0 && (
          <details className="card p-4">
            <summary className="text-yellow-400 text-sm cursor-pointer font-medium">
              ⚠️ {status.sincronizacao.erros.length} tribunal(is) com falha na última sincronização
            </summary>
            <ul className="mt-2 space-y-1">
              {status.sincronizacao.erros.map((e, i) => (
                <li key={i} className="text-navy-400 text-xs font-mono bg-navy-900 px-3 py-1 rounded">
                  {e}
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
      )}

      {clienteAberto && (
        <ModalCliente
          key={clienteAberto.id || 'novo'}
          cliente={clienteAberto}
          onFechar={() => setClienteAberto(null)}
          onSalvo={(c) => { setClienteAberto(c); recarregarListas() }}
          onAbrirNegociacao={(n) => { setClienteAberto(null); setNegociacaoAberta(n) }}
          onNovaNegociacao={(c) => { setClienteAberto(null); setNovaNegociacao({ cliente: c }) }}
        />
      )}

      {novaNegociacao && (
        <Modal titulo="Nova negociação" subtitulo="1 negociação = 1 cliente × 1 banco × 1 contrato" onFechar={() => setNovaNegociacao(null)} largura="max-w-4xl">
          <FormNegociacao
            clienteInicial={novaNegociacao.cliente}
            equipe={eu.equipe}
            usuario={eu.usuario}
            onSalvo={(n) => { setNovaNegociacao(null); setNegociacaoAberta(n); recarregarListas() }}
          />
        </Modal>
      )}

      {negociacaoAberta && (
        <ModalNegociacao
          key={negociacaoAberta.id}
          negociacaoInicial={negociacaoAberta}
          equipe={eu.equipe}
          usuario={eu.usuario}
          onFechar={() => setNegociacaoAberta(null)}
          onAlterada={recarregarListas}
          onAbrirCliente={(c) => { setNegociacaoAberta(null); setClienteAberto(c) }}
        />
      )}

      {/* Modal de detalhe */}
      {processoselecionado && (
        <ModalProcesso
          processo={processoselecionado}
          onFechar={() => setProcessoSelecionado(null)}
          onAtualizado={(p) => {
            handleAtualizado(p)
            if (p) setProcessoSelecionado(p)
            else setProcessoSelecionado(null)
          }}
        />
      )}
    </div>
  )
}
