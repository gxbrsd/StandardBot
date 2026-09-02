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
    configureWelcome,
    disableWelcome,
    getMessageGuildData,
    makeMessageChannelReference,
    resolveWelcomeChannel,
    sendWelcomeMessage,
    setRulesEmbedConfig
} from '../services/message-config.js';

import type {
    RulesEmbedConfig,
    WelcomeFormat
} from '../services/message-config.js';


/*
|--------------------------------------------------------------------------
| VISUAL
|--------------------------------------------------------------------------
*/

const MESSAGE_COLOR =
    0x2b2d31;


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function baseEmbed():
    EmbedBuilder {

    return new EmbedBuilder()

        .setColor(
            MESSAGE_COLOR
        )

        .setFooter({

            text:
                'StandardBot • Mensagens'
        })

        .setTimestamp();
}


function errorText(
    error:
        unknown
):
    string {

    return error instanceof Error
        ? error.message
        : String(error);
}


/*
|--------------------------------------------------------------------------
| VALIDAR COR
|--------------------------------------------------------------------------
|
| Aceita:
|
| #ff0000
| ff0000
|
| E salva sempre:
|
| #FF0000
|
|--------------------------------------------------------------------------
*/

function normalizeHexColor(
    value:
        string
):
    string | null {

    const trimmed =
        value
            .trim();


    const match =
        trimmed.match(
            /^#?([0-9a-fA-F]{6})$/
        );


    if (
        !match ||
        !match[1]
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


    /*
     * Vazio = sem imagem.
     */

    if (
        trimmed.length ===
        0
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
| MODAL DE BOAS-VINDAS
|--------------------------------------------------------------------------
*/

async function showWelcomeModal(
    interaction:
        ChatInputCommandInteraction,
    format:
        WelcomeFormat
):
    Promise<ModalSubmitInteraction | null> {

    const modalId =
        `mensagens-welcome-${interaction.id}`;


    const modal =
        new ModalBuilder()

            .setCustomId(
                modalId
            )

            .setTitle(
                format ===
                    'embed'

                    ? 'Boas-vindas • Embed'

                    : 'Boas-vindas • Texto'
            );


    /*
    |--------------------------------------------------------------------------
    | MENSAGEM
    |--------------------------------------------------------------------------
    */

    const messageInput =
        new TextInputBuilder()

            .setCustomId(
                'welcome-message'
            )

            .setLabel(
                'Mensagem de boas-vindas'
            )

            .setStyle(
                TextInputStyle.Paragraph
            )

            .setPlaceholder(
                'Ex.: Bem-vindo ao {servidor}, {usuario}!'
            )

            .setRequired(
                true
            )

            .setMinLength(
                1
            )

            .setMaxLength(
                4000
            );


    const messageRow =
        new ActionRowBuilder<TextInputBuilder>()

            .addComponents(
                messageInput
            );


    modal.addComponents(
        messageRow
    );


    /*
    |--------------------------------------------------------------------------
    | TÍTULO DO EMBED
    |--------------------------------------------------------------------------
    */

    if (
        format ===
        'embed'
    ) {

        const titleInput =
            new TextInputBuilder()

                .setCustomId(
                    'welcome-title'
                )

                .setLabel(
                    'Título do embed'
                )

                .setStyle(
                    TextInputStyle.Short
                )

                .setPlaceholder(
                    'Ex.: Bem-vindo ao servidor!'
                )

                .setRequired(
                    false
                )

                .setMaxLength(
                    256
                );


        const titleRow =
            new ActionRowBuilder<TextInputBuilder>()

                .addComponents(
                    titleInput
                );


        modal.addComponents(
            titleRow
        );
    }


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
| MODAL COMPLETO DAS REGRAS
|--------------------------------------------------------------------------
|
| Discord permite no máximo 5 linhas de componentes em um modal.
|
| Nós usamos exatamente as cinco:
|
| 1. título
| 2. regras
| 3. footer
| 4. cor
| 5. imagem
|
|--------------------------------------------------------------------------
*/

async function showRulesModal(
    interaction:
        ChatInputCommandInteraction,
    current:
        RulesEmbedConfig
):
    Promise<ModalSubmitInteraction | null> {

    const modalId =
        `mensagens-rules-${interaction.id}`;


    const modal =
        new ModalBuilder()

            .setCustomId(
                modalId
            )

            .setTitle(
                'Editar embed de regras'
            );


    /*
    |--------------------------------------------------------------------------
    | 1. TÍTULO
    |--------------------------------------------------------------------------
    */

    const titleInput =
        new TextInputBuilder()

            .setCustomId(
                'rules-title'
            )

            .setLabel(
                'Título'
            )

            .setStyle(
                TextInputStyle.Short
            )

            .setPlaceholder(
                'Ex.: Regras do servidor'
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
    | 2. CONTEÚDO
    |--------------------------------------------------------------------------
    */

    const contentInput =
        new TextInputBuilder()

            .setCustomId(
                'rules-content'
            )

            .setLabel(
                'Texto das regras'
            )

            .setStyle(
                TextInputStyle.Paragraph
            )

            .setPlaceholder(
                [
                    '**01 — Respeito**',
                    'Respeite os outros membros.',
                    '',
                    '**02 — Spam**',
                    'Não faça spam.'
                ].join('\n')
            )

            .setRequired(
                true
            )

            .setMinLength(
                1
            )

            .setMaxLength(
                4000
            );


    if (
        current.content
    ) {

        contentInput.setValue(
            current.content.slice(
                0,
                4000
            )
        );
    }


    /*
    |--------------------------------------------------------------------------
    | 3. FOOTER
    |--------------------------------------------------------------------------
    */

    const footerInput =
        new TextInputBuilder()

            .setCustomId(
                'rules-footer'
            )

            .setLabel(
                'Footer'
            )

            .setStyle(
                TextInputStyle.Short
            )

            .setPlaceholder(
                'Deixe vazio para não usar footer'
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
    | 4. COR
    |--------------------------------------------------------------------------
    */

    const colorInput =
        new TextInputBuilder()

            .setCustomId(
                'rules-color'
            )

            .setLabel(
                'Cor HEX'
            )

            .setStyle(
                TextInputStyle.Short
            )

            .setPlaceholder(
                '#2B2D31'
            )

            .setRequired(
                true
            )

            .setMinLength(
                6
            )

            .setMaxLength(
                7
            );


    colorInput.setValue(
        current.color
    );


    /*
    |--------------------------------------------------------------------------
    | 5. IMAGEM
    |--------------------------------------------------------------------------
    */

    const imageInput =
        new TextInputBuilder()

            .setCustomId(
                'rules-image'
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
    | LINHAS
    |--------------------------------------------------------------------------
    */

    const titleRow =
        new ActionRowBuilder<TextInputBuilder>()

            .addComponents(
                titleInput
            );


    const contentRow =
        new ActionRowBuilder<TextInputBuilder>()

            .addComponents(
                contentInput
            );


    const footerRow =
        new ActionRowBuilder<TextInputBuilder>()

            .addComponents(
                footerInput
            );


    const colorRow =
        new ActionRowBuilder<TextInputBuilder>()

            .addComponents(
                colorInput
            );


    const imageRow =
        new ActionRowBuilder<TextInputBuilder>()

            .addComponents(
                imageInput
            );


    modal.addComponents(
        titleRow,
        contentRow,
        footerRow,
        colorRow,
        imageRow
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
| STATUS DE BOAS-VINDAS
|--------------------------------------------------------------------------
*/

async function welcomeStatus(
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
                '❌ Este comando só funciona dentro de um servidor.',

            flags:
                MessageFlags.Ephemeral
        });


        return;
    }


    const resolved =
        await resolveWelcomeChannel(
            guild
        );


    const data =
        await getMessageGuildData(
            guild.id
        );


    const welcome =
        data.welcome;


    const channelText =
        resolved.channel

            ? `<#${resolved.channel.id}>`

            : welcome.channel

                ? `#${welcome.channel.name} (${resolved.status})`

                : 'Não configurado';


    const formatText =
        welcome.format ===
            'embed'

            ? 'Embed'

            : 'Texto normal';


    const messagePreview =
        welcome.message.length >
            1000

            ? `${welcome.message.slice(0, 997)}...`

            : welcome.message;


    const embed =
        baseEmbed()

            .setTitle(
                'Boas-vindas • Status'
            )

            .addFields(

                {

                    name:
                        'Estado',

                    value:
                        welcome.enabled
                            ? '✅ Ativado'
                            : '❌ Desativado',

                    inline:
                        true
                },

                {

                    name:
                        'Formato',

                    value:
                        formatText,

                    inline:
                        true
                },

                {

                    name:
                        'Canal',

                    value:
                        channelText,

                    inline:
                        false
                },

                {

                    name:
                        'Mensagem',

                    value:
                        messagePreview,

                    inline:
                        false
                }
            );


    if (
        welcome.format ===
        'embed'
    ) {

        embed.addFields({

            name:
                'Título do embed',

            value:
                welcome.embedTitle
                    ?.trim() ||
                'Bem-vindo!',

            inline:
                false
        });
    }


    embed.addFields({

        name:
            'Variáveis disponíveis',

        value:
            [
                '`{usuario}` → menciona o usuário',
                '`{nome}` → nome exibido',
                '`{servidor}` → nome do servidor',
                '`{membros}` → número de membros'
            ].join('\n'),

        inline:
            false
    });


    await interaction.reply({

        embeds: [
            embed
        ],

        flags:
            MessageFlags.Ephemeral
    });
}


/*
|--------------------------------------------------------------------------
| STATUS DAS REGRAS
|--------------------------------------------------------------------------
*/

async function rulesStatus(
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
                '❌ Este comando só funciona dentro de um servidor.',

            flags:
                MessageFlags.Ephemeral
        });


        return;
    }


    const data =
        await getMessageGuildData(
            guild.id
        );


    const rules =
        data.rules;


    const embed =
        baseEmbed()

            .setTitle(
                'Regras • Status'
            );


    if (
        !rules.content
    ) {

        embed.setDescription(
            [
                '❌ Nenhum embed personalizado foi configurado ainda.',
                '',
                'Use:',
                '',
                '`/mensagens regras editar`'
            ].join('\n')
        );


        await interaction.reply({

            embeds: [
                embed
            ],

            flags:
                MessageFlags.Ephemeral
        });


        return;
    }


    const preview =
        rules.content.length >
            900

            ? `${rules.content.slice(0, 897)}...`

            : rules.content;


    embed

        .setDescription(
            '✅ Existe um embed de regras personalizado salvo.'
        )

        .addFields(

            {

                name:
                    'Título',

                value:
                    rules.title ||
                    'Nenhum',

                inline:
                    false
            },

            {

                name:
                    'Cor',

                value:
                    `\`${rules.color}\``,

                inline:
                    true
            },

            {

                name:
                    'Footer',

                value:
                    rules.footer ||
                    'Nenhum',

                inline:
                    false
            },

            {

                name:
                    'Imagem',

                value:
                    rules.imageUrl
                        ? rules.imageUrl
                        : 'Nenhuma',

                inline:
                    false
            },

            {

                name:
                    'Prévia do texto',

                value:
                    preview,

                inline:
                    false
            }
        );


    await interaction.reply({

        embeds: [
            embed
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

export const mensagensCommand = {

    data:
        new SlashCommandBuilder()

            .setName(
                'mensagens'
            )

            .setDescription(
                'Configura mensagens automáticas e textos do servidor.'
            )


            /*
            |--------------------------------------------------------------------------
            | BOAS-VINDAS
            |--------------------------------------------------------------------------
            */

            .addSubcommandGroup(
                group =>

                    group

                        .setName(
                            'boas-vindas'
                        )

                        .setDescription(
                            'Configura a mensagem enviada quando alguém entra.'
                        )

                        .addSubcommand(
                            subcommand =>

                                subcommand

                                    .setName(
                                        'configurar'
                                    )

                                    .setDescription(
                                        'Configura a mensagem automática de boas-vindas.'
                                    )

                                    .addChannelOption(
                                        option =>

                                            option

                                                .setName(
                                                    'canal'
                                                )

                                                .setDescription(
                                                    'Canal que receberá as boas-vindas.'
                                                )

                                                .addChannelTypes(
                                                    ChannelType.GuildText
                                                )

                                                .setRequired(
                                                    true
                                                )
                                    )

                                    .addStringOption(
                                        option =>

                                            option

                                                .setName(
                                                    'formato'
                                                )

                                                .setDescription(
                                                    'Escolha entre texto normal ou embed.'
                                                )

                                                .addChoices(

                                                    {

                                                        name:
                                                            'Texto normal',

                                                        value:
                                                            'text'
                                                    },

                                                    {

                                                        name:
                                                            'Embed',

                                                        value:
                                                            'embed'
                                                    }
                                                )

                                                .setRequired(
                                                    true
                                                )
                                    )
                        )

                        .addSubcommand(
                            subcommand =>

                                subcommand

                                    .setName(
                                        'testar'
                                    )

                                    .setDescription(
                                        'Envia uma prévia usando você como novo membro.'
                                    )
                        )

                        .addSubcommand(
                            subcommand =>

                                subcommand

                                    .setName(
                                        'status'
                                    )

                                    .setDescription(
                                        'Mostra a configuração atual de boas-vindas.'
                                    )
                        )

                        .addSubcommand(
                            subcommand =>

                                subcommand

                                    .setName(
                                        'desativar'
                                    )

                                    .setDescription(
                                        'Desativa a mensagem automática de boas-vindas.'
                                    )
                        )
            )


            /*
            |--------------------------------------------------------------------------
            | REGRAS
            |--------------------------------------------------------------------------
            */

            .addSubcommandGroup(
                group =>

                    group

                        .setName(
                            'regras'
                        )

                        .setDescription(
                            'Personaliza o embed da mensagem de regras.'
                        )

                        .addSubcommand(
                            subcommand =>

                                subcommand

                                    .setName(
                                        'editar'
                                    )

                                    .setDescription(
                                        'Edita título, texto, footer, cor e imagem das regras.'
                                    )
                        )

                        .addSubcommand(
                            subcommand =>

                                subcommand

                                    .setName(
                                        'status'
                                    )

                                    .setDescription(
                                        'Mostra a configuração atual do embed de regras.'
                                    )
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

        const guild =
            interaction.guild;


        if (
            !guild
        ) {

            await interaction.reply({

                content:
                    '❌ Este comando só funciona dentro de um servidor.',

                flags:
                    MessageFlags.Ephemeral
            });


            return;
        }


        const group =
            interaction.options.getSubcommandGroup(
                true
            );


        const subcommand =
            interaction.options.getSubcommand(
                true
            );


        /*
        |--------------------------------------------------------------------------
        | BOAS-VINDAS • CONFIGURAR
        |--------------------------------------------------------------------------
        */

        if (
            group ===
                'boas-vindas' &&

            subcommand ===
                'configurar'
        ) {

            const selectedChannel =
                interaction.options.getChannel(
                    'canal',
                    true
                );


            const channel =
                await guild.channels.fetch(
                    selectedChannel.id
                );


            if (
                !channel ||
                channel.type !==
                    ChannelType.GuildText
            ) {

                await interaction.reply({

                    content:
                        '❌ Escolha um canal de texto válido.',

                    flags:
                        MessageFlags.Ephemeral
                });


                return;
            }


            const formatValue =
                interaction.options.getString(
                    'formato',
                    true
                );


            const format:
                WelcomeFormat =

                formatValue ===
                    'embed'

                    ? 'embed'

                    : 'text';


            const modal =
                await showWelcomeModal(
                    interaction,
                    format
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


            try {

                const message =
                    modal.fields
                        .getTextInputValue(
                            'welcome-message'
                        )
                        .trim();


                let title:
                    string | null =
                    null;


                if (
                    format ===
                    'embed'
                ) {

                    const titleValue =
                        modal.fields
                            .getTextInputValue(
                                'welcome-title'
                            )
                            .trim();


                    title =
                        titleValue.length >
                            0

                            ? titleValue

                            : 'Bem-vindo!';
                }


                await configureWelcome(
                    guild.id,
                    {

                        channel:
                            makeMessageChannelReference(
                                channel
                            ),

                        format,

                        message,

                        embedTitle:
                            title
                    }
                );


                await modal.editReply({

                    content:
                        [
                            '✅ Boas-vindas configuradas.',
                            '',
                            `Canal: <#${channel.id}>`,
                            `Formato: **${format === 'embed' ? 'Embed' : 'Texto normal'}**`,
                            '',
                            'Variáveis:',
                            '`{usuario}` `{nome}` `{servidor}` `{membros}`',
                            '',
                            'Use `/mensagens boas-vindas testar`.'
                        ].join('\n')
                });

            } catch (error) {

                console.error(
                    '[MENSAGENS] Erro ao configurar boas-vindas:',
                    error
                );


                await modal.editReply({

                    content:
                        `❌ Não consegui salvar: ${errorText(error)}`
                });
            }


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | BOAS-VINDAS • TESTAR
        |--------------------------------------------------------------------------
        */

        if (
            group ===
                'boas-vindas' &&

            subcommand ===
                'testar'
        ) {

            await interaction.deferReply({

                flags:
                    MessageFlags.Ephemeral
            });


            try {

                const member =
                    await guild.members.fetch(
                        interaction.user.id
                    );


                const result =
                    await sendWelcomeMessage(
                        member
                    );


                if (
                    result.sent
                ) {

                    await interaction.editReply({

                        content:
                            '✅ Mensagem de teste enviada no canal configurado.'
                    });


                    return;
                }


                let reason =
                    result.reason ??
                    'motivo desconhecido';


                if (
                    reason ===
                    'disabled'
                ) {

                    reason =
                        'o sistema está desativado';
                }


                if (
                    reason ===
                    'channel-not-configured'
                ) {

                    reason =
                        'nenhum canal foi configurado';
                }


                if (
                    reason ===
                    'missing'
                ) {

                    reason =
                        'o canal configurado não existe mais';
                }


                if (
                    reason ===
                    'ambiguous'
                ) {

                    reason =
                        'existem vários canais com o mesmo nome';
                }


                if (
                    reason ===
                    'empty-message'
                ) {

                    reason =
                        'a mensagem está vazia';
                }


                await interaction.editReply({

                    content:
                        `❌ Não consegui enviar porque ${reason}.`
                });

            } catch (error) {

                console.error(
                    '[MENSAGENS] Erro ao testar boas-vindas:',
                    error
                );


                await interaction.editReply({

                    content:
                        `❌ Não consegui enviar o teste: ${errorText(error)}`
                });
            }


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | BOAS-VINDAS • STATUS
        |--------------------------------------------------------------------------
        */

        if (
            group ===
                'boas-vindas' &&

            subcommand ===
                'status'
        ) {

            await welcomeStatus(
                interaction
            );


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | BOAS-VINDAS • DESATIVAR
        |--------------------------------------------------------------------------
        */

        if (
            group ===
                'boas-vindas' &&

            subcommand ===
                'desativar'
        ) {

            await interaction.deferReply({

                flags:
                    MessageFlags.Ephemeral
            });


            await disableWelcome(
                guild.id
            );


            await interaction.editReply({

                content:
                    '✅ Mensagem automática de boas-vindas desativada.'
            });


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | REGRAS • EDITAR
        |--------------------------------------------------------------------------
        */

        if (
            group ===
                'regras' &&

            subcommand ===
                'editar'
        ) {

            const data =
                await getMessageGuildData(
                    guild.id
                );


            const modal =
                await showRulesModal(
                    interaction,
                    data.rules
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


            try {

                /*
                |--------------------------------------------------------------------------
                | PEGAR CAMPOS
                |--------------------------------------------------------------------------
                */

                const titleValue =
                    modal.fields
                        .getTextInputValue(
                            'rules-title'
                        )
                        .trim();


                const content =
                    modal.fields
                        .getTextInputValue(
                            'rules-content'
                        )
                        .trim();


                const footerValue =
                    modal.fields
                        .getTextInputValue(
                            'rules-footer'
                        )
                        .trim();


                const colorValue =
                    modal.fields
                        .getTextInputValue(
                            'rules-color'
                        )
                        .trim();


                const imageValue =
                    modal.fields
                        .getTextInputValue(
                            'rules-image'
                        )
                        .trim();


                /*
                |--------------------------------------------------------------------------
                | CONTEÚDO
                |--------------------------------------------------------------------------
                */

                if (
                    content.length ===
                    0
                ) {

                    await modal.editReply({

                        content:
                            '❌ O texto das regras não pode ficar vazio.'
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
                            [
                                '❌ Cor HEX inválida.',
                                '',
                                'Use algo como:',
                                '`#FF0000`',
                                '`#2B2D31`',
                                '`5865F2`'
                            ].join('\n')
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
                            [
                                '❌ A URL da imagem é inválida.',
                                '',
                                'Ela precisa começar com:',
                                '`https://`',
                                '',
                                'Ou deixe o campo vazio para remover a imagem.'
                            ].join('\n')
                    });


                    return;
                }


                /*
                |--------------------------------------------------------------------------
                | SALVAR
                |--------------------------------------------------------------------------
                */

                await setRulesEmbedConfig(
                    guild.id,
                    {

                        title:
                            titleValue.length >
                                0

                                ? titleValue

                                : null,

                        content,

                        footer:
                            footerValue.length >
                                0

                                ? footerValue

                                : null,

                        color,

                        imageUrl
                    }
                );


                await modal.editReply({

                    content:
                        [
                            '✅ Embed das regras salvo.',
                            '',
                            `Título: ${titleValue || 'nenhum'}`,
                            `Cor: \`${color}\``,
                            `Footer: ${footerValue || 'nenhum'}`,
                            `Imagem: ${imageUrl ? 'configurada' : 'nenhuma'}`,
                            '',
                            'Agora use:',
                            '`/regras atualizar`',
                            '',
                            'ou `/regras publicar` caso ainda não exista uma mensagem.'
                        ].join('\n')
                });

            } catch (error) {

                console.error(
                    '[MENSAGENS] Erro ao salvar embed das regras:',
                    error
                );


                await modal.editReply({

                    content:
                        `❌ Não consegui salvar: ${errorText(error)}`
                });
            }


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | REGRAS • STATUS
        |--------------------------------------------------------------------------
        */

        if (
            group ===
                'regras' &&

            subcommand ===
                'status'
        ) {

            await rulesStatus(
                interaction
            );


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | FALLBACK
        |--------------------------------------------------------------------------
        */

        await interaction.reply({

            content:
                '❌ Opção de mensagens não reconhecida.',

            flags:
                MessageFlags.Ephemeral
        });
    }
};