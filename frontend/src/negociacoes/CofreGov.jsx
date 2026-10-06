import { useState, useEffect, useRef } from 'react'
import { Lock, Eye, EyeOff, Copy, Save, Trash2 } from 'lucide-react'
import { getGov, revelarGov, salvarGov, apagarGov } from '../api'
import { Secao, Campo, dataHoraBR, erroApi } from './comum'

const SEGUNDOS_VISIVEL = 60

export default function CofreGov({ clienteId, onAlterado }) {
  const [info, setInfo] = useState(null)
  const [dados, setDados] = useState(null) // credenciais reveladas
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ login: '', senha: '', observacoes: '' })
  const [erro, setErro] = useState('')
  const [restante, setRestante] = useState(0)
  const timer = useRef(null)

  const carregar = () => getGov(clienteId).then((r) => setInfo(r.data)).catch((e) => setErro(erroApi(e)))
  useEffect(() => { carregar(); return () => clearInterval(timer.current) }, [clienteId])

  function esconder() {
    clearInterval(timer.current)
    setDados(null)
    setRestante(0)
  }

  async function revelar() {
    setErro('')
    try {
      const r = await revelarGov(clienteId)
      setDados(r.data)
      setRestante(SEGUNDOS_VISIVEL)
      clearInterval(timer.current)
      timer.current = setInterval(() => {
        setRestante((s) => {
          if (s <= 1) { esconder(); return 0 }
          return s - 1
        })
      }, 1000)
      onAlterado?.()
    } catch (e) {
      setErro(erroApi(e))
    }
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    try {
      await salvarGov(clienteId, form)
      setEditando(false)
      setForm({ login: '', senha: '', observacoes: '' })
      esconder()
      carregar()
      onAlterado?.()
    } catch (err) {
      setErro(erroApi(err))
    }
  }

  async function apagar() {
    if (!confirm('Apagar o acesso gov.br deste cliente?')) return
    await apagarGov(clienteId)
    esconder()
    carregar()
    onAlterado?.()
  }

  if (!info) return null

  return (
    <Secao titulo={<span className="flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-gold-400" /> Acesso gov.br</span>}>
      {!info.pode_acessar ? (
        <p className="text-sm text-navy-400">
          {info.existe ? 'Cadastrado. ' : 'Não cadastrado. '}
          Acesso restrito ao responsável pelos acordos.
        </p>
      ) : !info.cofre_ativo ? (
        <p className="text-sm text-amber-300">Cofre desativado: falta configurar a variável APP_CHAVE_COFRE no Railway.</p>
      ) : (
        <div className="space-y-3">
          {info.existe && !editando && (
            <>
              <p className="text-[11px] text-navy-500">
                Cadastrado/alterado por <b className="text-navy-400">{info.atualizado_por}</b> em {dataHoraBR(info.atualizado_em)}.
                Cada visualização fica registrada no histórico.
              </p>
              {dados ? (
                <div className="rounded-lg border border-gold-500/30 bg-gold-500/5 p-3 space-y-1 text-sm">
                  <LinhaSecreta rotulo="Login (CPF)" valor={dados.login} />
                  <LinhaSecreta rotulo="Senha" valor={dados.senha} />
                  {dados.observacoes && <p className="text-navy-300 text-xs whitespace-pre-wrap">{dados.observacoes}</p>}
                  <p className="text-[11px] text-navy-500">Oculta automaticamente em {restante}s.</p>
                </div>
              ) : null}
              <div className="flex gap-2 flex-wrap">
                {dados ? (
                  <button type="button" onClick={esconder} className="btn-secondary text-xs py-1.5"><EyeOff className="w-3.5 h-3.5" /> Ocultar</button>
                ) : (
                  <button type="button" onClick={revelar} className="btn-primary text-xs py-1.5"><Eye className="w-3.5 h-3.5" /> Ver acesso</button>
                )}
                <button type="button" onClick={() => setEditando(true)} className="btn-secondary text-xs py-1.5">Alterar</button>
                <button type="button" onClick={apagar} className="btn-secondary text-xs py-1.5 text-red-400"><Trash2 className="w-3.5 h-3.5" /> Apagar</button>
              </div>
            </>
          )}
          {(!info.existe || editando) && (
            <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Campo label="Login gov.br (CPF)" obrigatorio>
                <input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} className="input-field w-full" autoComplete="off" required />
              </Campo>
              <Campo label="Senha gov.br" obrigatorio>
                <input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} className="input-field w-full" autoComplete="new-password" required />
              </Campo>
              <Campo label="Observações (ex.: código chega no celular do cliente)" className="md:col-span-2">
                <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="input-field w-full" autoComplete="off" />
              </Campo>
              <div className="md:col-span-2 flex justify-end gap-2">
                {editando && <button type="button" onClick={() => setEditando(false)} className="btn-secondary text-xs py-1.5">Cancelar</button>}
                <button type="submit" className="btn-primary text-xs py-1.5"><Save className="w-3.5 h-3.5" /> Guardar no cofre</button>
              </div>
            </form>
          )}
        </div>
      )}
      {erro && <p className="text-red-400 text-sm mt-2">{erro}</p>}
    </Secao>
  )
}

function LinhaSecreta({ rotulo, valor }) {
  return (
    <p className="flex items-center gap-2">
      <span className="text-navy-400 text-xs w-24">{rotulo}</span>
      <span className="font-mono text-white">{valor}</span>
      <button type="button" onClick={() => navigator.clipboard.writeText(valor)} className="p-1 hover:bg-navy-700 rounded" title="Copiar">
        <Copy className="w-3.5 h-3.5 text-navy-400" />
      </button>
    </p>
  )
}
