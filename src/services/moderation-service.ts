import {
    ChannelType,
    PermissionFlagsBits
} from 'discord.js';

import type {
    DMChannel,
    Guild,
    GuildMember,
    TextChannel,
    User
} from 'discord.js';

import type {
    ChannelLockRecord,
    ModerationConfig,
    WarningRecord
} from '../moderacao/types.js';

import {
    moderationLogEmbed
} from '../embeds/moderation.js';

import type {
    ModerationLogOptions
} from '../embeds/moderation.js';

import {
    addWarningRecord,
    getChannelLockRecord,
    getModerationGuildData,
    getWarningsForUser,
    patchModerationConfig,
    removeChannelLockRecord,
    removeWarningRecord,
    upsertChannelLockRecord
} from './moderation-store.js';

import {
    makeModerationTextReference,
    resolveModerationConfig
} from './moderation-resolver.js';

import type {
    ModerationReferenceStatus
} from './moderation-resolver.js';

import {
    isActiveTicketChannel
} from './ticket-model-bridge.js';


const MAX_TIMEOUT_MS =
    28 * 24 * 60 * 60 * 1000;

const MAX_BAN_DELETE_SECONDS =
    7 * 24 * 60 * 60;


export interface ModerationConfigState {

    config:
        ModerationConfig;

    logsChannel: {

        value:
            TextChannel | null;

        status:
            ModerationReferenceStatus;
    };

    repaired:
        boolean;
}


export interface ModerationDuration {

    milliseconds:
        number;

    text:
        string;
}


export interface ClearMessagesResult {

    requested:
        number;

    deleted:
        number;
}


export interface LockChannelResult {

    channel:
        TextChannel;

    record:
        ChannelLockRecord;

    alreadyLocked:
        boolean;
}


export interface UnlockChannelResult {

    channel:
        TextChannel;

    record:
        ChannelLockRecord;
}


export interface NukeChannelResult {

    oldChannelId:
        string;

    newChannelId:
        string;

    channel:
        TextChannel;
}


/*
|--------------------------------------------------------------------------
| BOT
|--------------------------------------------------------------------------
*/

async function getBotMember(
    guild: Guild
):
    Promise<GuildMember> {

    if (
        guild.members.me
    ) {

        return guild.members.me;
    }


    const botId =
        guild.client.user?.id;


    if (
        !botId
    ) {

        throw new Error(
            'Não consegui identificar o usuário do bot.'
        );
    }


    return guild.members.fetch(
        botId
    );
}


/*
|--------------------------------------------------------------------------
| MOTIVO
|--------------------------------------------------------------------------
*/

function normalizeReason(
    reason:
        string | null | undefined
):
    string {

    const value =
        reason?.trim();


    if (
        !value
    ) {

        return 'Não informado.';
    }


    return value.slice(
        0,
        1000
    );
}


/*
|--------------------------------------------------------------------------
| ID DE USUÁRIO
|--------------------------------------------------------------------------
*/

function normalizeUserId(
    input: string
):
    string {

    const value =
        input
            .trim()
            .replace(
                /^<@!?/,
                ''
            )
            .replace(
                />$/,
                ''
            );


    if (
        !/^\d{17,20}$/.test(
            value
        )
    ) {

        throw new Error(
            'ID de usuário inválido.'
        );
    }


    return value;
}


/*
|--------------------------------------------------------------------------
| AUDIT LOG
|--------------------------------------------------------------------------
*/

function auditReason(
    moderator: GuildMember,
    action: string,
    reason:
        string | null | undefined
):
    string {

    return (
        `StandardBot • ${action} • ` +
        `Moderador: ${moderator.user.tag} (${moderator.id}) • ` +
        `Motivo: ${normalizeReason(reason)}`
    ).slice(
        0,
        512
    );
}


/*
|--------------------------------------------------------------------------
| DM DE MODERAÇÃO
|--------------------------------------------------------------------------
|
| Falha ao mandar DM NUNCA cancela a punição.
|
|--------------------------------------------------------------------------
*/

type ModerationDmAction =
    | 'warning'
    | 'timeout'
    | 'kick'
    | 'ban';


