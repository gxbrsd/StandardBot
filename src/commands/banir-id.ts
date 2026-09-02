import {
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';

import type {
    ChatInputCommandInteraction
} from 'discord.js';

import {
    banUserById
} from '../services/moderation-service.js';


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


export const banirIdCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'banir-id'
            )

            .setDescription(
                'Bane um usuário pelo ID, mesmo que ele já tenha saído do servidor.'
            )

            .addStringOption(
                option =>

                    option

                        .setName(
                            'usuario_id'
                        )

                        .setDescription(
                            'ID do usuário que será banido.'
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


    staffOnly:
        true,


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
                    'Este comando só pode ser utilizado dentro de um servidor.',

                flags:
                    MessageFlags.Ephemeral
            });


            return;
        }


        await interaction.deferReply({

            flags:
                MessageFlags.Ephemeral
        });


        try {

            const moderator =
                await guild.members.fetch(
                    interaction.user.id
                );


            const userId =
                interaction.options.getString(
                    'usuario_id',
                    true
                );


            const reason =
                interaction.options.getString(
                    'motivo',
                    true
                );


            const deleteMessageSeconds =
                interaction.options.getInteger(
                    'apagar_mensagens'
                ) ??
                0;


            const user =
                await banUserById(
                    guild,
                    moderator,
                    userId,
                    reason,
                    deleteMessageSeconds
                );


            await interaction.editReply({

                content:
                    [
                        '## Usuário banido',
                        '',
                        `**Usuário:** ${user.tag}`,
                        `**ID:** \`${user.id}\``,
                        `**Motivo:** ${reason}`,
                        '',
                        'O banimento foi aplicado diretamente pelo ID.'
                    ].join(
                        '\n'
                    )
            });

        } catch (error) {

            console.error(
                '[BANIR-ID]',
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