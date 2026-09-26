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

## Deploy na web — Render.com (GRATUITO)

### Passo 1 — Subir para o GitHub
```bash
cd juridico-dashboard
git init
git add .
git commit -m "Sistema de gestão processual"
# Crie um repositório no github.com (pode ser privado) e siga as instruções
git remote add origin https://github.com/SEU_USUARIO/juridico-dashboard.git
git push -u origin main
```

### Passo 2 — Criar conta no Render
1. Acesse https://render.com e crie uma conta gratuita
2. Clique em **"New +"** → **"Blueprint"**
3. Conecte seu repositório GitHub
4. O Render vai ler o arquivo `render.yaml` e configurar tudo automaticamente

### Passo 3 — Configurar variáveis de ambiente
No painel do Render, no serviço **juridico-backend**, vá em **Environment** e adicione:
- `DATAJUD_API_KEY` = sua chave da API DataJud

### Passo 4 — Acesso
Após o deploy (~3 min), o Render fornecerá uma URL pública para o seu dashboard.

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
Atualize no arquivo `backend/.env` (local) ou nas variáveis do Render (web).
