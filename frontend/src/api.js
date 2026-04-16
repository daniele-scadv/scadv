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

export default api
