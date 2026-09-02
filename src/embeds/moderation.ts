import {
    EmbedBuilder
} from 'discord.js';

import type {
    WarningRecord
} from '../moderacao/types.js';


/*
|--------------------------------------------------------------------------
| COR PADRÃO
|--------------------------------------------------------------------------
*/

const MODERATION_COLOR =
    0x2b2d31;


/*
|--------------------------------------------------------------------------
| TIPOS DE LOG
|--------------------------------------------------------------------------
*/

export type ModerationLogAction =

    | 'ban'

    | 'unban'

    | 'kick'

    | 'timeout'

    | 'untimeout'

    | 'warning'

    | 'warning-removed'

    | 'clear'

    | 'lock'

    | 'unlock'

    | 'nuke';


/*
|--------------------------------------------------------------------------
| OPÇÕES DO LOG
|--------------------------------------------------------------------------
*/

export interface ModerationLogOptions {

    action:
        ModerationLogAction;


    moderatorId:
        string;


    targetUserId?:
        string;


    reason?:
        string;


    durationText?:
        string;


    warningId?:
        number;


    amount?:
        number;


    channelId?:
        string;


    oldChannelId?:
        string;


    newChannelId?:
        string;
}


/*
|--------------------------------------------------------------------------
| TÍTULOS
|--------------------------------------------------------------------------
*/

const ACTION_TITLES:
    Record<
        ModerationLogAction,
        string
    > = {

    ban:
        'MODERAÇÃO • BANIMENTO',

    unban:
        'MODERAÇÃO • DESBANIMENTO',

    kick:
        'MODERAÇÃO • EXPULSÃO',

    timeout:
        'MODERAÇÃO • TIMEOUT',

    untimeout:
        'MODERAÇÃO • TIMEOUT REMOVIDO',

    warning:
        'MODERAÇÃO • ADVERTÊNCIA',

    'warning-removed':
        'MODERAÇÃO • ADVERTÊNCIA REMOVIDA',

    clear:
        'MODERAÇÃO • LIMPEZA',

    lock:
        'MODERAÇÃO • LOCK',

    unlock:
        'MODERAÇÃO • UNLOCK',

    nuke:
        'MODERAÇÃO • NUKE'
};


/*
|--------------------------------------------------------------------------
| EMBED BASE
|--------------------------------------------------------------------------
*/

function baseModerationEmbed():
    EmbedBuilder {

    return new EmbedBuilder()

        .setColor(
            MODERATION_COLOR
        )

        .setFooter({

            text:
                'StandardBot • Moderação'
        })

        .setTimestamp();
}


/*
|--------------------------------------------------------------------------
| LOG DE MODERAÇÃO
|--------------------------------------------------------------------------
*/

export function moderationLogEmbed(
    options:
        ModerationLogOptions
):
    EmbedBuilder {

    const lines:
        string[] = [];


    /*
    |--------------------------------------------------------------------------
    | MODERADOR
    |--------------------------------------------------------------------------
    */

    lines.push(
        `**Moderador:** <@${options.moderatorId}>`
    );


    /*
    |--------------------------------------------------------------------------
    | USUÁRIO ALVO
    |--------------------------------------------------------------------------
    */

    if (
        options.targetUserId
    ) {

        lines.push(
            `**Usuário:** <@${options.targetUserId}>`
        );
    }


    /*
    |--------------------------------------------------------------------------
    | WARNING ID
    |--------------------------------------------------------------------------
    */

    if (
        options.warningId !==
        undefined
    ) {

        lines.push(
            `**Advertência:** #${options.warningId}`
        );
    }


    /*
    |--------------------------------------------------------------------------
    | DURAÇÃO
    |--------------------------------------------------------------------------
    */

    if (
        options.durationText
    ) {

        lines.push(
            `**Duração:** ${options.durationText}`
        );
    }


    /*
    |--------------------------------------------------------------------------
    | QUANTIDADE
    |--------------------------------------------------------------------------
    */

    if (
        options.amount !==
        undefined
    ) {

        lines.push(
            `**Quantidade:** ${options.amount}`
        );
    }


    /*
    |--------------------------------------------------------------------------
    | CANAL
    |--------------------------------------------------------------------------
    */

    if (
        options.channelId
    ) {

        lines.push(
            `**Canal:** <#${options.channelId}>`
        );
    }


    /*
    |--------------------------------------------------------------------------
    | NUKE
    |--------------------------------------------------------------------------
    */

    if (
        options.oldChannelId
    ) {

        lines.push(
            `**Canal antigo:** \`${options.oldChannelId}\``
        );
    }


    if (
        options.newChannelId
    ) {

        lines.push(
            `**Novo canal:** <#${options.newChannelId}>`
        );
    }


    /*
    |--------------------------------------------------------------------------
    | MOTIVO
    |--------------------------------------------------------------------------
    */

    if (
        options.reason
    ) {

        lines.push(
            '',
            `**Motivo:** ${options.reason}`
        );

    } else {

        if (
            options.action ===
                'ban' ||

            options.action ===
                'kick' ||

            options.action ===
                'timeout' ||

            options.action ===
                'warning'
        ) {

            lines.push(
                '',
                '**Motivo:** Não informado.'
            );
        }
    }


    return baseModerationEmbed()

        .setTitle(
            ACTION_TITLES[
                options.action
            ]
        )

        .setDescription(
            lines.join(
                '\n'
            )
        );
}


