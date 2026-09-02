import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';

import type {
    ActiveTicket
} from '../tickets/types.js';


/*
|--------------------------------------------------------------------------
| CORES
|--------------------------------------------------------------------------
*/

const EMBED_COLOR =
    0x2b2d31;


/*
|--------------------------------------------------------------------------
| EMBED DO PAINEL
|--------------------------------------------------------------------------
|
| Painel padrão sem dependência de arquivos de imagem locais.
|
|--------------------------------------------------------------------------
*/

export function ticketPanelEmbed():
    EmbedBuilder {

    return new EmbedBuilder()

        .setColor(
            EMBED_COLOR
        )

        .setTitle(
            'Support'
        )

        .setDescription(
            [
                'Use o botão abaixo para abrir um atendimento privado.',
                '',
                'Descreva sua solicitação no canal que será criado.'
            ].join(
                '\n'
            )
        )

        .setFooter({
            text: 'StandardBot • Tickets'
        });
}


/*
|--------------------------------------------------------------------------
| BOTÃO DE ABRIR TICKET
|--------------------------------------------------------------------------
*/

export function ticketPanelRow():
    ActionRowBuilder<ButtonBuilder> {

    const openButton =
        new ButtonBuilder()

            .setCustomId(
                'ticket:open'
            )

            .setLabel(
                'Abrir ticket'
            )

            .setEmoji(
                '🎫'
            )

            .setStyle(
                ButtonStyle.Secondary
            );


    return new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            openButton
        );
}


/*
|--------------------------------------------------------------------------
| EMBED DE TICKET ABERTO
|--------------------------------------------------------------------------
|
| Essa aparece dentro do canal:
|
| #ticket-user-0001
|
|--------------------------------------------------------------------------
*/

export function ticketOpenedEmbed(
    ticket: ActiveTicket,
    staffConfigured: boolean
):
    EmbedBuilder {

    const description: string[] = [

        `<@${ticket.openerId}>, seu atendimento foi criado com sucesso.`,

        '',

        'Descreva abaixo o motivo do contato com o máximo de informações possível.',

        '',

        'A equipe poderá assumir o atendimento através do botão abaixo.'
    ];


    /*
    |--------------------------------------------------------------------------
    | SEM STAFF CONFIGURADO
    |--------------------------------------------------------------------------
    */

    if (
        !staffConfigured
    ) {

        description.push(

            '',

            '⚠ **Nenhum cargo de staff está configurado neste servidor.**',

            'Administradores ainda poderão acessar e gerenciar este ticket.'
        );
    }


    return new EmbedBuilder()

        .setColor(
            EMBED_COLOR
        )

        .setTitle(
            `Atendimento #${String(
                ticket.sequence
            ).padStart(
                4,
                '0'
            )}`
        )

        .setDescription(
            description.join(
                '\n'
            )
        )

        .setFooter({
            text:
                'StandardBot • Sistema de tickets'
        })

        .setTimestamp(
            new Date(
                ticket.openedAt
            )
        );
}


/*
|--------------------------------------------------------------------------
| BOTÕES DO TICKET
|--------------------------------------------------------------------------
|
| Dentro do ticket:
|
| [ 🎧 Assumir ticket ]
| [ 🔒 Fechar ticket ]
|
|--------------------------------------------------------------------------
*/

export function ticketControlRow(
    channelId: string
):
    ActionRowBuilder<ButtonBuilder> {

    const claimButton =
        new ButtonBuilder()

            .setCustomId(
                `ticket:claim:${channelId}`
            )

            .setLabel(
                'Assumir ticket'
            )

            .setEmoji(
                '🎧'
            )

            .setStyle(
                ButtonStyle.Secondary
            );


    const closeButton =
        new ButtonBuilder()

            .setCustomId(
                `ticket:close:${channelId}`
            )

            .setLabel(
                'Fechar ticket'
            )

            .setEmoji(
                '🔒'
            )

            .setStyle(
                ButtonStyle.Danger
            );


    return new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            claimButton,
            closeButton
        );
}


/*
|--------------------------------------------------------------------------
| CONFIRMAÇÃO DE FECHAMENTO
|--------------------------------------------------------------------------
|
| Evita que alguém feche o ticket por clique acidental.
|
|--------------------------------------------------------------------------
*/

export function ticketCloseConfirmRow(
    channelId: string
):
    ActionRowBuilder<ButtonBuilder> {

    const confirmButton =
        new ButtonBuilder()

            .setCustomId(
                `ticket:close-confirm:${channelId}`
            )

            .setLabel(
                'Confirmar fechamento'
            )

            .setStyle(
                ButtonStyle.Danger
            );


    const cancelButton =
        new ButtonBuilder()

            .setCustomId(
                `ticket:close-cancel:${channelId}`
            )

            .setLabel(
                'Cancelar'
            )

            .setStyle(
                ButtonStyle.Secondary
            );


    return new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            confirmButton,
            cancelButton
        );
}


/*
|--------------------------------------------------------------------------
| TIPOS DE LOG
|--------------------------------------------------------------------------
*/

export type TicketLogAction =

    | 'opened'

    | 'claimed'

    | 'closed'

    | 'user-added'

    | 'user-removed';


/*
|--------------------------------------------------------------------------
| EMBED DE LOG
|--------------------------------------------------------------------------
*/

export function ticketLogEmbed(
    action: TicketLogAction,
    ticket: ActiveTicket,
    actorId: string,
    details: string | null = null
):
    EmbedBuilder {

    /*
    |--------------------------------------------------------------------------
    | TÍTULOS
    |--------------------------------------------------------------------------
    */

    const titles:
        Record<
            TicketLogAction,
            string
        > = {

        opened:
            'TICKET • ABERTO',

        claimed:
            'TICKET • ASSUMIDO',

        closed:
            'TICKET • FECHADO',

        'user-added':
            'TICKET • USUÁRIO ADICIONADO',

        'user-removed':
            'TICKET • USUÁRIO REMOVIDO'
    };


    /*
    |--------------------------------------------------------------------------
    | DESCRIÇÃO
    |--------------------------------------------------------------------------
    */

    const description: string[] = [

        `Ticket: **#${String(
            ticket.sequence
        ).padStart(
            4,
            '0'
        )}**`,

        `Usuário: <@${ticket.openerId}>`,

        `Responsável pela ação: <@${actorId}>`
    ];


    /*
    |--------------------------------------------------------------------------
    | ATENDENTE
    |--------------------------------------------------------------------------
    */

    if (
        ticket.claimedById
    ) {

        description.push(
            `Atendente: <@${ticket.claimedById}>`
        );
    }


    /*
    |--------------------------------------------------------------------------
    | DETALHES
    |--------------------------------------------------------------------------
    */

    if (
        details
    ) {

        description.push(
            `Detalhes: ${details}`
        );
    }


    return new EmbedBuilder()

        .setColor(
            EMBED_COLOR
        )

        .setTitle(
            titles[
                action
            ]
        )

        .setDescription(
            description.join(
                '\n'
            )
        )

        .setFooter({
            text:
                'StandardBot • Logs de tickets'
        })

        .setTimestamp();
}