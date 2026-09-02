import {
    ChannelType,
    PermissionFlagsBits
} from 'discord.js';


import type {
    CategoryChannel,
    Guild,
    GuildMember,
    Message,
    OverwriteResolvable,
    PermissionOverwriteOptions,
    Role,
    TextChannel,
    User
} from 'discord.js';

import type {
    ActiveTicket,
    TicketConfig,
    TicketReferenceStatus
} from '../tickets/types.js';

import {
    ticketControlRow,
    ticketLogEmbed,
    ticketOpenedEmbed,
    ticketPanelEmbed,
    ticketPanelRow
} from '../embeds/ticket.js';

import {
    allocateTicketSequence,
    getTicketGuildData,
    patchTicketConfig,
    removeActiveTicketByChannel,
    removeActiveTicketByOpener,
    updateActiveTicket,
    upsertActiveTicket
} from './ticket-store.js';

import {
    makeCategoryReference,
    makeTextReference,
    resolveTicketConfig
} from './ticket-resolver.js';




/*
|--------------------------------------------------------------------------
| TIPOS
|--------------------------------------------------------------------------
*/

export interface TicketConfigState {

    config:
        TicketConfig;


    category: {

        status:
            TicketReferenceStatus;

        value:
            CategoryChannel | null;
    };


    staffRole: {

        status:
            TicketReferenceStatus;

        value:
            Role | null;
    };


    logsChannel: {

        status:
            TicketReferenceStatus;

        value:
            TextChannel | null;
    };


    panelChannel: {

        status:
            TicketReferenceStatus;

        value:
            TextChannel | null;
    };


    openTickets:
        ActiveTicket[];


    repaired:
        boolean;
}


export interface OpenTicketResult {

    created:
        boolean;

    ticket:
        ActiveTicket;

    channel:
        TextChannel;
}


export interface SyncTicketResult {

    synchronized:
        number;

    removedStale:
        number;

    warnings:
        string[];
}


/*
|--------------------------------------------------------------------------
| NOME DE CANAL
|--------------------------------------------------------------------------
*/

function cleanChannelName(
    value: string
):
    string {

    const normalized =
        value

            .normalize(
                'NFD'
            )

            .replace(
                /[\u0300-\u036f]/g,
                ''
            )

            .toLowerCase()

            .replace(
                /[^a-z0-9-_]/g,
                '-'
            )

            .replace(
                /-+/g,
                '-'
            )

            .replace(
                /^-+|-+$/g,
                ''
            )

            .slice(
                0,
                55
            );


    return (
        normalized ||
        'usuario'
    );
}


/*
|--------------------------------------------------------------------------
| NÚMERO FORMATADO
|--------------------------------------------------------------------------
*/

function formattedTicketNumber(
    ticket: ActiveTicket
):
    string {

    return String(
        ticket.sequence
    ).padStart(
        4,
        '0'
    );
}


/*
|--------------------------------------------------------------------------
| PERMISSÕES DO USUÁRIO
|--------------------------------------------------------------------------
*/

function ticketPermissionsForUser():
    PermissionOverwriteOptions {

    return {

        ViewChannel:
            true,

        SendMessages:
            true,

        ReadMessageHistory:
            true,

        AttachFiles:
            true,

        EmbedLinks:
            true,

        AddReactions:
            true
    };
}


/*
|--------------------------------------------------------------------------
| PERMISSÕES DA STAFF
|--------------------------------------------------------------------------
*/

function ticketPermissionsForStaff():
    PermissionOverwriteOptions {

    return {

        ViewChannel:
            true,

        SendMessages:
            true,

        ReadMessageHistory:
            true,

        AttachFiles:
            true,

        EmbedLinks:
            true,

        AddReactions:
            true,

        ManageMessages:
            true
    };
}


/*
|--------------------------------------------------------------------------
| QUEM PODE GERENCIAR
|--------------------------------------------------------------------------
*/

export function memberCanManageTickets(
    member: GuildMember,
    staffRole: Role | null
):
    boolean {

    if (
        member.id ===
        member.guild.ownerId
    ) {

        return true;
    }


    if (
        member.permissions.has(
            PermissionFlagsBits.Administrator
        ) ||

        member.permissions.has(
            PermissionFlagsBits.ManageChannels
        ) ||

        member.permissions.has(
            PermissionFlagsBits.ManageGuild
        )
    ) {

        return true;
    }


    return (

        !!staffRole &&

        member.roles.cache.has(
            staffRole.id
        )
    );
}