/*
|--------------------------------------------------------------------------
| FORMATAR DATA
|--------------------------------------------------------------------------
*/

function discordTimestamp(
    isoDate: string
):
    string {

    const milliseconds =
        new Date(
            isoDate
        ).getTime();


    if (
        Number.isNaN(
            milliseconds
        )
    ) {

        return isoDate;
    }


    const seconds =
        Math.floor(
            milliseconds /
            1000
        );


    return `<t:${seconds}:f>`;
}


/*
|--------------------------------------------------------------------------
| LISTAR WARNINGS
|--------------------------------------------------------------------------
*/

export function warningListEmbed(
    userId: string,
    warnings:
        WarningRecord[]
):
    EmbedBuilder {

    if (
        warnings.length ===
        0
    ) {

        return baseModerationEmbed()

            .setTitle(
                'Advertências'
            )

            .setDescription(
                [
                    `<@${userId}> não possui advertências registradas.`,
                    '',
                    '**Total:** 0'
                ].join(
                    '\n'
                )
            );
    }


    const ordered =
        [
            ...warnings
        ]

            .sort(
                (a, b) =>
                    b.id -
                    a.id
            );


    const visible =
        ordered.slice(
            0,
            10
        );


    const blocks =
        visible.map(
            warning =>

                [
                    `### Advertência #${warning.id}`,

                    `**Moderador:** <@${warning.moderatorId}>`,

                    `**Data:** ${discordTimestamp(
                        warning.createdAt
                    )}`,

                    `**Motivo:** ${warning.reason}`

                ].join(
                    '\n'
                )
        );


    const description:
        string[] = [

        `Histórico de <@${userId}>`,

        '',

        ...blocks,

        '',

        `**Total de advertências:** ${warnings.length}`
    ];


    if (
        warnings.length >
        visible.length
    ) {

        description.push(

            '',

            `Mostrando as **${visible.length} mais recentes** de ${warnings.length}.`
        );
    }


    return baseModerationEmbed()

        .setTitle(
            'Advertências'
        )

        .setDescription(
            description.join(
                '\n\n'
            )
        );
}


/*
|--------------------------------------------------------------------------
| WARNING CRIADO
|--------------------------------------------------------------------------
*/

export function warningCreatedEmbed(
    warning:
        WarningRecord
):
    EmbedBuilder {

    return baseModerationEmbed()

        .setTitle(
            `Advertência #${warning.id}`
        )

        .setDescription(
            [
                `**Usuário:** <@${warning.userId}>`,
                `**Moderador:** <@${warning.moderatorId}>`,
                `**Motivo:** ${warning.reason}`,
                `**Data:** ${discordTimestamp(warning.createdAt)}`
            ].join(
                '\n'
            )
        );
}


/*
|--------------------------------------------------------------------------
| WARNING REMOVIDO
|--------------------------------------------------------------------------
*/

export function warningRemovedEmbed(
    warning:
        WarningRecord
):
    EmbedBuilder {

    return baseModerationEmbed()

        .setTitle(
            `Advertência #${warning.id} removida`
        )

        .setDescription(
            [
                `**Usuário:** <@${warning.userId}>`,
                `**Advertência original:** ${warning.reason}`,
                `**Criada por:** <@${warning.moderatorId}>`,
                `**Criada em:** ${discordTimestamp(warning.createdAt)}`
            ].join(
                '\n'
            )
        );
}