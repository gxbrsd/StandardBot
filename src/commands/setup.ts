import {
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder
} from 'discord.js';

import {
    updateGuildConfig
} from '../services/guild-config.js';

export const setupCommand = {

    staffOnly: false,

    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configura o bot neste servidor')

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('cargo')
                .setDescription(
                    'Define o cargo que poderá administrar o bot'
                )

                .addRoleOption(option =>
                    option
                        .setName('cargo')
                        .setDescription(
                            'Cargo da equipe/moderação'
                        )
                        .setRequired(true)
                )
        ),

    async execute(interaction: any) {

        if (!interaction.inGuild()) {
            await interaction.reply({
                content:
                    'Esse comando só pode ser usado dentro de um servidor.',
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        const role = interaction.options.getRole(
            'cargo',
            true
        );

        if (role.id === interaction.guildId) {
            await interaction.reply({
                content:
                    'Você não pode usar `@everyone` como cargo administrativo.',
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        updateGuildConfig(
            interaction.guildId,
            {
                staffRoleId: role.id
            }
        );

        await interaction.reply({
            content:
                `✅ O cargo ${role} agora pode usar os comandos administrativos do bot.`,
            flags: MessageFlags.Ephemeral
        });
    }
};