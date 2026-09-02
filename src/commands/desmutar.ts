import {
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';

import type {
    ChatInputCommandInteraction,
    GuildMember
} from 'discord.js';

import {
    removeTimeout
} from '../services/moderation-service.js';


/*
|--------------------------------------------------------------------------
| COMANDO
|--------------------------------------------------------------------------
*/

export const desmutarCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'desmutar'
            )

            .setDescription(
                'Remove o timeout de um usuário.'
            )


            /*
            |--------------------------------------------------------------------------
            | USUÁRIO
            |--------------------------------------------------------------------------
            */

            .addUserOption(
                option =>

                    option

                        .setName(
                            'usuario'
                        )

                        .setDescription(
                            'Usuário que terá o mute removido.'
                        )

                        .setRequired(
                            true
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | MOTIVO
            |--------------------------------------------------------------------------
            */

            .addStringOption(
                option =>

                    option

                        .setName(
                            'motivo'
                        )

                        .setDescription(
                            'Motivo da remoção do mute.'
                        )

                        .setMaxLength(
                            1000
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
            | VERIFICAR SE ESTÁ MUTADO
            |--------------------------------------------------------------------------
            |
            | communicationDisabledUntilTimestamp:
            |
            | null = sem timeout
            | timestamp futuro = timeout ativo
            |
            */

            const timeoutUntil =
                target.communicationDisabledUntilTimestamp;


            if (
                !timeoutUntil ||
                timeoutUntil <=
                    Date.now()
            ) {

                await interaction.editReply(
                    '❌ Esse usuário não possui um timeout ativo.'
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
                    'motivo'
                ) ??
                'Timeout removido manualmente.';


            /*
            |--------------------------------------------------------------------------
            | REMOVER TIMEOUT
            |--------------------------------------------------------------------------
            |
            | moderation-service cuida de:
            |
            | - ModerateMembers;
            | - hierarquia do moderador;
            | - hierarquia do bot;
            | - proteção do dono;
            | - impedir ação em si mesmo;
            | - moderatable;
            | - Audit Log;
            | - #logs-mod.
            |
            */

            await removeTimeout(
                guild,
                moderator,
                target,
                reason
            );


            /*
            |--------------------------------------------------------------------------
            | CONFIRMAÇÃO
            |--------------------------------------------------------------------------
            */

            await interaction.editReply({

                content:
                    [
                        '## Mute removido',
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
                '[DESMUTAR]',
                error
            );


            const message =
                error instanceof Error

                    ? error.message

                    : 'Ocorreu um erro inesperado ao remover o mute.';


            await interaction.editReply(
                `❌ ${message}`
            );
        }
    }
};