function moderationDmContent(
    guild: Guild,
    action: ModerationDmAction,
    reason: string,
    options?: {
        duration?: string;
        warningId?: number;
    }
):
    string {

    const title =
        action === 'warning'
            ? 'ADVERTÊNCIA'
            : action === 'timeout'
                ? 'TIMEOUT'
                : action === 'kick'
                    ? 'EXPULSÃO'
                    : 'BANIMENTO';


    const actionText =
        action === 'warning'
            ? 'Você recebeu uma advertência.'
            : action === 'timeout'
                ? 'Você recebeu um timeout.'
                : action === 'kick'
                    ? 'Você foi expulso do servidor.'
                    : 'Você foi banido do servidor.';


    const lines =
        [
            `## MODERAÇÃO • ${title}`,
            '',
            `**Servidor:** ${guild.name}`,
            actionText
        ];


    if (
        options?.warningId !==
        undefined
    ) {

        lines.push(
            `**Advertência:** #${options.warningId}`
        );
    }


    if (
        options?.duration
    ) {

        lines.push(
            `**Duração:** ${options.duration}`
        );
    }


    lines.push(
        `**Motivo:** ${reason}`,
        '',
        'Caso precise de esclarecimentos, entre em contato com a equipe do servidor.'
    );


    return lines.join(
        '\n'
    );
}


async function prepareDm(
    user: User
):
    Promise<DMChannel | null> {

    try {

        return await user.createDM();

    } catch {

        return null;
    }
}


async function sendPreparedDm(
    channel: DMChannel | null,
    content: string
):
    Promise<boolean> {

    if (
        !channel
    ) {

        return false;
    }


    try {

        await channel.send({
            content
        });


        return true;

    } catch {

        return false;
    }
}


async function sendModerationDm(
    user: User,
    content: string
):
    Promise<boolean> {

    const channel =
        await prepareDm(
            user
        );


    return sendPreparedDm(
        channel,
        content
    );
}


/*
|--------------------------------------------------------------------------
| HIERARQUIA
|--------------------------------------------------------------------------
*/

async function assertMemberHierarchy(
    guild: Guild,
    moderator: GuildMember,
    target: GuildMember
):
    Promise<void> {

    if (
        moderator.id ===
        target.id
    ) {

        throw new Error(
            'Você não pode executar essa ação em si mesmo.'
        );
    }


    if (
        target.id ===
        guild.ownerId
    ) {

        throw new Error(
            'O proprietário do servidor não pode ser moderado por este comando.'
        );
    }


    const botMember =
        await getBotMember(
            guild
        );


    if (
        target.id ===
        botMember.id
    ) {

        throw new Error(
            'Não posso executar essa ação em mim mesmo.'
        );
    }


    if (
        moderator.id !==
        guild.ownerId
    ) {

        if (
            moderator.roles.highest.position <=
            target.roles.highest.position
        ) {

            throw new Error(
                'Você não pode moderar um membro com cargo igual ou superior ao seu.'
            );
        }
    }


    if (
        botMember.roles.highest.position <=
        target.roles.highest.position
    ) {

        throw new Error(
            'Meu cargo precisa estar acima do cargo do usuário que será moderado.'
        );
    }
}


/*
|--------------------------------------------------------------------------
| PERMISSÃO DO BOT
|--------------------------------------------------------------------------
*/

async function requireBotGuildPermission(
    guild: Guild,
    permission: bigint,
    message: string
):
    Promise<void> {

    const botMember =
        await getBotMember(
            guild
        );


    if (
        !botMember.permissions.has(
            permission
        )
    ) {

        throw new Error(
            message
        );
    }
}


/*
|--------------------------------------------------------------------------
| CONFIGURAÇÃO
|--------------------------------------------------------------------------
*/

export async function getModerationConfigState(
    guild: Guild
):
    Promise<ModerationConfigState> {

    const data =
        await getModerationGuildData(
            guild.id
        );


    const resolved =
        await resolveModerationConfig(
            guild,
            data.config
        );


    return {

        config:
            resolved.config,

        logsChannel:
            resolved.logsChannel,

        repaired:
            resolved.repaired
    };
}


export async function setModerationLogsChannel(
    guild: Guild,
    channel: TextChannel
):
    Promise<void> {

    await patchModerationConfig(
        guild.id,
        {

            logsChannel:
                makeModerationTextReference(
                    channel
                )
        }
    );
}


export async function clearModerationLogsChannel(
    guild: Guild
):
    Promise<void> {

    await patchModerationConfig(
        guild.id,
        {

            logsChannel:
                null
        }
    );
}


/*
|--------------------------------------------------------------------------
| LOG
|--------------------------------------------------------------------------
*/

