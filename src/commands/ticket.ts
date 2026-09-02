import {
    ChannelType,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder
} from 'discord.js';

import type {
    CategoryChannel,
    ChatInputCommandInteraction,
    Role,
    TextChannel
} from 'discord.js';

import {
    canUseStaffCommands
} from '../services/permissions.js';

import {
    getTicketGuildData,
    patchTicketConfig
} from '../services/ticket-store.js';

import {
    makeCategoryReference,
    makeRoleReference,
    makeTextReference
} from '../services/ticket-resolver.js';

import {
    addUserToTicket,
    closeTicket,
    getTicketConfigState,
    openTicket,
    publishTicketPanel,
    removeUserFromTicket,
    synchronizeTickets
} from '../services/ticket-service.js';


/*
|--------------------------------------------------------------------------
| EMBED BASE
|--------------------------------------------------------------------------
*/

function baseEmbed():
    EmbedBuilder {

    return new EmbedBuilder()

        .setColor(
            0x2b2d31
        );
}


/*
|--------------------------------------------------------------------------
| ERRO -> TEXTO
|--------------------------------------------------------------------------
*/

function errorText(
    error: unknown
):
    string {

    if (
        error instanceof Error
    ) {

        return error.message;
    }


    return String(
        error
    );
}


/*
|--------------------------------------------------------------------------
| STATUS DE REFERÊNCIA
|--------------------------------------------------------------------------
*/

function statusLabel(
    status: string,
    mention: string | null
):
    string {

    switch (
        status
    ) {

        case 'ok':

            return (
                `✓ ${mention ?? 'encontrado'}`
            );


        case 'repaired':

            return (
                `↻ ${mention ?? 'encontrado'} *(ID reparado automaticamente)*`
            );


        case 'missing':

            return (
                '⚠ configurado, mas não encontrado'
            );


        case 'ambiguous':

            return (
                '⚠ existem vários com o mesmo nome; configure novamente'
            );


        default:

            return (
                '— não configurado'
            );
    }
}


/*
|--------------------------------------------------------------------------
| CHECAGEM DE STAFF
|--------------------------------------------------------------------------
|
| /ticket NÃO pode usar staffOnly global.
|
| Motivo:
|
| /ticket abrir
| /ticket fechar
|
| também precisam funcionar para usuários comuns.
|
| Então somente os subcomandos administrativos
| fazem essa verificação.
|
|--------------------------------------------------------------------------
*/

