import {
    MessageFlags,
    PermissionFlagsBits
} from 'discord.js';

import type {
    ButtonInteraction,
    GuildMember,
    Role
} from 'discord.js';

import {
    ticketCloseConfirmRow
} from '../embeds/ticket.js';

import {
    claimTicket,
    closeTicket,
    getTicketByChannel,
    getTicketConfigState,
    openTicket
} from '../services/ticket-service.js';


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function errorText(
    error:
        unknown
):
    string {

    return error instanceof Error

        ? error.message

        : String(
            error
        );
}


/*
|--------------------------------------------------------------------------
| ADMINISTRADOR
|--------------------------------------------------------------------------
*/

function memberIsAdministrator(
    member:
        GuildMember
):
    boolean {

    return (

        member.id ===
            member.guild.ownerId ||

        member.permissions.has(
            PermissionFlagsBits.Administrator
        )
    );
}


/*
|--------------------------------------------------------------------------
| SUPORTE DE TICKETS
|--------------------------------------------------------------------------
|
| Essa é a ÚNICA parte do bot em que um cargo configurado diretamente
| concede acesso a uma função.
|
| Esse cargo NÃO dá:
|
| - ban
| - kick
| - mute
| - nuke
| - modelos
| - setup
| - configuração do próprio sistema de tickets
|
| Ele serve somente para atender tickets pelos botões.
|
|--------------------------------------------------------------------------
*/

function memberIsTicketSupport(
    member:
        GuildMember,
    staffRole:
        Role | null
):
    boolean {

    if (
        memberIsAdministrator(
            member
        )
    ) {

        return true;
    }


    return (

        staffRole !==
            null &&

        member.roles.cache.has(
            staffRole.id
        )
    );
}


/*
|--------------------------------------------------------------------------
| BUSCAR MEMBRO + CARGO DE SUPORTE
|--------------------------------------------------------------------------
*/

async function getTicketActorState(
    interaction:
        ButtonInteraction
):
    Promise<{

        member:
            GuildMember;

        staffRole:
            Role | null;
    }> {

    const guild =
        interaction.guild;


    if (
        !guild
    ) {

        throw new Error(
            'Este botão só funciona dentro de um servidor.'
        );
    }


    const member =
        await guild.members.fetch(
            interaction.user.id
        );


    const state =
        await getTicketConfigState(
            guild
        );


    return {

        member,

        staffRole:
            state.staffRole.value
    };
}


/*
|--------------------------------------------------------------------------
| VALIDAR QUEM PODE ASSUMIR
|--------------------------------------------------------------------------
*/

async function assertCanClaimTicket(
    interaction:
        ButtonInteraction
):
    Promise<GuildMember> {

    const {
        member,
        staffRole
    } =
        await getTicketActorState(
            interaction
        );


    if (
        !memberIsTicketSupport(
            member,
            staffRole
        )
    ) {

        throw new Error(
            'Somente a equipe de suporte configurada ou um administrador pode assumir tickets.'
        );
    }


    return member;
}


/*
|--------------------------------------------------------------------------
| VALIDAR QUEM PODE FECHAR
|--------------------------------------------------------------------------
|
| Fechar:
|
| - autor do ticket
| - suporte configurado
| - administrador
| - proprietário
|
|--------------------------------------------------------------------------
*/

