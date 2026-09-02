import {
    ChannelType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder
} from 'discord.js';

import {
    buildRulesEmbed
} from '../embeds/regras.js';

import {
    getGuildConfig,
    updateGuildConfig
} from '../services/guild-config.js';

import {
    getMessageGuildData
} from '../services/message-config.js';


async function buildCurrentRulesEmbed(
    guildId: string
): Promise<EmbedBuilder> {

    const data =
        await getMessageGuildData(
            guildId
        );

    const rules =
        data.rules;

    if (!rules.content) {
        return buildRulesEmbed();
    }

    const colorNumber =
        Number.parseInt(
            rules.color.replace('#', ''),
            16
        );

    const embed =
        new EmbedBuilder()
            .setColor(
                Number.isNaN(colorNumber)
                    ? 0x2b2d31
                    : colorNumber
            )
            .setDescription(
                rules.content
            );

    if (rules.title) {
        embed.setTitle(
            rules.title
        );
    }

    if (rules.footer) {
        embed.setFooter({
            text: rules.footer
        });
    }

    if (rules.imageUrl) {
        embed.setImage(
            rules.imageUrl
        );
    }

    return embed;
}


export const regrasCommand = {
    staffOnly: true,

    data: new SlashCommandBuilder()
        .setName('regras')
        .setDescription('Gerencia a mensagem de regras do servidor')
        .addSubcommand(subcommand =>
            subcommand
                .setName('publicar')
                .setDescription('Publica a mensagem oficial de regras')
                .addChannelOption(option =>
                    option
                        .setName('canal')
                        .setDescription('Canal onde as regras serão publicadas')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('atualizar')
                .setDescription('Atualiza a mensagem oficial de regras')
        ),

    async execute(
        interaction: ChatInputCommandInteraction
    ): Promise<void> {

        if (
            !interaction.inGuild() ||
            !interaction.guild
        ) {
            await interaction.reply({
                content: '❌ Esse comando só pode ser usado dentro de um servidor.',
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        const subcommand =
            interaction.options.getSubcommand();

        if (subcommand === 'publicar') {
            const selectedChannel =
                interaction.options.getChannel(
                    'canal',
                    true
                );

            const channel =
                await interaction.guild.channels.fetch(
                    selectedChannel.id
                );

            if (
                !channel ||
                channel.type !== ChannelType.GuildText
            ) {
                await interaction.editReply({
                    content: '❌ Escolha um canal de texto válido.'
                });
                return;
            }

            const rulesEmbed =
                await buildCurrentRulesEmbed(
                    interaction.guildId
                );

            const config =
                getGuildConfig(
                    interaction.guildId
                );

            if (
                config.rulesMessageId &&
                config.rulesChannelId === channel.id
            ) {
                try {
                    const oldMessage =
                        await channel.messages.fetch(
                            config.rulesMessageId
                        );

                    await oldMessage.edit({
                        embeds: [rulesEmbed],
                        attachments: []
                    });

                    if (!oldMessage.pinned) {
                        await oldMessage.pin();
                    }

                    await interaction.editReply({
                        content: '✅ A mensagem de regras existente foi atualizada.'
                    });
                    return;
                } catch (error) {
                    console.warn(
                        'Mensagem antiga de regras não encontrada. Criando uma nova...',
                        error
                    );
                }
            }

            const message =
                await channel.send({
                    embeds: [rulesEmbed]
                });

            await message.pin();

            updateGuildConfig(
                interaction.guildId,
                {
                    rulesChannelId: channel.id,
                    rulesMessageId: message.id
                }
            );

            await interaction.editReply({
                content: `✅ Regras publicadas e fixadas em ${channel}.`
            });
            return;
        }

        if (subcommand === 'atualizar') {
            const config =
                getGuildConfig(
                    interaction.guildId
                );

            if (
                !config.rulesChannelId ||
                !config.rulesMessageId
            ) {
                await interaction.editReply({
                    content: '❌ Ainda não existe uma mensagem de regras registrada. Use `/regras publicar` primeiro.'
                });
                return;
            }

            try {
                const channel =
                    await interaction.guild.channels.fetch(
                        config.rulesChannelId
                    );

                if (
                    !channel ||
                    channel.type !== ChannelType.GuildText
                ) {
                    throw new Error(
                        'Canal de regras não encontrado.'
                    );
                }

                const message =
                    await channel.messages.fetch(
                        config.rulesMessageId
                    );

                const rulesEmbed =
                    await buildCurrentRulesEmbed(
                        interaction.guildId
                    );

                await message.edit({
                    embeds: [rulesEmbed],
                    attachments: []
                });

                if (!message.pinned) {
                    await message.pin();
                }

                await interaction.editReply({
                    content: '✅ Mensagem de regras atualizada.'
                });
            } catch (error) {
                console.error(
                    'Erro ao atualizar regras:',
                    error
                );

                await interaction.editReply({
                    content: '❌ Não consegui encontrar ou editar a mensagem antiga. Use `/regras publicar` para criar uma nova.'
                });
            }
        }
    }
};
