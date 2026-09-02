import {
    ChannelType
} from 'discord.js';

import type {
    Guild
} from 'discord.js';

import type {
    ActiveTicket
} from '../tickets/types.js';

import {
    getTicketGuildData
} from './ticket-store.js';


/*
|--------------------------------------------------------------------------
| MARCADOR OFICIAL DOS TICKETS
|--------------------------------------------------------------------------
|
| Todo canal criado pelo StandardBot recebe um tópico assim:
|
| StandardBot Ticket • opener:123 • ticket:4
|
| Ele funciona como segunda camada de segurança.
|
|--------------------------------------------------------------------------
*/

const TICKET_TOPIC_PREFIX =
    'StandardBot Ticket •';


/*
|--------------------------------------------------------------------------
| RESULTADO
|--------------------------------------------------------------------------
*/

export interface ActiveTicketChannelsResult {

    tickets:
        ActiveTicket[];

    channelIds:
        Set<string>;

    removedStale:
        number;

    recoveredByMarker:
        number;
}


/*
|--------------------------------------------------------------------------
| VERIFICAR MARCADOR
|--------------------------------------------------------------------------
*/

function hasTicketMarker(
    topic: string | null
):
    boolean {

    return (
        typeof topic === 'string' &&
        topic.startsWith(
            TICKET_TOPIC_PREFIX
        )
    );
}


/*
|--------------------------------------------------------------------------
| PEGAR CANAIS DE TICKET
|--------------------------------------------------------------------------
|
| REGRA PRINCIPAL:
|
| Se o ticket-store oficial possui o channelId,
| ele é considerado temporário imediatamente.
|
| Não precisamos consultar o Discord outra vez
| para decidir se deve entrar ou não em um snapshot.
|
|--------------------------------------------------------------------------
*/

export async function getActiveTicketChannels(
    guild: Guild
):
    Promise<ActiveTicketChannelsResult> {

    /*
    |--------------------------------------------------------------------------
    | DADOS DO STORE
    |--------------------------------------------------------------------------
    */

    const data =
        await getTicketGuildData(
            guild.id
        );


    /*
    |--------------------------------------------------------------------------
    | IDS
    |--------------------------------------------------------------------------
    |
    | IMPORTANTE:
    |
    | Entram no Set DIRETAMENTE.
    |
    | Isso significa que:
    |
    | activeTickets:
    | [
    |   {
    |       channelId: "123"
    |   }
    | ]
    |
    | imediatamente gera:
    |
    | Set("123")
    |
    |--------------------------------------------------------------------------
    */

    const channelIds =
        new Set<string>(
            data.activeTickets.map(
                ticket =>
                    ticket.channelId
            )
        );


    /*
    |--------------------------------------------------------------------------
    | BUSCAR CANAIS
    |--------------------------------------------------------------------------
    |
    | Essa busca agora serve apenas para a segunda camada:
    | detectar tickets pelo tópico oficial.
    |
    |--------------------------------------------------------------------------
    */

    const channels =
        await guild.channels.fetch();


    let recoveredByMarker =
        0;


    /*
    |--------------------------------------------------------------------------
    | SEGUNDA CAMADA
    |--------------------------------------------------------------------------
    */

    for (
        const channel
        of channels.values()
    ) {

        if (
            !channel
        ) {

            continue;
        }


        if (
            channel.type !==
            ChannelType.GuildText
        ) {

            continue;
        }


        if (
            !hasTicketMarker(
                channel.topic
            )
        ) {

            continue;
        }


        /*
         * Já veio do JSON.
         */

        if (
            channelIds.has(
                channel.id
            )
        ) {

            continue;
        }


        /*
         * Não estava no JSON,
         * mas possui o marcador oficial.
         */

        channelIds.add(
            channel.id
        );


        recoveredByMarker++;
    }


    /*
    |--------------------------------------------------------------------------
    | DEBUG
    |--------------------------------------------------------------------------
    |
    | Por enquanto eu QUERO que isso apareça sempre.
    |
    | Assim não ficamos mais tentando adivinhar.
    |
    |--------------------------------------------------------------------------
    */

    console.log(
        [
            '[TICKET/MODELO]',
            `guild=${guild.name}`,
            `guildId=${guild.id}`,
            `store=${data.activeTickets.length}`,
            `detectados=${channelIds.size}`,
            `marcador=${recoveredByMarker}`
        ].join(
            ' '
        )
    );


    if (
        data.activeTickets.length >
        0
    ) {

        console.log(
            '[TICKET/MODELO] IDs do store:',
            data.activeTickets.map(
                ticket =>
                    ticket.channelId
            )
        );
    }


    if (
        channelIds.size >
        0
    ) {

        console.log(
            '[TICKET/MODELO] IDs protegidos do modelo:',
            [
                ...channelIds
            ]
        );
    }


    return {

        tickets:
            data.activeTickets,

        channelIds,

        /*
         * Não limpamos registros aqui.
         *
         * Essa ponte existe para PROTEGER dados durante
         * captura/restauração, não para decidir que um
         * ticket deve ser apagado do store.
         */

        removedStale:
            0,

        recoveredByMarker
    };
}


/*
|--------------------------------------------------------------------------
| PEGAR SOMENTE IDS
|--------------------------------------------------------------------------
*/

export async function getActiveTicketChannelIds(
    guild: Guild
):
    Promise<Set<string>> {

    const result =
        await getActiveTicketChannels(
            guild
        );


    return result.channelIds;
}


/*
|--------------------------------------------------------------------------
| QUANTIDADE
|--------------------------------------------------------------------------
*/

export async function getActiveTicketCount(
    guild: Guild
):
    Promise<number> {

    const result =
        await getActiveTicketChannels(
            guild
        );


    return result.channelIds.size;
}


/*
|--------------------------------------------------------------------------
| VERIFICAR CANAL
|--------------------------------------------------------------------------
*/

export async function isActiveTicketChannel(
    guild: Guild,
    channelId: string
):
    Promise<boolean> {

    const result =
        await getActiveTicketChannels(
            guild
        );


    return result.channelIds.has(
        channelId
    );
}