async function requireStaff(
    interaction:
        ChatInputCommandInteraction
):
    Promise<boolean> {

    const guild =
        interaction.guild;


    /*
    |--------------------------------------------------------------------------
    | OWNER / ADMIN
    |--------------------------------------------------------------------------
    */

    if (
        guild
    ) {

        const member =
            await guild.members.fetch(
                interaction.user.id
            );


        if (

            member.id ===
                guild.ownerId ||

            member.permissions.has(
                PermissionFlagsBits.Administrator
            ) ||

            member.permissions.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {

            return true;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | SISTEMA DE STAFF EXISTENTE DO BOT
    |--------------------------------------------------------------------------
    */

    if (
        await canUseStaffCommands(
            interaction
        )
    ) {

        return true;
    }


    /*
    |--------------------------------------------------------------------------
    | NEGAR
    |--------------------------------------------------------------------------
    */

    await interaction.editReply({

        content:
            '❌ Você não possui permissão para configurar o sistema de tickets.',

        embeds: [],

        components: []
    });


    return false;
}


/*
|--------------------------------------------------------------------------
| MOSTRAR STATUS
|--------------------------------------------------------------------------
*/

async function renderStatus(
    interaction:
        ChatInputCommandInteraction
):
    Promise<void> {

    const guild =
        interaction.guild;


    if (
        !guild
    ) {

        throw new Error(
            'Este comando só funciona dentro de um servidor.'
        );
    }


    /*
    |--------------------------------------------------------------------------
    | RESOLVER CONFIGURAÇÃO
    |--------------------------------------------------------------------------
    |
    | Aqui já acontece automaticamente:
    |
    | ID morreu
    | ↓
    | procurar pelo nome
    | ↓
    | reparar ID
    |
    |--------------------------------------------------------------------------
    */

    const state =
        await getTicketConfigState(
            guild
        );


    /*
    |--------------------------------------------------------------------------
    | PAINEL
    |--------------------------------------------------------------------------
    */

    const panel =
        statusLabel(

            state.panelChannel.status,

            state.panelChannel.value
                ? `<#${state.panelChannel.value.id}>`
                : null
        );


    /*
    |--------------------------------------------------------------------------
    | CATEGORIA
    |--------------------------------------------------------------------------
    */

    const category =
        statusLabel(

            state.category.status,

            state.category.value
                ? `**${state.category.value.name}**`
                : null
        );


    /*
    |--------------------------------------------------------------------------
    | STAFF
    |--------------------------------------------------------------------------
    */

    const staff =
        statusLabel(

            state.staffRole.status,

            state.staffRole.value
                ? `<@&${state.staffRole.value.id}>`
                : null
        );


    /*
    |--------------------------------------------------------------------------
    | LOGS
    |--------------------------------------------------------------------------
    */

    const logs =
        statusLabel(

            state.logsChannel.status,

            state.logsChannel.value
                ? `<#${state.logsChannel.value.id}>`
                : null
        );


    /*
    |--------------------------------------------------------------------------
    | EMBED
    |--------------------------------------------------------------------------
    */

    await interaction.editReply({

        embeds: [

            baseEmbed()

                .setTitle(
                    'Configuração de tickets'
                )

                .setDescription(
                    [

                        `**Painel:** ${panel}`,

                        `**Categoria:** ${category}`,

                        `**Cargo Staff:** ${staff}`,

                        `**Logs:** ${logs}`,

                        '',

                        `Tickets ativos registrados: **${state.openTickets.length}**`,

                        '',

                        state.repaired

                            ? '↻ Uma ou mais referências foram reparadas automaticamente após mudanças no servidor.'

                            : 'IDs válidos e nomes de fallback são mantidos automaticamente.'

                    ].join(
                        '\n'
                    )
                )
        ],

        components: []
    });
}


/*
|--------------------------------------------------------------------------
| /TICKET CONFIGURAR
|--------------------------------------------------------------------------
|
| Tudo é opcional.
|
| Exemplos:
|
| /ticket configurar cargo_staff:@Staff
|
| /ticket configurar canal_logs:#logs
|
| /ticket configurar canal_painel:#suporte
|
| /ticket configurar categoria:TICKETS
|
| Também pode configurar tudo de uma vez.
|
|--------------------------------------------------------------------------
*/

async function configureCommand(
    interaction:
        ChatInputCommandInteraction
):
    Promise<void> {

    const guild =
        interaction.guild;


    if (
        !guild
    ) {

        throw new Error(
            'Este comando só funciona dentro de um servidor.'
        );
    }


    /*
    |--------------------------------------------------------------------------
    | STAFF
    |--------------------------------------------------------------------------
    */

    if (
        !(await requireStaff(
            interaction
        ))
    ) {

        return;
    }


    /*
    |--------------------------------------------------------------------------
    | OPÇÕES
    |--------------------------------------------------------------------------
    */

    const category =
        interaction.options
            .getChannel(
                'categoria'
            );


    const staffRole =
        interaction.options
            .getRole(
                'cargo_staff'
            );


    const logsChannel =
        interaction.options
            .getChannel(
                'canal_logs'
            );


    const panelChannel =
        interaction.options
            .getChannel(
                'canal_painel'
            );


    /*
    |--------------------------------------------------------------------------
    | SEM ALTERAÇÕES
    |--------------------------------------------------------------------------
    |
    | /ticket configurar
    |
    | sozinho apenas mostra o estado.
    |
    */

    const hasChanges =

        !!category ||

        !!staffRole ||

        !!logsChannel ||

        !!panelChannel;


    if (
        !hasChanges
    ) {

        await renderStatus(
            interaction
        );


        return;
    }


    /*
    |--------------------------------------------------------------------------
    | PATCH
    |--------------------------------------------------------------------------
    */

    const patch:
        Parameters<
            typeof patchTicketConfig
        >[1] = {};


    /*
    |--------------------------------------------------------------------------
    | CATEGORIA
    |--------------------------------------------------------------------------
    */

    if (
        category
    ) {

        if (
            category.type !==
            ChannelType.GuildCategory
        ) {

            throw new Error(
                'A categoria precisa ser uma categoria real do servidor.'
            );
        }


        patch.category =
            makeCategoryReference(
                category as CategoryChannel
            );
    }


    /*
    |--------------------------------------------------------------------------
    | STAFF ROLE
    |--------------------------------------------------------------------------
    */

    if (
        staffRole
    ) {

        /*
         * @everyone não serve.
         */

        if (
            staffRole.id ===
            guild.roles.everyone.id
        ) {

            throw new Error(
                '@everyone não pode ser usado como cargo de staff.'
            );
        }


        /*
         * Não queremos cargo de bot/integrations.
         */

        if (
            staffRole.managed
        ) {

            throw new Error(
                'Cargos gerenciados por bots ou integrações não podem ser usados como cargo de staff.'
            );
        }


        patch.staffRole =
            makeRoleReference(
                staffRole as Role
            );
    }


    /*
    |--------------------------------------------------------------------------
    | LOGS
    |--------------------------------------------------------------------------
    */

    if (
        logsChannel
    ) {

        if (
            logsChannel.type !==
            ChannelType.GuildText
        ) {

            throw new Error(
                'O canal de logs precisa ser um canal de texto.'
            );
        }


        patch.logsChannel =
            makeTextReference(
                logsChannel as TextChannel
            );
    }


    /*
    |--------------------------------------------------------------------------
    | PAINEL
    |--------------------------------------------------------------------------
    */

    if (
        panelChannel
    ) {

        if (
            panelChannel.type !==
            ChannelType.GuildText
        ) {

            throw new Error(
                'O canal do painel precisa ser um canal de texto.'
            );
        }


        /*
         * Precisamos saber se mudou de canal.
         */

        const current =
            await getTicketGuildData(
                guild.id
            );


        patch.panelChannel =
            makeTextReference(
                panelChannel as TextChannel
            );


        /*
         * Mudou de canal?
         *
         * A mensagem antiga não pode ser reutilizada.
         */

        if (
            current.config
                .panelChannel
                ?.id !==
            panelChannel.id
        ) {

            patch.panelMessageId =
                null;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | SALVAR
    |--------------------------------------------------------------------------
    */

    await patchTicketConfig(
        guild.id,
        patch
    );


    /*
    |--------------------------------------------------------------------------
    | MOSTRAR NOVO ESTADO
    |--------------------------------------------------------------------------
    */

    await renderStatus(
        interaction
    );
}


/*
|--------------------------------------------------------------------------
| /TICKET DESVINCULAR
|--------------------------------------------------------------------------
|
| Isso permite limpar uma configuração sem editar JSON.
|
| Exemplo:
|
| /ticket desvincular item:Cargo Staff
|
|--------------------------------------------------------------------------
*/

async function unlinkCommand(
    interaction:
        ChatInputCommandInteraction
):
    Promise<void> {

    const guild =
        interaction.guild;


    if (
        !guild
    ) {

        throw new Error(
            'Este comando só funciona dentro de um servidor.'
        );
    }


    if (
        !(await requireStaff(
            interaction
        ))
    ) {

        return;
    }


    const item =
        interaction.options
            .getString(
                'item',
                true
            );


    switch (
        item
    ) {

        /*
        |--------------------------------------------------------------------------
        | CATEGORIA
        |--------------------------------------------------------------------------
        */

        case 'categoria':

            await patchTicketConfig(
                guild.id,
                {

                    category:
                        null
                }
            );

            break;


        /*
        |--------------------------------------------------------------------------
        | STAFF
        |--------------------------------------------------------------------------
        */

        case 'cargo_staff':

            await patchTicketConfig(
                guild.id,
                {

                    staffRole:
                        null
                }
            );

            break;


        /*
        |--------------------------------------------------------------------------
        | LOGS
        |--------------------------------------------------------------------------
        */

        case 'canal_logs':

            await patchTicketConfig(
                guild.id,
                {

                    logsChannel:
                        null
                }
            );

            break;


        /*
        |--------------------------------------------------------------------------
        | PAINEL
        |--------------------------------------------------------------------------
        */

        case 'canal_painel':

            await patchTicketConfig(
                guild.id,
                {

                    panelChannel:
                        null,

                    panelMessageId:
                        null
                }
            );

            break;


        /*
        |--------------------------------------------------------------------------
        | INVÁLIDO
        |--------------------------------------------------------------------------
        */

        default:

            throw new Error(
                'Item de configuração inválido.'
            );
    }


    /*
    |--------------------------------------------------------------------------
    | MOSTRAR RESULTADO
    |--------------------------------------------------------------------------
    */

    await renderStatus(
        interaction
    );
}


/*
|--------------------------------------------------------------------------
| /TICKET PAINEL
|--------------------------------------------------------------------------
*/

async function panelCommand(
    interaction:
        ChatInputCommandInteraction
):
    Promise<void> {

    const guild =
        interaction.guild;


    if (
        !guild
    ) {

        throw new Error(
            'Este comando só funciona dentro de um servidor.'
        );
    }


    if (
        !(await requireStaff(
            interaction
        ))
    ) {

        return;
    }


    /*
    |--------------------------------------------------------------------------
    | CANAL OPCIONAL
    |--------------------------------------------------------------------------
    */

    const option =
        interaction.options
            .getChannel(
                'canal'
            );


    let channel:
        TextChannel | null =
        null;


    if (
        option
    ) {

        if (
            option.type !==
            ChannelType.GuildText
        ) {

            throw new Error(
                'O painel precisa ser publicado em um canal de texto.'
            );
        }


        channel =
            option as TextChannel;
    }


    /*
    |--------------------------------------------------------------------------
    | PUBLICAR
    |--------------------------------------------------------------------------
    */

    const result =
        await publishTicketPanel(
            guild,
            channel
        );


    /*
    |--------------------------------------------------------------------------
    | RESPOSTA
    |--------------------------------------------------------------------------
    */

    await interaction.editReply({

        embeds: [

            baseEmbed()

                .setTitle(
                    result.updated
                        ? 'Painel atualizado'
                        : 'Painel publicado'
                )

                .setDescription(
                    `O painel de tickets está em <#${result.channel.id}>.`
                )
        ],

        components: []
    });
}


/*
|--------------------------------------------------------------------------
| /TICKET ABRIR
|--------------------------------------------------------------------------
|
| O botão será o método principal.
|
| Mas deixar slash command também é útil:
|
| /ticket abrir
|
|--------------------------------------------------------------------------
*/

async function openCommand(
    interaction:
        ChatInputCommandInteraction
):
    Promise<void> {

    const guild =
        interaction.guild;


    if (
        !guild
    ) {

        throw new Error(
            'Este comando só funciona dentro de um servidor.'
        );
    }


    const result =
        await openTicket(
            guild,
            interaction.user
        );


    /*
    |--------------------------------------------------------------------------
    | NOVO
    |--------------------------------------------------------------------------
    */

    if (
        result.created
    ) {

        await interaction.editReply({

            content:
                `🎫 Seu ticket foi criado: <#${result.channel.id}>`
        });


        return;
    }


    /*
    |--------------------------------------------------------------------------
    | JÁ EXISTE
    |--------------------------------------------------------------------------
    */

    await interaction.editReply({

        content:
            `Você já possui um ticket aberto: <#${result.channel.id}>`
    });
}


/*
|--------------------------------------------------------------------------
| /TICKET FECHAR
|--------------------------------------------------------------------------
*/

async function closeCommand(
    interaction:
        ChatInputCommandInteraction
):
    Promise<void> {

    const guild =
        interaction.guild;


    if (
        !guild
    ) {

        throw new Error(
            'Este comando só funciona dentro de um servidor.'
        );
    }


    /*
    |--------------------------------------------------------------------------
    | CANAL ATUAL
    |--------------------------------------------------------------------------
    */

    const channel =
        interaction.channel;


    if (
        !channel ||
        channel.type !==
            ChannelType.GuildText
    ) {

        throw new Error(
            'Use `/ticket fechar` dentro de um canal de ticket.'
        );
    }


    /*
    |--------------------------------------------------------------------------
    | MOTIVO
    |--------------------------------------------------------------------------
    */

    const reason =
        interaction.options
            .getString(
                'motivo'
            );


    /*
    |--------------------------------------------------------------------------
    | MEMBRO
    |--------------------------------------------------------------------------
    */

    const member =
        await guild.members.fetch(
            interaction.user.id
        );


    /*
    |--------------------------------------------------------------------------
    | FECHAR
    |--------------------------------------------------------------------------
    */

    const ticket =
        await closeTicket(
            guild,
            channel.id,
            member,
            reason
        );


    /*
    |--------------------------------------------------------------------------
    | TENTAR MOSTRAR CONFIRMAÇÃO
    |--------------------------------------------------------------------------
    |
    | O canal acabou de ser apagado.
    |
    | Então não deixamos uma falha aqui
    | transformar um fechamento bem sucedido em erro.
    |
    */

    await interaction.editReply({

        content:
            `🔒 Ticket #${String(
                ticket.sequence
            ).padStart(
                4,
                '0'
            )} fechado.`
    })

        .catch(
            () => undefined
        );
}


/*
|--------------------------------------------------------------------------
| /TICKET ADICIONAR
|--------------------------------------------------------------------------
*/

async function addCommand(
    interaction:
        ChatInputCommandInteraction
):
    Promise<void> {

    const guild =
        interaction.guild;


    if (
        !guild
    ) {

        throw new Error(
            'Este comando só funciona dentro de um servidor.'
        );
    }


    /*
    |--------------------------------------------------------------------------
    | CANAL
    |--------------------------------------------------------------------------
    */

    const channel =
        interaction.channel;


    if (
        !channel ||
        channel.type !==
            ChannelType.GuildText
    ) {

        throw new Error(
            'Use este comando dentro de um canal de ticket.'
        );
    }


    /*
    |--------------------------------------------------------------------------
    | MEMBRO EXECUTOR
    |--------------------------------------------------------------------------
    */

    const member =
        await guild.members.fetch(
            interaction.user.id
        );


    /*
    |--------------------------------------------------------------------------
    | USUÁRIO
    |--------------------------------------------------------------------------
    */

    const user =
        interaction.options
            .getUser(
                'usuario',
                true
            );


    /*
    |--------------------------------------------------------------------------
    | ADICIONAR
    |--------------------------------------------------------------------------
    */

    await addUserToTicket(
        guild,
        channel.id,
        member,
        user
    );


    /*
    |--------------------------------------------------------------------------
    | RESPOSTA
    |--------------------------------------------------------------------------
    */

    await interaction.editReply({

        content:
            `✓ <@${user.id}> agora pode acessar este ticket.`
    });
}


/*
|--------------------------------------------------------------------------
| /TICKET REMOVER
|--------------------------------------------------------------------------
*/

async function removeCommand(
    interaction:
        ChatInputCommandInteraction
):
    Promise<void> {

    const guild =
        interaction.guild;


    if (
        !guild
    ) {

        throw new Error(
            'Este comando só funciona dentro de um servidor.'
        );
    }


    /*
    |--------------------------------------------------------------------------
    | CANAL
    |--------------------------------------------------------------------------
    */

    const channel =
        interaction.channel;


    if (
        !channel ||
        channel.type !==
            ChannelType.GuildText
    ) {

        throw new Error(
            'Use este comando dentro de um canal de ticket.'
        );
    }


    /*
    |--------------------------------------------------------------------------
    | MEMBRO EXECUTOR
    |--------------------------------------------------------------------------
    */

    const member =
        await guild.members.fetch(
            interaction.user.id
        );


    /*
    |--------------------------------------------------------------------------
    | USUÁRIO
    |--------------------------------------------------------------------------
    */

    const user =
        interaction.options
            .getUser(
                'usuario',
                true
            );


    /*
    |--------------------------------------------------------------------------
    | REMOVER
    |--------------------------------------------------------------------------
    */

    await removeUserFromTicket(
        guild,
        channel.id,
        member,
        user
    );


    /*
    |--------------------------------------------------------------------------
    | RESPOSTA
    |--------------------------------------------------------------------------
    */

    await interaction.editReply({

        content:
            `✓ <@${user.id}> não possui mais acesso adicional a este ticket.`
    });
}


/*
|--------------------------------------------------------------------------
| /TICKET SINCRONIZAR
|--------------------------------------------------------------------------
|
| Exemplo:
|
| você tinha 4 tickets abertos
|
| criou @Staff depois
|
| /ticket configurar cargo_staff:@Staff
|
| /ticket sincronizar
|
| Os 4 tickets recebem @Staff.
|
|--------------------------------------------------------------------------
*/

async function syncCommand(
    interaction:
        ChatInputCommandInteraction
):
    Promise<void> {

    const guild =
        interaction.guild;


    if (
        !guild
    ) {

        throw new Error(
            'Este comando só funciona dentro de um servidor.'
        );
    }


    /*
    |--------------------------------------------------------------------------
    | STAFF
    |--------------------------------------------------------------------------
    */

    if (
        !(await requireStaff(
            interaction
        ))
    ) {

        return;
    }


    /*
    |--------------------------------------------------------------------------
    | SINCRONIZAR
    |--------------------------------------------------------------------------
    */

    const result =
        await synchronizeTickets(
            guild
        );


    /*
    |--------------------------------------------------------------------------
    | RESULTADO
    |--------------------------------------------------------------------------
    */

    const lines: string[] = [

        `Tickets sincronizados: **${result.synchronized}**`,

        `Registros antigos removidos: **${result.removedStale}**`
    ];


    /*
    |--------------------------------------------------------------------------
    | AVISOS
    |--------------------------------------------------------------------------
    */

    if (
        result.warnings.length >
        0
    ) {

        lines.push(

            '',

            '**Avisos:**',

            ...result.warnings

                .slice(
                    0,
                    8
                )

                .map(
                    warning =>
                        `• ${warning}`
                )
        );
    }


    /*
    |--------------------------------------------------------------------------
    | RESPOSTA
    |--------------------------------------------------------------------------
    */

    await interaction.editReply({

        embeds: [

            baseEmbed()

                .setTitle(
                    'Tickets sincronizados'
                )

                .setDescription(
                    lines.join(
                        '\n'
                    )
                )
        ],

        components: []
    });
}


/*
|--------------------------------------------------------------------------
| COMANDO /TICKET
|--------------------------------------------------------------------------
*/

export const ticketCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'ticket'
            )

            .setDescription(
                'Configura e gerencia o sistema de tickets.'
            )


            /*
            |--------------------------------------------------------------------------
            | /ticket configurar
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'configurar'
                        )

                        .setDescription(
                            'Define canais, categoria e cargo de staff.'
                        )


                        /*
                        |--------------------------------------------------------------------------
                        | CATEGORIA
                        |--------------------------------------------------------------------------
                        */

                        .addChannelOption(
                            option =>

                                option

                                    .setName(
                                        'categoria'
                                    )

                                    .setDescription(
                                        'Categoria onde os tickets ficarão.'
                                    )

                                    .addChannelTypes(
                                        ChannelType.GuildCategory
                                    )

                                    .setRequired(
                                        false
                                    )
                        )


                        /*
                        |--------------------------------------------------------------------------
                        | STAFF
                        |--------------------------------------------------------------------------
                        */

                        .addRoleOption(
                            option =>

                                option

                                    .setName(
                                        'cargo_staff'
                                    )

                                    .setDescription(
                                        'Cargo que poderá atender tickets.'
                                    )

                                    .setRequired(
                                        false
                                    )
                        )


                        /*
                        |--------------------------------------------------------------------------
                        | LOGS
                        |--------------------------------------------------------------------------
                        */

                        .addChannelOption(
                            option =>

                                option

                                    .setName(
                                        'canal_logs'
                                    )

                                    .setDescription(
                                        'Canal que receberá os logs de tickets.'
                                    )

                                    .addChannelTypes(
                                        ChannelType.GuildText
                                    )

                                    .setRequired(
                                        false
                                    )
                        )


                        /*
                        |--------------------------------------------------------------------------
                        | PAINEL
                        |--------------------------------------------------------------------------
                        */

                        .addChannelOption(
                            option =>

                                option

                                    .setName(
                                        'canal_painel'
                                    )

                                    .setDescription(
                                        'Canal em que o painel de tickets será publicado.'
                                    )

                                    .addChannelTypes(
                                        ChannelType.GuildText
                                    )

                                    .setRequired(
                                        false
                                    )
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | /ticket status
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'status'
                        )

                        .setDescription(
                            'Mostra a configuração atual dos tickets.'
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | /ticket desvincular
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'desvincular'
                        )

                        .setDescription(
                            'Remove uma referência da configuração.'
                        )

                        .addStringOption(
                            option =>

                                option

                                    .setName(
                                        'item'
                                    )

                                    .setDescription(
                                        'O que será desvinculado.'
                                    )

                                    .setRequired(
                                        true
                                    )

                                    .addChoices(

                                        {

                                            name:
                                                'Categoria',

                                            value:
                                                'categoria'
                                        },

                                        {

                                            name:
                                                'Cargo Staff',

                                            value:
                                                'cargo_staff'
                                        },

                                        {

                                            name:
                                                'Canal de logs',

                                            value:
                                                'canal_logs'
                                        },

                                        {

                                            name:
                                                'Canal do painel',

                                            value:
                                                'canal_painel'
                                        }
                                    )
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | /ticket painel
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'painel'
                        )

                        .setDescription(
                            'Publica ou atualiza o painel de abertura.'
                        )

                        .addChannelOption(
                            option =>

                                option

                                    .setName(
                                        'canal'
                                    )

                                    .setDescription(
                                        'Opcional: publica e salva em outro canal.'
                                    )

                                    .addChannelTypes(
                                        ChannelType.GuildText
                                    )

                                    .setRequired(
                                        false
                                    )
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | /ticket abrir
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'abrir'
                        )

                        .setDescription(
                            'Abre seu ticket sem precisar do painel.'
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | /ticket fechar
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'fechar'
                        )

                        .setDescription(
                            'Fecha o ticket do canal atual.'
                        )

                        .addStringOption(
                            option =>

                                option

                                    .setName(
                                        'motivo'
                                    )

                                    .setDescription(
                                        'Motivo opcional do fechamento.'
                                    )

                                    .setMaxLength(
                                        300
                                    )

                                    .setRequired(
                                        false
                                    )
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | /ticket adicionar
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'adicionar'
                        )

                        .setDescription(
                            'Adiciona um usuário ao ticket atual.'
                        )

                        .addUserOption(
                            option =>

                                option

                                    .setName(
                                        'usuario'
                                    )

                                    .setDescription(
                                        'Usuário que ganhará acesso.'
                                    )

                                    .setRequired(
                                        true
                                    )
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | /ticket remover
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'remover'
                        )

                        .setDescription(
                            'Remove um usuário adicional do ticket.'
                        )

                        .addUserOption(
                            option =>

                                option

                                    .setName(
                                        'usuario'
                                    )

                                    .setDescription(
                                        'Usuário que perderá o acesso adicional.'
                                    )

                                    .setRequired(
                                        true
                                    )
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | /ticket sincronizar
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'sincronizar'
                        )

                        .setDescription(
                            'Reaplica categoria, staff e permissões nos tickets ativos.'
                        )
            ),


    /*
    |--------------------------------------------------------------------------
    | STAFF ONLY
    |--------------------------------------------------------------------------
    |
    | FALSE de propósito.
    |
    | Porque:
    |
    | /ticket abrir
    | /ticket fechar
    |
    | são comandos que usuários comuns precisam usar.
    |
    | Os subcomandos administrativos possuem
    | requireStaff() individualmente.
    |
    |--------------------------------------------------------------------------
    */

    staffOnly:
        false,


    /*
    |--------------------------------------------------------------------------
    | EXECUTE
    |--------------------------------------------------------------------------
    */

    async execute(
        interaction:
            ChatInputCommandInteraction
    ):
        Promise<void> {

        /*
        |--------------------------------------------------------------------------
        | DEFER IMEDIATO
        |--------------------------------------------------------------------------
        |
        | O sistema pode consultar:
        |
        | canais
        | cargos
        | arquivos
        | configurações
        |
        | Então reconhecemos a interação imediatamente.
        |
        |--------------------------------------------------------------------------
        */

        if (
            !interaction.deferred &&
            !interaction.replied
        ) {

            await interaction.deferReply({

                flags:
                    MessageFlags.Ephemeral
            });
        }


        try {

            /*
            |--------------------------------------------------------------------------
            | SUBCOMANDO
            |--------------------------------------------------------------------------
            */

            const subcommand =
                interaction.options
                    .getSubcommand();


            switch (
                subcommand
            ) {

                /*
                |--------------------------------------------------------------------------
                | CONFIGURAR
                |--------------------------------------------------------------------------
                */

                case 'configurar':

                    await configureCommand(
                        interaction
                    );

                    return;


                /*
                |--------------------------------------------------------------------------
                | STATUS
                |--------------------------------------------------------------------------
                */

                case 'status':

                    if (
                        !(await requireStaff(
                            interaction
                        ))
                    ) {

                        return;
                    }


                    await renderStatus(
                        interaction
                    );


                    return;


                /*
                |--------------------------------------------------------------------------
                | DESVINCULAR
                |--------------------------------------------------------------------------
                */

                case 'desvincular':

                    await unlinkCommand(
                        interaction
                    );

                    return;


                /*
                |--------------------------------------------------------------------------
                | PAINEL
                |--------------------------------------------------------------------------
                */

                case 'painel':

                    await panelCommand(
                        interaction
                    );

                    return;


                /*
                |--------------------------------------------------------------------------
                | ABRIR
                |--------------------------------------------------------------------------
                */

                case 'abrir':

                    await openCommand(
                        interaction
                    );

                    return;


                /*
                |--------------------------------------------------------------------------
                | FECHAR
                |--------------------------------------------------------------------------
                */

                case 'fechar':

                    await closeCommand(
                        interaction
                    );

                    return;


                /*
                |--------------------------------------------------------------------------
                | ADICIONAR
                |--------------------------------------------------------------------------
                */

                case 'adicionar':

                    await addCommand(
                        interaction
                    );

                    return;


                /*
                |--------------------------------------------------------------------------
                | REMOVER
                |--------------------------------------------------------------------------
                */

                case 'remover':

                    await removeCommand(
                        interaction
                    );

                    return;


                /*
                |--------------------------------------------------------------------------
                | SINCRONIZAR
                |--------------------------------------------------------------------------
                */

                case 'sincronizar':

                    await syncCommand(
                        interaction
                    );

                    return;


                /*
                |--------------------------------------------------------------------------
                | INVÁLIDO
                |--------------------------------------------------------------------------
                */

                default:

                    await interaction.editReply({

                        content:
                            '❌ Subcomando de ticket desconhecido.'
                    });
            }

        } catch (error) {

            /*
            |--------------------------------------------------------------------------
            | LOG
            |--------------------------------------------------------------------------
            */

            console.error(
                '[TICKET] Erro em /ticket:',
                error
            );


            /*
            |--------------------------------------------------------------------------
            | RESPOSTA
            |--------------------------------------------------------------------------
            */

            try {

                await interaction.editReply({

                    content:
                        `❌ ${errorText(
                            error
                        )}`,

                    embeds: [],

                    components: []
                });

            } catch (
                responseError
            ) {

                /*
                 * Erro ao mostrar o erro
                 * não pode derrubar o Node.
                 */

                console.error(
                    '[TICKET] Também não consegui responder ao erro:',
                    responseError
                );
            }
        }
    }
};