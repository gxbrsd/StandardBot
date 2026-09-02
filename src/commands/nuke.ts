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
    nukeChannel
} from '../services/moderation-service.js';


/*
|--------------------------------------------------------------------------
| COMANDO
|--------------------------------------------------------------------------
*/

export const nukeCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'nuke'
            )

            .setDescription(
                'Recria um canal, apagando todas as mensagens dele.'
            )


            /*
            |--------------------------------------------------------------------------
            | CONFIRMAÇÃO
            |--------------------------------------------------------------------------
            |
            | OBRIGATÓRIOS precisam vir antes dos opcionais
            | na API do Discord.
            |
            */

            .addBooleanOption(
                option =>

                    option

                        .setName(
                            'confirmar'
                        )

                        .setDescription(
                            'Confirma que todas as mensagens do canal serão apagadas.'
                        )

                        .setRequired(
                            true
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | CANAL
            |--------------------------------------------------------------------------
            |
            | Se não informar, usa o canal atual.
            |
            */

            .addChannelOption(
                option =>

                    option

                        .setName(
                            'canal'
                        )

                        .setDescription(
                            'Canal que será recriado.'
                        )

                        .addChannelTypes(
                            ChannelType.GuildText
                        )

                        .setRequired(
                            false
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
                            'Motivo da recriação do canal.'
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

            /*
            |--------------------------------------------------------------------------
            | CONFIRMAÇÃO
            |--------------------------------------------------------------------------
            */

            const confirmed =
                interaction.options.getBoolean(
                    'confirmar',
                    true
                );


            if (
                !confirmed
            ) {

                await interaction.editReply(
                    'Nuke cancelado. Nenhuma alteração foi feita.'
                );


                return;
            }


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
            | CANAL INFORMADO
            |--------------------------------------------------------------------------
            */

            const selectedChannel =
                interaction.options.getChannel(
                    'canal'
                );


            let channel:
                TextChannel;


            /*
            |--------------------------------------------------------------------------
            | CANAL ESPECÍFICO
            |--------------------------------------------------------------------------
            */

            if (
                selectedChannel
            ) {

                if (
                    selectedChannel.type !==
                    ChannelType.GuildText
                ) {

                    await interaction.editReply(
                        '❌ O canal selecionado precisa ser um canal de texto.'
                    );


                    return;
                }


                channel =
                    selectedChannel as TextChannel;

            } else {

                /*
                |--------------------------------------------------------------------------
                | CANAL ATUAL
                |--------------------------------------------------------------------------
                */

                const currentChannel =
                    interaction.channel;


                if (
                    !currentChannel ||
                    currentChannel.type !==
                        ChannelType.GuildText
                ) {

                    await interaction.editReply(
                        '❌ Execute este comando em um canal de texto ou informe a opção `canal`.'
                    );


                    return;
                }


                channel =
                    currentChannel as TextChannel;
            }


            /*
            |--------------------------------------------------------------------------
            | MESMA GUILD
            |--------------------------------------------------------------------------
            */

            if (
                channel.guild.id !==
                guild.id
            ) {

                await interaction.editReply(
                    '❌ O canal selecionado não pertence a este servidor.'
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
                'Limpeza completa do canal.';


            /*
            |--------------------------------------------------------------------------
            | INFORMAÇÕES ANTIGAS
            |--------------------------------------------------------------------------
            */

            const oldChannelId =
                channel.id;


            const oldChannelName =
                channel.name;


            /*
            |--------------------------------------------------------------------------
            | NUKE
            |--------------------------------------------------------------------------
            */

            const result =
                await nukeChannel(
                    guild,
                    moderator,
                    channel,
                    reason
                );


            /*
            |--------------------------------------------------------------------------
            | CONFIRMAÇÃO
            |--------------------------------------------------------------------------
            */

            try {

                await interaction.editReply({

                    content:
                        [
                            '## Canal recriado',
                            '',
                            `**Canal:** <#${result.newChannelId}>`,
                            `**Nome:** #${oldChannelName}`,
                            `**ID antigo:** \`${oldChannelId}\``,
                            `**ID novo:** \`${result.newChannelId}\``,
                            `**Motivo:** ${reason}`,
                            '',
                            'Todas as mensagens do canal antigo foram removidas.'
                        ].join(
                            '\n'
                        ),

                    allowedMentions: {

                        parse:
                            []
                    }
                });

            } catch (replyError) {

                console.warn(
                    '[NUKE] Canal recriado, mas não consegui atualizar a resposta da interaction:',
                    replyError
                );
            }

        } catch (error) {

            console.error(
                '[NUKE]',
                error
            );


            const message =
                error instanceof Error
                    ? error.message
                    : 'Ocorreu um erro inesperado durante o nuke.';


            try {

                await interaction.editReply(
                    `❌ ${message}`
                );

            } catch {

                /*
                 * O canal pode ter deixado de existir
                 * durante uma falha tardia.
                 */
            }
        }
    }
};