/*
|--------------------------------------------------------------------------
| CONFIGURAÇÃO RESOLVIDA
|--------------------------------------------------------------------------
*/

export async function getTicketConfigState(
    guild: Guild
):
    Promise<TicketConfigState> {

    const data =
        await getTicketGuildData(
            guild.id
        );


    const resolved =
        await resolveTicketConfig(
            guild,
            data.config
        );


    return {

        config:
            resolved.config,

        category:
            resolved.category,

        staffRole:
            resolved.staffRole,

        logsChannel:
            resolved.logsChannel,

        panelChannel:
            resolved.panelChannel,

        openTickets:
            data.activeTickets,

        repaired:
            resolved.repaired
    };
}


/*
|--------------------------------------------------------------------------
| GARANTIR CATEGORIA
|--------------------------------------------------------------------------
*/

async function ensureTicketCategory(
    guild: Guild
):
    Promise<CategoryChannel> {

    const state =
        await getTicketConfigState(
            guild
        );


    if (
        state.category.value
    ) {

        return state.category.value;
    }


    if (
        state.category.status ===
        'ambiguous'
    ) {

        throw new Error(
            'Existem várias categorias com o mesmo nome salvo para tickets. Use `/ticket configurar categoria:` e selecione a categoria correta.'
        );
    }


    const desiredName =
        state.config.category?.name ??
        'TICKETS';


    const category =
        await guild.channels.create({

            name:
                desiredName,

            type:
                ChannelType.GuildCategory,

            reason:
                'StandardBot: categoria automática do sistema de tickets'
        });


    await patchTicketConfig(
        guild.id,
        {

            category:
                makeCategoryReference(
                    category
                )
        }
    );


    return category;
}


/*
|--------------------------------------------------------------------------
| LOG
|--------------------------------------------------------------------------
*/

async function sendTicketLog(
    guild: Guild,

    action:
        Parameters<
            typeof ticketLogEmbed
        >[0],

    ticket:
        ActiveTicket,

    actorId:
        string,

    details:
        string | null = null
):
    Promise<void> {

    try {

        const state =
            await getTicketConfigState(
                guild
            );


        const logs =
            state.logsChannel.value;


        if (
            !logs
        ) {

            return;
        }


        await logs.send({

            embeds: [

                ticketLogEmbed(
                    action,
                    ticket,
                    actorId,
                    details
                )
            ]
        });

    } catch (error) {

        console.error(
            '[TICKET] Não consegui enviar log:',
            error
        );
    }
}


/*
|--------------------------------------------------------------------------
| CONTEÚDO DA MENSAGEM PRINCIPAL
|--------------------------------------------------------------------------
*/

function ticketMainMessageContent(
    ticket: ActiveTicket,
    staffRole: Role | null
):
    string {

    if (
        staffRole
    ) {

        return (
            `<@${ticket.openerId}> <@&${staffRole.id}>`
        );
    }


    return (
        `<@${ticket.openerId}>`
    );
}


/*
|--------------------------------------------------------------------------
| PROCURAR MENSAGEM PRINCIPAL
|--------------------------------------------------------------------------
|
| Tickets novos possuem messageId.
|
| Tickets antigos, como o que você já tinha aberto antes
| desta atualização, não possuem.
|
| Para eles buscamos a mensagem do bot pelo título:
|
| Atendimento #0006
|
|--------------------------------------------------------------------------
*/

