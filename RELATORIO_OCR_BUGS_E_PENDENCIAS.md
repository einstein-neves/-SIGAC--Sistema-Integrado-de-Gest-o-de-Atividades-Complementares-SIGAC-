# SIGAC - Relatório de OCR, bugs e pendências

## O que foi preparado agora
- fila de certificados enviada por alunos e coordenadores para o admin
- nova seção **Certificados** no admin
- nova seção **Certificados** no aluno
- nova seção **Certificados** no coordenador
- módulo `js/ocr.js` separado do restante do sistema
- `js/data.js` com métodos isolados para certificados, já prontos para futura troca por API/banco
- pré-validação OCR com leitura de PDF/imagem, detecção de horas, nome, data e instituição
- decisão final continua manual com o admin
- horas de certificados aprovados passam a contar no progresso do aluno

## O que já existia e continua funcionando
- login por perfil
- cadastro de usuários e cursos
- vínculos entre cursos e usuários
- publicação de atividades
- envio e avaliação de atividades
- oportunidades e inscrições
- barra de horas do aluno

## Bugs e limitações ainda existentes
1. O projeto ainda mantém a lógica principal no `localStorage`, então não sincroniza entre máquinas diferentes.
2. O `server.js` e o banco SQLite existem, mas o front principal ainda não usa essa camada como fonte única.
3. O OCR usa heurística, então ele **não prova autenticidade real** do certificado; ele só faz pré-triagem.
4. PDF com várias páginas ainda usa principalmente a primeira página para pré-análise.
5. Certificados muito escaneados ou com foto ruim podem cair em análise manual.
6. Ainda há arquivos antigos/duplicados no projeto, como `reset.html` e `resetarsenha.html`.
7. A versão atual depende de internet para baixar `pdf.js` e `tesseract.js` via CDN.

## O que falta para produção/online real
- trocar `js/data.js` de `localStorage` para API
- salvar certificados no banco real
- criar endpoints de certificados no `server.js`
- guardar OCR e revisão final no banco
- hospedar backend e banco online
- criar autenticação centralizada no servidor

## Onde mexer quando o banco/API chegarem
- **principal arquivo de troca:** `js/data.js`
- o resto das telas já chama funções do `SIGACStore`, então a camada de dados ficou separada
- o módulo `js/ocr.js` pode continuar quase igual, só trocando o ponto em que salva o resultado
