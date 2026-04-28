# SIGAC

Sistema Integrado de Gestao de Atividades Complementares.

## Como rodar o projeto

1. Instale as dependencias:

   ```bash
   npm install
   ```

2. Copie o arquivo de ambiente:

   ```bash
   cp .env.example .env
   ```

   No Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Preencha o `.env` com suas credenciais locais.

4. Rode o projeto:

   ```bash
   npm start
   ```

   Ou diretamente:

   ```bash
   node server.js
   ```

## Aviso de seguranca

Nunca envie o arquivo `.env` para o GitHub. Use apenas `.env.example` para documentar as variaveis necessarias.