async function findTicketMainMessage(
    channel: TextChannel,
    ticket: ActiveTicket,
    botId: string
):
    Promise<Message | null> {

    /*
    |--------------------------------------------------------------------------
    | 1. ID SALVO
    |--------------------------------------------------------------------------
    */

    if (
        ticket.messageId
    ) {

        const byId =
            await channel.messages

                .fetch(
                    ticket.messageId
                )

                .catch(
                    () => null
                );


        if (
            byId &&
            byId.author.id ===
                botId
        ) {

            return byId;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | 2. FALLBACK PARA TICKETS ANTIGOS
    |--------------------------------------------------------------------------
    */

    const expectedTitle =
        `Atendimento #${formattedTicketNumber(
            ticket
        )}`;


    const recentMessages =
        await channel.messages.fetch({

            limit:
                100
        });


    const found =
        recentMessages.find(
            message =>

                message.author.id ===
                    botId &&

                message.embeds.some(
                    embed =>
                        embed.title ===
                        expectedTitle
                )
        );


    return (
        found ??
        null
    );
}


/*
|--------------------------------------------------------------------------
| ATUALIZAR MENSAGEM PRINCIPAL
|--------------------------------------------------------------------------
|
| Essa função resolve justamente:
|
| @cargo desconhecido
|
| depois que /modelo recriar @Staff.
|
|--------------------------------------------------------------------------
*/

async function refreshTicketMainMessage(
    guild: Guild,
    channel: TextChannel,
    ticket: ActiveTicket,
    staffRole: Role | null,
    warnings: string[]
):
    Promise<void> {

    const botMember =
        guild.members.me;


    if (
        !botMember
    ) {

        warnings.push(
            `Não consegui atualizar a mensagem do ticket #${formattedTicketNumber(ticket)} porque o membro do bot não foi encontrado.`
        );


        return;
    }


    /*
    |--------------------------------------------------------------------------
    | LOCALIZAR MENSAGEM
    |--------------------------------------------------------------------------
    */

    const message =
        await findTicketMainMessage(
            channel,
            ticket,
            botMember.id
        )

            .catch(
                error => {

                    console.error(

                        `[TICKET] Não consegui procurar a mensagem principal do ticket #${formattedTicketNumber(ticket)}:`,

                        error
                    );


                    return null;
                }
            );


    if (
        !message
    ) {

        warnings.push(
            `Não encontrei a mensagem principal do ticket #${formattedTicketNumber(ticket)} para atualizá-la.`
        );


        return;
    }


    /*
    |--------------------------------------------------------------------------
    | ATUALIZAR
    |--------------------------------------------------------------------------
    |
    | Isso troca:
    |
    | @cargo desconhecido
    |
    | pelo novo:
    |
    | @Staff
    |
    |--------------------------------------------------------------------------
    */

    try {

        await message.edit({

            content:
                ticketMainMessageContent(
                    ticket,
                    staffRole
                ),


            allowedMentions: {

                users: [
                    ticket.openerId
                ],

                roles:
                    staffRole

                        ? [
                            staffRole.id
                        ]

                        : []
            },


            embeds: [

                ticketOpenedEmbed(
                    ticket,
                    !!staffRole
                )
            ],


            components: [

                ticketControlRow(
                    channel.id
                )
            ]
        });

    } catch (error) {

        console.error(

            `[TICKET] Não consegui atualizar a mensagem principal do ticket #${formattedTicketNumber(ticket)}:`,

            error
        );


        warnings.push(
            `Não consegui atualizar a mensagem principal do ticket #${formattedTicketNumber(ticket)}.`
        );


        return;
    }


    /*
    |--------------------------------------------------------------------------
    | SALVAR ID PARA AS PRÓXIMAS VEZES
    |--------------------------------------------------------------------------
    |
    | Aqui os tickets antigos passam a ganhar messageId.
    |
    |--------------------------------------------------------------------------
    */

    if (
        ticket.messageId !==
        message.id
    ) {

        const updated =
            await updateActiveTicket(
                guild.id,
                ticket.channelId,

                current => {

                    current.messageId =
                        message.id;
                }
            );


        if (
            updated
        ) {

            ticket.messageId =
                message.id;
        }
    }
}


/*
|--------------------------------------------------------------------------
| PUBLICAR PAINEL
|--------------------------------------------------------------------------
*/

export async function publishTicketPanel(
    guild: Guild,
    explicitChannel: TextChannel | null
):
    Promise<{

        channel:
            TextChannel;

        message:
            Message;

        updated:
            boolean;
    }> {

    let state =
        await getTicketConfigState(
            guild
        );


    let channel =
        explicitChannel ??
        state.panelChannel.value;


    if (
        !channel
    ) {

        throw new Error(
            'Nenhum canal de painel foi definido. Use `/ticket configurar canal_painel:#canal` ou informe o canal em `/ticket painel`.'
        );
    }


    if (
        explicitChannel
    ) {

        const oldChannelId =
            state.config
                .panelChannel
                ?.id;


        await patchTicketConfig(
            guild.id,
            {

                panelChannel:
                    makeTextReference(
                        explicitChannel
                    ),

                ...(
                    oldChannelId !==
                    explicitChannel.id

                        ? {
                            panelMessageId:
                                null
                        }

                        : {}
                )
            }
        );


        state =
            await getTicketConfigState(
                guild
            );


        channel =
            explicitChannel;
    }


    /*
    |--------------------------------------------------------------------------
    | ATUALIZAR PAINEL EXISTENTE
    |--------------------------------------------------------------------------
    */

    if (
        state.config.panelMessageId &&
        state.config.panelChannel?.id ===
            channel.id
    ) {

        try {

            const existing =
                await channel.messages.fetch(
                    state.config.panelMessageId
                );


            await existing.edit({

                embeds: [
                    ticketPanelEmbed()
                ],

                components: [
                    ticketPanelRow()
                ]
            });


            return {

                channel,

                message:
                    existing,

                updated:
                    true
            };

        } catch {

            /*
             * Mensagem antiga não existe mais.
             * Uma nova será publicada.
             */
        }
    }


    /*
    |--------------------------------------------------------------------------
    | NOVO PAINEL
    |--------------------------------------------------------------------------
    */


    const message =
        await channel.send({

            embeds: [
                ticketPanelEmbed()
            ],

            components: [
                ticketPanelRow()
            ]
        });


    await patchTicketConfig(
        guild.id,
        {

            panelChannel:
                makeTextReference(
                    channel
                ),

            panelMessageId:
                message.id
        }
    );


    return {

        channel,

        message,

        updated:
            false
    };
}


/*
|--------------------------------------------------------------------------
| TICKET EXISTENTE
|--------------------------------------------------------------------------
*/

async function findExistingTicket(
    guild: Guild,
    openerId: string
):
    Promise<{

        ticket:
            ActiveTicket;

        channel:
            TextChannel;

    } | null> {

    const data =
        await getTicketGuildData(
            guild.id
        );


    const existing =
        data.activeTickets.find(
            ticket =>
                ticket.openerId ===
                openerId
        );


    if (
        !existing
    ) {

        return null;
    }


    await guild.channels.fetch();


    const channel =
        guild.channels.cache.get(
            existing.channelId
        );


    if (
        channel &&
        channel.type ===
            ChannelType.GuildText
    ) {

        return {

            ticket:
                existing,

            channel:
                channel as TextChannel
        };
    }


    /*
     * Registro existe, canal morreu.
     */

    await removeActiveTicketByOpener(
        guild.id,
        openerId
    );


    return null;
}


/*
|--------------------------------------------------------------------------
| ABRIR TICKET
|--------------------------------------------------------------------------
*/

export async function openTicket(
    guild: Guild,
    user: User
):
    Promise<OpenTicketResult> {

    /*
    |--------------------------------------------------------------------------
    | IMPEDIR DUPLICADO
    |--------------------------------------------------------------------------
    */

    const existing =
        await findExistingTicket(
            guild,
            user.id
        );


    if (
        existing
    ) {

        return {

            created:
                false,

            ticket:
                existing.ticket,

            channel:
                existing.channel
        };
    }


    /*
    |--------------------------------------------------------------------------
    | CATEGORIA
    |--------------------------------------------------------------------------
    */

    const category =
        await ensureTicketCategory(
            guild
        );


    /*
    |--------------------------------------------------------------------------
    | CONFIGURAÇÃO
    |--------------------------------------------------------------------------
    */

    const state =
        await getTicketConfigState(
            guild
        );


    const staffRole =
        state.staffRole.value;


    /*
    |--------------------------------------------------------------------------
    | MEMBRO
    |--------------------------------------------------------------------------
    */

    const member =
        await guild.members.fetch(
            user.id
        );


    /*
    |--------------------------------------------------------------------------
    | BOT
    |--------------------------------------------------------------------------
    */

    const botMember =
        guild.members.me;


    if (
        !botMember
    ) {

        throw new Error(
            'Não consegui localizar o próprio bot dentro do servidor.'
        );
    }


    /*
    |--------------------------------------------------------------------------
    | NÚMERO
    |--------------------------------------------------------------------------
    */

    const sequence =
        await allocateTicketSequence(
            guild.id
        );


    /*
    |--------------------------------------------------------------------------
    | NOME
    |--------------------------------------------------------------------------
    */

    const baseName =
        cleanChannelName(
            member.displayName ||
            user.username
        );


    const channelName =
        `ticket-${baseName}-${String(
            sequence
        ).padStart(
            4,
            '0'
        )}`

            .slice(
                0,
                100
            );


    /*
    |--------------------------------------------------------------------------
    | PERMISSÕES
    |--------------------------------------------------------------------------
    */

    const permissionOverwrites:
        OverwriteResolvable[] = [

        {
            id:
                guild.roles.everyone.id,

            deny: [
                PermissionFlagsBits.ViewChannel
            ]
        },


        {
            id:
                user.id,

            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AddReactions
            ]
        },


        {
            id:
                botMember.id,

            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages
            ]
        }
    ];


    if (
        staffRole
    ) {

        permissionOverwrites.push({

            id:
                staffRole.id,

            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AddReactions,
                PermissionFlagsBits.ManageMessages
            ]
        });
    }


    /*
    |--------------------------------------------------------------------------
    | CRIAR CANAL
    |--------------------------------------------------------------------------
    */

    const channel =
        await guild.channels.create({

            name:
                channelName,

            type:
                ChannelType.GuildText,

            parent:
                category.id,

            topic:
                `StandardBot Ticket • opener:${user.id} • ticket:${sequence}`,

            permissionOverwrites,

            reason:
                `StandardBot: ticket aberto por ${user.tag}`
        });


    /*
    |--------------------------------------------------------------------------
    | REGISTRO
    |--------------------------------------------------------------------------
    */

    const ticket:
        ActiveTicket = {

        sequence,

        channelId:
            channel.id,

        channelName:
            channel.name,

        openerId:
            user.id,

        openedAt:
            new Date()
                .toISOString(),

        claimedById:
            null,

        extraUserIds:
            [],

        messageId:
            null
    };


    /*
    |--------------------------------------------------------------------------
    | SALVAR ANTES DA MENSAGEM
    |--------------------------------------------------------------------------
    |
    | Se algo demorar depois, o canal já é oficialmente
    | reconhecido como ticket pelo sistema.
    |
    |--------------------------------------------------------------------------
    */

    await upsertActiveTicket(
        guild.id,
        ticket
    );


    /*
    |--------------------------------------------------------------------------
    | MENSAGEM PRINCIPAL
    |--------------------------------------------------------------------------
    */

    try {

        const initialMessage =
            await channel.send({

                content:
                    ticketMainMessageContent(
                        ticket,
                        staffRole
                    ),


                allowedMentions: {

                    users: [
                        user.id
                    ],

                    roles:
                        staffRole

                            ? [
                                staffRole.id
                            ]

                            : []
                },


                embeds: [

                    ticketOpenedEmbed(
                        ticket,
                        !!staffRole
                    )
                ],


                components: [

                    ticketControlRow(
                        channel.id
                    )
                ]
            });


        /*
        |--------------------------------------------------------------------------
        | SALVAR MESSAGE ID
        |--------------------------------------------------------------------------
        */

        ticket.messageId =
            initialMessage.id;


        await updateActiveTicket(
            guild.id,
            channel.id,

            current => {

                current.messageId =
                    initialMessage.id;
            }
        );

    } catch (error) {

        /*
         * Se não conseguimos nem criar a mensagem principal,
         * não deixamos um ticket quebrado abandonado.
         */

        await removeActiveTicketByChannel(
            guild.id,
            channel.id
        )

            .catch(
                () => undefined
            );


        await channel.delete(
            'StandardBot: falha ao inicializar o ticket'
        )

            .catch(
                () => undefined
            );


        throw error;
    }


    /*
    |--------------------------------------------------------------------------
    | LOG
    |--------------------------------------------------------------------------
    */

    await sendTicketLog(
        guild,
        'opened',
        ticket,
        user.id,
        `Canal: <#${channel.id}>`
    );


    return {

        created:
            true,

        ticket,

        channel
    };
}


