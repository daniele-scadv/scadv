# Sistema de Gestão Processual — Dra. Daniele Cabral

## Rodando localmente (para testar antes do deploy)

### 1. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Mac/Linux
pip install -r requirements.txt
AUTH_DESABILITADA=1 uvicorn main:app --reload
```
O backend estará em http://localhost:8000

### 2. Frontend (em outro terminal)
```bash
cd frontend
npm install
npm run dev
```
O dashboard estará em http://localhost:5173

### 3. Primeira sincronização
Abra o dashboard e clique em **"Sincronizar"**. O sistema vai buscar seus processos em todos os tribunais (pode levar alguns minutos na primeira vez).

---

## Railway — configuração obrigatória

### 1. Banco de dados permanente (sem isso, anotações somem a cada deploy)
1. No projeto do Railway: **New** → **Database** → **Add PostgreSQL**
2. No serviço do sistema → **Variables** → **Add Reference** → escolha `DATABASE_URL` do Postgres
3. O sistema cria as tabelas sozinho no primeiro start. Clique em **Sincronizar** para trazer os processos.

### 2. Senha de acesso (sem isso o sistema fica bloqueado)
No serviço do sistema → **Variables**:
- `APP_USUARIO` = usuário de login (ex.: `santiagocabral`)
- `APP_SENHA` = senha forte (mínimo 16 caracteres, gerada em gerenciador de senhas)
- `DATAJUD_API_KEY` = chave da API DataJud

O navegador pedirá usuário e senha ao abrir o sistema. Após 10 tentativas erradas, o IP fica bloqueado por 15 minutos.
Para testes locais sem senha: `AUTH_DESABILITADA=1` no `.env` (nunca use no Railway).

---

## Alerta de movimentações por e-mail

O sistema sincroniza sozinho às **07:00 e 13:00** (horário de Roraima) e envia **um e-mail-resumo** com:
- processos que tiveram movimentação nova (ordenados por prioridade — urgentes no topo, com o "O que fazer" de cada um);
- processos novos em que a OAB passou a constar.

Processos marcados como ocultos não geram alerta. A primeira sincronização (banco vazio) não dispara e-mail.

### Variáveis no Railway

| Variável | Exemplo | Obrigatória |
|---|---|---|
| `ALERTA_EMAILS` | `daniele@santiagocabraladv.com, equipe@santiagocabraladv.com` | sim |
| `APP_URL` | link do sistema no Railway (vai no e-mail) | recomendado |
| `SINCRONIZAR_HORARIOS` | `07:00,13:00` (vazio desliga) | não |
| `FUSO_HORARIO` | `America/Boa_Vista` | não |

**Forma de envio — escolha uma:**

**A) Resend (recomendado)** — envio por API; funciona em qualquer plano do Railway.
1. Crie conta em https://resend.com, adicione o domínio `santiagocabraladv.com` e cadastre os registros DNS que ele mostrar.
2. Gere uma API Key.
3. No Railway: `RESEND_API_KEY` = a chave; `ALERTA_REMETENTE` = `Processos <alertas@santiagocabraladv.com>`.

**B) SMTP (Google Workspace)** — pode ser bloqueado pelo Railway dependendo do plano.
1. Na conta Google do remetente, ative a verificação em duas etapas e gere uma **senha de app**.
2. No Railway: `SMTP_HOST` = `smtp.gmail.com`, `SMTP_PORT` = `587`, `SMTP_USUARIO` = e-mail remetente, `SMTP_SENHA` = senha de app.

### Testar
Com o sistema logado, abra o console do navegador (F12) e rode:
`fetch('/api/alertas/teste', {method: 'POST'}).then(r => r.json()).then(console.log)`
Deve chegar um e-mail de teste. O resultado de cada sincronização aparece em `/api/status` (campo `alerta`).

---

## Estrutura do projeto

- `backend/` — **é o que o Railway publica** (Root Directory = `backend`). Contém a API, o login e o painel já compilado em `backend/static/`.
- `frontend/` — código-fonte do painel. Depois de alterar alguma tela, rode `npm run build` dentro de `frontend/`: o resultado vai direto para `backend/static/`. Faça commit dessa pasta junto.

---

## Como usar o sistema

| Ação | Como fazer |
|------|------------|
| Buscar processos | Clique em "Sincronizar" (1ª vez pode demorar ~5 min) |
| Ver detalhes | Clique em qualquer linha da tabela |
| Adicionar anotações | Abra o processo → campo "O que fazer" → Salvar |
| Definir prioridade | Abra o processo → selecione Urgente/Alta/Normal/Baixa |
| Filtrar | Use os filtros no topo da tabela |
| Exportar planilha | Botão "Exportar Excel" no cabeçalho |

---

## Renovar API Key do DataJud
Se a API Key parar de funcionar, gere uma nova em:
https://datajud-wiki.cnj.jus.br/
Atualize no arquivo `backend/.env` (local) ou nas variáveis do Railway (web).
