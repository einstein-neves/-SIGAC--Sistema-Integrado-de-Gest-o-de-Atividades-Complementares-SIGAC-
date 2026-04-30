SIGAC - pacote limpo para envio

Este projeto deve ser enviado sem credenciais reais e sem arquivos gerados localmente.

Conteudo esperado no pacote:
- Codigo fonte HTML, CSS, JavaScript e Node.js.
- package.json e package-lock.json.
- manifest.json, service-worker.js, icones PWA e assets publicos.
- README.md e pasta docs/.
- .env.example com variaveis ficticias.
- scripts de validacao e teste.

O pacote NAO deve conter:
- .env
- .git/
- node_modules/
- data/
- exports/
- .sixth/
- logs
- banco local
- tokens, sessoes ou credenciais reais

Como preparar:
1. Execute preparar-envio.bat.
2. O arquivo SIGAC-envio.zip sera gerado na raiz.
3. Antes de enviar, confira se o ZIP nao contem arquivos sensiveis.

Como rodar em outra maquina:
1. Extraia o ZIP.
2. Execute npm install.
3. Copie .env.example para .env.
4. Preencha DATABASE_URL, PORT e SESSION_SECRET.
5. Para e-mail, mantenha EMAIL_MODE=mock ou configure EMAIL_MODE=smtp com SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS e SMTP_FROM.
6. Execute npm start.
7. Acesse http://localhost:3000/.

Como testar:
- npm test
- Com servidor ligado: defina SIGAC_TEST_BASE_URL=http://127.0.0.1:3000 e rode npm test.

Nesta versao, o sistema registra e-mails em uma fila simulada, preparada para integracao futura com SMTP/Nodemailer/SendGrid/Resend.
O SMTP real e opcional e so deve ser ativado com credenciais locais no .env real.
O OCR e opcional; se Tesseract.js/PDF.js por CDN falharem, a validacao manual continua disponivel.