/*
|--------------------------------------------------------------------------
| PEGAR TICKET PELO CANAL
|--------------------------------------------------------------------------
*/

export async function getTicketByChannel(
    guild: Guild,
    channelId: string
):
    Promise<ActiveTicket | null> {

    const data =
        await getTicketGuildData(
            guild.id
        );


    return (

        data.activeTickets.find(
            ticket =>
                ticket.channelId ===
                channelId
        ) ??

        null
    );
}


/*
|--------------------------------------------------------------------------
| ASSUMIR
|--------------------------------------------------------------------------
*/

export async function claimTicket(
    guild: Guild,
    channelId: string,
    actor: GuildMember
):
    Promise<ActiveTicket> {

    const state =
        await getTicketConfigState(
            guild
        );


    if (
        !memberCanManageTickets(
            actor,
            state.staffRole.value
        )
    ) {

        throw new Error(
            'Você não possui permissão para assumir tickets.'
        );
    }


    const ticket =
        await updateActiveTicket(
            guild.id,
            channelId,

            current => {

                current.claimedById =
                    actor.id;
            }
        );


    if (
        !ticket
    ) {

        throw new Error(
            'Este canal não está registrado como um ticket ativo.'
        );
    }


    await sendTicketLog(
        guild,
        'claimed',
        ticket,
        actor.id,
        null
    );


    return ticket;
}


