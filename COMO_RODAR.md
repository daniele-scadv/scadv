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

### 2. Logins da equipe (sem isso o sistema fica bloqueado)
No serviço do sistema → **Variables**:
- `APP_USUARIOS` = um login por pessoa, separados por ponto e vírgula:
  `daniele:SenhaForte1;ana:SenhaForte2;bruno:SenhaForte3`
  O nome antes dos dois-pontos é o que aparece em "Lançado por" e no histórico de cada cliente e negociação.
  Senhas fortes (mínimo 16 caracteres) e sem ponto e vírgula. Para tirar o acesso de alguém, apague o trecho da pessoa.
- `DATAJUD_API_KEY` = chave da API DataJud

O login único antigo (`APP_USUARIO` + `APP_SENHA`) continua funcionando, mas tudo que for lançado por ele aparece com o mesmo nome. Use um login por pessoa.

O navegador pedirá usuário e senha ao abrir o sistema. Após 10 tentativas erradas, o IP fica bloqueado por 15 minutos.
Para testes locais sem senha: `AUTH_DESABILITADA=1` no `.env` (nunca use no Railway).

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

### Negociações com bancos

| Ação | Como fazer |
|------|------------|
| Cadastrar cliente | Aba **Clientes** → "Novo cliente" (CPF/CNPJ é validado e não pode repetir) |
| Passar os dados ao banco | Abra o cliente ou a negociação → "Copiar qualificação" → cole no WhatsApp/e-mail |
| Abrir negociação | Aba **Negociações** → "Nova negociação" (1 negociação = 1 cliente × 1 banco × 1 contrato) |
| Registrar contato com o banco | Abra a negociação → "Registrar tentativa de acordo" (já atualiza etapa, última proposta e próxima ação) |
| Rotina diária | Aba **Negociações** abre filtrada em "Para hoje e atrasadas" |
| Métricas | Aba **Painel de Acordos**: calculado automaticamente pelos lançamentos |

Regras do sistema: toda negociação em andamento exige próxima ação com data; acordo fechado exige valor e data; encerramento sem acordo exige motivo.
Tentativas lançadas não são editadas nem apagadas: se houver erro, lance uma nova tentativa corrigindo.

---

## Renovar API Key do DataJud
Se a API Key parar de funcionar, gere uma nova em:
https://datajud-wiki.cnj.jus.br/
Atualize no arquivo `backend/.env` (local) ou nas variáveis do Railway (web).
