#!/bin/bash
set -e

echo "==> Instalando dependências do backend..."
pip install -r backend/requirements.txt

echo "==> Instalando dependências do frontend..."
cd frontend
npm install
npm run build
cd ..

echo "==> Copiando frontend para pasta static do backend..."
rm -rf backend/static
cp -r frontend/dist backend/static

echo "==> Build concluído!"