export async function sendModerationLog(
    guild: Guild,
    options:
        ModerationLogOptions
):
    Promise<boolean> {

    try {

        const state =
            await getModerationConfigState(
                guild
            );


        if (
            !state.logsChannel.value
        ) {

            return false;
        }


        await state.logsChannel.value.send({

            embeds: [

                moderationLogEmbed(
                    options
                )
            ]
        });


        return true;

    } catch (error) {

        console.error(
            '[MODERAÇÃO] Falha ao enviar log:',
            error
        );


        return false;
    }
}


/*
|--------------------------------------------------------------------------
| DURAÇÃO
|--------------------------------------------------------------------------
*/

function durationText(
    milliseconds: number
):
    string {

    const second =
        1000;

    const minute =
        60 * second;

    const hour =
        60 * minute;

    const day =
        24 * hour;


    if (
        milliseconds %
        day ===
        0
    ) {

        const amount =
            milliseconds /
            day;


        return amount === 1
            ? '1 dia'
            : `${amount} dias`;
    }


    if (
        milliseconds %
        hour ===
        0
    ) {

        const amount =
            milliseconds /
            hour;


        return amount === 1
            ? '1 hora'
            : `${amount} horas`;
    }


    if (
        milliseconds %
        minute ===
        0
    ) {

        const amount =
            milliseconds /
            minute;


        return amount === 1
            ? '1 minuto'
            : `${amount} minutos`;
    }


    const seconds =
        Math.floor(
            milliseconds /
            second
        );


    return seconds === 1
        ? '1 segundo'
        : `${seconds} segundos`;
}


export function parseModerationDuration(
    input: string
):
    ModerationDuration {

    const normalized =
        input
            .trim()
            .toLowerCase()
            .replace(
                /\s+/g,
                ''
            );


    if (
        !normalized
    ) {

        throw new Error(
            'Informe uma duração. Exemplo: `10m`, `2h`, `1d`.'
        );
    }


    const pattern =
        /(\d+)(s|m|h|d|w)/g;


    let total =
        0;


    let consumed =
        '';


    let match:
        RegExpExecArray | null;


    while (
        (
            match =
                pattern.exec(
                    normalized
                )
        ) !== null
    ) {

        const rawAmount =
            match[1];

        const unit =
            match[2];


        if (
            !rawAmount ||
            !unit
        ) {

            continue;
        }


        const amount =
            Number(
                rawAmount
            );


        if (
            !Number.isSafeInteger(
                amount
            ) ||
            amount <=
            0
        ) {

            throw new Error(
                'A duração informada é inválida.'
            );
        }


        switch (
            unit
        ) {

            case 's':

                total +=
                    amount *
                    1000;

                break;


            case 'm':

                total +=
                    amount *
                    60 *
                    1000;

                break;


            case 'h':

                total +=
                    amount *
                    60 *
                    60 *
                    1000;

                break;


            case 'd':

                total +=
                    amount *
                    24 *
                    60 *
                    60 *
                    1000;

                break;


            case 'w':

                total +=
                    amount *
                    7 *
                    24 *
                    60 *
                    60 *
                    1000;

                break;
        }


        consumed +=
            match[0];
    }


    if (
        consumed !==
        normalized
    ) {

        throw new Error(
            'Formato de duração inválido. Use `10m`, `2h`, `1d` ou `1d12h`.'
        );
    }


    if (
        total <=
        0
    ) {

        throw new Error(
            'A duração precisa ser maior que zero.'
        );
    }


    if (
        total >
        MAX_TIMEOUT_MS
    ) {

        throw new Error(
            'O Discord permite timeout de no máximo 28 dias.'
        );
    }


    return {

        milliseconds:
            total,

        text:
            durationText(
                total
            )
    };
}


/*
|--------------------------------------------------------------------------
| NORMALIZAR LIMPEZA DE MENSAGENS DO BAN
|--------------------------------------------------------------------------
*/

function normalizeBanDeleteSeconds(
    seconds: number
):
    number {

    return Math.max(
        0,
        Math.min(
            MAX_BAN_DELETE_SECONDS,
            Math.floor(
                seconds
            )
        )
    );
}


/*
|--------------------------------------------------------------------------
| BANIR MEMBRO NORMAL
|--------------------------------------------------------------------------
*/