/*
|--------------------------------------------------------------------------
| FECHAR
|--------------------------------------------------------------------------
*/

export async function closeTicket(
    guild: Guild,
    channelId: string,
    actor: GuildMember,
    reason: string | null
):
    Promise<ActiveTicket> {

    const ticket =
        await getTicketByChannel(
            guild,
            channelId
        );


    if (
        !ticket
    ) {

        throw new Error(
            'Este canal não está registrado como um ticket ativo.'
        );
    }


    const state =
        await getTicketConfigState(
            guild
        );


    const canManage =
        memberCanManageTickets(
            actor,
            state.staffRole.value
        );


    if (
        actor.id !==
            ticket.openerId &&
        !canManage
    ) {

        throw new Error(
            'Somente o autor do ticket ou a equipe pode fechar este atendimento.'
        );
    }


    const channel =
        guild.channels.cache.get(
            channelId
        );


    if (
        !channel ||
        channel.type !==
            ChannelType.GuildText
    ) {

        await removeActiveTicketByChannel(
            guild.id,
            channelId
        );


        throw new Error(
            'O canal deste ticket já não existe. O registro antigo foi limpo.'
        );
    }


    await sendTicketLog(
        guild,
        'closed',
        ticket,
        actor.id,

        reason ??
        'Sem motivo informado.'
    );


    await channel.delete(
        `StandardBot: ticket fechado por ${actor.user.tag}${
            reason
                ? ` • ${reason}`
                : ''
        }`
    );


    await removeActiveTicketByChannel(
        guild.id,
        channelId
    );


    return ticket;
}


