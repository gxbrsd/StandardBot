import {
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';

import type {
    ChatInputCommandInteraction,
    GuildMember
} from 'discord.js';

import {
    warningCreatedEmbed,
    warningListEmbed,
    warningRemovedEmbed
} from '../embeds/moderation.js';

import {
    createWarning,
    deleteWarning,
    listWarnings
} from '../services/moderation-service.js';


/*
|--------------------------------------------------------------------------
| COMANDO
|--------------------------------------------------------------------------
*/

export const avisoCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'aviso'
            )

            .setDescription(
                'Gerencia advertências de usuários.'
            )


            /*
            |--------------------------------------------------------------------------
            | ADICIONAR
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'adicionar'
                        )

                        .setDescription(
                            'Adiciona uma advertência a um usuário.'
                        )

                        .addUserOption(
                            option =>

                                option

                                    .setName(
                                        'usuario'
                                    )

                                    .setDescription(
                                        'Usuário que receberá a advertência.'
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
                                        'Motivo da advertência.'
                                    )

                                    .setMinLength(
                                        1
                                    )

                                    .setMaxLength(
                                        1000
                                    )

                                    .setRequired(
                                        true
                                    )
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | LISTAR
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'listar'
                        )

                        .setDescription(
                            'Lista as advertências de um usuário.'
                        )

                        .addUserOption(
                            option =>

                                option

                                    .setName(
                                        'usuario'
                                    )

                                    .setDescription(
                                        'Usuário cujo histórico será exibido.'
                                    )

                                    .setRequired(
                                        true
                                    )
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | REMOVER
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'remover'
                        )

                        .setDescription(
                            'Remove uma advertência pelo ID.'
                        )

                        .addIntegerOption(
                            option =>

                                option

                                    .setName(
                                        'id'
                                    )

                                    .setDescription(
                                        'ID da advertência que será removida.'
                                    )

                                    .setMinValue(
                                        1
                                    )

                                    .setRequired(
                                        true
                                    )
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
    | EXECUÇÃO
    |--------------------------------------------------------------------------
    */

    async execute(
        interaction:
            ChatInputCommandInteraction
    ):
        Promise<void> {

        /*
        |--------------------------------------------------------------------------
        | SERVIDOR
        |--------------------------------------------------------------------------
        */

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


        /*
        |--------------------------------------------------------------------------
        | DEFER
        |--------------------------------------------------------------------------
        */

        await interaction.deferReply({

            flags:
                MessageFlags.Ephemeral
        });


        try {

            const subcommand =
                interaction.options.getSubcommand();


            /*
            |--------------------------------------------------------------------------
            | ADICIONAR
            |--------------------------------------------------------------------------
            */

            if (
                subcommand ===
                'adicionar'
            ) {

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
                | USUÁRIO
                |--------------------------------------------------------------------------
                */

                const user =
                    interaction.options.getUser(
                        'usuario',
                        true
                    );


                /*
                |--------------------------------------------------------------------------
                | MEMBRO
                |--------------------------------------------------------------------------
                */

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
                | MOTIVO
                |--------------------------------------------------------------------------
                */

                const reason =
                    interaction.options.getString(
                        'motivo',
                        true
                    );


                /*
                |--------------------------------------------------------------------------
                | CRIAR ADVERTÊNCIA
                |--------------------------------------------------------------------------
                |
                | O service cuida de:
                |
                | - hierarquia;
                | - self-warning;
                | - proteção do dono;
                | - persistência no JSON;
                | - ID incremental;
                | - logs.
                |
                */

                const warning =
                    await createWarning(
                        guild,
                        moderator,
                        target,
                        reason
                    );


                /*
                |--------------------------------------------------------------------------
                | RESPOSTA
                |--------------------------------------------------------------------------
                */

                await interaction.editReply({

                    embeds: [

                        warningCreatedEmbed(
                            warning
                        )
                    ]
                });


                return;
            }


            /*
            |--------------------------------------------------------------------------
            | LISTAR
            |--------------------------------------------------------------------------
            */

            if (
                subcommand ===
                'listar'
            ) {

                const user =
                    interaction.options.getUser(
                        'usuario',
                        true
                    );


                /*
                 * Não exigimos que o usuário ainda esteja
                 * no servidor.
                 *
                 * Isso permite consultar o histórico de alguém
                 * que saiu depois de receber advertências.
                 */

                const warnings =
                    await listWarnings(
                        guild,
                        user.id
                    );


                await interaction.editReply({

                    embeds: [

                        warningListEmbed(
                            user.id,
                            warnings
                        )
                    ]
                });


                return;
            }


            /*
            |--------------------------------------------------------------------------
            | REMOVER
            |--------------------------------------------------------------------------
            */

            if (
                subcommand ===
                'remover'
            ) {

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
                | ID
                |--------------------------------------------------------------------------
                */

                const warningId =
                    interaction.options.getInteger(
                        'id',
                        true
                    );


                /*
                |--------------------------------------------------------------------------
                | REMOVER
                |--------------------------------------------------------------------------
                */

                const warning =
                    await deleteWarning(
                        guild,
                        moderator,
                        warningId
                    );


                /*
                |--------------------------------------------------------------------------
                | RESPOSTA
                |--------------------------------------------------------------------------
                */

                await interaction.editReply({

                    embeds: [

                        warningRemovedEmbed(
                            warning
                        )
                    ]
                });


                return;
            }


            /*
            |--------------------------------------------------------------------------
            | FALLBACK
            |--------------------------------------------------------------------------
            */

            await interaction.editReply(
                '❌ Subcomando de advertência desconhecido.'
            );

        } catch (error) {

            console.error(
                '[AVISO]',
                error
            );


            const message =
                error instanceof Error

                    ? error.message

                    : 'Ocorreu um erro inesperado ao gerenciar a advertência.';


            await interaction.editReply(
                `❌ ${message}`
            );
        }
    }
};