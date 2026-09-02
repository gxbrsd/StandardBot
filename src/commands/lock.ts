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
    lockChannel
} from '../services/moderation-service.js';


/*
|--------------------------------------------------------------------------
| COMANDO
|--------------------------------------------------------------------------
*/

export const lockCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'lock'
            )

            .setDescription(
                'Bloqueia o envio de mensagens em um canal.'
            )


            /*
            |--------------------------------------------------------------------------
            | CANAL
            |--------------------------------------------------------------------------
            |
            | Se nenhum canal for informado,
            | usa o canal onde o comando foi executado.
            |
            */

            .addChannelOption(
                option =>

                    option

                        .setName(
                            'canal'
                        )

                        .setDescription(
                            'Canal que será bloqueado.'
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
            | SEGURANÇA
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
            | LOCK
            |--------------------------------------------------------------------------
            |
            | O moderation-service:
            |
            | 1. verifica ManageChannels;
            |
            | 2. descobre o estado atual de SendMessages do @everyone:
            |
            |    allow
            |    deny
            |    inherit
            |
            | 3. salva isso em data/moderation;
            |
            | 4. aplica SendMessages: false;
            |
            | 5. envia log.
            |
            */

            const result =
                await lockChannel(
                    guild,
                    moderator,
                    channel
                );


            /*
            |--------------------------------------------------------------------------
            | JÁ ESTAVA TRANCADO
            |--------------------------------------------------------------------------
            |
            | Não sobrescrevemos o estado original.
            |
            | Isso é MUITO importante.
            |
            | Exemplo:
            |
            | estado original = inherit
            |
            | /lock
            | ↓
            | salva inherit
            |
            | /lock de novo
            | ↓
            | NÃO salva deny por cima
            |
            | /unlock
            | ↓
            | consegue restaurar inherit corretamente
            |
            */

            if (
                result.alreadyLocked
            ) {

                await interaction.editReply({

                    content:
                        [
                            '## Canal já bloqueado',
                            '',
                            `<#${channel.id}> já possui um \`/lock\` ativo registrado pelo StandardBot.`,
                            '',
                            'O estado original das permissões foi preservado.'
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
            | CONFIRMAÇÃO
            |--------------------------------------------------------------------------
            */

            let previousStateText:
                string;


            switch (
                result.record.previousSendMessages
            ) {

                case 'allow':

                    previousStateText =
                        'permitido explicitamente';

                    break;


                case 'deny':

                    previousStateText =
                        'negado explicitamente';

                    break;


                case 'inherit':

                    previousStateText =
                        'herdado';

                    break;
            }


            await interaction.editReply({

                content:
                    [
                        '## Canal bloqueado',
                        '',
                        `**Canal:** <#${channel.id}>`,
                        '**@everyone:** não pode mais enviar mensagens',
                        '',
                        `**Estado anterior:** ${previousStateText}`,
                        '',
                        'Esse estado será restaurado pelo `/unlock`.'
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
                '[LOCK]',
                error
            );


            const message =
                error instanceof Error

                    ? error.message

                    : 'Ocorreu um erro inesperado ao bloquear o canal.';


            await interaction.editReply(
                `❌ ${message}`
            );
        }
    }
};