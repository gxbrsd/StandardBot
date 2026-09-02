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
    clearMessages
} from '../services/moderation-service.js';


export const limparCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'limpar'
            )

            .setDescription(
                'Apaga várias mensagens recentes de um canal.'
            )

            .addIntegerOption(
                option =>

                    option

                        .setName(
                            'quantidade'
                        )

                        .setDescription(
                            'Quantidade de mensagens que serão apagadas.'
                        )

                        .setMinValue(
                            1
                        )

                        .setMaxValue(
                            100
                        )

                        .setRequired(
                            true
                        )
            )

            .addChannelOption(
                option =>

                    option

                        .setName(
                            'canal'
                        )

                        .setDescription(
                            'Canal onde as mensagens serão apagadas.'
                        )

                        .addChannelTypes(
                            ChannelType.GuildText
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


            const amount =
                interaction.options.getInteger(
                    'quantidade',
                    true
                );


            const selectedChannel =
                interaction.options.getChannel(
                    'canal'
                );


            let channel:
                TextChannel;


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


            if (
                channel.guild.id !==
                guild.id
            ) {

                await interaction.editReply(
                    '❌ O canal selecionado não pertence a este servidor.'
                );


                return;
            }


            const result =
                await clearMessages(
                    guild,
                    moderator,
                    channel,
                    amount
                );


            const ignored =
                result.requested -
                result.deleted;


            const lines:
                string[] = [

                '## Limpeza concluída',

                '',

                `**Canal:** <#${channel.id}>`,

                `**Solicitadas:** ${result.requested}`,

                `**Apagadas:** ${result.deleted}`
            ];


            if (
                ignored >
                0
            ) {

                lines.push(
                    `**Não apagadas:** ${ignored}`
                );
            }


            await interaction.editReply({

                content:
                    lines.join(
                        '\n'
                    ),

                allowedMentions: {

                    parse:
                        []
                }
            });

        } catch (error) {

            console.error(
                '[LIMPAR]',
                error
            );


            const message =
                error instanceof Error
                    ? error.message
                    : 'Ocorreu um erro inesperado durante a limpeza.';


            await interaction.editReply(
                `❌ ${message}`
            );
        }
    }
};