export async function banMember(
    guild: Guild,
    moderator: GuildMember,
    target: GuildMember,
    reason:
        string | null,
    deleteMessageSeconds = 0
):
    Promise<void> {

    await requireBotGuildPermission(
        guild,
        PermissionFlagsBits.BanMembers,
        'Preciso da permissão `Banir membros` para executar essa ação.'
    );


    await assertMemberHierarchy(
        guild,
        moderator,
        target
    );


    if (
        !target.bannable
    ) {

        throw new Error(
            'Não consigo banir esse membro. Verifique a hierarquia dos cargos e minhas permissões.'
        );
    }


    const normalizedReason =
        normalizeReason(
            reason
        );


    /*
     * Abrimos o canal privado ANTES de remover o usuário,
     * mas só enviamos a mensagem DEPOIS que o ban funcionar.
     */

    const dmChannel =
        await prepareDm(
            target.user
        );


    await guild.members.ban(
        target.id,
        {

            deleteMessageSeconds:
                normalizeBanDeleteSeconds(
                    deleteMessageSeconds
                ),

            reason:
                auditReason(
                    moderator,
                    'Banimento',
                    normalizedReason
                )
        }
    );


    await sendPreparedDm(
        dmChannel,

        moderationDmContent(
            guild,
            'ban',
            normalizedReason
        )
    );


    await sendModerationLog(
        guild,
        {

            action:
                'ban',

            moderatorId:
                moderator.id,

            targetUserId:
                target.id,

            reason:
                normalizedReason
        }
    );
}


/*
|--------------------------------------------------------------------------
| BANIR POR ID
|--------------------------------------------------------------------------
|
| Permite banir alguém que já saiu do servidor.
|
|--------------------------------------------------------------------------
*/

export async function banUserById(
    guild: Guild,
    moderator: GuildMember,
    rawUserId: string,
    reason:
        string | null,
    deleteMessageSeconds = 0
):
    Promise<User> {

    await requireBotGuildPermission(
        guild,
        PermissionFlagsBits.BanMembers,
        'Preciso da permissão `Banir membros` para executar essa ação.'
    );


    const userId =
        normalizeUserId(
            rawUserId
        );


    const botMember =
        await getBotMember(
            guild
        );


    if (
        userId ===
        moderator.id
    ) {

        throw new Error(
            'Você não pode banir a si mesmo.'
        );
    }


    if (
        userId ===
        guild.ownerId
    ) {

        throw new Error(
            'O proprietário do servidor não pode ser banido.'
        );
    }


    if (
        userId ===
        botMember.id
    ) {

        throw new Error(
            'Não posso me banir.'
        );
    }


    const existingBan =
        await guild.bans.fetch(
            userId
        )

            .catch(
                () => null
            );


    if (
        existingBan
    ) {

        throw new Error(
            'Esse usuário já está banido deste servidor.'
        );
    }


    const user =
        await guild.client.users.fetch(
            userId
        )

            .catch(
                () => null
            );


    if (
        !user
    ) {

        throw new Error(
            'Não consegui encontrar um usuário do Discord com esse ID.'
        );
    }


    /*
     * Caso o usuário ainda esteja dentro do servidor,
     * aplicamos TODAS as verificações normais de hierarquia.
     */

    const member =
        await guild.members.fetch(
            userId
        )

            .catch(
                () => null
            );


    if (
        member
    ) {

        await assertMemberHierarchy(
            guild,
            moderator,
            member
        );


        if (
            !member.bannable
        ) {

            throw new Error(
                'Não consigo banir esse membro por causa da hierarquia de cargos.'
            );
        }
    }


    const normalizedReason =
        normalizeReason(
            reason
        );


    const dmChannel =
        await prepareDm(
            user
        );


    await guild.members.ban(
        userId,
        {

            deleteMessageSeconds:
                normalizeBanDeleteSeconds(
                    deleteMessageSeconds
                ),

            reason:
                auditReason(
                    moderator,
                    'Banimento por ID',
                    normalizedReason
                )
        }
    );


    await sendPreparedDm(
        dmChannel,

        moderationDmContent(
            guild,
            'ban',
            normalizedReason
        )
    );


    await sendModerationLog(
        guild,
        {

            action:
                'ban',

            moderatorId:
                moderator.id,

            targetUserId:
                userId,

            reason:
                normalizedReason
        }
    );


    return user;
}


/*
|--------------------------------------------------------------------------
| DESBANIR
|--------------------------------------------------------------------------
*/

