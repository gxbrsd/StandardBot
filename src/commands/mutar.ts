import {
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';

import type {
    ChatInputCommandInteraction,
    GuildMember
} from 'discord.js';

import {
    parseModerationDuration,
    timeoutMember
} from '../services/moderation-service.js';


/*
|--------------------------------------------------------------------------
| COMANDO
|--------------------------------------------------------------------------
*/

export const mutarCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'mutar'
            )

            .setDescription(
                'Aplica um timeout temporário em um usuário.'
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
                            'Usuário que será mutado.'
                        )

                        .setRequired(
                            true
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | DURAÇÃO
            |--------------------------------------------------------------------------
            |
            | Exemplos:
            |
            | 30s
            | 10m
            | 2h
            | 1d
            | 1d12h
            |
            */

            .addStringOption(
                option =>

                    option

                        .setName(
                            'duracao'
                        )

                        .setDescription(
                            'Duração do mute. Ex.: 10m, 2h, 1d, 1d12h.'
                        )

                        .setMinLength(
                            2
                        )

                        .setMaxLength(
                            30
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
                            'Motivo do mute.'
                        )

                        .setMaxLength(
                            1000
                        )

                        .setRequired(
                            true
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
            | DURAÇÃO
            |--------------------------------------------------------------------------
            */

            const durationInput =
                interaction.options.getString(
                    'duracao',
                    true
                );


            /*
             * O parser aceita:
             *
             * 10m
             * 2h
             * 1d
             * 1d12h
             *
             * e rejeita automaticamente valores acima
             * do limite de 28 dias do Discord.
             */

            const duration =
                parseModerationDuration(
                    durationInput
                );


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
            | APLICAR TIMEOUT
            |--------------------------------------------------------------------------
            |
            | moderation-service cuida de:
            |
            | - ModerateMembers;
            | - hierarquia do moderador;
            | - hierarquia do bot;
            | - proteção do dono;
            | - impedir self-mute;
            | - moderatable;
            | - limite de 28 dias;
            | - Audit Log;
            | - #logs-mod.
            |
            */

            await timeoutMember(
                guild,
                moderator,
                target,
                duration,
                reason
            );


            /*
            |--------------------------------------------------------------------------
            | FIM DO TIMEOUT
            |--------------------------------------------------------------------------
            */

            const endsAt =
                Math.floor(
                    (
                        Date.now() +
                        duration.milliseconds
                    ) /
                    1000
                );


            /*
            |--------------------------------------------------------------------------
            | CONFIRMAÇÃO
            |--------------------------------------------------------------------------
            */

            await interaction.editReply({

                content:
                    [
                        '## Usuário mutado',
                        '',
                        `**Usuário:** ${user.tag}`,
                        `**ID:** \`${user.id}\``,
                        `**Duração:** ${duration.text}`,
                        `**Até:** <t:${endsAt}:F>`,
                        `**Restante:** <t:${endsAt}:R>`,
                        `**Motivo:** ${reason}`
                    ].join(
                        '\n'
                    )
            });

        } catch (error) {

            console.error(
                '[MUTAR]',
                error
            );


            const message =
                error instanceof Error

                    ? error.message

                    : 'Ocorreu um erro inesperado ao aplicar o mute.';


            await interaction.editReply(
                `❌ ${message}`
            );
        }
    }
};