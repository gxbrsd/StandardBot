import {
    ChannelType
} from 'discord.js';

import type {
    Guild,
    TextChannel
} from 'discord.js';

import type {
    ModerationChannelReference,
    ModerationConfig
} from '../moderacao/types.js';

import {
    patchModerationConfig
} from './moderation-store.js';


/*
|--------------------------------------------------------------------------
| STATUS DA REFERÊNCIA
|--------------------------------------------------------------------------
*/

export type ModerationReferenceStatus =
    | 'not-configured'
    | 'ok'
    | 'repaired'
    | 'missing'
    | 'ambiguous';


/*
|--------------------------------------------------------------------------
| RESULTADO DE UMA REFERÊNCIA
|--------------------------------------------------------------------------
*/

export interface ResolvedModerationReference<T> {

    value:
        T | null;

    status:
        ModerationReferenceStatus;
}


/*
|--------------------------------------------------------------------------
| CONFIGURAÇÃO RESOLVIDA
|--------------------------------------------------------------------------
*/

export interface ResolvedModerationConfig {

    config:
        ModerationConfig;


    logsChannel:
        ResolvedModerationReference<TextChannel>;


    /*
     * true quando algum ID antigo foi substituído
     * automaticamente por um novo.
     */
    repaired:
        boolean;
}


/*
|--------------------------------------------------------------------------
| CRIAR REFERÊNCIA DE CANAL DE TEXTO
|--------------------------------------------------------------------------
|
| Guardamos:
|
| - ID atual
| - nome
|
| Exemplo:
|
| {
|   id: "123456",
|   name: "logs-mod"
| }
|
|--------------------------------------------------------------------------
*/

export function makeModerationTextReference(
    channel: TextChannel
):
    ModerationChannelReference {

    return {

        id:
            channel.id,

        name:
            channel.name
    };
}


/*
|--------------------------------------------------------------------------
| RESOLVER CANAL DE TEXTO
|--------------------------------------------------------------------------
|
| Estratégia:
|
| 1. tenta o ID salvo;
| 2. se morreu, procura pelo nome;
| 3. se existir exatamente um, repara;
| 4. se houver vários iguais, não escolhe no chute.
|
|--------------------------------------------------------------------------
*/

function resolveTextChannel(
    guild: Guild,
    reference:
        ModerationChannelReference | null
):
    ResolvedModerationReference<TextChannel> {

    /*
    |--------------------------------------------------------------------------
    | NÃO CONFIGURADO
    |--------------------------------------------------------------------------
    */

    if (
        !reference
    ) {

        return {

            value:
                null,

            status:
                'not-configured'
        };
    }


    /*
    |--------------------------------------------------------------------------
    | TENTAR PELO ID
    |--------------------------------------------------------------------------
    */

    if (
        reference.id
    ) {

        const byId =
            guild.channels.cache.get(
                reference.id
            );


        if (
            byId &&
            byId.type ===
                ChannelType.GuildText
        ) {

            return {

                value:
                    byId as TextChannel,

                status:
                    'ok'
            };
        }
    }


    /*
    |--------------------------------------------------------------------------
    | FALLBACK PELO NOME
    |--------------------------------------------------------------------------
    */

    const matches =
        guild.channels.cache

            .filter(
                channel =>

                    channel.type ===
                        ChannelType.GuildText &&

                    channel.name ===
                        reference.name
            )

            .map(
                channel =>
                    channel as TextChannel
            );


    /*
    |--------------------------------------------------------------------------
    | EXATAMENTE UM
    |--------------------------------------------------------------------------
    */

    if (
        matches.length ===
        1
    ) {

        return {

            value:
                matches[0] ?? null,

            status:
                'repaired'
        };
    }


    /*
    |--------------------------------------------------------------------------
    | VÁRIOS COM O MESMO NOME
    |--------------------------------------------------------------------------
    */

    if (
        matches.length >
        1
    ) {

        return {

            value:
                null,

            status:
                'ambiguous'
        };
    }


    /*
    |--------------------------------------------------------------------------
    | NÃO EXISTE
    |--------------------------------------------------------------------------
    */

    return {

        value:
            null,

        status:
            'missing'
    };
}


/*
|--------------------------------------------------------------------------
| RESOLVER CONFIGURAÇÃO DE MODERAÇÃO
|--------------------------------------------------------------------------
|
| Exemplo:
|
| antes do /modelo:
|
| #logs-mod
| ID = 111
|
|
| depois do /modelo:
|
| #logs-mod
| ID = 999
|
|
| O sistema:
|
| tenta 111
| ↓
| não existe
| ↓
| encontra exatamente um "logs-mod"
| ↓
| muda o ID para 999
| ↓
| salva automaticamente
|
|--------------------------------------------------------------------------
*/

export async function resolveModerationConfig(
    guild: Guild,
    config: ModerationConfig
):
    Promise<ResolvedModerationConfig> {

    /*
    |--------------------------------------------------------------------------
    | ATUALIZAR CACHE
    |--------------------------------------------------------------------------
    |
    | Fundamental porque /modelo pode ter acabado
    | de recriar toda a estrutura.
    |
    */

    await guild.channels.fetch();


    /*
    |--------------------------------------------------------------------------
    | RESOLVER LOGS
    |--------------------------------------------------------------------------
    */

    const logsChannel =
        resolveTextChannel(
            guild,
            config.logsChannel
        );


    let repaired =
        false;


    let nextConfig:
        ModerationConfig = {

        ...config
    };


    /*
    |--------------------------------------------------------------------------
    | REPARAR ID
    |--------------------------------------------------------------------------
    */

    if (
        logsChannel.status ===
            'repaired' &&

        logsChannel.value
    ) {

        nextConfig = {

            ...nextConfig,

            logsChannel:
                makeModerationTextReference(
                    logsChannel.value
                ),

            updatedAt:
                new Date()
                    .toISOString()
        };


        await patchModerationConfig(
            guild.id,
            {

                logsChannel:
                    nextConfig.logsChannel
            }
        );


        repaired =
            true;
    }


    return {

        config:
            nextConfig,

        logsChannel,

        repaired
    };
}