/*
|--------------------------------------------------------------------------
| ADICIONAR USUÁRIO
|--------------------------------------------------------------------------
*/

export async function addUserToTicket(
    guild: Guild,
    channelId: string,
    actor: GuildMember,
    user: User
):
    Promise<ActiveTicket> {

    const state =
        await getTicketConfigState(
            guild
        );


    if (
        !memberCanManageTickets(
            actor,
            state.staffRole.value
        )
    ) {

        throw new Error(
            'Você não possui permissão para adicionar usuários a tickets.'
        );
    }


    const ticket =
        await getTicketByChannel(
            guild,
            channelId
        );


    if (
        !ticket
    ) {

        throw new Error(
            'Este canal não está registrado como um ticket ativo.'
        );
    }


    const channel =
        guild.channels.cache.get(
            channelId
        );


    if (
        !channel ||
        channel.type !==
            ChannelType.GuildText
    ) {

        throw new Error(
            'O canal deste ticket não existe mais.'
        );
    }


    await channel.permissionOverwrites.edit(
        user.id,

        ticketPermissionsForUser(),

        {

            reason:
                `StandardBot: usuário adicionado ao ticket por ${actor.user.tag}`
        }
    );


    const updated =
        await updateActiveTicket(
            guild.id,
            channelId,

            current => {

                if (
                    current.openerId ===
                    user.id
                ) {

                    return;
                }


                if (
                    !current.extraUserIds.includes(
                        user.id
                    )
                ) {

                    current.extraUserIds.push(
                        user.id
                    );
                }
            }
        );


    if (
        !updated
    ) {

        throw new Error(
            'Não consegui atualizar o registro deste ticket.'
        );
    }


    await sendTicketLog(
        guild,
        'user-added',
        updated,
        actor.id,
        `Usuário: <@${user.id}>`
    );


    return updated;
}


