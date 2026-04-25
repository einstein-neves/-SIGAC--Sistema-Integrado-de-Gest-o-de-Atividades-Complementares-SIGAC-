SIGAC - pacote enxuto para envio

Conteudo:
- frontend HTML/CSS/JS
- backend Node.js
- package.json e package-lock.json para instalar dependencias
- configuracao atual em .env
- scripts auxiliares em scripts/
- exportacao dos dados em exports/

Como iniciar:
1. Abra a pasta do projeto.
2. Instale o Node.js se ainda nao tiver.
3. Execute no PowerShell: npm install
4. Execute no PowerShell: .\start-sigac.ps1
5. Acesse: http://localhost:3000

Observacoes:
- Este pacote esta configurado para usar o banco remoto definido em .env.
- Se voce compartilhar este pacote, estara compartilhando tambem o acesso ao banco configurado em DATABASE_URL.
- Se quiser enviar sem a credencial ativa, troque o .env por .env.example antes de compartilhar.
