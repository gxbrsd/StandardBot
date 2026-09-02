import {
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';

import type {
    ChatInputCommandInteraction,
    GuildMember
} from 'discord.js';

import {
    kickMember
} from '../services/moderation-service.js';


export const expulsarCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'expulsar'
            )

            .setDescription(
                'Expulsa um usuário do servidor.'
            )

            .addUserOption(
                option =>

                    option

                        .setName(
                            'usuario'
                        )

                        .setDescription(
                            'Usuário que será expulso.'
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
                            'Motivo da expulsão.'
                        )

                        .setMaxLength(
                            1000
                        )

                        .setRequired(
                            true
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


            const reason =
                interaction.options.getString(
                    'motivo',
                    true
                );


            await kickMember(
                guild,
                moderator,
                target,
                reason
            );


            await interaction.editReply({

                content:
                    [
                        '## Usuário expulso',
                        '',
                        `**Usuário:** ${user.tag}`,
                        `**ID:** \`${user.id}\``,
                        `**Motivo:** ${reason}`
                    ].join(
                        '\n'
                    )
            });

        } catch (error) {

            console.error(
                '[EXPULSAR]',
                error
            );


            const message =
                error instanceof Error
                    ? error.message
                    : 'Ocorreu um erro inesperado durante a expulsão.';


            await interaction.editReply(
                `❌ ${message}`
            );
        }
    }
};