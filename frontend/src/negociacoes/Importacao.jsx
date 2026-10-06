import { useState } from 'react'
import { Upload, CheckCircle2 } from 'lucide-react'
import { previaImportacao, confirmarImportacao } from '../api'
import { Modal, Secao, erroApi } from './comum'

const ROTULOS = {
  novo: { texto: 'Cliente novo', cor: 'text-emerald-300' },
  ja_cadastrado: { texto: 'Já cadastrado (só completa campos vazios)', cor: 'text-blue-300' },
  mesmo_cliente_de_outra_linha: { texto: 'Mesmo cliente de outra linha', cor: 'text-navy-300' },
  excluido: { texto: 'Excluído pelo nicho', cor: 'text-navy-500' },
}

export default function Importacao({ onFechar, onImportado }) {
  const [arquivo, setArquivo] = useState(null)
  const [excluidos, setExcluidos] = useState(['GPX'])
  const [previa, setPrevia] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function gerarPrevia(arq = arquivo, exc = excluidos) {
    if (!arq) return
    setCarregando(true)
    setErro('')
    try {
      const r = await previaImportacao(arq, exc)
      setPrevia(r.data)
    } catch (e) {
      setErro(erroApi(e))
    } finally {
      setCarregando(false)
    }
  }

  function alternarNicho(nicho) {
    const novo = excluidos.includes(nicho) ? excluidos.filter((n) => n !== nicho) : [...excluidos, nicho]
    setExcluidos(novo)
    gerarPrevia(arquivo, novo)
  }

  async function confirmar() {
    setCarregando(true)
    setErro('')
    try {
      const r = await confirmarImportacao(arquivo, excluidos)
      setResultado(r.data)
      onImportado()
    } catch (e) {
      setErro(erroApi(e))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Modal titulo="Importar clientes de planilha" subtitulo="Nada é gravado antes da confirmação. Reimportar a mesma planilha não duplica." onFechar={onFechar} largura="max-w-5xl">
      <div className="space-y-5">
        {resultado ? (
          <div className="card p-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-white font-semibold">Importação concluída</p>
            <p className="text-navy-300 text-sm">
              {resultado.clientes_criados} clientes cadastrados · {resultado.clientes_completados} cadastros completados ·{' '}
              {resultado.negociacoes_criadas} negociações abertas
            </p>
            <button onClick={onFechar} className="btn-primary mx-auto mt-3">Fechar</button>
          </div>
        ) : (
          <>
            <label className="card p-5 flex items-center gap-4 cursor-pointer hover:border-gold-500/40">
              <Upload className="w-6 h-6 text-gold-400" />
              <span className="text-sm text-navy-200">{arquivo ? arquivo.name : 'Escolher planilha .xlsx (contratos fechados, índice de clientes, exportação do Advbox)'}</span>
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => { const f = e.target.files[0]; setArquivo(f); setPrevia(null); gerarPrevia(f, excluidos) }}
              />
            </label>

            {carregando && <p className="text-navy-400 text-sm">Processando...</p>}
            {erro && <p className="text-red-400 text-sm">{erro}</p>}

            {previa && (
              <>
                <Secao titulo="Nichos fora das negociações (clique para alternar)">
                  <div className="flex flex-wrap gap-2">
                    {previa.nichos.map((n) => (
                      <button
                        key={n}
                        onClick={() => alternarNicho(n)}
                        className={`text-xs px-3 py-1 rounded-full border ${excluidos.includes(n) ? 'bg-red-500/20 border-red-500/40 text-red-300 line-through' : 'border-navy-600 text-navy-200'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </Secao>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(ROTULOS).map(([k, r]) => (
                    <div key={k} className="card p-3">
                      <p className="text-[11px] text-navy-400">{r.texto}</p>
                      <p className={`text-2xl font-bold ${r.cor}`}>{previa.resumo[k] || 0}</p>
                    </div>
                  ))}
                </div>

                <div className="card overflow-hidden max-h-[45vh] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-navy-900/70 sticky top-0">
                      <tr className="text-left text-navy-400 uppercase tracking-wider">
                        <th className="px-3 py-2">Aba / linha</th>
                        <th className="px-3 py-2">Nome na planilha</th>
                        <th className="px-3 py-2">Nicho</th>
                        <th className="px-3 py-2">Resultado</th>
                        <th className="px-3 py-2">Atenção</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-700/50">
                      {previa.itens.map((i) => (
                        <tr key={`${i.aba}-${i.linha}`} className={i.situacao === 'excluido' ? 'opacity-50' : ''}>
                          <td className="px-3 py-2 text-navy-400 whitespace-nowrap">{i.aba} · {i.linha}</td>
                          <td className="px-3 py-2 text-white">{i.nome}</td>
                          <td className="px-3 py-2 text-navy-300">{i.nicho}</td>
                          <td className={`px-3 py-2 ${ROTULOS[i.situacao]?.cor}`}>
                            {ROTULOS[i.situacao]?.texto}{i.cliente_existente && ` → ${i.cliente_existente}`}
                          </td>
                          <td className="px-3 py-2 text-amber-300">{i.avisos.join(' · ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <button onClick={confirmar} disabled={carregando} className="btn-primary disabled:opacity-50">
                    Confirmar importação
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
