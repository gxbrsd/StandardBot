import {
    mkdir,
    readFile,
    rename,
    writeFile
} from 'node:fs/promises';

import {
    randomUUID
} from 'node:crypto';

import path from 'node:path';

import type {
    ActiveTicket,
    TicketConfig,
    TicketGuildData
} from '../tickets/types.js';


/*
|--------------------------------------------------------------------------
| PASTA DOS DADOS
|--------------------------------------------------------------------------
*/

const ROOT =
    path.resolve(
        'data',
        'tickets'
    );


/*
|--------------------------------------------------------------------------
| FILA POR SERVIDOR
|--------------------------------------------------------------------------
|
| Evita duas operações simultâneas sobrescreverem
| o mesmo arquivo JSON.
|
|--------------------------------------------------------------------------
*/

const guildQueues =
    new Map<
        string,
        Promise<void>
    >();


async function withGuildLock<T>(
    guildId: string,
    task: () => Promise<T>
):
    Promise<T> {

    const previous =
        guildQueues.get(
            guildId
        ) ?? Promise.resolve();


    /*
     * O "!" aqui informa ao TypeScript que release
     * será inicializado pelo executor da Promise
     * antes de ser utilizado.
     */

    let release!:
        () => void;


    const gate =
        new Promise<void>(
            resolve => {

                release =
                    resolve;
            }
        );


    const queued =
        previous

            .catch(
                () => undefined
            )

            .then(
                () => gate
            );


    guildQueues.set(
        guildId,
        queued
    );


    /*
     * Espera a operação anterior deste servidor terminar.
     */

    await previous.catch(
        () => undefined
    );


    try {

        return await task();

    } finally {

        /*
         * Libera a próxima operação da fila.
         */

        release();


        /*
         * Se esta ainda for a última fila registrada,
         * removemos do Map.
         */

        if (
            guildQueues.get(
                guildId
            ) === queued
        ) {

            guildQueues.delete(
                guildId
            );
        }
    }
}


/*
|--------------------------------------------------------------------------
| CONFIGURAÇÃO PADRÃO
|--------------------------------------------------------------------------
*/

function emptyConfig():
    TicketConfig {

    return {

        category:
            null,

        staffRole:
            null,

        logsChannel:
            null,

        panelChannel:
            null,

        panelMessageId:
            null,

        updatedAt:
            new Date()
                .toISOString()
    };
}


/*
|--------------------------------------------------------------------------
| DADOS PADRÃO DO SERVIDOR
|--------------------------------------------------------------------------
*/

function emptyGuildData(
    guildId: string
):
    TicketGuildData {

    return {

        schemaVersion:
            1,

        guildId,

        config:
            emptyConfig(),

        activeTickets:
            [],

        nextSequence:
            1
    };
}


/*
|--------------------------------------------------------------------------
| VALIDAR ARQUIVO
|--------------------------------------------------------------------------
*/

function isTicketGuildData(
    value: unknown
):
    value is TicketGuildData {

    if (
        !value ||
        typeof value !== 'object'
    ) {

        return false;
    }


    const candidate =
        value as Partial<TicketGuildData>;


    return (

        candidate.schemaVersion === 1 &&

        typeof candidate.guildId ===
            'string' &&

        !!candidate.config &&

        Array.isArray(
            candidate.activeTickets
        ) &&

        typeof candidate.nextSequence ===
            'number'
    );
}


/*
|--------------------------------------------------------------------------
| CAMINHO DO JSON
|--------------------------------------------------------------------------
*/

function filePath(
    guildId: string
):
    string {

    return path.join(
        ROOT,
        `${guildId}.json`
    );
}


/*
|--------------------------------------------------------------------------
| LER
|--------------------------------------------------------------------------
*/

async function readUnlocked(
    guildId: string
):
    Promise<TicketGuildData> {

    await mkdir(
        ROOT,
        {
            recursive:
                true
        }
    );


    try {

        const raw =
            await readFile(
                filePath(
                    guildId
                ),
                'utf8'
            );


        const parsed:
            unknown =
            JSON.parse(
                raw
            );


        if (
            !isTicketGuildData(
                parsed
            )
        ) {

            throw new Error(
                `Arquivo de tickets do servidor ${guildId} possui formato inválido.`
            );
        }


        return parsed;

    } catch (error) {

        const code =
            (
                error as NodeJS.ErrnoException
            ).code;


        /*
         * Primeira utilização do servidor.
         */

        if (
            code === 'ENOENT'
        ) {

            return emptyGuildData(
                guildId
            );
        }


        throw error;
    }
}


/*
|--------------------------------------------------------------------------
| SALVAR
|--------------------------------------------------------------------------
|
| Salva primeiro em arquivo temporário.
|
| Depois troca pelo arquivo definitivo.
|
|--------------------------------------------------------------------------
*/