async function assertCanCloseTicket(
    interaction:
        ButtonInteraction,
    channelId:
        string
):
    Promise<GuildMember> {

    const guild =
        interaction.guild;


    if (
        !guild
    ) {

        throw new Error(
            'Este botão só funciona dentro de um servidor.'
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


    const {
        member,
        staffRole
    } =
        await getTicketActorState(
            interaction
        );


    if (
        member.id ===
        ticket.openerId
    ) {

        return member;
    }


    if (
        memberIsTicketSupport(
            member,
            staffRole
        )
    ) {

        return member;
    }


    throw new Error(
        'Somente o autor do ticket, a equipe de suporte ou um administrador pode fechar este atendimento.'
    );
}


/*
|--------------------------------------------------------------------------
| MENSAGEM NO CANAL DO TICKET
|--------------------------------------------------------------------------
|
| interaction.channel possui um tipo muito amplo no Discord.js e pode
| incluir PartialGroupDMChannel.
|
| Como tickets sempre pertencem a uma guild, buscamos o canal diretamente
| através da guild e só enviamos se ele realmente for text-based.
|
|--------------------------------------------------------------------------
*/

async function sendTicketChannelMessage(
    guild:
        NonNullable<ButtonInteraction['guild']>,
    channelId:
        string,
    content:
        string
):
    Promise<void> {

    const channel =
        await guild.channels.fetch(
            channelId
        )

            .catch(
                () => null
            );


    if (
        !channel ||
        !channel.isTextBased()
    ) {

        return;
    }


    await channel.send({

        content
    });
}


/*
|--------------------------------------------------------------------------
| HANDLER
|--------------------------------------------------------------------------
*/

export async function handleTicketButton(
    interaction:
        ButtonInteraction
):
    Promise<void> {

    if (
        !interaction.customId.startsWith(
            'ticket:'
        )
    ) {

        return;
    }


    const guild =
        interaction.guild;


    if (
        !guild
    ) {

        await interaction.reply({

            content:
                'Este botão só funciona dentro de um servidor.',

            flags:
                MessageFlags.Ephemeral
        });


        return;
    }


    const [
        ,
        action,
        channelId
    ] =
        interaction.customId.split(
            ':'
        );


    try {

        /*
        |--------------------------------------------------------------------------
        | ABRIR
        |--------------------------------------------------------------------------
        |
        | Público.
        |
        |--------------------------------------------------------------------------
        */

        if (
            action ===
            'open'
        ) {

            await interaction.deferReply({

                flags:
                    MessageFlags.Ephemeral
            });


            const result =
                await openTicket(
                    guild,
                    interaction.user
                );


            await interaction.editReply({

                content:
                    result.created

                        ? `🎫 Seu ticket foi criado: <#${result.channel.id}>`

                        : `Você já possui um ticket aberto: <#${result.channel.id}>`
            });


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | ASSUMIR
        |--------------------------------------------------------------------------
        |
        | Somente:
        |
        | - cargo de suporte configurado
        | - Administrator
        | - owner
        |
        |--------------------------------------------------------------------------
        */

        if (
            action ===
                'claim' &&

            channelId
        ) {

            await interaction.deferReply({

                flags:
                    MessageFlags.Ephemeral
            });


            const member =
                await assertCanClaimTicket(
                    interaction
                );


            const ticket =
                await claimTicket(
                    guild,
                    channelId,
                    member
                );


            await interaction.editReply({

                content:
                    `🎧 Você assumiu o ticket #${String(ticket.sequence).padStart(4, '0')}.`
            });


            await sendTicketChannelMessage(

                guild,

                channelId,

                `🎧 <@${member.id}> assumiu este atendimento.`
            );


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | PEDIR CONFIRMAÇÃO DE FECHAMENTO
        |--------------------------------------------------------------------------
        */

        if (
            action ===
                'close' &&

            channelId
        ) {

            /*
             * Fazemos a autorização ANTES de mostrar a confirmação.
             */

            await assertCanCloseTicket(
                interaction,
                channelId
            );


            await interaction.reply({

                content:
                    'Tem certeza que deseja fechar este ticket? O canal será apagado.',

                components: [

                    ticketCloseConfirmRow(
                        channelId
                    )
                ],

                flags:
                    MessageFlags.Ephemeral
            });


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | CANCELAR
        |--------------------------------------------------------------------------
        */

        if (
            action ===
                'close-cancel' &&

            channelId
        ) {

            await interaction.update({

                content:
                    'Fechamento cancelado.',

                components:
                    []
            });


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | CONFIRMAR FECHAMENTO
        |--------------------------------------------------------------------------
        |
        | Revalidamos a permissão.
        |
        | Não confiamos apenas na verificação feita quando o botão anterior
        | foi clicado.
        |
        |--------------------------------------------------------------------------
        */

        if (
            action ===
                'close-confirm' &&

            channelId
        ) {

            const member =
                await assertCanCloseTicket(
                    interaction,
                    channelId
                );


            await interaction.update({

                content:
                    'Fechando ticket...',

                components:
                    []
            });


            const ticket =
                await closeTicket(
                    guild,
                    channelId,
                    member,
                    'Fechado pelo botão do ticket.'
                );


            await interaction.editReply({

                content:
                    `🔒 Ticket #${String(ticket.sequence).padStart(4, '0')} fechado.`,

                components:
                    []
            })

                .catch(
                    () => undefined
                );


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | INVÁLIDO
        |--------------------------------------------------------------------------
        */

        await interaction.reply({

            content:
                'Este botão de ticket não é mais válido.',

            flags:
                MessageFlags.Ephemeral
        });

    } catch (error) {

        console.error(
            '[TICKET] Erro em botão:',
            error
        );


        const content =
            `❌ ${errorText(error)}`;


        try {

            if (
                interaction.deferred ||
                interaction.replied
            ) {

                await interaction.editReply({

                    content,

                    components:
                        []
                });

            } else {

                await interaction.reply({

                    content,

                    flags:
                        MessageFlags.Ephemeral
                });
            }

        } catch (
            responseError
        ) {

            console.error(
                '[TICKET] Também não consegui responder ao erro do botão:',
                responseError
            );
        }
    }
}