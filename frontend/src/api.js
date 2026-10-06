import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

export const getStatus = () => api.get('/status')
export const getProcessos = (params) => api.get('/processos', { params })
export const getProcesso = (numero) => api.get(`/processos/${encodeURIComponent(numero)}`)
export const updateProcesso = (numero, dados) => api.patch(`/processos/${encodeURIComponent(numero)}`, dados)
export const getTribunais = () => api.get('/tribunais')
export const sincronizar = () => api.post('/sincronizar')
export const getExportUrl = () => '/api/exportar/excel'

export const getEu = () => api.get('/eu')

export const getClientes = (params) => api.get('/clientes', { params })
export const getCliente = (id) => api.get(`/clientes/${id}`)
export const criarCliente = (dados) => api.post('/clientes', dados)
export const atualizarCliente = (id, dados) => api.patch(`/clientes/${id}`, dados)
export const getHistoricoCliente = (id) => api.get(`/clientes/${id}/historico`)

export const getNegociacoes = (params) => api.get('/negociacoes', { params })
export const getNegociacao = (id) => api.get(`/negociacoes/${id}`)
export const criarNegociacao = (dados) => api.post('/negociacoes', dados)
export const atualizarNegociacao = (id, dados) => api.patch(`/negociacoes/${id}`, dados)
export const getTentativas = (id) => api.get(`/negociacoes/${id}/tentativas`)
export const registrarTentativa = (id, dados) => api.post(`/negociacoes/${id}/tentativas`, dados)
export const getHistoricoNegociacao = (id) => api.get(`/negociacoes/${id}/historico`)
export const getDashboardNegociacoes = (params) => api.get('/negociacoes/dashboard', { params })

export const getGov = (id) => api.get(`/clientes/${id}/gov`)
export const revelarGov = (id) => api.post(`/clientes/${id}/gov/revelar`)
export const salvarGov = (id, dados) => api.put(`/clientes/${id}/gov`, dados)
export const apagarGov = (id) => api.delete(`/clientes/${id}/gov`)

const formImportacao = (arquivo, nichosExcluidos) => {
  const f = new FormData()
  f.append('arquivo', arquivo)
  f.append('nichos_excluidos', JSON.stringify(nichosExcluidos))
  return f
}
export const previaImportacao = (arquivo, nichosExcluidos) => api.post('/importacao/previa', formImportacao(arquivo, nichosExcluidos))
export const confirmarImportacao = (arquivo, nichosExcluidos) => api.post('/importacao/confirmar', formImportacao(arquivo, nichosExcluidos))

export const getContatosBancos = (params) => api.get('/contatos-bancos', { params })
export const getTiposContato = () => api.get('/contatos-bancos/tipos')
export const criarContatoBanco = (dados) => api.post('/contatos-bancos', dados)
export const atualizarContatoBanco = (id, dados) => api.patch(`/contatos-bancos/${id}`, dados)
export const apagarContatoBanco = (id) => api.delete(`/contatos-bancos/${id}`)
export const getHistoricoContatoBanco = (id) => api.get(`/contatos-bancos/${id}/historico`)

export default api