/*
|--------------------------------------------------------------------------
| REMOVER USUÁRIO
|--------------------------------------------------------------------------
*/

export async function removeUserFromTicket(
    guild: Guild,
    channelId: string,
    actor: GuildMember,
    user: User
):
    Promise<ActiveTicket> {

    const state =
        await getTicketConfigState(
            guild
        );


    if (
        !memberCanManageTickets(
            actor,
            state.staffRole.value
        )
    ) {

        throw new Error(
            'Você não possui permissão para remover usuários de tickets.'
        );
    }


    const ticket =
        await getTicketByChannel(
            guild,
            channelId
        );


    if (
        !ticket
    ) {

        throw new Error(
            'Este canal não está registrado como um ticket ativo.'
        );
    }


    if (
        user.id ===
        ticket.openerId
    ) {

        throw new Error(
            'O autor do ticket não pode ser removido do próprio atendimento.'
        );
    }


    if (
        user.id ===
        guild.members.me?.id
    ) {

        throw new Error(
            'O próprio bot não pode ser removido do ticket.'
        );
    }


    const channel =
        guild.channels.cache.get(
            channelId
        );


    if (
        !channel ||
        channel.type !==
            ChannelType.GuildText
    ) {

        throw new Error(
            'O canal deste ticket não existe mais.'
        );
    }


    await channel.permissionOverwrites.delete(
        user.id,

        `StandardBot: usuário removido do ticket por ${actor.user.tag}`
    );


    const updated =
        await updateActiveTicket(
            guild.id,
            channelId,

            current => {

                current.extraUserIds =
                    current.extraUserIds.filter(
                        id =>
                            id !==
                            user.id
                    );
            }
        );


    if (
        !updated
    ) {

        throw new Error(
            'Não consegui atualizar o registro deste ticket.'
        );
    }


    await sendTicketLog(
        guild,
        'user-removed',
        updated,
        actor.id,
        `Usuário: <@${user.id}>`
    );


    return updated;
}


/*
|--------------------------------------------------------------------------
| SINCRONIZAR
|--------------------------------------------------------------------------
|
| Essa função agora faz QUATRO coisas:
|
| 1. categoria;
| 2. permissões;
| 3. novo @Staff;
| 4. mensagem principal / botões.
|
|--------------------------------------------------------------------------
*/