export async function unbanUser(
    guild: Guild,
    moderator: GuildMember,
    rawUserId: string,
    reason:
        string | null
):
    Promise<User> {

    await requireBotGuildPermission(
        guild,
        PermissionFlagsBits.BanMembers,
        'Preciso da permissão `Banir membros` para remover um banimento.'
    );


    const userId =
        normalizeUserId(
            rawUserId
        );


    const ban =
        await guild.bans.fetch(
            userId
        )

            .catch(
                () => null
            );


    if (
        !ban
    ) {

        throw new Error(
            'Esse usuário não está banido deste servidor.'
        );
    }


    const normalizedReason =
        normalizeReason(
            reason
        );


    await guild.bans.remove(
        userId,

        auditReason(
            moderator,
            'Desbanimento',
            normalizedReason
        )
    );


    await sendModerationLog(
        guild,
        {

            action:
                'unban',

            moderatorId:
                moderator.id,

            targetUserId:
                userId,

            reason:
                normalizedReason
        }
    );


    return ban.user;
}


/*
|--------------------------------------------------------------------------
| EXPULSAR
|--------------------------------------------------------------------------
*/

export async function kickMember(
    guild: Guild,
    moderator: GuildMember,
    target: GuildMember,
    reason:
        string | null
):
    Promise<void> {

    await requireBotGuildPermission(
        guild,
        PermissionFlagsBits.KickMembers,
        'Preciso da permissão `Expulsar membros` para executar essa ação.'
    );


    await assertMemberHierarchy(
        guild,
        moderator,
        target
    );


    if (
        !target.kickable
    ) {

        throw new Error(
            'Não consigo expulsar esse membro. Verifique a hierarquia dos cargos e minhas permissões.'
        );
    }


    const normalizedReason =
        normalizeReason(
            reason
        );


    const dmChannel =
        await prepareDm(
            target.user
        );


    await target.kick(
        auditReason(
            moderator,
            'Expulsão',
            normalizedReason
        )
    );


    await sendPreparedDm(
        dmChannel,

        moderationDmContent(
            guild,
            'kick',
            normalizedReason
        )
    );


    await sendModerationLog(
        guild,
        {

            action:
                'kick',

            moderatorId:
                moderator.id,

            targetUserId:
                target.id,

            reason:
                normalizedReason
        }
    );
}


/*
|--------------------------------------------------------------------------
| MUTAR
|--------------------------------------------------------------------------
*/

export async function timeoutMember(
    guild: Guild,
    moderator: GuildMember,
    target: GuildMember,
    duration: ModerationDuration,
    reason:
        string | null
):
    Promise<void> {

    await requireBotGuildPermission(
        guild,
        PermissionFlagsBits.ModerateMembers,
        'Preciso da permissão `Moderar membros` para aplicar timeout.'
    );


    await assertMemberHierarchy(
        guild,
        moderator,
        target
    );


    if (
        !target.moderatable
    ) {

        throw new Error(
            'Não consigo aplicar timeout nesse membro. Verifique a hierarquia dos cargos e minhas permissões.'
        );
    }


    const normalizedReason =
        normalizeReason(
            reason
        );


    await target.timeout(
        duration.milliseconds,

        auditReason(
            moderator,
            'Timeout',
            normalizedReason
        )
    );


    await sendModerationDm(

        target.user,

        moderationDmContent(
            guild,
            'timeout',
            normalizedReason,
            {

                duration:
                    duration.text
            }
        )
    );


    await sendModerationLog(
        guild,
        {

            action:
                'timeout',

            moderatorId:
                moderator.id,

            targetUserId:
                target.id,

            durationText:
                duration.text,

            reason:
                normalizedReason
        }
    );
}


/*
|--------------------------------------------------------------------------
| DESMUTAR
|--------------------------------------------------------------------------
*/

export async function removeTimeout(
    guild: Guild,
    moderator: GuildMember,
    target: GuildMember,
    reason:
        string | null
):
    Promise<void> {

    await requireBotGuildPermission(
        guild,
        PermissionFlagsBits.ModerateMembers,
        'Preciso da permissão `Moderar membros` para remover timeout.'
    );


    await assertMemberHierarchy(
        guild,
        moderator,
        target
    );


    if (
        !target.moderatable
    ) {

        throw new Error(
            'Não consigo remover o timeout desse membro.'
        );
    }


    const normalizedReason =
        normalizeReason(
            reason
        );


    await target.timeout(
        null,

        auditReason(
            moderator,
            'Timeout removido',
            normalizedReason
        )
    );


    await sendModerationLog(
        guild,
        {

            action:
                'untimeout',

            moderatorId:
                moderator.id,

            targetUserId:
                target.id,

            reason:
                normalizedReason
        }
    );
}


