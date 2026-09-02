import {
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';

import type {
    AutocompleteInteraction,
    ChatInputCommandInteraction
} from 'discord.js';

import {
    unbanUser
} from '../services/moderation-service.js';


export const desbanirCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'desbanir'
            )

            .setDescription(
                'Remove o banimento de um usuário.'
            )

            .addStringOption(
                option =>

                    option

                        .setName(
                            'usuario'
                        )

                        .setDescription(
                            'Usuário banido. Pesquise pelo nome ou informe o ID.'
                        )

                        .setAutocomplete(
                            true
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
                            'Motivo do desbanimento.'
                        )

                        .setMaxLength(
                            1000
                        )

                        .setRequired(
                            false
                        )
            ),


    staffOnly:
        true,


    /*
    |--------------------------------------------------------------------------
    | AUTOCOMPLETE DOS BANIDOS
    |--------------------------------------------------------------------------
    */

    async autocomplete(
        interaction:
            AutocompleteInteraction
    ):
        Promise<void> {

        const guild =
            interaction.guild;


        if (
            !guild
        ) {

            await interaction.respond(
                []
            );


            return;
        }


        try {

            const focused =
                interaction.options
                    .getFocused()
                    .toLowerCase()
                    .trim();


            const bans =
                await guild.bans.fetch();


            const results =
                [
                    ...bans.values()
                ]

                    .filter(
                        ban => {

                            if (
                                !focused
                            ) {

                                return true;
                            }


                            const username =
                                ban.user.username
                                    .toLowerCase();


                            const globalName =
                                ban.user.globalName
                                    ?.toLowerCase() ??
                                '';


                            const tag =
                                ban.user.tag
                                    .toLowerCase();


                            return (

                                username.includes(
                                    focused
                                ) ||

                                globalName.includes(
                                    focused
                                ) ||

                                tag.includes(
                                    focused
                                ) ||

                                ban.user.id.includes(
                                    focused
                                )
                            );
                        }
                    )

                    .slice(
                        0,
                        25
                    )

                    .map(
                        ban => {

                            const displayName =
                                ban.user.globalName ??
                                ban.user.username;


                            return {

                                name:
                                    `${displayName} • ${ban.user.id}`
                                        .slice(
                                            0,
                                            100
                                        ),

                                value:
                                    ban.user.id
                            };
                        }
                    );


            await interaction.respond(
                results
            );

        } catch (error) {

            console.error(
                '[DESBANIR/AUTOCOMPLETE]',
                error
            );


            await interaction.respond(
                []
            )
                .catch(
                    () => undefined
                );
        }
    },


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
                    'usuario',
                    true
                );


            const reason =
                interaction.options.getString(
                    'motivo'
                ) ??
                'Banimento removido pela equipe.';


            const user =
                await unbanUser(
                    guild,
                    moderator,
                    userId,
                    reason
                );


            await interaction.editReply({

                content:
                    [
                        '## Usuário desbanido',
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
                '[DESBANIR]',
                error
            );


            const message =
                error instanceof Error
                    ? error.message
                    : 'Ocorreu um erro inesperado durante o desbanimento.';


            await interaction.editReply(
                `❌ ${message}`
            );
        }
    }
};