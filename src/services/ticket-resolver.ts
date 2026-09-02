import {
    ChannelType
} from 'discord.js';

import type {
    CategoryChannel,
    Guild,
    Role,
    TextChannel
} from 'discord.js';

import type {
    TicketChannelReference,
    TicketConfig,
    TicketReferenceStatus,
    TicketRoleReference
} from '../tickets/types.js';

import {
    replaceTicketConfig
} from './ticket-store.js';


/*
|--------------------------------------------------------------------------
| RESULTADO DE UMA REFERÊNCIA
|--------------------------------------------------------------------------
*/

export interface ResolvedReference<T> {

    value:
        T | null;

    status:
        TicketReferenceStatus;
}


/*
|--------------------------------------------------------------------------
| CONFIGURAÇÃO COMPLETA RESOLVIDA
|--------------------------------------------------------------------------
*/

export interface ResolvedTicketConfig {

    config:
        TicketConfig;


    category:
        ResolvedReference<CategoryChannel>;


    staffRole:
        ResolvedReference<Role>;


    logsChannel:
        ResolvedReference<TextChannel>;


    panelChannel:
        ResolvedReference<TextChannel>;


    repaired:
        boolean;
}


/*
|--------------------------------------------------------------------------
| REFERÊNCIA DE CATEGORIA
|--------------------------------------------------------------------------
*/

function categoryRef(
    channel: CategoryChannel
):
    TicketChannelReference {

    return {

        id:
            channel.id,

        name:
            channel.name,

        type:
            'category'
    };
}


/*
|--------------------------------------------------------------------------
| REFERÊNCIA DE CANAL DE TEXTO
|--------------------------------------------------------------------------
*/

function textRef(
    channel: TextChannel
):
    TicketChannelReference {

    return {

        id:
            channel.id,

        name:
            channel.name,

        type:
            'text'
    };
}


/*
|--------------------------------------------------------------------------
| REFERÊNCIA DE CARGO
|--------------------------------------------------------------------------
*/

function roleRef(
    role: Role
):
    TicketRoleReference {

    return {

        id:
            role.id,

        name:
            role.name
    };
}


/*
|--------------------------------------------------------------------------
| RESOLVER CATEGORIA
|--------------------------------------------------------------------------
*/