/*
|--------------------------------------------------------------------------
| ADVERTÊNCIA
|--------------------------------------------------------------------------
*/

export async function createWarning(
    guild: Guild,
    moderator: GuildMember,
    target: GuildMember,
    reason:
        string
):
    Promise<WarningRecord> {

    await assertMemberHierarchy(
        guild,
        moderator,
        target
    );


    const normalizedReason =
        normalizeReason(
            reason
        );


    const warning =
        await addWarningRecord(
            guild.id,
            target.id,
            moderator.id,
            normalizedReason
        );


    await sendModerationDm(

        target.user,

        moderationDmContent(
            guild,
            'warning',
            normalizedReason,
            {

                warningId:
                    warning.id
            }
        )
    );


    await sendModerationLog(
        guild,
        {

            action:
                'warning',

            moderatorId:
                moderator.id,

            targetUserId:
                target.id,

            warningId:
                warning.id,

            reason:
                warning.reason
        }
    );


    return warning;
}


export async function listWarnings(
    guild: Guild,
    userId: string
):
    Promise<WarningRecord[]> {

    return getWarningsForUser(
        guild.id,
        userId
    );
}


export async function deleteWarning(
    guild: Guild,
    moderator: GuildMember,
    warningId: number
):
    Promise<WarningRecord> {

    const warning =
        await removeWarningRecord(
            guild.id,
            warningId
        );


    if (
        !warning
    ) {

        throw new Error(
            `A advertência #${warningId} não existe.`
        );
    }


    await sendModerationLog(
        guild,
        {

            action:
                'warning-removed',

            moderatorId:
                moderator.id,

            targetUserId:
                warning.userId,

            warningId:
                warning.id,

            reason:
                `Advertência removida. Motivo original: ${warning.reason}`
        }
    );


    return warning;
}


/*
|--------------------------------------------------------------------------
| LIMPAR
|--------------------------------------------------------------------------
*/

export async function clearMessages(
    guild: Guild,
    moderator: GuildMember,
    channel: TextChannel,
    amount: number
):
    Promise<ClearMessagesResult> {

    const normalizedAmount =
        Math.floor(
            amount
        );


    if (
        normalizedAmount <
        1 ||
        normalizedAmount >
        100
    ) {

        throw new Error(
            'A quantidade precisa estar entre 1 e 100 mensagens.'
        );
    }


    const botMember =
        await getBotMember(
            guild
        );


    const permissions =
        channel.permissionsFor(
            botMember
        );


    if (
        !permissions?.has(
            PermissionFlagsBits.ManageMessages
        )
    ) {

        throw new Error(
            'Preciso da permissão `Gerenciar mensagens` neste canal.'
        );
    }


    const deleted =
        await channel.bulkDelete(
            normalizedAmount,
            true
        );


    await sendModerationLog(
        guild,
        {

            action:
                'clear',

            moderatorId:
                moderator.id,

            amount:
                deleted.size,

            channelId:
                channel.id
        }
    );


    return {

        requested:
            normalizedAmount,

        deleted:
            deleted.size
    };
}


/*
|--------------------------------------------------------------------------
| LOCK
|--------------------------------------------------------------------------
*/

function getPreviousSendMessagesState(
    channel: TextChannel
):
    ChannelLockRecord['previousSendMessages'] {

    const overwrite =
        channel.permissionOverwrites.cache.get(
            channel.guild.roles.everyone.id
        );


    if (
        !overwrite
    ) {

        return 'inherit';
    }


    if (
        overwrite.allow.has(
            PermissionFlagsBits.SendMessages
        )
    ) {

        return 'allow';
    }


    if (
        overwrite.deny.has(
            PermissionFlagsBits.SendMessages
        )
    ) {

        return 'deny';
    }


    return 'inherit';
}