async function writeUnlocked(
    data: TicketGuildData
):
    Promise<void> {

    await mkdir(
        ROOT,
        {
            recursive:
                true
        }
    );


    const target =
        filePath(
            data.guildId
        );


    const temporary =
        `${target}.${randomUUID()}.tmp`;


    await writeFile(
        temporary,

        JSON.stringify(
            data,
            null,
            2
        ),

        'utf8'
    );


    await rename(
        temporary,
        target
    );
}


/*
|--------------------------------------------------------------------------
| PEGAR DADOS
|--------------------------------------------------------------------------
*/

export async function getTicketGuildData(
    guildId: string
):
    Promise<TicketGuildData> {

    return readUnlocked(
        guildId
    );
}


/*
|--------------------------------------------------------------------------
| SUBSTITUIR CONFIGURAÇÃO INTEIRA
|--------------------------------------------------------------------------
*/

export async function replaceTicketConfig(
    guildId: string,
    config: TicketConfig
):
    Promise<TicketGuildData> {

    return withGuildLock(

        guildId,

        async () => {

            const data =
                await readUnlocked(
                    guildId
                );


            data.config = {

                ...config,

                updatedAt:
                    new Date()
                        .toISOString()
            };


            await writeUnlocked(
                data
            );


            return data;
        }
    );
}


/*
|--------------------------------------------------------------------------
| ALTERAR PARTE DA CONFIGURAÇÃO
|--------------------------------------------------------------------------
*/

export async function patchTicketConfig(
    guildId: string,
    patch:
        Partial<TicketConfig>
):
    Promise<TicketGuildData> {

    return withGuildLock(

        guildId,

        async () => {

            const data =
                await readUnlocked(
                    guildId
                );


            data.config = {

                ...data.config,

                ...patch,

                updatedAt:
                    new Date()
                        .toISOString()
            };


            await writeUnlocked(
                data
            );


            return data;
        }
    );
}


/*
|--------------------------------------------------------------------------
| PRÓXIMO NÚMERO
|--------------------------------------------------------------------------
*/

export async function allocateTicketSequence(
    guildId: string
):
    Promise<number> {

    return withGuildLock(

        guildId,

        async () => {

            const data =
                await readUnlocked(
                    guildId
                );


            const sequence =
                data.nextSequence;


            data.nextSequence++;


            await writeUnlocked(
                data
            );


            return sequence;
        }
    );
}


/*
|--------------------------------------------------------------------------
| SALVAR TICKET ATIVO
|--------------------------------------------------------------------------
*/

export async function upsertActiveTicket(
    guildId: string,
    ticket: ActiveTicket
):
    Promise<void> {

    await withGuildLock(

        guildId,

        async () => {

            const data =
                await readUnlocked(
                    guildId
                );


            /*
             * Um registro por canal.
             *
             * Um ticket aberto por usuário.
             */

            data.activeTickets =
                data.activeTickets.filter(
                    existing =>

                        existing.channelId !==
                            ticket.channelId &&

                        existing.openerId !==
                            ticket.openerId
                );


            data.activeTickets.push(
                ticket
            );


            await writeUnlocked(
                data
            );
        }
    );
}


/*
|--------------------------------------------------------------------------
| ALTERAR TICKET ATIVO
|--------------------------------------------------------------------------
*/

export async function updateActiveTicket(
    guildId: string,
    channelId: string,

    updater:
        (
            ticket:
                ActiveTicket
        ) => void
):
    Promise<ActiveTicket | null> {

    return withGuildLock(

        guildId,

        async () => {

            const data =
                await readUnlocked(
                    guildId
                );


            const ticket =
                data.activeTickets.find(
                    item =>
                        item.channelId ===
                        channelId
                );


            if (
                !ticket
            ) {

                return null;
            }


            updater(
                ticket
            );


            await writeUnlocked(
                data
            );


            return ticket;
        }
    );
}


/*
|--------------------------------------------------------------------------
| REMOVER PELO CANAL
|--------------------------------------------------------------------------
*/

export async function removeActiveTicketByChannel(
    guildId: string,
    channelId: string
):
    Promise<void> {

    await withGuildLock(

        guildId,

        async () => {

            const data =
                await readUnlocked(
                    guildId
                );


            data.activeTickets =
                data.activeTickets.filter(
                    ticket =>
                        ticket.channelId !==
                        channelId
                );


            await writeUnlocked(
                data
            );
        }
    );
}


/*
|--------------------------------------------------------------------------
| REMOVER PELO AUTOR
|--------------------------------------------------------------------------
*/

export async function removeActiveTicketByOpener(
    guildId: string,
    openerId: string
):
    Promise<void> {

    await withGuildLock(

        guildId,

        async () => {

            const data =
                await readUnlocked(
                    guildId
                );


            data.activeTickets =
                data.activeTickets.filter(
                    ticket =>
                        ticket.openerId !==
                        openerId
                );


            await writeUnlocked(
                data
            );
        }
    );
}