# Permissões

StandardBot usa permissões nativas do Discord para autorizar comandos. O nome do cargo não é usado como fonte de autorização.

O proprietário do servidor e usuários com `Administrator` recebem os bypasses previstos pela lógica central quando apropriado.

| Comando | Requisito |
| --- | --- |
| `/ajuda` | Todos |
| `/setup` | Proprietário do servidor |
| `/modelo restaurar` | Proprietário do servidor |
| demais `/modelo` | Administrador |
| `/ticket` | Administrador |
| `/moderacao` | Administrador |
| `/mensagens` | Administrador |
| `/regras` | Administrador |
| `/banir` | Banir membros |
| `/banir-id` | Banir membros |
| `/desbanir` | Banir membros |
| `/expulsar` | Expulsar membros |
| `/mutar` | Moderar membros |
| `/desmutar` | Moderar membros |
| `/aviso` | Moderar membros |
| `/limpar` | Gerenciar mensagens |
| `/lock` | Gerenciar canais |
| `/unlock` | Gerenciar canais |
| `/nuke` | Gerenciar canais |

## Botões de ticket

Os botões não seguem a mesma matriz dos slash commands. A lógica do ticket decide quem pode agir:

- qualquer usuário pode abrir pelo painel;
- o autor pode fechar o próprio ticket;
- suporte configurado pode atender;
- administradores podem gerenciar;
- usuários adicionais recebem acesso apenas quando adicionados ao ticket.

## Hierarquia

Ter uma permissão de moderação não permite ignorar a hierarquia do Discord. O serviço de moderação verifica se o alvo pode ser moderado pelo executor e pelo próprio bot antes de executar ações aplicáveis.

## Novos comandos

A regra padrão para comandos desconhecidos é `Administrator`. Isso evita que um comando administrativo novo se torne público acidentalmente.
