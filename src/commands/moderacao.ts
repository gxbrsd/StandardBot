import {
    ChannelType,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';

import type {
    ChatInputCommandInteraction,
    TextChannel
} from 'discord.js';

import {
    clearModerationLogsChannel,
    getModerationConfigState,
    setModerationLogsChannel
} from '../services/moderation-service.js';


/*
|--------------------------------------------------------------------------
| COMANDO
|--------------------------------------------------------------------------
*/

export const moderacaoCommand = {

    /*
    |--------------------------------------------------------------------------
    | DEFINIÇÃO
    |--------------------------------------------------------------------------
    */

    data:
        new SlashCommandBuilder()

            .setName(
                'moderacao'
            )

            .setDescription(
                'Configura o sistema de moderação do servidor.'
            )


            /*
            |--------------------------------------------------------------------------
            | CONFIGURAR
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'configurar'
                        )

                        .setDescription(
                            'Configura o sistema de moderação.'
                        )

                        .addChannelOption(
                            option =>

                                option

                                    .setName(
                                        'canal_logs'
                                    )

                                    .setDescription(
                                        'Canal onde serão enviados os logs de moderação.'
                                    )

                                    .addChannelTypes(
                                        ChannelType.GuildText
                                    )

                                    .setRequired(
                                        true
                                    )
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | STATUS
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'status'
                        )

                        .setDescription(
                            'Mostra a configuração atual da moderação.'
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | DESVINCULAR
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'desvincular'
                        )

                        .setDescription(
                            'Remove o canal de logs configurado.'
                        )
            ),


    /*
    |--------------------------------------------------------------------------
    | STAFF ONLY
    |--------------------------------------------------------------------------
    |
    | O index.ts já possui a verificação central dos comandos
    | administrativos/staff.
    |
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
            | CONFIGURAR
            |--------------------------------------------------------------------------
            */

            if (
                subcommand ===
                'configurar'
            ) {

                const selected =
                    interaction.options.getChannel(
                        'canal_logs',
                        true
                    );


                if (
                    selected.type !==
                    ChannelType.GuildText
                ) {

                    await interaction.editReply(
                        'O canal de logs precisa ser um canal de texto.'
                    );


                    return;
                }


                const channel =
                    selected as TextChannel;


                /*
                |--------------------------------------------------------------------------
                | GARANTIR QUE É DA MESMA GUILD
                |--------------------------------------------------------------------------
                */

                if (
                    channel.guild.id !==
                    guild.id
                ) {

                    await interaction.editReply(
                        'Esse canal não pertence a este servidor.'
                    );


                    return;
                }


                /*
                |--------------------------------------------------------------------------
                | SALVAR
                |--------------------------------------------------------------------------
                */

                await setModerationLogsChannel(
                    guild,
                    channel
                );


                await interaction.editReply({

                    content:
                        [
                            '## Moderação configurada',
                            '',
                            `**Canal de logs:** <#${channel.id}>`,
                            '',
                            'Os próximos eventos de moderação serão registrados nesse canal.'
                        ].join(
                            '\n'
                        ),

                    allowedMentions: {

                        parse:
                            []
                    }
                });


                return;
            }


            /*
            |--------------------------------------------------------------------------
            | STATUS
            |--------------------------------------------------------------------------
            */

            if (
                subcommand ===
                'status'
            ) {

                const state =
                    await getModerationConfigState(
                        guild
                    );


                /*
                |--------------------------------------------------------------------------
                | NÃO CONFIGURADO
                |--------------------------------------------------------------------------
                */

                if (
                    !state.config.logsChannel
                ) {

                    await interaction.editReply({

                        content:
                            [
                                '## Moderação',
                                '',
                                '**Canal de logs:** não configurado',
                                '',
                                'Configure com:',
                                '`/moderacao configurar canal_logs:#canal`'
                            ].join(
                                '\n'
                            )
                    });


                    return;
                }


                /*
                |--------------------------------------------------------------------------
                | CANAL RESOLVIDO
                |--------------------------------------------------------------------------
                */

                if (
                    state.logsChannel.value
                ) {

                    const repairedText =
                        state.repaired

                            ? '\n\n*O ID do canal havia mudado e foi reparado automaticamente.*'

                            : '';


                    await interaction.editReply({

                        content:
                            [
                                '## Moderação',
                                '',
                                `**Canal de logs:** <#${state.logsChannel.value.id}>`,
                                `**Status:** ${state.repaired ? 'reparado automaticamente' : 'OK'}`,
                                repairedText
                            ]

                                .filter(
                                    Boolean
                                )

                                .join(
                                    '\n'
                                ),

                        allowedMentions: {

                            parse:
                                []
                        }
                    });


                    return;
                }


                /*
                |--------------------------------------------------------------------------
                | AMBÍGUO
                |--------------------------------------------------------------------------
                */

                if (
                    state.logsChannel.status ===
                    'ambiguous'
                ) {

                    await interaction.editReply({

                        content:
                            [
                                '## Moderação',
                                '',
                                `O canal de logs salvo era **#${state.config.logsChannel.name}**, mas existem vários canais com esse mesmo nome.`,
                                '',
                                'Não escolhi nenhum automaticamente.',
                                '',
                                'Use novamente:',
                                '`/moderacao configurar canal_logs:#canal`'
                            ].join(
                                '\n'
                            )
                    });


                    return;
                }


                /*
                |--------------------------------------------------------------------------
                | SUMIU
                |--------------------------------------------------------------------------
                */

                await interaction.editReply({

                    content:
                        [
                            '## Moderação',
                            '',
                            `O canal de logs configurado **#${state.config.logsChannel.name}** não existe mais.`,
                            '',
                            'Configure um novo canal com:',
                            '`/moderacao configurar canal_logs:#canal`'
                        ].join(
                            '\n'
                        )
                });


                return;
            }


            /*
            |--------------------------------------------------------------------------
            | DESVINCULAR
            |--------------------------------------------------------------------------
            */

            if (
                subcommand ===
                'desvincular'
            ) {

                const state =
                    await getModerationConfigState(
                        guild
                    );


                if (
                    !state.config.logsChannel
                ) {

                    await interaction.editReply(
                        'Nenhum canal de logs de moderação está configurado.'
                    );


                    return;
                }


                await clearModerationLogsChannel(
                    guild
                );


                await interaction.editReply(
                    'Canal de logs de moderação desvinculado.'
                );


                return;
            }


            /*
            |--------------------------------------------------------------------------
            | FALLBACK
            |--------------------------------------------------------------------------
            */

            await interaction.editReply(
                'Subcomando de moderação desconhecido.'
            );

        } catch (error) {

            console.error(
                '[MODERAÇÃO/COMANDO]',
                error
            );


            const message =
                error instanceof Error

                    ? error.message

                    : 'Ocorreu um erro inesperado ao executar o comando.';


            await interaction.editReply({

                content:
                    `❌ ${message}`
            });
        }
    }
};