async function resolveChannelLockRecord(
    guild: Guild,
    channel: TextChannel
):
    Promise<ChannelLockRecord | null> {

    const direct =
        await getChannelLockRecord(
            guild.id,
            channel.id
        );


    if (
        direct
    ) {

        return direct;
    }


    const data =
        await getModerationGuildData(
            guild.id
        );


    const records =
        data.lockedChannels.filter(
            record =>
                record.channelName ===
                channel.name
        );


    if (
        records.length !==
        1
    ) {

        return null;
    }


    const oldRecord =
        records[0];


    if (
        !oldRecord
    ) {

        return null;
    }


    await guild.channels.fetch();


    if (
        guild.channels.cache.has(
            oldRecord.channelId
        )
    ) {

        return null;
    }


    /*
     * Não repara no chute se houver dois canais
     * com o mesmo nome.
     */

    const channelMatches =
        guild.channels.cache.filter(
            current =>
                current.type ===
                    ChannelType.GuildText &&
                current.name ===
                    channel.name
        );


    if (
        channelMatches.size !==
        1
    ) {

        return null;
    }


    const repaired:
        ChannelLockRecord = {

        ...oldRecord,

        channelId:
            channel.id,

        channelName:
            channel.name
    };


    await removeChannelLockRecord(
        guild.id,
        oldRecord.channelId
    );


    await upsertChannelLockRecord(
        guild.id,
        repaired
    );


    return repaired;
}


export async function lockChannel(
    guild: Guild,
    moderator: GuildMember,
    channel: TextChannel
):
    Promise<LockChannelResult> {

    const botMember =
        await getBotMember(
            guild
        );


    if (
        !channel
            .permissionsFor(
                botMember
            )
            ?.has(
                PermissionFlagsBits.ManageChannels
            )
    ) {

        throw new Error(
            'Preciso da permissão `Gerenciar canais` neste canal.'
        );
    }


    const existing =
        await resolveChannelLockRecord(
            guild,
            channel
        );


    if (
        existing
    ) {

        return {

            channel,

            record:
                existing,

            alreadyLocked:
                true
        };
    }


    const record:
        ChannelLockRecord = {

        channelId:
            channel.id,

        channelName:
            channel.name,

        previousSendMessages:
            getPreviousSendMessagesState(
                channel
            ),

        lockedById:
            moderator.id,

        lockedAt:
            new Date()
                .toISOString()
    };


    await upsertChannelLockRecord(
        guild.id,
        record
    );


    try {

        await channel.permissionOverwrites.edit(
            guild.roles.everyone.id,
            {

                SendMessages:
                    false
            },
            {

                reason:
                    auditReason(
                        moderator,
                        'Lock',
                        `Canal #${channel.name}`
                    )
            }
        );

    } catch (error) {

        await removeChannelLockRecord(
            guild.id,
            channel.id
        )
            .catch(
                () => null
            );


        throw error;
    }


    await sendModerationLog(
        guild,
        {

            action:
                'lock',

            moderatorId:
                moderator.id,

            channelId:
                channel.id
        }
    );


    return {

        channel,

        record,

        alreadyLocked:
            false
    };
}


/*
|--------------------------------------------------------------------------
| UNLOCK
|--------------------------------------------------------------------------
*/

export async function unlockChannel(
    guild: Guild,
    moderator: GuildMember,
    channel: TextChannel
):
    Promise<UnlockChannelResult> {

    const botMember =
        await getBotMember(
            guild
        );


    if (
        !channel
            .permissionsFor(
                botMember
            )
            ?.has(
                PermissionFlagsBits.ManageChannels
            )
    ) {

        throw new Error(
            'Preciso da permissão `Gerenciar canais` neste canal.'
        );
    }


    const record =
        await resolveChannelLockRecord(
            guild,
            channel
        );


    if (
        !record
    ) {

        throw new Error(
            'Este canal não possui um `/lock` ativo registrado pelo StandardBot.'
        );
    }


    switch (
        record.previousSendMessages
    ) {

        case 'allow':

            await channel.permissionOverwrites.edit(
                guild.roles.everyone.id,
                {

                    SendMessages:
                        true
                },
                {

                    reason:
                        auditReason(
                            moderator,
                            'Unlock',
                            `Canal #${channel.name}`
                        )
                }
            );

            break;


        case 'deny':

            await channel.permissionOverwrites.edit(
                guild.roles.everyone.id,
                {

                    SendMessages:
                        false
                },
                {

                    reason:
                        auditReason(
                            moderator,
                            'Unlock',
                            `Canal #${channel.name}`
                        )
                }
            );

            break;


        case 'inherit':

            await channel.permissionOverwrites.edit(
                guild.roles.everyone.id,
                {

                    SendMessages:
                        null
                },
                {

                    reason:
                        auditReason(
                            moderator,
                            'Unlock',
                            `Canal #${channel.name}`
                        )
                }
            );

            break;
    }


    await removeChannelLockRecord(
        guild.id,
        channel.id
    );


    await sendModerationLog(
        guild,
        {

            action:
                'unlock',

            moderatorId:
                moderator.id,

            channelId:
                channel.id
        }
    );


    return {

        channel,

        record
    };
}