function resolveCategory(
    guild: Guild,
    reference:
        TicketChannelReference | null
):
    ResolvedReference<CategoryChannel> {

    /*
    |--------------------------------------------------------------------------
    | NÃO CONFIGURADA
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
    | TENTAR ID
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
                ChannelType.GuildCategory
        ) {

            return {

                value:
                    byId as CategoryChannel,

                status:
                    'ok'
            };
        }
    }


    /*
    |--------------------------------------------------------------------------
    | FALLBACK POR NOME
    |--------------------------------------------------------------------------
    */

    const matches =
        guild.channels.cache

            .filter(
                channel =>

                    channel.type ===
                        ChannelType.GuildCategory &&

                    channel.name ===
                        reference.name
            )

            .map(
                channel =>
                    channel as CategoryChannel
            );


    /*
    |--------------------------------------------------------------------------
    | EXATAMENTE UMA
    |--------------------------------------------------------------------------
    */

    if (
        matches.length === 1
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
    | MAIS DE UMA
    |--------------------------------------------------------------------------
    */

    if (
        matches.length > 1
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
    | NENHUMA
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
| RESOLVER CANAL DE TEXTO
|--------------------------------------------------------------------------
*/

function resolveTextChannel(
    guild: Guild,
    reference:
        TicketChannelReference | null
):
    ResolvedReference<TextChannel> {

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
    | TENTAR ID
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


    if (
        matches.length === 1
    ) {

        return {

            value:
                matches[0] ?? null,

            status:
                'repaired'
        };
    }


    if (
        matches.length > 1
    ) {

        return {

            value:
                null,

            status:
                'ambiguous'
        };
    }


    return {

        value:
            null,

        status:
            'missing'
    };
}


/*
|--------------------------------------------------------------------------
| RESOLVER CARGO
|--------------------------------------------------------------------------
*/

function resolveRole(
    guild: Guild,
    reference:
        TicketRoleReference | null
):
    ResolvedReference<Role> {

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
    | TENTAR ID
    |--------------------------------------------------------------------------
    */

    if (
        reference.id
    ) {

        const byId =
            guild.roles.cache.get(
                reference.id
            );


        if (
            byId &&
            !byId.managed
        ) {

            return {

                value:
                    byId,

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
        guild.roles.cache

            .filter(
                role =>

                    !role.managed &&

                    role.name ===
                        reference.name
            )

            .map(
                role =>
                    role
            );


    if (
        matches.length === 1
    ) {

        return {

            value:
                matches[0] ?? null,

            status:
                'repaired'
        };
    }


    if (
        matches.length > 1
    ) {

        return {

            value:
                null,

            status:
                'ambiguous'
        };
    }


    return {

        value:
            null,

        status:
            'missing'
    };
}


/*
|--------------------------------------------------------------------------
| RESOLVER CONFIGURAÇÃO COMPLETA
|--------------------------------------------------------------------------
|
| Essa função faz:
|
| ID salvo
| ↓
| recurso existe?
|
| SIM → usa normalmente
|
| NÃO
| ↓
| procura mesmo nome + mesmo tipo
|
| encontrou exatamente 1?
|
| SIM → repara o ID automaticamente
|
| NÃO → não inventa
|
|--------------------------------------------------------------------------
*/

export async function resolveTicketConfig(
    guild: Guild,
    config: TicketConfig
):
    Promise<ResolvedTicketConfig> {

    /*
    |--------------------------------------------------------------------------
    | ATUALIZAR CACHES
    |--------------------------------------------------------------------------
    |
    | Fundamental depois de:
    |
    | /modelo restaurar
    |
    |--------------------------------------------------------------------------
    */

    await Promise.all([

        guild.channels.fetch(),

        guild.roles.fetch()
    ]);


    /*
    |--------------------------------------------------------------------------
    | RESOLVER
    |--------------------------------------------------------------------------
    */

    const category =
        resolveCategory(
            guild,
            config.category
        );


    const staffRole =
        resolveRole(
            guild,
            config.staffRole
        );


    const logsChannel =
        resolveTextChannel(
            guild,
            config.logsChannel
        );


    const panelChannel =
        resolveTextChannel(
            guild,
            config.panelChannel
        );


    /*
    |--------------------------------------------------------------------------
    | CÓPIA DA CONFIGURAÇÃO
    |--------------------------------------------------------------------------
    */

    const next:
        TicketConfig = {

        ...config
    };


    let repaired =
        false;


    /*
    |--------------------------------------------------------------------------
    | REPARAR CATEGORIA
    |--------------------------------------------------------------------------
    */

    if (
        category.status ===
            'repaired' &&

        category.value
    ) {

        next.category =
            categoryRef(
                category.value
            );


        repaired =
            true;
    }


    /*
    |--------------------------------------------------------------------------
    | REPARAR STAFF
    |--------------------------------------------------------------------------
    */

    if (
        staffRole.status ===
            'repaired' &&

        staffRole.value
    ) {

        next.staffRole =
            roleRef(
                staffRole.value
            );


        repaired =
            true;
    }


    /*
    |--------------------------------------------------------------------------
    | REPARAR LOGS
    |--------------------------------------------------------------------------
    */

    if (
        logsChannel.status ===
            'repaired' &&

        logsChannel.value
    ) {

        next.logsChannel =
            textRef(
                logsChannel.value
            );


        repaired =
            true;
    }


    /*
    |--------------------------------------------------------------------------
    | REPARAR CANAL DO PAINEL
    |--------------------------------------------------------------------------
    */

    if (
        panelChannel.status ===
            'repaired' &&

        panelChannel.value
    ) {

        /*
         * Verificamos antes se o ID realmente mudou.
         */

        const oldPanelChannelId =
            config.panelChannel?.id;


        next.panelChannel =
            textRef(
                panelChannel.value
            );


        /*
         * Canal foi recriado?
         *
         * Então a mensagem do painel antigo também morreu.
         */

        if (
            oldPanelChannelId !==
            panelChannel.value.id
        ) {

            next.panelMessageId =
                null;
        }


        repaired =
            true;
    }


    /*
    |--------------------------------------------------------------------------
    | SALVAR REPAROS
    |--------------------------------------------------------------------------
    */

    if (
        repaired
    ) {

        next.updatedAt =
            new Date()
                .toISOString();


        await replaceTicketConfig(
            guild.id,
            next
        );
    }


    /*
    |--------------------------------------------------------------------------
    | RESULTADO
    |--------------------------------------------------------------------------
    */

    return {

        config:
            next,

        category,

        staffRole,

        logsChannel,

        panelChannel,

        repaired
    };
}


/*
|--------------------------------------------------------------------------
| CRIAR REFERÊNCIA DE CATEGORIA
|--------------------------------------------------------------------------
|
| Export usado pelo:
|
| /ticket configurar
|
|--------------------------------------------------------------------------
*/

export function makeCategoryReference(
    channel: CategoryChannel
):
    TicketChannelReference {

    return categoryRef(
        channel
    );
}


/*
|--------------------------------------------------------------------------
| CRIAR REFERÊNCIA DE CANAL
|--------------------------------------------------------------------------
*/

export function makeTextReference(
    channel: TextChannel
):
    TicketChannelReference {

    return textRef(
        channel
    );
}


/*
|--------------------------------------------------------------------------
| CRIAR REFERÊNCIA DE CARGO
|--------------------------------------------------------------------------
*/

export function makeRoleReference(
    role: Role
):
    TicketRoleReference {

    return roleRef(
        role
    );
}