export async function synchronizeTickets(
    guild: Guild
):
    Promise<SyncTicketResult> {

    /*
    |--------------------------------------------------------------------------
    | CATEGORIA
    |--------------------------------------------------------------------------
    */

    const category =
        await ensureTicketCategory(
            guild
        );


    /*
    |--------------------------------------------------------------------------
    | CONFIGURAÇÃO
    |--------------------------------------------------------------------------
    */

    const state =
        await getTicketConfigState(
            guild
        );


    const staffRole =
        state.staffRole.value;


    /*
    |--------------------------------------------------------------------------
    | AVISOS
    |--------------------------------------------------------------------------
    */

    const warnings:
        string[] = [];


    /*
     * Existe staff salvo, mas não conseguimos resolver.
     */

    if (
        state.config.staffRole &&
        !staffRole
    ) {

        if (
            state.staffRole.status ===
            'ambiguous'
        ) {

            warnings.push(
                `O cargo de staff "${state.config.staffRole.name}" ficou ambíguo porque existem vários cargos com esse nome. Configure novamente com /ticket configurar.`
            );

        } else {

            warnings.push(
                `O cargo de staff "${state.config.staffRole.name}" não foi encontrado.`
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | BOT
    |--------------------------------------------------------------------------
    */

    const botMember =
        guild.members.me;


    if (
        !botMember
    ) {

        throw new Error(
            'Não consegui localizar o próprio bot dentro do servidor.'
        );
    }


    let synchronized =
        0;


    let removedStale =
        0;


    /*
    |--------------------------------------------------------------------------
    | TICKETS
    |--------------------------------------------------------------------------
    */

    for (
        const ticket
        of state.openTickets
    ) {

        /*
        |--------------------------------------------------------------------------
        | ATUALIZAR CANAL
        |--------------------------------------------------------------------------
        */

        await guild.channels.fetch(
            ticket.channelId
        )

            .catch(
                () => null
            );


        const channel =
            guild.channels.cache.get(
                ticket.channelId
            );


        /*
        |--------------------------------------------------------------------------
        | CANAL MORREU
        |--------------------------------------------------------------------------
        */

        if (
            !channel ||
            channel.type !==
                ChannelType.GuildText
        ) {

            await removeActiveTicketByChannel(
                guild.id,
                ticket.channelId
            );


            removedStale++;


            continue;
        }


        /*
        |--------------------------------------------------------------------------
        | CATEGORIA
        |--------------------------------------------------------------------------
        */

        if (
            channel.parentId !==
            category.id
        ) {

            await channel.setParent(
                category.id,
                {

                    lockPermissions:
                        false,

                    reason:
                        'StandardBot: sincronização da categoria de tickets'
                }
            );
        }


        /*
        |--------------------------------------------------------------------------
        | @EVERYONE
        |--------------------------------------------------------------------------
        */

        await channel.permissionOverwrites.edit(
            guild.roles.everyone.id,

            {

                ViewChannel:
                    false
            },

            {

                reason:
                    'StandardBot: sincronização de tickets'
            }
        );


        /*
        |--------------------------------------------------------------------------
        | AUTOR
        |--------------------------------------------------------------------------
        */

        await channel.permissionOverwrites.edit(
            ticket.openerId,

            ticketPermissionsForUser(),

            {

                reason:
                    'StandardBot: sincronização de tickets'
            }
        );


        /*
        |--------------------------------------------------------------------------
        | BOT
        |--------------------------------------------------------------------------
        */

        await channel.permissionOverwrites.edit(
            botMember.id,

            {

                ViewChannel:
                    true,

                SendMessages:
                    true,

                ReadMessageHistory:
                    true,

                ManageChannels:
                    true,

                ManageMessages:
                    true
            },

            {

                reason:
                    'StandardBot: sincronização de tickets'
            }
        );


        /*
        |--------------------------------------------------------------------------
        | STAFF
        |--------------------------------------------------------------------------
        */

        if (
            staffRole
        ) {

            await channel.permissionOverwrites.edit(
                staffRole.id,

                ticketPermissionsForStaff(),

                {

                    reason:
                        'StandardBot: sincronização do cargo de staff'
                }
            );
        }


        /*
        |--------------------------------------------------------------------------
        | USUÁRIOS ADICIONAIS
        |--------------------------------------------------------------------------
        */

        for (
            const userId
            of ticket.extraUserIds
        ) {

            await channel.permissionOverwrites.edit(
                userId,

                ticketPermissionsForUser(),

                {

                    reason:
                        'StandardBot: sincronização de usuário adicional'
                }
            )

                .catch(
                    () => {

                        warnings.push(
                            `Não consegui sincronizar o usuário ${userId} no ticket #${formattedTicketNumber(ticket)}.`
                        );
                    }
                );
        }


        /*
        |--------------------------------------------------------------------------
        | MENSAGEM PRINCIPAL
        |--------------------------------------------------------------------------
        |
        | É aqui que:
        |
        | @cargo desconhecido
        |
        | vira:
        |
        | @Staff novo
        |
        |--------------------------------------------------------------------------
        */

        await refreshTicketMainMessage(
            guild,
            channel,
            ticket,
            staffRole,
            warnings
        );


        synchronized++;
    }


    return {

        synchronized,

        removedStale,

        warnings
    };
}