/*
|--------------------------------------------------------------------------
| COMMUNITY
|--------------------------------------------------------------------------
*/

function getCommunityProtectedChannelIds(
    guild: Guild
):
    Set<string> {

    const safetyAlertsChannelId =
        (
            guild as Guild & {
                safetyAlertsChannelId?:
                    string | null;
            }
        ).safetyAlertsChannelId;


    return new Set(

        [
            guild.rulesChannelId,
            guild.publicUpdatesChannelId,
            safetyAlertsChannelId
        ]

            .filter(
                (
                    id
                ): id is string =>
                    typeof id ===
                    'string'
            )
    );
}


/*
|--------------------------------------------------------------------------
| VALIDAR NUKE
|--------------------------------------------------------------------------
*/

async function validateNuke(
    guild: Guild,
    channel: TextChannel
):
    Promise<void> {

    if (
        getCommunityProtectedChannelIds(
            guild
        ).has(
            channel.id
        )
    ) {

        throw new Error(
            'Este canal é obrigatório para os recursos de Comunidade do Discord e não pode receber `/nuke`.'
        );
    }


    if (
        await isActiveTicketChannel(
            guild,
            channel.id
        )
    ) {

        throw new Error(
            'Não é permitido usar `/nuke` em um ticket ativo. Feche o ticket normalmente.'
        );
    }


    const botMember =
        await getBotMember(
            guild
        );


    if (
        !channel
            .permissionsFor(
                botMember
            )
            ?.has(
                PermissionFlagsBits.ManageChannels
            )
    ) {

        throw new Error(
            'Preciso da permissão `Gerenciar canais` para recriar este canal.'
        );
    }
}


async function migrateLockAfterNuke(
    guild: Guild,
    oldChannelId: string,
    newChannel: TextChannel
):
    Promise<void> {

    const oldRecord =
        await getChannelLockRecord(
            guild.id,
            oldChannelId
        );


    if (
        !oldRecord
    ) {

        return;
    }


    await removeChannelLockRecord(
        guild.id,
        oldChannelId
    );


    await upsertChannelLockRecord(
        guild.id,
        {

            ...oldRecord,

            channelId:
                newChannel.id,

            channelName:
                newChannel.name
        }
    );
}


/*
|--------------------------------------------------------------------------
| NUKE
|--------------------------------------------------------------------------
*/

export async function nukeChannel(
    guild: Guild,
    moderator: GuildMember,
    channel: TextChannel,
    reason:
        string | null
):
    Promise<NukeChannelResult> {

    await validateNuke(
        guild,
        channel
    );


    const oldChannelId =
        channel.id;


    const oldPosition =
        channel.position;


    const normalizedReason =
        normalizeReason(
            reason
        );


    const replacement =
        await channel.clone({

            reason:
                auditReason(
                    moderator,
                    'Nuke - criação do substituto',
                    normalizedReason
                )
        });


    if (
        replacement.type !==
        ChannelType.GuildText
    ) {

        await replacement.delete(
            'StandardBot: rollback de nuke'
        )
            .catch(
                () => undefined
            );


        throw new Error(
            'O canal recriado não possui o tipo esperado.'
        );
    }


    const newChannel =
        replacement as TextChannel;


    try {

        await newChannel.setPosition(
            oldPosition,
            {

                reason:
                    'StandardBot: preservando posição durante nuke'
            }
        );

    } catch (error) {

        await newChannel.delete(
            'StandardBot: rollback de nuke por falha de posição'
        )
            .catch(
                () => undefined
            );


        throw error;
    }


    try {

        await channel.delete(

            auditReason(
                moderator,
                'Nuke - remoção do canal antigo',
                normalizedReason
            )
        );

    } catch (error) {

        await newChannel.delete(
            'StandardBot: rollback de nuke'
        )
            .catch(
                () => undefined
            );


        throw error;
    }


    await migrateLockAfterNuke(
        guild,
        oldChannelId,
        newChannel
    )
        .catch(
            error => {

                console.error(
                    '[MODERAÇÃO] Falha ao migrar lock após nuke:',
                    error
                );
            }
        );


    await sendModerationLog(
        guild,
        {

            action:
                'nuke',

            moderatorId:
                moderator.id,

            oldChannelId,

            newChannelId:
                newChannel.id,

            reason:
                normalizedReason
        }
    );


    return {

        oldChannelId,

        newChannelId:
            newChannel.id,

        channel:
            newChannel
    };
}