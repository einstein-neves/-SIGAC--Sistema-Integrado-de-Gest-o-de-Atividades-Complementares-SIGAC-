# Plano de Testes da Entrega 1

## Testes automatizados basicos

Execute:

```bash
npm test
```

Status esperado: comando finaliza com sucesso e valida estrutura, PWA, `.gitignore`, `.env.example`, sintaxe JS, documentacao, empacotamento e smoke test de API em modo seguro.

Para validar rotas reais com servidor ligado:

```powershell
$env:SIGAC_TEST_BASE_URL="http://127.0.0.1:3000"
npm test
```

Para incluir rotas autenticadas opcionais:

```powershell
$env:SIGAC_TEST_ADMIN_EMAIL="admin@example.com"
$env:SIGAC_TEST_ADMIN_PASSWORD="senha_do_admin"
npm test
```

## Roteiro manual detalhado

| ID | Cenario | Perfil | Pre-condicao | Passos | Resultado esperado | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | Login Super Admin | Super Admin | Usuario ativo no banco | Acessar login, escolher Super Admin, informar e-mail/senha e entrar | Redireciona para `adminsigac.html` e carrega dashboard | Aprovado |
| T02 | Login Coordenador | Coordenador | Coordenador ativo e vinculado a curso | Acessar login, escolher Coordenador, informar credenciais e entrar | Redireciona para `coordenador.html` sem logout imediato | Aprovado |
| T03 | Login Aluno web | Aluno | Aluno ativo e vinculado a curso | Acessar login, escolher Aluno, informar credenciais e entrar | Redireciona para `index.html` e mostra progresso | Aprovado |
| T04 | Cadastro de curso | Super Admin | Login Super Admin | Abrir Cursos, preencher dados e salvar | Curso aparece na listagem e fica disponivel para vinculos | Aprovado |
| T05 | Cadastro de coordenador | Super Admin | Curso cadastrado | Abrir Usuarios, criar Coordenador e selecionar curso(s) | Coordenador criado com senha hash e vinculo registrado | Aprovado |
| T06 | Associacao coordenador-curso | Super Admin | Coordenador e curso existentes | Atualizar cursos vinculados do coordenador | Coordenador passa a ver apenas cursos vinculados | Aprovado |
| T07 | Cadastro de aluno | Coordenador | Coordenador vinculado ao curso | Abrir Alunos, preencher nome, e-mail, senha e curso | Aluno criado no curso do coordenador | Aprovado |
| T08 | Associacao aluno-curso | Super Admin | Aluno e curso existentes | Vincular aluno a curso no painel Admin | Aluno recebe notificacao e curso passa a aparecer para ele | Aprovado |
| T09 | Criacao de regra de atividade | Coordenador ou Super Admin | Curso existente | Preencher categoria, limite, carga minima e salvar | Regra aparece na listagem do curso | Aprovado |
| T10 | Envio de certificado | Aluno web | Arquivo PDF/imagem valido | Abrir Certificados, preencher carga/observacao e enviar | Certificado entra como pendente para revisao | Aprovado |
| T11 | OCR opcional | Coordenador ou Super Admin | Certificado pendente e internet disponivel | Clicar em Processar OCR | Resumo profissional aparece; decisao final permanece humana | Aprovado com dependencia de internet |
| T12 | Falha segura do OCR | Coordenador ou Super Admin | Simular CDN indisponivel/offline | Clicar em Processar OCR | Mensagem amigavel aparece e o envio manual continua possivel | Aprovado |
| T13 | Envio de atividade | Aluno web | Atividade cadastrada | Preencher categoria, carga horaria, descricao, anexo e enviar | Submissao entra em analise e coordenador recebe notificacao | Aprovado |
| T14 | Aprovacao | Coordenador | Submissao pendente de curso vinculado | Abrir Envios de atividades, informar feedback e aprovar | Status aprovado, dashboard, log, notificacao e e-mail registrados | Aprovado |
| T15 | Reprovacao | Coordenador | Submissao pendente de curso vinculado | Abrir Envios de atividades, informar feedback e reprovar | Status rejeitado, dashboard, log, notificacao e e-mail registrados | Aprovado |
| T16 | Dashboard Admin | Super Admin | Dados cadastrados | Abrir Dashboard/Admin | Cards, tabelas e graficos carregam sem quebrar | Aprovado |
| T17 | Dashboard Coordenador | Coordenador | Curso vinculado com dados | Abrir Dashboard/Coordenador | Painel carrega dados apenas dos cursos vinculados | Aprovado |
| T18 | Logs | Super Admin | Acoes executadas | Abrir auditoria/logs | Acoes relevantes aparecem com ator, entidade e data | Aprovado |
| T19 | Notificacoes | Todos | Eventos executados | Abrir area de notificacoes | Mensagens objetivas aparecem para o perfil correto | Aprovado |
| T20 | E-mail mock | Super Admin | `EMAIL_MODE=mock` | Executar evento que gere e-mail e abrir fila | E-mail fica registrado como `simulado (fila local)` | Aprovado |
| T21 | E-mail SMTP | Super Admin | `EMAIL_MODE=smtp` e SMTP configurado no `.env` | Executar evento que gere e-mail | Envio real e tentado; falha fica registrada sem quebrar o fluxo | Opcional |
| T22 | Acesso indevido bloqueado | Coordenador/Aluno | Token valido de outro perfil | Tentar abrir rota ou dado fora do perfil/curso | API retorna 403 e frontend mostra mensagem segura | Aprovado |
| T23 | API indisponivel | Qualquer perfil | Parar backend com tela aberta | Tentar carregar dados dinamicos | Interface mostra mensagem de API indisponivel e nao trava | Aprovado |
| T24 | Modo offline/PWA | Qualquer perfil | PWA carregado previamente | Simular offline no navegador | Assets estaticos continuam; dados `/api` nao sao cacheados | Aprovado |
| T25 | Pacote limpo | Operador | Projeto pronto | Rodar `preparar-envio.bat` e inspecionar ZIP | ZIP nao contem `.env`, `.git`, `node_modules`, `data`, `exports`, `.sixth`, logs ou banco local | Aprovado |

## Fluxo completo da Entrega 1

1. Login como Super Admin.
2. Cadastro de curso.
3. Cadastro de coordenador.
4. Associacao do coordenador ao curso.
5. Cadastro de aluno.
6. Associacao do aluno ao curso.
7. Login do aluno web.
8. Envio de atividade com certificado/comprovante.
9. Uso opcional de OCR.
10. Login do coordenador.
11. Visualizacao da submissao.
12. Aprovacao ou reprovacao.
13. Atualizacao do dashboard.
14. Registro de log.
15. Registro de notificacao/e-mail mock ou SMTP se configurado.
