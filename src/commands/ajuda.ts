import {
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';

import type {
    ChatInputCommandInteraction
} from 'discord.js';


/*
|--------------------------------------------------------------------------
| VISUAL
|--------------------------------------------------------------------------
*/

const HELP_COLOR =
    0x2b2d31;


/*
|--------------------------------------------------------------------------
| TIPOS
|--------------------------------------------------------------------------
*/

interface CommandHelp {

    title:
        string;

    summary:
        string;

    usage:
        string;

    examples:
        string[];

    access:
        string;

    notes?:
        string[];
}


/*
|--------------------------------------------------------------------------
| AJUDA POR COMANDO
|--------------------------------------------------------------------------
*/

const COMMAND_HELP:
    Record<
        string,
        CommandHelp
    > = {

    ajuda: {

        title:
            '/ajuda',

        summary:
            'Mostra informações sobre os comandos e sistemas do StandardBot.',

        usage:
            [
                '/ajuda',
                '/ajuda categoria:<categoria>',
                '/ajuda comando:<comando>'
            ].join(
                '\n'
            ),

        examples: [

            '/ajuda',

            '/ajuda categoria:mensagens',

            '/ajuda categoria:moderação',

            '/ajuda comando:mutar'
        ],

        access:
            'Todos os usuários.'
    },


    setup: {

        title:
            '/setup',

        summary:
            'Executa a configuração inicial do StandardBot no servidor.',

        usage:
            '/setup',

        examples: [

            '/setup'
        ],

        access:
            'Somente o proprietário do servidor.',

        notes: [

            'É uma operação administrativa crítica.',

            'Ter a permissão Administrador não substitui a posse do servidor para este comando.'
        ]
    },


    regras: {

        title:
            '/regras',

        summary:
            'Publica e atualiza a mensagem oficial de regras do servidor.',

        usage:
            [
                '/regras publicar canal:<canal>',
                '/regras atualizar'
            ].join(
                '\n'
            ),

        examples: [

            '/regras publicar canal:#regras',

            '/regras atualizar'
        ],

        access:
            'Requer a permissão Administrador.',

        notes: [

            'O visual e o conteúdo do embed podem ser configurados através de /mensagens regras editar.',

            'Quando já existe uma mensagem registrada, /regras atualizar edita a mesma mensagem.',

            'A mensagem publicada é fixada automaticamente.'
        ]
    },


    mensagens: {

        title:
            '/mensagens',

        summary:
            'Configura as boas-vindas automáticas e o embed de regras do servidor.',

        usage:
            [
                '/mensagens boas-vindas configurar canal:<canal> formato:<texto ou embed>',
                '/mensagens boas-vindas testar',
                '/mensagens boas-vindas status',
                '/mensagens boas-vindas desativar',
                '/mensagens regras editar',
                '/mensagens regras status'
            ].join(
                '\n'
            ),

        examples: [

            '/mensagens boas-vindas configurar canal:#geral formato:Embed',

            '/mensagens boas-vindas testar',

            '/mensagens regras editar',

            '/mensagens regras status'
        ],

        access:
            'Requer a permissão Administrador.',

        notes: [

            'As boas-vindas podem ser enviadas como texto normal ou embed.',

            'Variáveis disponíveis nas boas-vindas: {usuario}, {nome}, {servidor} e {membros}.',

            'O editor de regras permite alterar título, texto, footer, cor HEX e imagem por URL.',

            'Após editar as regras, utilize /regras publicar ou /regras atualizar para refletir a configuração na mensagem oficial.'
        ]
    },


    modelo: {

        title:
            '/modelo',

        summary:
            'Salva e gerencia modelos da estrutura do servidor.',

        usage:
            [
                '/modelo salvar',
                '/modelo listar',
                '/modelo detalhes',
                '/modelo restaurar',
                '/modelo excluir',
                '/modelo limpar-backups'
            ].join(
                '\n'
            ),

        examples: [

            '/modelo salvar nome:servidor-principal',

            '/modelo detalhes nome:servidor-principal',

            '/modelo restaurar nome:servidor-principal'
        ],

        access:
            [
                'Salvar, listar, detalhes, excluir e limpar backups: **Administrador**.',
                '',
                'Restaurar: **somente o proprietário do servidor**.'
            ].join(
                '\n'
            ),

        notes: [

            'Os modelos são pessoais: cada administrador possui sua própria lista de modelos.',

            'Tickets ativos não entram no snapshot.',

            'Durante uma restauração, tickets ativos são preservados e sincronizados novamente.',

            'A restauração pode recriar canais e cargos com novos IDs.',

            'Mesmo um administrador não pode usar /modelo restaurar se não for o proprietário do servidor.'
        ]
    },


    ticket: {

        title:
            '/ticket',

        summary:
            'Configura e administra o sistema de atendimento privado do StandardBot.',

        usage:
            [
                '/ticket configurar',
                '/ticket painel',
                '/ticket status',
                '/ticket sincronizar',
                '/ticket adicionar',
                '/ticket remover',
                '/ticket abrir',
                '/ticket fechar'
            ].join(
                '\n'
            ),

        examples: [

            '/ticket configurar cargo_staff:@Suporte',

            '/ticket painel canal:#atendimento',

            '/ticket status',

            '/ticket sincronizar'
        ],

        access:
            'Os comandos slash de /ticket requerem a permissão Administrador.',

        notes: [

            'Usuários comuns não precisam utilizar /ticket: eles abrem atendimento pelo botão do painel.',

            'O cargo de suporte configurado NÃO ganha acesso aos comandos administrativos de /ticket.',

            'A equipe de suporte atende utilizando os botões dentro dos tickets.',

            'Administradores também podem atender tickets.',

            'O autor do ticket pode fechar o próprio atendimento.',

            'Cada usuário pode possuir apenas um ticket ativo.',

            'Tickets ativos sobrevivem à restauração de modelos.'
        ]
    },


    moderacao: {

        title:
            '/moderacao',

        summary:
            'Configura o sistema de moderação e o canal utilizado para os logs.',

        usage:
            [
                '/moderacao configurar canal_logs:#canal',
                '/moderacao status',
                '/moderacao desvincular'
            ].join(
                '\n'
            ),

        examples: [

            '/moderacao configurar canal_logs:#logs-mod',

            '/moderacao status'
        ],

        access:
            'Requer a permissão Administrador.',

        notes: [

            'Configurar a moderação não concede permissões de ban, kick ou mute para ninguém.',

            'Os comandos de punição utilizam as permissões nativas do Discord.'
        ]
    },


    banir: {

        title:
            '/banir',

        summary:
            'Bane um membro que ainda está dentro do servidor.',

        usage:
            '/banir usuario:@usuario motivo:<motivo> apagar_mensagens:<opcional>',

        examples: [

            '/banir usuario:@Fulano motivo:Spam',

            '/banir usuario:@Fulano motivo:Raid apagar_mensagens:Últimos 7 dias'
        ],

        access:
            'Requer a permissão Banir membros.',

        notes: [

            'O nome do cargo do moderador não importa. O bot verifica a permissão nativa Banir membros.',

            'O bot também verifica a hierarquia dos cargos antes de executar o banimento.',

            'Não é possível utilizar o comando para contornar a hierarquia do Discord.',

            'O usuário recebe uma DM quando as mensagens privadas estiverem disponíveis.',

            'Para alguém que já saiu do servidor, utilize /banir-id.'
        ]
    },


    'banir-id': {

        title:
            '/banir-id',

        summary:
            'Bane diretamente pelo ID do Discord, inclusive usuários que já saíram do servidor.',

        usage:
            '/banir-id usuario_id:<ID> motivo:<motivo> apagar_mensagens:<opcional>',

        examples: [

            '/banir-id usuario_id:123456789012345678 motivo:Evadiu antes do ban'
        ],

        access:
            'Requer a permissão Banir membros.',

        notes: [

            'Se o usuário ainda estiver dentro do servidor, a hierarquia de cargos continua sendo verificada.',

            'Não é possível usar /banir-id para ignorar a hierarquia normal.',

            'Uma DM pode não ser entregue caso o usuário esteja fora do servidor ou tenha mensagens privadas bloqueadas.'
        ]
    },


    desbanir: {

        title:
            '/desbanir',

        summary:
            'Remove um usuário da lista de banimentos do servidor.',

        usage:
            '/desbanir usuario:<usuário banido ou ID> motivo:<opcional>',

        examples: [

            '/desbanir usuario:Fulano',

            '/desbanir usuario:123456789012345678 motivo:Apelação aceita'
        ],

        access:
            'Requer a permissão Banir membros.',

        notes: [

            'O campo de usuário possui autocomplete com a lista de pessoas atualmente banidas.',

            'Também é possível informar diretamente o ID do usuário.',

            'Usuários sem a permissão Banir membros não recebem acesso ao autocomplete da lista de banidos.'
        ]
    },


    expulsar: {

        title:
            '/expulsar',

        summary:
            'Remove um membro do servidor sem bani-lo.',

        usage:
            '/expulsar usuario:@usuario motivo:<motivo>',

        examples: [

            '/expulsar usuario:@Fulano motivo:Comportamento inadequado'
        ],

        access:
            'Requer a permissão Expulsar membros.',

        notes: [

            'O usuário poderá entrar novamente utilizando um convite.',

            'O bot verifica a hierarquia antes de executar a expulsão.',

            'Uma DM é enviada quando possível.'
        ]
    },


    mutar: {

        title:
            '/mutar',

        summary:
            'Aplica o timeout nativo do Discord por um período determinado.',

        usage:
            '/mutar usuario:@usuario duracao:<tempo> motivo:<motivo>',

        examples: [

            '/mutar usuario:@Fulano duracao:30s motivo:Spam',

            '/mutar usuario:@Fulano duracao:10m motivo:Flood',

            '/mutar usuario:@Fulano duracao:2h motivo:Discussão',

            '/mutar usuario:@Fulano duracao:1d12h motivo:Reincidência'
        ],

        access:
            'Requer a permissão Moderar membros.',

        notes: [

            '`s` = segundos',

            '`m` = minutos',

            '`h` = horas',

            '`d` = dias',

            '`w` = semanas',

            'As unidades podem ser combinadas. Exemplo: `1d12h`.',

            'Palavras completas como `10 minutos` não são aceitas. Utilize `10m`.',

            'O Discord permite timeout de no máximo 28 dias.',

            'O bot verifica a hierarquia antes da punição.',

            'O usuário recebe uma DM informando duração e motivo quando possível.'
        ]
    },


    desmutar: {

        title:
            '/desmutar',

        summary:
            'Remove um timeout ativo antes do término.',

        usage:
            '/desmutar usuario:@usuario motivo:<opcional>',

        examples: [

            '/desmutar usuario:@Fulano',

            '/desmutar usuario:@Fulano motivo:Punição revisada'
        ],

        access:
            'Requer a permissão Moderar membros.'
    },


    aviso: {

        title:
            '/aviso',

        summary:
            'Gerencia advertências persistentes dos usuários.',

        usage:
            [
                '/aviso adicionar usuario:@usuario motivo:<motivo>',
                '/aviso listar usuario:@usuario',
                '/aviso remover id:<ID>'
            ].join(
                '\n'
            ),

        examples: [

            '/aviso adicionar usuario:@Fulano motivo:Spam',

            '/aviso listar usuario:@Fulano',

            '/aviso remover id:3'
        ],

        access:
            'Requer a permissão Moderar membros.',

        notes: [

            'Cada advertência recebe um ID dentro do servidor.',

            'O histórico continua salvo mesmo que o usuário saia do servidor.',

            'Ao receber uma advertência, o usuário recebe uma DM quando possível.'
        ]
    },


    limpar: {

        title:
            '/limpar',

        summary:
            'Apaga várias mensagens recentes de um canal.',

        usage:
            '/limpar quantidade:<1-100> canal:<opcional>',

        examples: [

            '/limpar quantidade:10',

            '/limpar quantidade:50 canal:#geral'
        ],

        access:
            'Requer a permissão Gerenciar mensagens.',

        notes: [

            'Sem informar canal, o comando utiliza o canal atual.',

            'Mensagens antigas demais para exclusão em massa podem não ser removidas pelo Discord.'
        ]
    },


    lock: {

        title:
            '/lock',

        summary:
            'Bloqueia o envio de mensagens de @everyone em um canal.',

        usage:
            '/lock canal:<opcional>',

        examples: [

            '/lock',

            '/lock canal:#geral'
        ],

        access:
            'Requer a permissão Gerenciar canais.',

        notes: [

            'O bot registra o estado anterior da permissão SendMessages.',

            'Aplicar /lock novamente não sobrescreve o estado original salvo.',

            'Utilize /unlock para restaurar exatamente a configuração anterior.'
        ]
    },


    unlock: {

        title:
            '/unlock',

        summary:
            'Remove um lock aplicado pelo StandardBot e restaura a permissão anterior.',

        usage:
            '/unlock canal:<opcional>',

        examples: [

            '/unlock',

            '/unlock canal:#geral'
        ],

        access:
            'Requer a permissão Gerenciar canais.',

        notes: [

            'O comando não simplesmente libera mensagens.',

            'Ele restaura o estado anterior como allow, deny ou herdado.'
        ]
    },


    nuke: {

        title:
            '/nuke',

        summary:
            'Recria completamente um canal para apagar seu histórico de mensagens.',

        usage:
            '/nuke confirmar:true canal:<opcional> motivo:<opcional>',

        examples: [

            '/nuke confirmar:true',

            '/nuke confirmar:true canal:#teste motivo:Limpeza completa'
        ],

        access:
            'Requer a permissão Gerenciar canais.',

        notes: [

            'É uma ação destrutiva.',

            'O canal recebe um novo ID.',

            'Nome, categoria, permissões e outras configurações são preservados pelo clone.',

            'Tickets ativos são protegidos contra nuke.',

            'Canais obrigatórios do modo Comunidade também são protegidos.',

            'Ter Gerenciar canais permite utilizar o comando, mas as proteções internas do StandardBot continuam sendo aplicadas.'
        ]
    }
};


/*
|--------------------------------------------------------------------------
| EMBED BASE
|--------------------------------------------------------------------------
*/

function baseEmbed():
    EmbedBuilder {

    return new EmbedBuilder()

        .setColor(
            HELP_COLOR
        )

        .setFooter({

            text:
                'StandardBot • Central de Ajuda'
        })

        .setTimestamp();
}


/*
|--------------------------------------------------------------------------
| AJUDA DE COMANDO
|--------------------------------------------------------------------------
*/

function commandHelpEmbed(
    commandName:
        string
):
    EmbedBuilder {

    const help =
        COMMAND_HELP[
            commandName
        ];


    if (
        !help
    ) {

        return baseEmbed()

            .setTitle(
                'Comando não encontrado'
            )

            .setDescription(
                'Não encontrei informações de ajuda para esse comando.'
            );
    }


    const embed =
        baseEmbed()

            .setTitle(
                `Ajuda • ${help.title}`
            )

            .setDescription(
                help.summary
            )

            .addFields(

                {

                    name:
                        'Uso',

                    value:
                        `\`\`\`\n${help.usage}\n\`\`\``,

                    inline:
                        false
                },

                {

                    name:
                        'Permissão necessária',

                    value:
                        help.access,

                    inline:
                        false
                },

                {

                    name:
                        'Exemplos',

                    value:
                        help.examples

                            .map(
                                example =>
                                    `\`${example}\``
                            )

                            .join(
                                '\n'
                            ),

                    inline:
                        false
                }
            );


    if (
        help.notes &&
        help.notes.length >
        0
    ) {

        embed.addFields({

            name:
                'Observações',

            value:
                help.notes

                    .map(
                        note =>
                            `• ${note}`
                    )

                    .join(
                        '\n'
                    ),

            inline:
                false
        });
    }


    return embed;
}


/*
|--------------------------------------------------------------------------
| VISÃO GERAL
|--------------------------------------------------------------------------
*/

function generalHelpEmbed():
    EmbedBuilder {

    return baseEmbed()

        .setTitle(
            'StandardBot • Ajuda'
        )

        .setDescription(
            [
                'Central de ajuda e referência dos sistemas do StandardBot.',
                '',
                'O bot utiliza as permissões nativas do Discord. O nome do seu cargo não importa: o que determina o acesso são as permissões concedidas a ele.',
                '',
                'Use `/ajuda categoria:` para visualizar uma área inteira ou `/ajuda comando:` para consultar um comando específico.'
            ].join(
                '\n'
            )
        )

        .addFields(

            {

                name:
                    '💬 Mensagens',

                value:
                    [
                        '`/mensagens boas-vindas configurar` — Administrador',
                        '`/mensagens boas-vindas testar` — Administrador',
                        '`/mensagens boas-vindas status` — Administrador',
                        '`/mensagens boas-vindas desativar` — Administrador',
                        '',
                        '`/mensagens regras editar` — Administrador',
                        '`/mensagens regras status` — Administrador',
                        '',
                        'Boas-vindas podem ser texto normal ou embed. As regras possuem editor completo de embed.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '🎫 Tickets',

                value:
                    [
                        '**Usuários:** abrem tickets pelo botão do painel.',
                        '**Suporte:** atende pelos botões dentro do ticket.',
                        '**Administradores:** configuram o sistema com `/ticket`.',
                        '',
                        'O cargo de suporte configurado serve somente para tickets.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '🗂️ Modelos',

                value:
                    [
                        '`/modelo salvar` — Administrador',
                        '`/modelo listar` — Administrador',
                        '`/modelo detalhes` — Administrador',
                        '`/modelo excluir` — Administrador',
                        '`/modelo restaurar` — somente proprietário',
                        '',
                        'Os modelos são pessoais para cada usuário.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '🛡️ Moderação',

                value:
                    [
                        '`/banir` • `/banir-id` • `/desbanir` → Banir membros',
                        '`/expulsar` → Expulsar membros',
                        '`/mutar` • `/desmutar` • `/aviso` → Moderar membros',
                        '`/limpar` → Gerenciar mensagens',
                        '`/lock` • `/unlock` • `/nuke` → Gerenciar canais'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '⚙️ Administração',

                value:
                    [
                        '`/mensagens` → Administrador',
                        '`/moderacao` → Administrador',
                        '`/ticket` → Administrador',
                        '`/regras` → Administrador',
                        '`/setup` → somente proprietário'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '🔐 Como as permissões funcionam',

                value:
                    [
                        'O StandardBot não utiliza um cargo global de Staff.',
                        '',
                        'Ter permissão para uma função libera apenas os comandos correspondentes.',
                        '',
                        'Exemplo: alguém com **Banir membros** pode banir, mas isso não concede automaticamente acesso a mute, nuke ou configuração do bot.'
                    ].join(
                        '\n'
                    )
            }
        );
}


/*
|--------------------------------------------------------------------------
| CATEGORIA TICKETS
|--------------------------------------------------------------------------
*/

function ticketHelpEmbed():
    EmbedBuilder {

    return baseEmbed()

        .setTitle(
            'Ajuda • Tickets'
        )

        .setDescription(
            'Sistema de atendimento privado entre usuários e a equipe de suporte.'
        )

        .addFields(

            {

                name:
                    '👤 Usuário',

                value:
                    [
                        'O usuário abre o atendimento através do botão **Abrir ticket** no painel.',
                        '',
                        'Ele não precisa utilizar comandos administrativos.',
                        '',
                        'O autor pode fechar o próprio atendimento através do botão de fechamento.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '🎧 Suporte',

                value:
                    [
                        'O suporte é definido através do cargo configurado no sistema de tickets.',
                        '',
                        'Esse cargo pode:',
                        '• visualizar os tickets;',
                        '• assumir atendimento;',
                        '• conversar no ticket;',
                        '• fechar atendimento.',
                        '',
                        'O cargo de suporte NÃO concede acesso aos comandos administrativos do StandardBot.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '⚙️ Administradores',

                value:
                    [
                        'Os comandos `/ticket` exigem **Administrador**.',
                        '',
                        'Administradores podem configurar categoria, cargo de suporte, logs, painel e sincronização do sistema.',
                        '',
                        'Administradores também podem atender tickets mesmo sem possuir o cargo de suporte.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '🔒 Privacidade',

                value:
                    [
                        'O ticket é oculto para `@everyone`.',
                        '',
                        'O autor, suporte autorizado, usuários adicionados e administradores podem possuir acesso conforme o sistema.',
                        '',
                        'Cada usuário pode manter apenas um ticket ativo.'
                    ].join(
                        '\n'
                    )
            }
        );
}


/*
|--------------------------------------------------------------------------
| CATEGORIA MENSAGENS
|--------------------------------------------------------------------------
*/

function messagesHelpEmbed():
    EmbedBuilder {

    return baseEmbed()

        .setTitle(
            'Ajuda • Mensagens'
        )

        .setDescription(
            'Configuração das boas-vindas automáticas e da mensagem oficial de regras.'
        )

        .addFields(

            {

                name:
                    '👋 Boas-vindas',

                value:
                    [
                        '`/mensagens boas-vindas configurar` — escolhe canal, formato e conteúdo.',
                        '`/mensagens boas-vindas testar` — envia uma prévia usando você como membro de teste.',
                        '`/mensagens boas-vindas status` — mostra a configuração salva.',
                        '`/mensagens boas-vindas desativar` — interrompe o envio automático.',
                        '',
                        '**Permissão:** Administrador.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '🧩 Variáveis',

                value:
                    [
                        '`{usuario}` → menção do membro',
                        '`{nome}` → nome exibido no servidor',
                        '`{servidor}` → nome do servidor',
                        '`{membros}` → quantidade atual de membros',
                        '',
                        'Essas variáveis são substituídas automaticamente quando a mensagem é enviada.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '📝 Formatos de boas-vindas',

                value:
                    [
                        '**Texto normal:** envia a mensagem diretamente no canal.',
                        '',
                        '**Embed:** envia a menção do novo membro e um embed configurado com título e mensagem.',
                        '',
                        'O sistema envia uma menção fora do embed para que o usuário receba a notificação.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '📜 Editor de regras',

                value:
                    [
                        '`/mensagens regras editar` abre o editor completo.',
                        '',
                        'É possível alterar:',
                        '• título;',
                        '• texto das regras;',
                        '• footer;',
                        '• cor HEX;',
                        '• imagem por URL.',
                        '',
                        '`/mensagens regras status` mostra a configuração atualmente salva.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '📌 Publicar as regras',

                value:
                    [
                        'Depois de editar o embed, use `/regras publicar` para criar a mensagem oficial.',
                        '',
                        'Se ela já estiver publicada, use `/regras atualizar` para editar a mesma mensagem.',
                        '',
                        'A mensagem de regras é fixada automaticamente.'
                    ].join(
                        '\n'
                    )
            }
        );
}


/*
|--------------------------------------------------------------------------
| CATEGORIA MODELOS
|--------------------------------------------------------------------------
*/

function modelHelpEmbed():
    EmbedBuilder {

    return baseEmbed()

        .setTitle(
            'Ajuda • Modelos'
        )

        .setDescription(
            'Sistema de snapshots e restauração da estrutura do servidor.'
        )

        .addFields(

            {

                name:
                    'Administrador',

                value:
                    [
                        '`/modelo salvar` — salva a estrutura atual.',
                        '`/modelo listar` — mostra seus modelos.',
                        '`/modelo detalhes` — mostra informações de um modelo.',
                        '`/modelo excluir` — exclui um modelo.',
                        '`/modelo limpar-backups` — remove backups automáticos.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '👑 Proprietário',

                value:
                    [
                        '`/modelo restaurar` — aplica um modelo ao servidor.',
                        '',
                        'A restauração é reservada exclusivamente ao proprietário devido ao impacto que pode causar sobre canais, cargos e permissões.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '📁 Modelos pessoais',

                value:
                    [
                        'Cada usuário possui sua própria biblioteca.',
                        '',
                        'Um administrador não recebe automaticamente acesso aos modelos salvos por outro administrador.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '🎫 Tickets ativos',

                value:
                    [
                        'Canais temporários de tickets ativos não entram no snapshot.',
                        '',
                        'Durante uma restauração, eles são preservados e sincronizados novamente.'
                    ].join(
                        '\n'
                    )
            }
        );
}


/*
|--------------------------------------------------------------------------
| CATEGORIA MODERAÇÃO
|--------------------------------------------------------------------------
*/

function moderationHelpEmbed():
    EmbedBuilder {

    return baseEmbed()

        .setTitle(
            'Ajuda • Moderação'
        )

        .setDescription(
            [
                'Os comandos utilizam diretamente as permissões nativas do Discord.',
                '',
                'Não existe um cargo global de Staff para liberar toda a moderação.'
            ].join(
                '\n'
            )
        )

        .addFields(

            {

                name:
                    '🔨 Banimentos',

                value:
                    [
                        '`/banir` — **Banir membros**',
                        '`/banir-id` — **Banir membros**',
                        '`/desbanir` — **Banir membros**'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '🚪 Expulsão',

                value:
                    '`/expulsar` — **Expulsar membros**'
            },

            {

                name:
                    '🔇 Timeout e advertências',

                value:
                    [
                        '`/mutar` — **Moderar membros**',
                        '`/desmutar` — **Moderar membros**',
                        '`/aviso` — **Moderar membros**'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '💬 Mensagens',

                value:
                    '`/limpar` — **Gerenciar mensagens**'
            },

            {

                name:
                    '📁 Canais',

                value:
                    [
                        '`/lock` — **Gerenciar canais**',
                        '`/unlock` — **Gerenciar canais**',
                        '`/nuke` — **Gerenciar canais**'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '⏱️ Tempo do /mutar',

                value:
                    [
                        '`30s` → 30 segundos',
                        '`10m` → 10 minutos',
                        '`2h` → 2 horas',
                        '`1d` → 1 dia',
                        '`1w` → 1 semana',
                        '`1d12h` → combinação',
                        '',
                        '**Máximo:** 28 dias.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '📨 DMs',

                value:
                    [
                        'Advertência, timeout, expulsão e banimento tentam avisar o usuário por mensagem privada.',
                        '',
                        'Se a conta estiver com DMs fechadas, a ação de moderação continua normalmente.'
                    ].join(
                        '\n'
                    )
            },

            {

                name:
                    '📋 Logs',

                value:
                    [
                        'O canal de logs é configurado através de `/moderacao configurar`.',
                        '',
                        'A configuração de moderação exige **Administrador**.'
                    ].join(
                        '\n'
                    )
            }
        );
}


/*
|--------------------------------------------------------------------------
| ESCOLHER CATEGORIA
|--------------------------------------------------------------------------
*/

function categoryHelpEmbed(
    category:
        string | null
):
    EmbedBuilder {

    switch (
        category
    ) {

        case 'tickets':

            return ticketHelpEmbed();


        case 'mensagens':

            return messagesHelpEmbed();


        case 'modelos':

            return modelHelpEmbed();


        case 'moderacao':

            return moderationHelpEmbed();


        case 'geral':

        default:

            return generalHelpEmbed();
    }
}


/*
|--------------------------------------------------------------------------
| COMANDO
|--------------------------------------------------------------------------
*/

export const ajudaCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'ajuda'
            )

            .setDescription(
                'Mostra a central de ajuda do StandardBot.'
            )

            .addStringOption(
                option =>

                    option

                        .setName(
                            'categoria'
                        )

                        .setDescription(
                            'Mostra os comandos de uma categoria.'
                        )

                        .addChoices(

                            {

                                name:
                                    'Geral',

                                value:
                                    'geral'
                            },

                            {

                                name:
                                    'Tickets',

                                value:
                                    'tickets'
                            },

                            {

                                name:
                                    'Mensagens',

                                value:
                                    'mensagens'
                            },

                            {

                                name:
                                    'Modelos',

                                value:
                                    'modelos'
                            },

                            {

                                name:
                                    'Moderação',

                                value:
                                    'moderacao'
                            }
                        )

                        .setRequired(
                            false
                        )
            )

            .addStringOption(
                option =>

                    option

                        .setName(
                            'comando'
                        )

                        .setDescription(
                            'Mostra ajuda detalhada de um comando específico.'
                        )

                        .addChoices(

                            {

                                name:
                                    'ajuda',

                                value:
                                    'ajuda'
                            },

                            {

                                name:
                                    'setup',

                                value:
                                    'setup'
                            },

                            {

                                name:
                                    'regras',

                                value:
                                    'regras'
                            },

                            {

                                name:
                                    'mensagens',

                                value:
                                    'mensagens'
                            },

                            {

                                name:
                                    'modelo',

                                value:
                                    'modelo'
                            },

                            {

                                name:
                                    'ticket',

                                value:
                                    'ticket'
                            },

                            {

                                name:
                                    'moderacao',

                                value:
                                    'moderacao'
                            },

                            {

                                name:
                                    'banir',

                                value:
                                    'banir'
                            },

                            {

                                name:
                                    'banir-id',

                                value:
                                    'banir-id'
                            },

                            {

                                name:
                                    'desbanir',

                                value:
                                    'desbanir'
                            },

                            {

                                name:
                                    'expulsar',

                                value:
                                    'expulsar'
                            },

                            {

                                name:
                                    'mutar',

                                value:
                                    'mutar'
                            },

                            {

                                name:
                                    'desmutar',

                                value:
                                    'desmutar'
                            },

                            {

                                name:
                                    'aviso',

                                value:
                                    'aviso'
                            },

                            {

                                name:
                                    'limpar',

                                value:
                                    'limpar'
                            },

                            {

                                name:
                                    'lock',

                                value:
                                    'lock'
                            },

                            {

                                name:
                                    'unlock',

                                value:
                                    'unlock'
                            },

                            {

                                name:
                                    'nuke',

                                value:
                                    'nuke'
                            }
                        )

                        .setRequired(
                            false
                        )
            ),


    /*
    |--------------------------------------------------------------------------
    | PÚBLICO
    |--------------------------------------------------------------------------
    */

    staffOnly:
        false,


    /*
    |--------------------------------------------------------------------------
    | EXECUÇÃO
    |--------------------------------------------------------------------------
    */

    async execute(
        interaction:
            ChatInputCommandInteraction
    ):
        Promise<void> {

        const command =
            interaction.options.getString(
                'comando'
            );


        const category =
            interaction.options.getString(
                'categoria'
            );


        /*
         * Se comando e categoria forem informados juntos,
         * a ajuda específica do comando possui prioridade.
         */

        const embed =
            command

                ? commandHelpEmbed(
                    command
                )

                : categoryHelpEmbed(
                    category
                );


        await interaction.reply({

            embeds: [

                embed
            ],

            flags:
                MessageFlags.Ephemeral
        });
    }
};