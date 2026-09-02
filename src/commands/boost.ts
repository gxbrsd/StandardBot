import {
    ActionRowBuilder,
    ChannelType,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';

import type {
    ChatInputCommandInteraction,
    ModalSubmitInteraction
} from 'discord.js';

import {
    mkdir,
    readFile,
    rename,
    writeFile
} from 'node:fs/promises';

import {
    resolve
} from 'node:path';

import {
    randomUUID
} from 'node:crypto';


/*
|--------------------------------------------------------------------------
| CONFIGURAÇÃO
|--------------------------------------------------------------------------
*/

const DATA_DIRECTORY =
    resolve(
        process.cwd(),
        'data',
        'boost'
    );

const DEFAULT_COLOR =
    '#2B2D31';


/*
|--------------------------------------------------------------------------
| TIPOS
|--------------------------------------------------------------------------
*/

interface BoostEmbedConfig {

    title:
        string | null;

    content:
        string;

    footer:
        string | null;

    color:
        string;

    imageUrl:
        string | null;

    updatedAt:
        string;
}


interface BoostPublicationConfig {

    channelId:
        string | null;

    messageId:
        string | null;

    updatedAt:
        string;
}


interface BoostGuildData {

    schemaVersion:
        1;

    guildId:
        string;

    embed:
        BoostEmbedConfig;

    publication:
        BoostPublicationConfig;
}


/*
|--------------------------------------------------------------------------
| FILA DE ESCRITA
|--------------------------------------------------------------------------
*/

let writeQueue:
    Promise<void> =
    Promise.resolve();


async function withWriteQueue<T>(
    work:
        () => Promise<T>
):
    Promise<T> {

    const previous =
        writeQueue;


    let release!:
        () => void;


    writeQueue =
        new Promise<void>(
            resolvePromise => {

                release =
                    resolvePromise;
            }
        );


    await previous;


    try {

        return await work();

    } finally {

        release();
    }
}


/*
|--------------------------------------------------------------------------
| DADOS PADRÃO
|--------------------------------------------------------------------------
*/

function createDefaultData(
    guildId:
        string
):
    BoostGuildData {

    const now =
        new Date()
            .toISOString();


    return {

        schemaVersion:
            1,

        guildId,

        embed: {

            title:
                'BOOSTER',

            content:
                [
                    '**Benefícios de Booster**',
                    '',
                    '• Benefícios exclusivos para apoiadores do servidor.',
                    '',
                    'Edite esta mensagem usando `/boost editar`.'
                ].join(
                    '\n'
                ),

            footer:
                'StandardBot • Boost',

            color:
                DEFAULT_COLOR,

            imageUrl:
                null,

            updatedAt:
                now
        },

        publication: {

            channelId:
                null,

            messageId:
                null,

            updatedAt:
                now
        }
    };
}


/*
|--------------------------------------------------------------------------
| CAMINHO DO ARQUIVO
|--------------------------------------------------------------------------
*/

function getGuildFilePath(
    guildId:
        string
):
    string {

    return resolve(
        DATA_DIRECTORY,
        `${guildId}.json`
    );
}


/*
|--------------------------------------------------------------------------
| LER CONFIGURAÇÃO
|--------------------------------------------------------------------------
*/

async function readBoostData(
    guildId:
        string
):
    Promise<BoostGuildData> {

    const defaults =
        createDefaultData(
            guildId
        );


    try {

        const raw =
            await readFile(
                getGuildFilePath(
                    guildId
                ),
                'utf8'
            );


        const parsed =
            JSON.parse(
                raw
            ) as Partial<BoostGuildData>;


        return {

            schemaVersion:
                1,

            guildId,

            embed: {

                ...defaults.embed,

                ...parsed.embed
            },

            publication: {

                ...defaults.publication,

                ...parsed.publication
            }
        };

    } catch (error) {

        if (
            error instanceof Error &&
            'code' in error &&
            error.code ===
                'ENOENT'
        ) {

            return defaults;
        }


        throw error;
    }
}


/*
|--------------------------------------------------------------------------
| SALVAR CONFIGURAÇÃO
|--------------------------------------------------------------------------
*/

async function writeBoostData(
    data:
        BoostGuildData
):
    Promise<void> {

    await mkdir(
        DATA_DIRECTORY,
        {
            recursive:
                true
        }
    );


    const filePath =
        getGuildFilePath(
            data.guildId
        );


    const temporaryPath =
        `${filePath}.${randomUUID()}.tmp`;


    await writeFile(
        temporaryPath,
        JSON.stringify(
            data,
            null,
            2
        ),
        'utf8'
    );


    await rename(
        temporaryPath,
        filePath
    );
}


/*
|--------------------------------------------------------------------------
| SALVAR EMBED
|--------------------------------------------------------------------------
*/

async function saveEmbedConfig(
    guildId:
        string,

    config:
        Omit<
            BoostEmbedConfig,
            'updatedAt'
        >
):
    Promise<void> {

    await withWriteQueue(
        async () => {

            const data =
                await readBoostData(
                    guildId
                );


            data.embed = {

                ...config,

                updatedAt:
                    new Date()
                        .toISOString()
            };


            await writeBoostData(
                data
            );
        }
    );
}


/*
|--------------------------------------------------------------------------
| SALVAR PUBLICAÇÃO
|--------------------------------------------------------------------------
*/

async function savePublication(
    guildId:
        string,

    channelId:
        string,

    messageId:
        string
):
    Promise<void> {

    await withWriteQueue(
        async () => {

            const data =
                await readBoostData(
                    guildId
                );


            data.publication = {

                channelId,

                messageId,

                updatedAt:
                    new Date()
                        .toISOString()
            };


            await writeBoostData(
                data
            );
        }
    );
}


/*
|--------------------------------------------------------------------------
| VALIDAR COR
|--------------------------------------------------------------------------
*/

function normalizeHexColor(
    value:
        string
):
    string | null {

    const match =
        value
            .trim()
            .match(
                /^#?([0-9a-fA-F]{6})$/
            );


    if (
        !match?.[1]
    ) {

        return null;
    }


    return (
        `#${match[1].toUpperCase()}`
    );
}


/*
|--------------------------------------------------------------------------
| VALIDAR URL DA IMAGEM
|--------------------------------------------------------------------------
*/

function normalizeImageUrl(
    value:
        string
):
    string | null | false {

    const trimmed =
        value
            .trim();


    if (
        !trimmed
    ) {

        return null;
    }


    try {

        const url =
            new URL(
                trimmed
            );


        if (
            url.protocol !==
                'http:' &&
            url.protocol !==
                'https:'
        ) {

            return false;
        }


        return url.toString();

    } catch {

        return false;
    }
}


/*
|--------------------------------------------------------------------------
| MONTAR EMBED
|--------------------------------------------------------------------------
*/

function buildBoostEmbed(
    config:
        BoostEmbedConfig
):
    EmbedBuilder {

    const color =
        Number.parseInt(
            config.color.replace(
                '#',
                ''
            ),
            16
        );


    const embed =
        new EmbedBuilder()

            .setColor(
                color
            )

            .setDescription(
                config.content
            );


    if (
        config.title
    ) {

        embed.setTitle(
            config.title
        );
    }


    if (
        config.footer
    ) {

        embed.setFooter({

            text:
                config.footer
        });
    }


    if (
        config.imageUrl
    ) {

        embed.setImage(
            config.imageUrl
        );
    }


    return embed;
}


/*
|--------------------------------------------------------------------------
| ESPERAR MODAL
|--------------------------------------------------------------------------
*/

async function waitForModal(
    interaction:
        ChatInputCommandInteraction,

    modalId:
        string
):
    Promise<ModalSubmitInteraction | null> {

    try {

        return await interaction.awaitModalSubmit({

            time:
                5 * 60_000,

            filter:
                modalInteraction =>

                    modalInteraction.customId ===
                        modalId &&

                    modalInteraction.user.id ===
                        interaction.user.id
        });

    } catch {

        return null;
    }
}


/*
|--------------------------------------------------------------------------
| MODAL DE EDIÇÃO
|--------------------------------------------------------------------------
*/

async function showBoostModal(
    interaction:
        ChatInputCommandInteraction,

    current:
        BoostEmbedConfig
):
    Promise<ModalSubmitInteraction | null> {

    const modalId =
        `boost-edit-${interaction.id}`;


    const modal =
        new ModalBuilder()

            .setCustomId(
                modalId
            )

            .setTitle(
                'Editar mensagem de boost'
            );


    /*
    |--------------------------------------------------------------------------
    | TÍTULO
    |--------------------------------------------------------------------------
    */

    const titleInput =
        new TextInputBuilder()

            .setCustomId(
                'boost-title'
            )

            .setLabel(
                'Título'
            )

            .setStyle(
                TextInputStyle.Short
            )

            .setPlaceholder(
                'Ex.: BOOSTER'
            )

            .setRequired(
                false
            )

            .setMaxLength(
                256
            );


    if (
        current.title
    ) {

        titleInput.setValue(
            current.title.slice(
                0,
                256
            )
        );
    }


    /*
    |--------------------------------------------------------------------------
    | TEXTO
    |--------------------------------------------------------------------------
    */

    const contentInput =
        new TextInputBuilder()

            .setCustomId(
                'boost-content'
            )

            .setLabel(
                'Texto da mensagem'
            )

            .setStyle(
                TextInputStyle.Paragraph
            )

            .setPlaceholder(
                'Escreva os benefícios e informações de boost.'
            )

            .setRequired(
                true
            )

            .setMinLength(
                1
            )

            .setMaxLength(
                4000
            )

            .setValue(
                current.content.slice(
                    0,
                    4000
                )
            );


    /*
    |--------------------------------------------------------------------------
    | FOOTER
    |--------------------------------------------------------------------------
    */

    const footerInput =
        new TextInputBuilder()

            .setCustomId(
                'boost-footer'
            )

            .setLabel(
                'Footer'
            )

            .setStyle(
                TextInputStyle.Short
            )

            .setPlaceholder(
                'Deixe vazio para remover'
            )

            .setRequired(
                false
            )

            .setMaxLength(
                2048
            );


    if (
        current.footer
    ) {

        footerInput.setValue(
            current.footer.slice(
                0,
                2048
            )
        );
    }


    /*
    |--------------------------------------------------------------------------
    | COR
    |--------------------------------------------------------------------------
    */

    const colorInput =
        new TextInputBuilder()

            .setCustomId(
                'boost-color'
            )

            .setLabel(
                'Cor HEX'
            )

            .setStyle(
                TextInputStyle.Short
            )

            .setPlaceholder(
                DEFAULT_COLOR
            )

            .setRequired(
                true
            )

            .setMinLength(
                6
            )

            .setMaxLength(
                7
            )

            .setValue(
                current.color
            );


    /*
    |--------------------------------------------------------------------------
    | IMAGEM
    |--------------------------------------------------------------------------
    */

    const imageInput =
        new TextInputBuilder()

            .setCustomId(
                'boost-image'
            )

            .setLabel(
                'URL da imagem'
            )

            .setStyle(
                TextInputStyle.Short
            )

            .setPlaceholder(
                'Cole uma URL ou deixe vazio'
            )

            .setRequired(
                false
            )

            .setMaxLength(
                4000
            );


    if (
        current.imageUrl
    ) {

        imageInput.setValue(
            current.imageUrl.slice(
                0,
                4000
            )
        );
    }


    /*
    |--------------------------------------------------------------------------
    | COMPONENTES
    |--------------------------------------------------------------------------
    */

    modal.addComponents(

        new ActionRowBuilder<TextInputBuilder>()

            .addComponents(
                titleInput
            ),


        new ActionRowBuilder<TextInputBuilder>()

            .addComponents(
                contentInput
            ),


        new ActionRowBuilder<TextInputBuilder>()

            .addComponents(
                footerInput
            ),


        new ActionRowBuilder<TextInputBuilder>()

            .addComponents(
                colorInput
            ),


        new ActionRowBuilder<TextInputBuilder>()

            .addComponents(
                imageInput
            )
    );


    await interaction.showModal(
        modal
    );


    return waitForModal(
        interaction,
        modalId
    );
}


/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

async function showStatus(
    interaction:
        ChatInputCommandInteraction
):
    Promise<void> {

    if (
        !interaction.guild
    ) {

        await interaction.reply({

            content:
                '❌ Este comando só funciona dentro de um servidor.',

            flags:
                MessageFlags.Ephemeral
        });


        return;
    }


    const data =
        await readBoostData(
            interaction.guild.id
        );


    const publication =
        data.publication.channelId &&
        data.publication.messageId

            ? [
                `Canal: <#${data.publication.channelId}>`,
                `Mensagem: \`${data.publication.messageId}\``
            ].join(
                '\n'
            )

            : 'Ainda não publicada.';


    const statusEmbed =
        new EmbedBuilder()

            .setColor(
                0x2b2d31
            )

            .setTitle(
                'Boost • Status'
            )

            .addFields(

                {

                    name:
                        'Título',

                    value:
                        data.embed.title ||
                        'Nenhum',

                    inline:
                        false
                },

                {

                    name:
                        'Cor',

                    value:
                        `\`${data.embed.color}\``,

                    inline:
                        true
                },

                {

                    name:
                        'Footer',

                    value:
                        data.embed.footer ||
                        'Nenhum',

                    inline:
                        false
                },

                {

                    name:
                        'Imagem',

                    value:
                        data.embed.imageUrl ||
                        'Nenhuma',

                    inline:
                        false
                },

                {

                    name:
                        'Publicação',

                    value:
                        publication,

                    inline:
                        false
                }
            )

            .setFooter({

                text:
                    'StandardBot • Boost'
            })

            .setTimestamp();


    await interaction.reply({

        embeds: [

            statusEmbed,

            buildBoostEmbed(
                data.embed
            )
        ],

        flags:
            MessageFlags.Ephemeral
    });
}


/*
|--------------------------------------------------------------------------
| COMANDO
|--------------------------------------------------------------------------
*/

export const boostCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'boost'
            )

            .setDescription(
                'Gerencia a mensagem de benefícios de boost do servidor.'
            )


            /*
            |--------------------------------------------------------------------------
            | EDITAR
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'editar'
                        )

                        .setDescription(
                            'Edita título, texto, footer, cor e imagem do embed.'
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
                            'Mostra a configuração e uma prévia do embed.'
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | PUBLICAR
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'publicar'
                        )

                        .setDescription(
                            'Publica a mensagem oficial de boost.'
                        )

                        .addChannelOption(
                            option =>

                                option

                                    .setName(
                                        'canal'
                                    )

                                    .setDescription(
                                        'Canal onde a mensagem será publicada.'
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
            | ATUALIZAR
            |--------------------------------------------------------------------------
            */

            .addSubcommand(
                subcommand =>

                    subcommand

                        .setName(
                            'atualizar'
                        )

                        .setDescription(
                            'Atualiza a mensagem de boost já publicada.'
                        )
            ),


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

        if (
            !interaction.inGuild() ||
            !interaction.guild
        ) {

            await interaction.reply({

                content:
                    '❌ Esse comando só pode ser usado dentro de um servidor.',

                flags:
                    MessageFlags.Ephemeral
            });


            return;
        }


        const subcommand =
            interaction.options
                .getSubcommand();


        /*
        |--------------------------------------------------------------------------
        | EDITAR
        |--------------------------------------------------------------------------
        */

        if (
            subcommand ===
            'editar'
        ) {

            const data =
                await readBoostData(
                    interaction.guildId
                );


            const modal =
                await showBoostModal(
                    interaction,
                    data.embed
                );


            if (
                !modal
            ) {

                return;
            }


            await modal.deferReply({

                flags:
                    MessageFlags.Ephemeral
            });


            const titleValue =
                modal.fields
                    .getTextInputValue(
                        'boost-title'
                    )
                    .trim();


            const content =
                modal.fields
                    .getTextInputValue(
                        'boost-content'
                    )
                    .trim();


            const footerValue =
                modal.fields
                    .getTextInputValue(
                        'boost-footer'
                    )
                    .trim();


            const colorValue =
                modal.fields
                    .getTextInputValue(
                        'boost-color'
                    )
                    .trim();


            const imageValue =
                modal.fields
                    .getTextInputValue(
                        'boost-image'
                    )
                    .trim();


            /*
            |--------------------------------------------------------------------------
            | TEXTO
            |--------------------------------------------------------------------------
            */

            if (
                !content
            ) {

                await modal.editReply({

                    content:
                        '❌ O texto da mensagem não pode ficar vazio.'
                });


                return;
            }


            /*
            |--------------------------------------------------------------------------
            | COR
            |--------------------------------------------------------------------------
            */

            const color =
                normalizeHexColor(
                    colorValue
                );


            if (
                !color
            ) {

                await modal.editReply({

                    content:
                        '❌ Cor HEX inválida. Use algo como `#2B2D31` ou `5865F2`.'
                });


                return;
            }


            /*
            |--------------------------------------------------------------------------
            | IMAGEM
            |--------------------------------------------------------------------------
            */

            const imageUrl =
                normalizeImageUrl(
                    imageValue
                );


            if (
                imageUrl ===
                false
            ) {

                await modal.editReply({

                    content:
                        '❌ URL de imagem inválida. Use `http://`, `https://` ou deixe vazio.'
                });


                return;
            }


            /*
            |--------------------------------------------------------------------------
            | SALVAR
            |--------------------------------------------------------------------------
            */

            await saveEmbedConfig(
                interaction.guildId,
                {

                    title:
                        titleValue ||
                        null,

                    content,

                    footer:
                        footerValue ||
                        null,

                    color,

                    imageUrl
                }
            );


            await modal.editReply({

                content:
                    [
                        '✅ Embed de boost salvo.',
                        '',
                        `Título: ${titleValue || 'nenhum'}`,
                        `Cor: \`${color}\``,
                        `Footer: ${footerValue || 'nenhum'}`,
                        `Imagem: ${imageUrl ? 'configurada' : 'nenhuma'}`,
                        '',
                        'Use `/boost publicar canal:#canal` para escolher onde publicar.',
                        '',
                        'Depois use `/boost atualizar` sempre que editar novamente.'
                    ].join(
                        '\n'
                    )
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

            await showStatus(
                interaction
            );


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | PUBLICAR
        |--------------------------------------------------------------------------
        */

        if (
            subcommand ===
            'publicar'
        ) {

            await interaction.deferReply({

                flags:
                    MessageFlags.Ephemeral
            });


            /*
            |--------------------------------------------------------------------------
            | CANAL ESCOLHIDO PELO USUÁRIO
            |--------------------------------------------------------------------------
            */

            const selectedChannel =
                interaction.options
                    .getChannel(
                        'canal',
                        true
                    );


            const channel =
                await interaction.guild
                    .channels
                    .fetch(
                        selectedChannel.id
                    );


            if (
                !channel ||
                channel.type !==
                    ChannelType.GuildText
            ) {

                await interaction.editReply({

                    content:
                        '❌ Escolha um canal de texto válido.'
                });


                return;
            }


            /*
            |--------------------------------------------------------------------------
            | EMBED
            |--------------------------------------------------------------------------
            */

            const data =
                await readBoostData(
                    interaction.guildId
                );


            const embed =
                buildBoostEmbed(
                    data.embed
                );


            /*
            |--------------------------------------------------------------------------
            | JÁ EXISTE NESSE CANAL
            |--------------------------------------------------------------------------
            */

            if (
                data.publication.channelId ===
                    channel.id &&
                data.publication.messageId
            ) {

                try {

                    const oldMessage =
                        await channel.messages.fetch(
                            data.publication.messageId
                        );


                    await oldMessage.edit({

                        embeds: [
                            embed
                        ],

                        attachments:
                            []
                    });


                    if (
                        !oldMessage.pinned
                    ) {

                        await oldMessage.pin();
                    }


                    await interaction.editReply({

                        content:
                            `✅ A mensagem de boost existente em ${channel} foi atualizada.`
                    });


                    return;

                } catch {

                    /*
                     * A mensagem antiga pode ter sido apagada.
                     * Nesse caso, criaremos outra.
                     */
                }
            }


            /*
            |--------------------------------------------------------------------------
            | CRIAR NOVA
            |--------------------------------------------------------------------------
            */

            const message =
                await channel.send({

                    embeds: [
                        embed
                    ]
                });


            await message.pin();


            /*
            |--------------------------------------------------------------------------
            | SALVAR CANAL + MENSAGEM
            |--------------------------------------------------------------------------
            */

            await savePublication(
                interaction.guildId,
                channel.id,
                message.id
            );


            await interaction.editReply({

                content:
                    `✅ Mensagem de boost publicada e fixada em ${channel}.`
            });


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | ATUALIZAR
        |--------------------------------------------------------------------------
        */

        if (
            subcommand ===
            'atualizar'
        ) {

            await interaction.deferReply({

                flags:
                    MessageFlags.Ephemeral
            });


            const data =
                await readBoostData(
                    interaction.guildId
                );


            /*
            |--------------------------------------------------------------------------
            | PUBLICAÇÃO AINDA NÃO CONFIGURADA
            |--------------------------------------------------------------------------
            */

            if (
                !data.publication.channelId ||
                !data.publication.messageId
            ) {

                await interaction.editReply({

                    content:
                        '❌ Ainda não existe uma mensagem de boost registrada. Use `/boost publicar canal:#canal` primeiro.'
                });


                return;
            }


            try {

                /*
                |--------------------------------------------------------------------------
                | CANAL
                |--------------------------------------------------------------------------
                */

                const channel =
                    await interaction.guild
                        .channels
                        .fetch(
                            data.publication.channelId
                        );


                if (
                    !channel ||
                    channel.type !==
                        ChannelType.GuildText
                ) {

                    throw new Error(
                        'Canal de boost não encontrado.'
                    );
                }


                /*
                |--------------------------------------------------------------------------
                | MENSAGEM
                |--------------------------------------------------------------------------
                */

                const message =
                    await channel.messages.fetch(
                        data.publication.messageId
                    );


                /*
                |--------------------------------------------------------------------------
                | ATUALIZAR
                |--------------------------------------------------------------------------
                */

                await message.edit({

                    embeds: [
                        buildBoostEmbed(
                            data.embed
                        )
                    ],

                    attachments:
                        []
                });


                if (
                    !message.pinned
                ) {

                    await message.pin();
                }


                await interaction.editReply({

                    content:
                        `✅ Mensagem de boost atualizada em ${channel}.`
                });

            } catch (error) {

                console.error(
                    'Erro ao atualizar mensagem de boost:',
                    error
                );


                await interaction.editReply({

                    content:
                        '❌ Não consegui encontrar ou editar a mensagem antiga. Use `/boost publicar canal:#canal` para criar uma nova.'
                });
            }


            return;
        }
    }
};