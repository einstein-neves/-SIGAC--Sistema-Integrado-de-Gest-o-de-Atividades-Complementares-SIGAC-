# Roteiro de Apresentacao da Entrega 1

## Problema

Instituicoes precisam acompanhar atividades complementares, certificados, cargas horarias e validacoes sem depender de planilhas soltas ou trocas manuais de mensagens.

## Solucao proposta

O SIGAC centraliza o fluxo academico em uma aplicacao web/PWA com perfis, regras por curso, submissões, validacao, dashboards, notificacoes e rastreabilidade.

## Tecnologias

- Frontend HTML, CSS e JavaScript.
- PWA com manifest, service worker e instalacao pelo navegador.
- Backend Node.js.
- Banco PostgreSQL.
- Chart.js local para dashboards.
- OCR de apoio com Tesseract.js/PDF.js via CDN.
- E-mail mock por padrao e SMTP opcional com Nodemailer.

## Perfis do sistema

- Super Admin: administra cursos, usuarios, regras, certificados, logs e configuracoes.
- Coordenador: gerencia alunos, atividades, envios e certificados dos cursos vinculados.
- Aluno: envia comprovantes, certificados e acompanha progresso.

## Demonstracao do fluxo

1. Entrar como Super Admin.
2. Cadastrar curso.
3. Cadastrar coordenador.
4. Associar coordenador ao curso.
5. Entrar como Coordenador.
6. Cadastrar aluno.
7. Entrar como Aluno.
8. Enviar atividade complementar com comprovante.
9. Enviar certificado.
10. Processar OCR opcional.
11. Voltar ao Coordenador.
12. Visualizar submissao.
13. Aprovar ou reprovar.
14. Mostrar dashboard atualizado.
15. Mostrar log, notificacao e e-mail mock; explicar que SMTP real e opcional via `.env`.

## OCR

O OCR e apresentado como apoio. Ele sugere campos encontrados, pendencias e carga horaria detectada, mas a decisao final continua sendo humana e baseada no formulario obrigatorio.

Se a CDN ou a internet falhar, o sistema exibe mensagem amigavel e permite continuar a validacao manual.

## Dashboards

Mostrar indicadores de pendencias, aprovados, rejeitados, alunos, certificados e progresso por perfil.

## PWA instalavel

Abrir DevTools > Application, conferir Manifest e Service Worker, e demonstrar a opcao de instalar o SIGAC pelo navegador.

## Seguranca

- `.env` fica fora do Git e do pacote.
- Senhas usam hash com salt.
- Coordenadores veem apenas cursos vinculados.
- Alunos veem apenas seus proprios dados.
- Super Admin tem visao global.
- Service worker nao cacheia respostas privadas da API.

## Logs

Mostrar auditoria para acoes relevantes: criacao de usuarios, vinculos, regras, envios, aprovacoes, reprovacoes e OCR.

## E-mails

Nesta versao, o sistema registra e-mails em uma fila simulada, preparada para integracao futura com SMTP/Nodemailer/SendGrid/Resend. O envio SMTP real ja esta preparado como opcional, mas depende de credenciais locais no `.env` e nao acompanha o pacote.

## Limitacoes conhecidas

- SMTP real depende de configuracao externa; por padrao, e-mails ficam em fila mock.
- OCR depende de internet para carregar bibliotecas externas nesta versao.
- Mobile React Native sera etapa futura.

## Proximos passos

- App mobile React Native.
- Integracao real de e-mail.
- Testes automatizados de integracao.
- Relatorios academicos mais detalhados.
