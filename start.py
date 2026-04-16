import os
import sys
import subprocess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Lê a porta — tenta variáveis conhecidas do Railway
port = None
for var in ["PORT", "RAILWAY_PORT", "HTTP_PORT"]:
    val = os.environ.get(var, "")
    if val.isdigit():
        port = int(val)
        break

if port is None:
    port = 8000

print(f"[START] PORT={port}", flush=True)
print(f"[START] ENV vars: { {k:v for k,v in os.environ.items() if 'PORT' in k} }", flush=True)

import uvicorn
uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info")
