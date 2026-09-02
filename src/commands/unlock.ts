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
    unlockChannel
} from '../services/moderation-service.js';


/*
|--------------------------------------------------------------------------
| COMANDO
|--------------------------------------------------------------------------
*/

export const unlockCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'unlock'
            )

            .setDescription(
                'Desbloqueia o envio de mensagens em um canal.'
            )


            /*
            |--------------------------------------------------------------------------
            | CANAL
            |--------------------------------------------------------------------------
            |
            | Se nenhum canal for informado,
            | usa o canal atual.
            |
            */

            .addChannelOption(
                option =>

                    option

                        .setName(
                            'canal'
                        )

                        .setDescription(
                            'Canal que será desbloqueado.'
                        )

                        .addChannelTypes(
                            ChannelType.GuildText
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
            | USAR CANAL INFORMADO
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
                | USAR CANAL ATUAL
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
            | MESMO SERVIDOR
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
            | UNLOCK
            |--------------------------------------------------------------------------
            |
            | O moderation-service:
            |
            | - procura o registro do /lock;
            | - recupera por nome se o ID tiver mudado;
            | - verifica ManageChannels;
            | - restaura exatamente o estado anterior;
            | - remove o registro de lock;
            | - envia log.
            |
            */

            const result =
                await unlockChannel(
                    guild,
                    moderator,
                    channel
                );


            /*
            |--------------------------------------------------------------------------
            | ESTADO RESTAURADO
            |--------------------------------------------------------------------------
            */

            let restoredStateText:
                string;


            switch (
                result.record.previousSendMessages
            ) {

                case 'allow':

                    restoredStateText =
                        'permitido explicitamente';

                    break;


                case 'deny':

                    restoredStateText =
                        'negado explicitamente';

                    break;


                case 'inherit':

                    restoredStateText =
                        'herdado';

                    break;
            }


            /*
            |--------------------------------------------------------------------------
            | CONFIRMAÇÃO
            |--------------------------------------------------------------------------
            */

            await interaction.editReply({

                content:
                    [
                        '## Canal desbloqueado',
                        '',
                        `**Canal:** <#${channel.id}>`,
                        '',
                        `**SendMessages do @everyone restaurado para:** ${restoredStateText}`,
                        '',
                        'As permissões anteriores ao `/lock` foram restauradas.'
                    ].join(
                        '\n'
                    ),

                allowedMentions: {

                    parse:
                        []
                }
            });

        } catch (error) {

            console.error(
                '[UNLOCK]',
                error
            );


            const message =
                error instanceof Error

                    ? error.message

                    : 'Ocorreu um erro inesperado ao desbloquear o canal.';


            await interaction.editReply(
                `❌ ${message}`
            );
        }
    }
};