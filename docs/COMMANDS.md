# Referência de comandos

> A disponibilidade real de cada comando depende da permissão do usuário no servidor. O sistema de autorização é descrito em `PERMISSIONS.md`.

## Ajuda

### `/ajuda`

Central de ajuda integrada.

Opções:

- `categoria`
- `comando`

## Setup

### `/setup cargo`

Registra uma referência de cargo administrativo na configuração da guild para compatibilidade com a configuração histórica do projeto.

A autorização efetiva dos comandos atuais é baseada nas permissões nativas descritas em `PERMISSIONS.md`.

## Mensagens

### `/mensagens boas-vindas configurar`

Configura canal e formato (`text` ou `embed`) e abre um modal para editar a mensagem.

### `/mensagens boas-vindas testar`

Envia a configuração atual usando o autor do comando como membro de teste.

### `/mensagens boas-vindas status`

Mostra a configuração salva.

### `/mensagens boas-vindas desativar`

Interrompe o envio automático sem apagar a configuração.

### `/mensagens regras editar`

Abre um modal para editar:

- título;
- conteúdo;
- footer;
- cor HEX;
- imagem por URL.

### `/mensagens regras status`

Mostra a configuração atual do embed de regras.

## Regras

### `/regras publicar canal:<canal>`

Publica a mensagem oficial de regras e a fixa no canal.

### `/regras atualizar`

Atualiza a mensagem já registrada sem criar outra.

## Tickets

### `/ticket configurar`

Configura o sistema de tickets e o cargo responsável pelo suporte.

### `/ticket painel`

Publica/atualiza o painel de abertura de tickets.

### `/ticket status`

Exibe o estado atual do sistema.

### `/ticket sincronizar`

Repara/sincroniza referências do sistema após alterações na estrutura do servidor.

### `/ticket adicionar`

Adiciona um usuário a um ticket.

### `/ticket remover`

Remove um usuário adicional de um ticket.

### `/ticket abrir`

Abertura administrativa de ticket.

### `/ticket fechar`

Fechamento administrativo de ticket.

Usuários comuns normalmente abrem tickets pelo botão do painel, não pelo slash command.

## Modelos

### `/modelo salvar`

Salva um snapshot. O conteúdo pode incluir estrutura, cargos, permissões ou combinações desses módulos.

### `/modelo listar`

Lista os modelos do usuário.

### `/modelo detalhes`

Mostra detalhes de um modelo salvo.

### `/modelo restaurar`

Restaura um modelo no servidor. É uma operação crítica e reservada ao proprietário.

### `/modelo excluir`

Exclui um modelo salvo.

### `/modelo limpar-backups`

Remove backups automáticos da biblioteca do usuário.

## Configuração de moderação

### `/moderacao configurar`

Define o canal de logs.

### `/moderacao status`

Exibe a configuração atual.

### `/moderacao desvincular`

Remove a referência ao canal de logs.

## Banimentos

### `/banir`

Bane um membro presente no servidor.

### `/banir-id`

Bane pelo ID, inclusive quando o usuário já saiu.

### `/desbanir`

Remove um banimento e possui autocomplete para usuários banidos.

## Expulsão

### `/expulsar`

Expulsa um membro sem bani-lo.

## Timeout

### `/mutar`

Aplica timeout. Exemplos de duração:

- `30s`
- `10m`
- `2h`
- `1d`
- `1w`
- `1d12h`

O limite do Discord para timeout é 28 dias.

### `/desmutar`

Remove timeout ativo.

## Advertências

### `/aviso adicionar`

Registra uma advertência persistente.

### `/aviso listar`

Lista advertências de um usuário.

### `/aviso remover`

Remove uma advertência pelo ID.

## Mensagens e canais

### `/limpar`

Apaga mensagens recentes do canal.

### `/lock`

Bloqueia envio de mensagens de `@everyone`, preservando o estado anterior.

### `/unlock`

Restaura o estado salvo pelo `/lock`.

### `/nuke`

Clona/recria um canal para remover o histórico. Possui proteções para tickets ativos e canais especiais de Community.
