# Arquitetura

## Entrada da aplicação

`src/index.ts` cria o `Client`, registra eventos e direciona interações para o mapa de comandos.

Intents atuais:

- `Guilds`
- `GuildMembers`

Eventos principais:

- `ClientReady`
- `InteractionCreate`
- `GuildMemberAdd`
- `Error`

## Commands

`src/commands/` contém os builders e handlers de slash commands.

`src/commands/index.ts` exporta:

- a lista usada no deploy;
- o mapa usado em runtime;
- metadados opcionais como autocomplete.

## Permissões

`src/services/permissions.ts` concentra a matriz de autorização. Essa camada é consultada antes da execução dos slash commands e também antes de autocomplete sensível.

## Tickets

O sistema é separado em:

- `ticket-service.ts`: regras de negócio;
- `ticket-store.ts`: persistência local;
- `ticket-resolver.ts`: resolução/reparo de referências;
- `ticket-model-bridge.ts`: integração com restauração de modelos;
- `ticket-buttons.ts`: interações dos botões;
- `embeds/ticket.ts`: apresentação.

Referências de canais/cargos armazenam informações suficientes para tentar reparar IDs que mudaram após reconstruções do servidor.

## Modelos

`modelo-engine.ts` captura e restaura:

- estrutura de canais;
- cargos;
- permission overwrites.

`modelo-store.ts` mantém bibliotecas pessoais por usuário.

A restauração possui proteções para recursos Community e tickets ativos.

## Moderação

`moderation-service.ts` concentra ações e validações de hierarquia.

`moderation-store.ts` persiste configuração, advertências e estado necessário para operações como lock/unlock.

`moderation-resolver.ts` resolve referências de canais de logs.

## Mensagens

`message-config.ts` armazena por guild:

- boas-vindas;
- canal de boas-vindas;
- formato;
- template;
- embed das regras.

O evento `GuildMemberAdd` chama `sendWelcomeMessage()`.

## Persistência

O projeto usa JSON local e grava arquivos dentro de `data/` em runtime. A pasta é ignorada pelo Git para evitar exposição de dados reais de servidores.

Para uma implantação distribuída ou com múltiplas instâncias, substitua os stores locais por uma camada de banco de dados compartilhada.
