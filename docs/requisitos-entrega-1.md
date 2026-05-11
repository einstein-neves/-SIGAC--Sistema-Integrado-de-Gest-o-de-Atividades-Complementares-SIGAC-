# Requisitos da Entrega 1

## Requisitos funcionais

- Autenticar usuarios por perfil.
- Permitir gestao global ao Super Admin.
- Permitir cadastro de cursos.
- Permitir cadastro de coordenadores.
- Vincular coordenadores a um ou mais cursos.
- Permitir cadastro de alunos por coordenadores.
- Vincular alunos aos cursos.
- Definir regras de atividades complementares por curso.
- Controlar limites de carga horaria por categoria.
- Receber envios de atividades com comprovantes.
- Permitir aprovacao ou reprovacao pelo coordenador.
- Permitir upload e avaliacao de certificados.
- Executar OCR opcional para apoio na leitura dos certificados.
- Exibir dashboards por perfil.
- Registrar notificacoes internas.
- Registrar logs de auditoria.
- Manter fila local de e-mails simulados.
- Permitir envio real opcional de e-mail quando SMTP estiver configurado.

## Requisitos nao funcionais

- Aplicacao instalavel como PWA.
- Backend unico com API HTTP.
- Banco PostgreSQL.
- Controle de acesso por perfil.
- Protecao de dados sensiveis via `.env`.
- Mensagens de erro compreensiveis.
- Interface responsiva.
- Hash seguro para senhas.
- Cache estatico sem quebrar chamadas dinamicas da API.
- Service worker sem cache de respostas privadas ou autenticadas.

## Requisitos atendidos

- PWA configurado com manifesto, service worker e icones.
- Rotas sensiveis protegidas por perfil.
- Coordenadores acessam dados dos cursos vinculados.
- Alunos acessam seus proprios dados.
- Senhas usam hash com salt.
- Notificacoes, logs e e-mails simulados registrados.
- SMTP opcional por Nodemailer, mantendo mock como padrao seguro.
- Documentacao academica criada em `docs/`.

## Implementado

- Aplicacao web/PWA.
- API e backend unico.
- Persistencia em PostgreSQL.
- Hash seguro de senhas.
- Controle de acesso por perfil e por vinculo de curso.
- Pacote limpo por `preparar-envio.bat`.

## Simulado

- Nesta versao, o sistema registra e-mails em uma fila simulada, preparada para integracao futura com SMTP/Nodemailer/SendGrid/Resend.

## Opcional

- Envio real por SMTP/Nodemailer, ativado somente por variaveis de ambiente locais.
- OCR de apoio por Tesseract.js/PDF.js via CDN; falha de OCR nao bloqueia envio ou revisao manual.

## Futuro

- Aplicativo React Native/mobile.
- Escolha de provedor SMTP oficial e politicas de entrega.
- Testes automatizados de fluxo completo com banco isolado.
