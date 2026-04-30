# Arquitetura

## Frontend PWA

O frontend usa HTML, CSS e JavaScript modular em `js/`. As telas principais sao `loginsigac.html`, `adminsigac.html`, `coordenador.html` e `index.html`. O PWA e composto por `manifest.json`, `service-worker.js`, `js/pwa.js` e icones em `icons/`. Os graficos usam Chart.js servido localmente em `vendor/chart.umd.min.js`.

## Backend/API

O backend esta em `server.js`, usando HTTP nativo do Node.js. As rotas seguem o prefixo `/api/` para autenticacao, dashboards, cursos, usuarios, atividades, submissões, certificados, notificacoes, logs e configuracoes.

## Banco de dados

`db.js` configura PostgreSQL com `pg`, cria tabelas e indices. As principais tabelas sao `users`, `courses`, `coordinator_courses`, `student_courses`, `activity_rules`, `activities`, `submissions`, `submission_versions`, `certificates`, `notifications`, `emails`, `audit_logs`, `sessions` e `password_reset_tokens`.

## OCR

O OCR roda no navegador por `js/ocr.js`, usando PDF.js e Tesseract.js via CDN nesta versao. Ele extrai texto, identifica campos provaveis e salva uma pre-analise. O resultado e apoio, nao decisao final. Se a CDN falhar, o usuario recebe mensagem amigavel e a validacao manual permanece disponivel.

## Notificacoes e e-mails

Notificacoes internas ficam em `notifications`. Nesta versao, o sistema registra e-mails em uma fila simulada, preparada para integracao futura com SMTP/Nodemailer/SendGrid/Resend.

O envio real e opcional: quando `EMAIL_MODE=smtp` e as variaveis `SMTP_HOST`, `SMTP_PORT` e `SMTP_FROM` estao configuradas no `.env`, o backend tenta enviar via Nodemailer. Se SMTP nao estiver configurado ou falhar, a fila local continua sendo gravada e o fluxo da aplicacao nao quebra.

Eventos com notificacao/e-mail: nova submissao, aprovacao, reprovacao, certificado enviado, mudancas de vinculo, criacao de usuario/curso/regra/oportunidade e alteracoes globais feitas pelo Super Admin.

## Logs

Acoes relevantes sao registradas em `audit_logs`, incluindo criacao de usuario, curso, regra, envio, avaliacao, processamento OCR, configuracoes e eventos de seguranca.
