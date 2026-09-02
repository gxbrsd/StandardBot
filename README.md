# StandardBot

StandardBot é um bot modular para Discord escrito em **TypeScript** com **discord.js v14**. O projeto reúne moderação, tickets, snapshots de servidor, regras configuráveis e mensagens automáticas de boas-vindas em uma base única, sem depender de banco de dados externo.

O repositório foi preparado para ser público: tokens, IDs reais, dados de servidores, histórico de moderação, modelos pessoais e imagens locais não fazem parte do código versionado.

## Recursos

- **Tickets privados** com painel, equipe de suporte, assumir/fechar atendimento e usuários adicionais.
- **Moderação** com ban, ban por ID, unban, kick, timeout, remoção de timeout, advertências e logs.
- **Ferramentas de canal** com limpar mensagens, lock, unlock e nuke protegido.
- **Modelos de servidor** para salvar e restaurar estrutura, cargos e permissões.
- **Regras configuráveis** por modal: título, conteúdo, footer, cor HEX e imagem por URL.
- **Boas-vindas automáticas** em texto ou embed, com variáveis dinâmicas.
- **Central de ajuda** integrada ao Discord.
- **Autorização por permissões nativas do Discord**, sem depender do nome de cargos.

## Stack

- Node.js
- TypeScript
- discord.js 14
- tsx
- dotenv
- armazenamento local em JSON criado em tempo de execução

## Requisitos

- **Node.js 20+** recomendado.
- Uma aplicação criada no [Discord Developer Portal](https://discord.com/developers/applications).
- O bot adicionado a um servidor onde você possa configurá-lo.

## Instalação rápida

```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd StandardBot
npm install
```

Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Preencha:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
DEV_GUILD_ID=your_development_server_id_here
```

> `DEV_GUILD_ID` só é obrigatório para deploy de desenvolvimento. O deploy global usa apenas `DISCORD_TOKEN` e `CLIENT_ID`.

## Discord Developer Portal

Em **Bot → Privileged Gateway Intents**, ative:

- **SERVER MEMBERS INTENT**

O projeto não precisa de `MESSAGE CONTENT INTENT` nem `PRESENCE INTENT` para os recursos atuais.

O cliente utiliza:

```ts
GatewayIntentBits.Guilds
GatewayIntentBits.GuildMembers
```

Veja a configuração completa em [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Registrar slash commands

Para registrar rapidamente em um servidor de desenvolvimento:

```bash
npm run deploy
```

Para registrar globalmente:

```bash
npm run deploy:global
```

Também funciona:

```bash
npm run deploy -- --global
```

## Executar

Desenvolvimento com reload automático:

```bash
npm run dev
```

Execução direta:

```bash
npm start
```

Validação do TypeScript:

```bash
npm run typecheck
```

## Variáveis das boas-vindas

O sistema substitui automaticamente:

| Variável | Resultado |
| --- | --- |
| `{usuario}` | menção do novo membro |
| `{nome}` | nome exibido no servidor |
| `{servidor}` | nome do servidor |
| `{membros}` | número atual de membros |

## Comandos

Os grupos principais são:

- `/ajuda`
- `/setup`
- `/mensagens`
- `/regras`
- `/ticket`
- `/modelo`
- `/moderacao`
- `/banir`
- `/banir-id`
- `/desbanir`
- `/expulsar`
- `/mutar`
- `/desmutar`
- `/aviso`
- `/limpar`
- `/lock`
- `/unlock`
- `/nuke`

A referência detalhada está em [docs/COMMANDS.md](docs/COMMANDS.md).

## Permissões

A autorização é centralizada e usa permissões nativas do Discord. Exemplos:

- `/ajuda` → qualquer usuário.
- `/modelo restaurar` → proprietário do servidor.
- `/mensagens`, `/regras`, `/ticket`, `/moderacao` → Administrador.
- banimentos → Banir membros.
- expulsão → Expulsar membros.
- timeout e advertências → Moderar membros.
- limpar → Gerenciar mensagens.
- lock/unlock/nuke → Gerenciar canais.

Veja a matriz completa em [docs/PERMISSIONS.md](docs/PERMISSIONS.md).

## Dados locais e privacidade

StandardBot cria a pasta `data/` automaticamente conforme os recursos são utilizados. Ela pode conter:

- IDs de servidores e usuários;
- configurações de tickets;
- tickets ativos;
- histórico de moderação;
- configurações de mensagens;
- modelos de servidor.

Por isso `data/` está no `.gitignore` e **não deve ser publicado**. Consulte [DATA.md](DATA.md).

O arquivo `.env` também está ignorado. Nunca faça commit do token do bot.

## Imagens

A versão pública não depende de imagens locais. O editor de regras aceita uma imagem opcional por URL. Isso mantém o repositório neutro e evita incluir assets pessoais.

## Estrutura

```text
StandardBot/
├── src/
│   ├── commands/          # slash commands
│   ├── embeds/            # builders visuais
│   ├── interactions/      # botões e outras interações
│   ├── modelos/           # tipos do sistema de modelos
│   ├── moderacao/         # tipos de moderação
│   ├── services/          # regras de negócio, stores e resolvers
│   ├── tickets/           # tipos de tickets
│   ├── deploy-commands.ts
│   └── index.ts
├── docs/
├── .env.example
├── .gitignore
├── DATA.md
├── LICENSE
├── package.json
└── tsconfig.json
```

Mais detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Segurança

- Nunca publique `.env`.
- Nunca publique a pasta `data/` de uma instância real.
- Antes de abrir issues com logs, remova tokens, IDs e informações privadas.
- Se um token for exposto publicamente, regenere-o imediatamente no Discord Developer Portal.

Veja [SECURITY.md](SECURITY.md).

## Contribuindo

Pull requests são bem-vindos. Antes de enviar uma alteração:

```bash
npm install
npm run typecheck
```

Consulte [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

Distribuído sob a licença MIT. Veja [LICENSE](LICENSE).
