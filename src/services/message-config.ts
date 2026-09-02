import {
    ChannelType,
    EmbedBuilder
} from 'discord.js';

import type {
    Guild,
    GuildMember,
    TextChannel
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
| CONSTANTES
|--------------------------------------------------------------------------
*/

const MESSAGE_COLOR =
    0x2b2d31;

const DATA_DIRECTORY =
    resolve(
        process.cwd(),
        'data',
        'messages'
    );


/*
|--------------------------------------------------------------------------
| TIPOS
|--------------------------------------------------------------------------
*/

export type WelcomeFormat =
    'text' |
    'embed';


export interface MessageChannelReference {

    id:
        string | null;

    name:
        string;
}


export interface WelcomeConfig {

    enabled:
        boolean;

    channel:
        MessageChannelReference | null;

    format:
        WelcomeFormat;

    message:
        string;

    embedTitle:
        string | null;

    updatedAt:
        string;
}


/*
|--------------------------------------------------------------------------
| CONFIGURAÇÃO DO EMBED DE REGRAS
|--------------------------------------------------------------------------
|
| Tudo fica salvo por servidor.
|
| title:
|   título do embed.
|
| content:
|   texto principal das regras.
|
| footer:
|   texto inferior do embed.
|
| color:
|   cor em formato HEX.
|
| imageUrl:
|   imagem grande exibida no embed.
|
|--------------------------------------------------------------------------
*/

export interface RulesEmbedConfig {

    title:
        string | null;

    content:
        string | null;

    footer:
        string | null;

    color:
        string;

    imageUrl:
        string | null;

    updatedAt:
        string;
}


export interface MessageGuildData {

    schemaVersion:
        1;

    guildId:
        string;

    welcome:
        WelcomeConfig;

    rules:
        RulesEmbedConfig;
}


export type MessageChannelResolveStatus =
    | 'not-configured'
    | 'ok'
    | 'repaired'
    | 'missing'
    | 'ambiguous';


export interface MessageChannelResolveResult {

    status:
        MessageChannelResolveStatus;

    channel:
        TextChannel | null;
}


export interface WelcomeSendResult {

    sent:
        boolean;

    reason:
        string | null;
}


/*
|--------------------------------------------------------------------------
| FILA DE ESCRITA
|--------------------------------------------------------------------------
|
| Evita duas alterações no mesmo arquivo ao mesmo tempo.
|
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
| CONFIGURAÇÃO PADRÃO
|--------------------------------------------------------------------------
*/

function createDefaultData(
    guildId:
        string
):
    MessageGuildData {

    const now =
        new Date()
            .toISOString();


    return {

        schemaVersion:
            1,

        guildId,

        welcome: {

            enabled:
                false,

            channel:
                null,

            format:
                'text',

            message:
                'Seja bem-vindo ao {servidor}, {usuario}!',

            embedTitle:
                'Bem-vindo!',

            updatedAt:
                now
        },

        rules: {

            /*
             * content === null significa que o servidor
             * ainda está usando o embed antigo padrão.
             */

            title:
                'Server Rules',

            content:
                null,

            footer:
                'StandardBot • Rules',

            color:
                '#2b2d31',

            imageUrl:
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

async function readGuildData(
    guildId:
        string
):
    Promise<MessageGuildData> {

    const filePath =
        getGuildFilePath(
            guildId
        );


    try {

        const raw =
            await readFile(
                filePath,
                'utf8'
            );


        const parsed =
            JSON.parse(
                raw
            ) as Partial<MessageGuildData>;


        /*
        |--------------------------------------------------------------------------
        | COMPATIBILIDADE
        |--------------------------------------------------------------------------
        |
        | Seus arquivos antigos data/messages/*.json
        | tinham somente:
        |
        | rules.content
        | rules.updatedAt
        |
        | Ao adicionar os novos campos, os valores padrão
        | são preenchidos automaticamente.
        |
        |--------------------------------------------------------------------------
        */

        const defaults =
            createDefaultData(
                guildId
            );


        return {

            schemaVersion:
                1,

            guildId,

            welcome: {

                ...defaults.welcome,

                ...parsed.welcome,

                channel:
                    parsed.welcome
                        ?.channel ??
                    defaults.welcome.channel
            },

            rules: {

                ...defaults.rules,

                ...parsed.rules
            }
        };

    } catch (error) {

        if (
            error instanceof Error &&
            'code' in error &&
            error.code ===
                'ENOENT'
        ) {

            return createDefaultData(
                guildId
            );
        }


        throw error;
    }
}


/*
|--------------------------------------------------------------------------
| ESCREVER CONFIGURAÇÃO
|--------------------------------------------------------------------------
*/

async function writeGuildData(
    data:
        MessageGuildData
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
| CONFIGURAÇÃO COMPLETA
|--------------------------------------------------------------------------
*/

export async function getMessageGuildData(
    guildId:
        string
):
    Promise<MessageGuildData> {

    return readGuildData(
        guildId
    );
}


/*
|--------------------------------------------------------------------------
| REFERÊNCIA DE CANAL
|--------------------------------------------------------------------------
*/

export function makeMessageChannelReference(
    channel: {
        id:
            string;

        name:
            string;
    }
):
    MessageChannelReference {

    return {

        id:
            channel.id,

        name:
            channel.name
    };
}


/*
|--------------------------------------------------------------------------
| CONFIGURAR BOAS-VINDAS
|--------------------------------------------------------------------------
*/

export async function configureWelcome(
    guildId:
        string,

    options: {

        channel:
            MessageChannelReference;

        format:
            WelcomeFormat;

        message:
            string;

        embedTitle:
            string | null;
    }
):
    Promise<MessageGuildData> {

    return withWriteQueue(
        async () => {

            const data =
                await readGuildData(
                    guildId
                );


            data.welcome = {

                enabled:
                    true,

                channel:
                    options.channel,

                format:
                    options.format,

                message:
                    options.message,

                embedTitle:
                    options.embedTitle,

                updatedAt:
                    new Date()
                        .toISOString()
            };


            await writeGuildData(
                data
            );


            return data;
        }
    );
}


/*
|--------------------------------------------------------------------------
| DESATIVAR BOAS-VINDAS
|--------------------------------------------------------------------------
*/

export async function disableWelcome(
    guildId:
        string
):
    Promise<MessageGuildData> {

    return withWriteQueue(
        async () => {

            const data =
                await readGuildData(
                    guildId
                );


            data.welcome.enabled =
                false;


            data.welcome.updatedAt =
                new Date()
                    .toISOString();


            await writeGuildData(
                data
            );


            return data;
        }
    );
}


/*
|--------------------------------------------------------------------------
| TEXTO DAS REGRAS
|--------------------------------------------------------------------------
|
| Mantemos esta função por compatibilidade com o código
| que já está funcionando agora.
|
| Ela altera somente o texto e preserva título,
| footer, cor e imagem.
|
|--------------------------------------------------------------------------
*/

export async function setRulesContent(
    guildId:
        string,
    content:
        string
):
    Promise<MessageGuildData> {

    return withWriteQueue(
        async () => {

            const data =
                await readGuildData(
                    guildId
                );


            data.rules.content =
                content;


            data.rules.updatedAt =
                new Date()
                    .toISOString();


            await writeGuildData(
                data
            );


            return data;
        }
    );
}


/*
|--------------------------------------------------------------------------
| CONFIGURAR EMBED COMPLETO DAS REGRAS
|--------------------------------------------------------------------------
*/

export async function setRulesEmbedConfig(
    guildId:
        string,

    options: {

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
    }
):
    Promise<MessageGuildData> {

    return withWriteQueue(
        async () => {

            const data =
                await readGuildData(
                    guildId
                );


            data.rules = {

                title:
                    options.title,

                content:
                    options.content,

                footer:
                    options.footer,

                color:
                    options.color,

                imageUrl:
                    options.imageUrl,

                updatedAt:
                    new Date()
                        .toISOString()
            };


            await writeGuildData(
                data
            );


            return data;
        }
    );
}


/*
|--------------------------------------------------------------------------
| OBTER TEXTO DAS REGRAS
|--------------------------------------------------------------------------
*/

export async function getRulesContent(
    guildId:
        string
):
    Promise<string | null> {

    const data =
        await readGuildData(
            guildId
        );


    return data.rules.content;
}


/*
|--------------------------------------------------------------------------
| RESOLVER CANAL DE BOAS-VINDAS
|--------------------------------------------------------------------------
|
| Primeiro tenta ID.
|
| Caso /modelo restaurar tenha recriado os canais e mudado os IDs:
|
| - procura pelo nome;
| - se existir exatamente 1, repara automaticamente o ID salvo;
| - se houver duplicados, não chuta.
|
|--------------------------------------------------------------------------
*/

export async function resolveWelcomeChannel(
    guild:
        Guild
):
    Promise<MessageChannelResolveResult> {

    const data =
        await readGuildData(
            guild.id
        );


    const reference =
        data.welcome.channel;


    if (
        !reference
    ) {

        return {

            status:
                'not-configured',

            channel:
                null
        };
    }


    await guild.channels.fetch();


    /*
    |--------------------------------------------------------------------------
    | 1. ID
    |--------------------------------------------------------------------------
    */

    if (
        reference.id
    ) {

        const channelById =
            guild.channels.cache.get(
                reference.id
            );


        if (
            channelById &&
            channelById.type ===
                ChannelType.GuildText
        ) {

            return {

                status:
                    'ok',

                channel:
                    channelById
            };
        }
    }


    /*
    |--------------------------------------------------------------------------
    | 2. NOME
    |--------------------------------------------------------------------------
    */

    const matches =
        [
            ...guild.channels.cache.values()
        ]

            .filter(
                (
                    channel
                ): channel is TextChannel =>

                    channel.type ===
                        ChannelType.GuildText &&

                    channel.name ===
                        reference.name
            );


    if (
        matches.length ===
        0
    ) {

        return {

            status:
                'missing',

            channel:
                null
        };
    }


    if (
        matches.length >
        1
    ) {

        return {

            status:
                'ambiguous',

            channel:
                null
        };
    }


    const repairedChannel =
        matches[0];


    if (
        !repairedChannel
    ) {

        return {

            status:
                'missing',

            channel:
                null
        };
    }


    /*
    |--------------------------------------------------------------------------
    | REPARAR ID
    |--------------------------------------------------------------------------
    */

    await withWriteQueue(
        async () => {

            const latest =
                await readGuildData(
                    guild.id
                );


            if (
                latest.welcome.channel
            ) {

                latest.welcome.channel = {

                    id:
                        repairedChannel.id,

                    name:
                        repairedChannel.name
                };


                latest.welcome.updatedAt =
                    new Date()
                        .toISOString();


                await writeGuildData(
                    latest
                );
            }
        }
    );


    console.log(
        `[MENSAGENS] Canal de boas-vindas reparado: #${repairedChannel.name} (${repairedChannel.id})`
    );


    return {

        status:
            'repaired',

        channel:
            repairedChannel
    };
}


/*
|--------------------------------------------------------------------------
| VARIÁVEIS PERSONALIZÁVEIS
|--------------------------------------------------------------------------
|
| {usuario}  -> menção
| {nome}     -> nome exibido no servidor
| {servidor} -> nome do servidor
| {membros}  -> quantidade de membros
|
|--------------------------------------------------------------------------
*/

export function renderMessageTemplate(
    template:
        string,
    member:
        GuildMember
):
    string {

    return template

        .replaceAll(
            '{usuario}',
            `<@${member.id}>`
        )

        .replaceAll(
            '{nome}',
            member.displayName
        )

        .replaceAll(
            '{servidor}',
            member.guild.name
        )

        .replaceAll(
            '{membros}',
            String(
                member.guild.memberCount
            )
        );
}


/*
|--------------------------------------------------------------------------
| ENVIAR BOAS-VINDAS
|--------------------------------------------------------------------------
*/

export async function sendWelcomeMessage(
    member:
        GuildMember
):
    Promise<WelcomeSendResult> {

    const data =
        await readGuildData(
            member.guild.id
        );


    /*
    |--------------------------------------------------------------------------
    | DESATIVADO
    |--------------------------------------------------------------------------
    */

    if (
        !data.welcome.enabled
    ) {

        return {

            sent:
                false,

            reason:
                'disabled'
        };
    }


    /*
    |--------------------------------------------------------------------------
    | SEM CANAL
    |--------------------------------------------------------------------------
    */

    if (
        !data.welcome.channel
    ) {

        return {

            sent:
                false,

            reason:
                'channel-not-configured'
        };
    }


    /*
    |--------------------------------------------------------------------------
    | SEM MENSAGEM
    |--------------------------------------------------------------------------
    */

    if (
        data.welcome.message
            .trim()
            .length ===
        0
    ) {

        return {

            sent:
                false,

            reason:
                'empty-message'
        };
    }


    /*
    |--------------------------------------------------------------------------
    | RESOLVER CANAL
    |--------------------------------------------------------------------------
    */

    const resolved =
        await resolveWelcomeChannel(
            member.guild
        );


    if (
        !resolved.channel
    ) {

        return {

            sent:
                false,

            reason:
                resolved.status
        };
    }


    const channel =
        resolved.channel;


    /*
    |--------------------------------------------------------------------------
    | RENDERIZAR
    |--------------------------------------------------------------------------
    */

    const renderedMessage =
        renderMessageTemplate(
            data.welcome.message,
            member
        );


    /*
    |--------------------------------------------------------------------------
    | TEXTO NORMAL
    |--------------------------------------------------------------------------
    */

    if (
        data.welcome.format ===
        'text'
    ) {

        /*
         * Se o administrador não colocou {usuario},
         * ainda mencionamos a pessoa automaticamente.
         */

        const content =
            data.welcome.message.includes(
                '{usuario}'
            )

                ? renderedMessage

                : [
                    `<@${member.id}>`,
                    renderedMessage
                ].join(
                    '\n'
                );


        await channel.send({

            content,

            allowedMentions: {

                users: [
                    member.id
                ]
            }
        });


        return {

            sent:
                true,

            reason:
                null
        };
    }


    /*
    |--------------------------------------------------------------------------
    | EMBED
    |--------------------------------------------------------------------------
    */

    const rawTitle =
        data.welcome.embedTitle
            ?.trim();


    const title =
        rawTitle

            ? renderMessageTemplate(
                rawTitle,
                member
            )

            : 'Bem-vindo!';


    const embed =
        new EmbedBuilder()

            .setColor(
                MESSAGE_COLOR
            )

            .setTitle(
                title
                    .slice(
                        0,
                        256
                    )
            )

            .setDescription(
                renderedMessage
                    .slice(
                        0,
                        4096
                    )
            )

            .setThumbnail(
                member.user.displayAvatarURL({

                    size:
                        256
                })
            )

            .setTimestamp();


    await channel.send({

        /*
         * Sempre menciona fora do embed para
         * realmente gerar a notificação.
         */

        content:
            `<@${member.id}>`,

        embeds: [
            embed
        ],

        allowedMentions: {

            users: [
                member.id
            ]
        }
    });


    return {

        sent:
            true,

        reason:
            null
    };
}