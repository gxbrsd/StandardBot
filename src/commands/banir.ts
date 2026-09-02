import {
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';

import type {
    ChatInputCommandInteraction,
    GuildMember
} from 'discord.js';

import {
    banMember
} from '../services/moderation-service.js';


/*
|--------------------------------------------------------------------------
| TEMPOS DE EXCLUSÃO DE MENSAGENS
|--------------------------------------------------------------------------
*/

const DELETE_MESSAGE_CHOICES = [

    {
        name:
            'Não apagar mensagens',

        value:
            0
    },

    {
        name:
            'Última 1 hora',

        value:
            60 * 60
    },

    {
        name:
            'Últimas 6 horas',

        value:
            6 * 60 * 60
    },

    {
        name:
            'Últimas 12 horas',

        value:
            12 * 60 * 60
    },

    {
        name:
            'Último 1 dia',

        value:
            24 * 60 * 60
    },

    {
        name:
            'Últimos 3 dias',

        value:
            3 * 24 * 60 * 60
    },

    {
        name:
            'Últimos 7 dias',

        value:
            7 * 24 * 60 * 60
    }

] as const;


/*
|--------------------------------------------------------------------------
| FORMATAR PERÍODO
|--------------------------------------------------------------------------
*/

function deleteMessagesText(
    seconds: number
):
    string {

    if (
        seconds ===
        0
    ) {

        return 'nenhuma';
    }


    const hour =
        60 * 60;


    const day =
        24 * hour;


    if (
        seconds %
            day ===
        0
    ) {

        const days =
            seconds /
            day;


        return (
            days === 1

                ? 'último 1 dia'

                : `últimos ${days} dias`
        );
    }


    const hours =
        seconds /
        hour;


    return (
        hours === 1

            ? 'última 1 hora'

            : `últimas ${hours} horas`
    );
}


/*
|--------------------------------------------------------------------------
| COMANDO
|--------------------------------------------------------------------------
*/

export const banirCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'banir'
            )

            .setDescription(
                'Bane um usuário do servidor.'
            )

            .addUserOption(
                option =>

                    option

                        .setName(
                            'usuario'
                        )

                        .setDescription(
                            'Usuário que será banido.'
                        )

                        .setRequired(
                            true
                        )
            )

            .addStringOption(
                option =>

                    option

                        .setName(
                            'motivo'
                        )

                        .setDescription(
                            'Motivo do banimento.'
                        )

                        .setMaxLength(
                            1000
                        )

                        .setRequired(
                            true
                        )
            )

            .addIntegerOption(
                option =>

                    option

                        .setName(
                            'apagar_mensagens'
                        )

                        .setDescription(
                            'Apaga mensagens recentes do usuário.'
                        )

                        .addChoices(
                            ...DELETE_MESSAGE_CHOICES
                        )

                        .setRequired(
                            false
                        )
            ),


    /*
    |--------------------------------------------------------------------------
    | STAFF ONLY
    |--------------------------------------------------------------------------
    */

    staffOnly:
        true,


    /*
    |--------------------------------------------------------------------------
    | EXECUTAR
    |--------------------------------------------------------------------------
    */

    async execute(
        interaction:
            ChatInputCommandInteraction
    ):
        Promise<void> {

        const guild =
            interaction.guild;


        if (
            !guild
        ) {

            await interaction.reply({

                content:
                    'Este comando só pode ser usado dentro de um servidor.',

                flags:
                    MessageFlags.Ephemeral
            });


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | RESPOSTA EPHEMERAL
        |--------------------------------------------------------------------------
        */

        await interaction.deferReply({

            flags:
                MessageFlags.Ephemeral
        });


        try {

            /*
            |--------------------------------------------------------------------------
            | MODERADOR
            |--------------------------------------------------------------------------
            */

            const moderator =
                await guild.members.fetch(
                    interaction.user.id
                );


            /*
            |--------------------------------------------------------------------------
            | ALVO
            |--------------------------------------------------------------------------
            */

            const user =
                interaction.options.getUser(
                    'usuario',
                    true
                );


            let target:
                GuildMember;


            try {

                target =
                    await guild.members.fetch(
                        user.id
                    );

            } catch {

                await interaction.editReply(
                    '❌ Esse usuário não é membro deste servidor.'
                );


                return;
            }


            /*
            |--------------------------------------------------------------------------
            | OPÇÕES
            |--------------------------------------------------------------------------
            */

            const reason =
                interaction.options.getString(
                    'motivo',
                    true
                );


            const deleteMessageSeconds =
                interaction.options.getInteger(
                    'apagar_mensagens'
                ) ?? 0;


            /*
            |--------------------------------------------------------------------------
            | EXECUTAR BAN
            |--------------------------------------------------------------------------
            */

            await banMember(
                guild,
                moderator,
                target,
                reason,
                deleteMessageSeconds
            );


            /*
            |--------------------------------------------------------------------------
            | CONFIRMAÇÃO
            |--------------------------------------------------------------------------
            */

            await interaction.editReply({

                content:
                    [
                        '## Usuário banido',
                        '',
                        `**Usuário:** ${user.tag}`,
                        `**ID:** \`${user.id}\``,
                        `**Motivo:** ${reason}`,
                        `**Mensagens apagadas:** ${deleteMessagesText(deleteMessageSeconds)}`
                    ].join(
                        '\n'
                    )
            });

        } catch (error) {

            console.error(
                '[BANIR]',
                error
            );


            const message =
                error instanceof Error

                    ? error.message

                    : 'Ocorreu um erro inesperado durante o banimento.';


            await interaction.editReply(
                `❌ ${message}`
            );
        }
    }
};