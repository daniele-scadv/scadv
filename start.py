import os
import sys

# Garante que o diretório atual está no path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

port = int(os.environ.get("PORT", 8000))
host = "0.0.0.0"

print(f"[START] Iniciando servidor em {host}:{port}", flush=True)
print(f"[START] Python: {sys.version}", flush=True)
print(f"[START] Diretório: {os.getcwd()}", flush=True)
print(f"[START] Arquivos: {os.listdir('.')}", flush=True)

import uvicorn
uvicorn.run("main:app", host=host, port=port, log_level="info")
