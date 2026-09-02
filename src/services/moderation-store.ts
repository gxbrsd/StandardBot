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
    ChannelLockRecord,
    ModerationConfig,
    ModerationGuildData,
    WarningRecord
} from '../moderacao/types.js';


/*
|--------------------------------------------------------------------------
| PASTA
|--------------------------------------------------------------------------
*/

const ROOT =
    path.resolve(
        'data',
        'moderation'
    );


/*
|--------------------------------------------------------------------------
| LOCK POR SERVIDOR
|--------------------------------------------------------------------------
|
| Evita duas ações de moderação alterarem o mesmo JSON
| ao mesmo tempo.
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


    await previous.catch(
        () => undefined
    );


    try {

        return await task();

    } finally {

        release();


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
| CONFIG PADRÃO
|--------------------------------------------------------------------------
*/

function emptyConfig():
    ModerationConfig {

    return {

        logsChannel:
            null,

        updatedAt:
            new Date()
                .toISOString()
    };
}


/*
|--------------------------------------------------------------------------
| DADOS PADRÃO
|--------------------------------------------------------------------------
*/

function emptyGuildData(
    guildId: string
):
    ModerationGuildData {

    return {

        schemaVersion:
            1,

        guildId,

        config:
            emptyConfig(),

        warnings:
            [],

        nextWarningId:
            1,

        lockedChannels:
            []
    };
}


/*
|--------------------------------------------------------------------------
| VALIDAÇÃO
|--------------------------------------------------------------------------
*/

function isModerationGuildData(
    value: unknown
):
    value is ModerationGuildData {

    if (
        !value ||
        typeof value !==
            'object'
    ) {

        return false;
    }


    const candidate =
        value as Partial<ModerationGuildData>;


    return (

        candidate.schemaVersion ===
            1 &&

        typeof candidate.guildId ===
            'string' &&

        !!candidate.config &&

        Array.isArray(
            candidate.warnings
        ) &&

        typeof candidate.nextWarningId ===
            'number' &&

        Array.isArray(
            candidate.lockedChannels
        )
    );
}


/*
|--------------------------------------------------------------------------
| CAMINHO
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
    Promise<ModerationGuildData> {

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
            !isModerationGuildData(
                parsed
            )
        ) {

            throw new Error(
                `Arquivo de moderação do servidor ${guildId} possui formato inválido.`
            );
        }


        return parsed;

    } catch (error) {

        const code =
            (
                error as NodeJS.ErrnoException
            ).code;


        if (
            code ===
                'ENOENT'
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
*/

async function writeUnlocked(
    data: ModerationGuildData
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

export async function getModerationGuildData(
    guildId: string
):
    Promise<ModerationGuildData> {

    return readUnlocked(
        guildId
    );
}


/*
|--------------------------------------------------------------------------
| PATCH DE CONFIGURAÇÃO
|--------------------------------------------------------------------------
*/

export async function patchModerationConfig(
    guildId: string,
    patch:
        Partial<ModerationConfig>
):
    Promise<ModerationGuildData> {

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
| ADICIONAR WARNING
|--------------------------------------------------------------------------
*/

export async function addWarningRecord(
    guildId: string,
    userId: string,
    moderatorId: string,
    reason: string
):
    Promise<WarningRecord> {

    return withGuildLock(

        guildId,

        async () => {

            const data =
                await readUnlocked(
                    guildId
                );


            const warning:
                WarningRecord = {

                id:
                    data.nextWarningId,

                guildId,

                userId,

                moderatorId,

                reason,

                createdAt:
                    new Date()
                        .toISOString()
            };


            data.nextWarningId++;


            data.warnings.push(
                warning
            );


            await writeUnlocked(
                data
            );


            return warning;
        }
    );
}


/*
|--------------------------------------------------------------------------
| LISTAR WARNINGS DE USUÁRIO
|--------------------------------------------------------------------------
*/

export async function getWarningsForUser(
    guildId: string,
    userId: string
):
    Promise<WarningRecord[]> {

    const data =
        await readUnlocked(
            guildId
        );


    return data.warnings

        .filter(
            warning =>
                warning.userId ===
                    userId
        )

        .sort(
            (a, b) =>
                a.id -
                b.id
        );
}


/*
|--------------------------------------------------------------------------
| PEGAR WARNING POR ID
|--------------------------------------------------------------------------
*/

export async function getWarningById(
    guildId: string,
    warningId: number
):
    Promise<WarningRecord | null> {

    const data =
        await readUnlocked(
            guildId
        );


    return (

        data.warnings.find(
            warning =>
                warning.id ===
                    warningId
        ) ??

        null
    );
}


/*
|--------------------------------------------------------------------------
| REMOVER WARNING
|--------------------------------------------------------------------------
*/

export async function removeWarningRecord(
    guildId: string,
    warningId: number
):
    Promise<WarningRecord | null> {

    return withGuildLock(

        guildId,

        async () => {

            const data =
                await readUnlocked(
                    guildId
                );


            const warning =
                data.warnings.find(
                    item =>
                        item.id ===
                            warningId
                );


            if (
                !warning
            ) {

                return null;
            }


            data.warnings =
                data.warnings.filter(
                    item =>
                        item.id !==
                        warningId
                );


            await writeUnlocked(
                data
            );


            return warning;
        }
    );
}


/*
|--------------------------------------------------------------------------
| PEGAR LOCK DE CANAL
|--------------------------------------------------------------------------
*/

export async function getChannelLockRecord(
    guildId: string,
    channelId: string
):
    Promise<ChannelLockRecord | null> {

    const data =
        await readUnlocked(
            guildId
        );


    return (

        data.lockedChannels.find(
            record =>
                record.channelId ===
                    channelId
        ) ??

        null
    );
}


/*
|--------------------------------------------------------------------------
| SALVAR LOCK
|--------------------------------------------------------------------------
|
| Um canal só deve possuir um registro de lock ativo.
|
|--------------------------------------------------------------------------
*/

export async function upsertChannelLockRecord(
    guildId: string,
    record: ChannelLockRecord
):
    Promise<void> {

    await withGuildLock(

        guildId,

        async () => {

            const data =
                await readUnlocked(
                    guildId
                );


            data.lockedChannels =
                data.lockedChannels.filter(
                    existing =>
                        existing.channelId !==
                        record.channelId
                );


            data.lockedChannels.push(
                record
            );


            await writeUnlocked(
                data
            );
        }
    );
}


/*
|--------------------------------------------------------------------------
| REMOVER LOCK
|--------------------------------------------------------------------------
*/

export async function removeChannelLockRecord(
    guildId: string,
    channelId: string
):
    Promise<ChannelLockRecord | null> {

    return withGuildLock(

        guildId,

        async () => {

            const data =
                await readUnlocked(
                    guildId
                );


            const existing =
                data.lockedChannels.find(
                    record =>
                        record.channelId ===
                            channelId
                );


            if (
                !existing
            ) {

                return null;
            }


            data.lockedChannels =
                data.lockedChannels.filter(
                    record =>
                        record.channelId !==
                        channelId
                );


            await writeUnlocked(
                data
            );


            return existing;
        }
    );
}