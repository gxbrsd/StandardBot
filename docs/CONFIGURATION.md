# Configuração

## 1. Criar a aplicação

1. Abra o Discord Developer Portal.
2. Crie uma nova aplicação.
3. Em **Bot**, crie/configure o usuário bot.
4. Copie o token para `DISCORD_TOKEN` no `.env`.
5. Em **General Information**, copie o **Application ID** para `CLIENT_ID`.

Nunca envie o token para GitHub, logs públicos ou screenshots.

## 2. Gateway Intents

Em **Bot → Privileged Gateway Intents**, ative:

- **SERVER MEMBERS INTENT**

Esse intent é necessário para o evento `GuildMemberAdd`, usado pelas boas-vindas automáticas.

Não é necessário ativar:

- Presence Intent;
- Message Content Intent.

## 3. Arquivo `.env`

Use `.env.example` como base:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
DEV_GUILD_ID=your_development_server_id_here
```

### `DISCORD_TOKEN`

Token secreto do bot.

### `CLIENT_ID`

Application ID da aplicação Discord.

### `DEV_GUILD_ID`

ID de um servidor usado para desenvolvimento. Necessário apenas para:

```bash
npm run deploy
```

Não é necessário para:

```bash
npm run deploy:global
```

## 4. Instalar dependências

```bash
npm install
```

## 5. Registrar comandos

Servidor de desenvolvimento:

```bash
npm run deploy
```

Global:

```bash
npm run deploy:global
```

Comandos de guild costumam refletir alterações mais rapidamente e são recomendados durante desenvolvimento.

## 6. Executar

```bash
npm run dev
```

ou:

```bash
npm start
```

## 7. Permissões do bot

As permissões exatas dependem dos módulos utilizados. Para todos os recursos, o bot precisa conseguir executar ações como:

- visualizar canais;
- enviar mensagens;
- incorporar links;
- ler histórico de mensagens;
- gerenciar canais;
- gerenciar cargos;
- gerenciar mensagens;
- banir membros;
- expulsar membros;
- moderar membros;
- gerenciar servidor em operações do sistema de modelos.

Durante desenvolvimento, usar `Administrator` no bot simplifica testes. Em produção, prefira conceder somente as permissões necessárias aos módulos que serão utilizados.

## 8. Dados em runtime

A pasta `data/` é criada automaticamente. Ela não precisa existir no clone inicial e não deve ser commitada.

Consulte `DATA.md` para detalhes.
