# Entrega 1

## O que esta pronto

- Aplicacao web/PWA instalavel.
- Backend unico com Node.js.
- Banco PostgreSQL.
- Autenticacao por perfil.
- Gestao de cursos, coordenadores, alunos e vinculos.
- Regras por curso.
- Submissao de atividades.
- Avaliacao de envios e certificados.
- OCR opcional de apoio.
- Dashboards por perfil.
- Notificacoes, logs, e-mails mock e SMTP opcional.
- Documentacao academica.
- Protecao de `.env` para Git/GitHub.
- Script `preparar-envio.bat` para gerar `SIGAC-envio.zip` limpo.

## Implementado

- PWA instalavel com manifesto, service worker e icones.
- Backend/API unico com PostgreSQL.
- Controle de acesso por Super Admin, Coordenador e Aluno.
- Dashboards, envios, certificados, regras, logs e notificacoes.
- Chart.js servido localmente para dashboards.
- E-mail mock por padrao e envio real opcional por SMTP/Nodemailer quando configurado no `.env`.

## Simulado

- Nesta versao, o sistema registra e-mails em uma fila simulada, preparada para integracao futura com SMTP/Nodemailer/SendGrid/Resend.

## Opcional

- Envio real por SMTP/Nodemailer: ativado somente com `EMAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT` e `SMTP_FROM` no `.env` real.
- OCR: atua como apoio, depende de Tesseract.js/PDF.js via CDN e nao substitui a revisao humana.

## Planejado para proxima etapa

- Aplicativo React Native/mobile.
- Definicao de provedor SMTP oficial da equipe/instituicao.
- Testes automatizados de integracao com banco isolado.

## Como demonstrar

1. Iniciar com `npm start`.
2. Abrir `http://localhost:3000/loginsigac.html`.
3. Mostrar login por perfil.
4. Demonstrar cadastro e vinculos no Super Admin.
5. Demonstrar cadastro de aluno e atividades no Coordenador.
6. Demonstrar envio de atividade/certificado no Aluno.
7. Demonstrar aprovacao/reprovacao no Coordenador.
8. Mostrar dashboards atualizados.
9. Mostrar logs, notificacoes e e-mails simulados.
10. Mostrar instalacao PWA.

## Limitacoes conhecidas

- OCR nao substitui validacao humana.
- OCR depende de internet para carregar Tesseract.js/PDF.js nesta versao.
- E-mail SMTP real depende de configuracao externa e credenciais locais no `.env`.
- Testes automatizados de fluxo completo ainda dependem de banco de teste dedicado.
- Aplicativo mobile React Native sera construido em etapa futura.

## Proximos passos

- Criar banco de teste e testes de integracao.
- Definir provedor de e-mail.
- Construir app mobile React Native.
- Ampliar relatorios gerenciais.
