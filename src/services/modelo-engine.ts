import {
    ChannelType,
    GuildFeature,
    OverwriteType,
    PermissionFlagsBits
} from 'discord.js';

import {
    randomUUID
} from 'node:crypto';

import type {
    CategoryChannel,
    ForumChannel,
    Guild,
    GuildBasedChannel,
    MediaChannel,
    NewsChannel,
    Role,
    StageChannel,
    TextChannel,
    VoiceChannel
} from 'discord.js';

import type {
    CanalModelo,
    CargoModelo,
    CargosModelo,
    ConteudoModelo,
    EstruturaModelo,
    ModulosModelo,
    ModeloServidor,
    OverwriteModelo,
    OverwritesCanalModelo,
    PermissaoCargoModelo,
    PermissoesModelo,
    ReferenciaCanalPermissao,
    ResultadoRestauracao,
    TipoAlvoPermissao,
    TipoCanalModelo
} from '../modelos/types.js';

import {
    getActiveTicketChannelIds
} from './ticket-model-bridge.js';

import {
    synchronizeTickets
} from './ticket-service.js';


const REASON =
    'StandardBot - sistema de modelos';

const ENGINE_VERSION =
    'community-safe-v6-ticket-aware';


function getDiscordErrorCode(
    error: unknown
): number | null {

    if (
        typeof error !== 'object' ||
        error === null
    ) {
        return null;
    }

    const candidate =
        error as {
            code?: unknown;
            rawError?: {
                code?: unknown;
            };
        };

    if (
        typeof candidate.code ===
        'number'
    ) {
        return candidate.code;
    }

    if (
        typeof candidate.rawError?.code ===
        'number'
    ) {
        return candidate.rawError.code;
    }

    return null;
}


function isCommunityRequiredChannelError(
    error: unknown
): boolean {

    return (
        getDiscordErrorCode(
            error
        ) === 50074
    );
}


type RealGuildChannel =
    | CategoryChannel
    | ForumChannel
    | MediaChannel
    | NewsChannel
    | StageChannel
    | TextChannel
    | VoiceChannel;


export function conteudoParaModulos(
    conteudo: ConteudoModelo
): ModulosModelo {

    switch (
        conteudo
    ) {

        case 'estrutura':

            return {
                estrutura: true,
                cargos: false,
                permissoes: false
            };


        case 'cargos':

            return {
                estrutura: false,
                cargos: true,
                permissoes: false
            };


        case 'permissoes':

            return {
                estrutura: false,
                cargos: false,
                permissoes: true
            };


        case 'estrutura-cargos':

            return {
                estrutura: true,
                cargos: true,
                permissoes: false
            };


        case 'estrutura-permissoes':

            return {
                estrutura: true,
                cargos: false,
                permissoes: true
            };


        case 'cargos-permissoes':

            return {
                estrutura: false,
                cargos: true,
                permissoes: true
            };


        case 'completo':

            return {
                estrutura: true,
                cargos: true,
                permissoes: true
            };
    }
}


export function conteudoLabel(
    conteudo: ConteudoModelo
): string {

    switch (
        conteudo
    ) {

        case 'estrutura':
            return 'Somente estrutura';

        case 'cargos':
            return 'Somente cargos';

        case 'permissoes':
            return 'Somente permissões';

        case 'estrutura-cargos':
            return 'Estrutura + cargos';

        case 'estrutura-permissoes':
            return 'Estrutura + permissões';

        case 'cargos-permissoes':
            return 'Cargos + permissões';

        case 'completo':
            return 'Modelo completo';
    }
}


export function isConteudoModelo(
    value: string
): value is ConteudoModelo {

    return [
        'estrutura',
        'cargos',
        'permissoes',
        'estrutura-cargos',
        'estrutura-permissoes',
        'cargos-permissoes',
        'completo'
    ].includes(
        value
    );
}


function channelKey(
    id: string
): string {

    return `channel:${id}`;
}


function roleKey(
    id: string
): string {

    return `role:${id}`;
}


function isRealGuildChannel(
    channel: GuildBasedChannel
): channel is RealGuildChannel {

    return !channel.isThread();
}


function getChannelType(
    channel: RealGuildChannel
): TipoCanalModelo | null {

    switch (
        channel.type
    ) {

        case ChannelType.GuildText:
            return 'text';

        case ChannelType.GuildAnnouncement:
            return 'announcement';

        case ChannelType.GuildForum:
            return 'forum';

        case ChannelType.GuildVoice:
            return 'voice';

        case ChannelType.GuildStageVoice:
            return 'stage';

        default:
            return null;
    }
}


function getPermissionTargetType(
    channel: RealGuildChannel
): TipoAlvoPermissao | null {

    if (
        channel.type ===
        ChannelType.GuildCategory
    ) {
        return 'category';
    }

    return getChannelType(
        channel
    );
}


function isSupportedGuildChannel(
    channel: RealGuildChannel
): boolean {

    return (
        channel.type ===
            ChannelType.GuildCategory ||
        getChannelType(
            channel
        ) !== null
    );
}


async function captureStructure(
    guild: Guild,
    ignoredChannelIds:
        ReadonlySet<string> =
        new Set<string>()
): Promise<EstruturaModelo> {

    await guild.channels.fetch();


    const all =
        [
            ...guild.channels.cache.values()
        ]

            .filter(
                isRealGuildChannel
            )

            .filter(
                channel =>
                    !ignoredChannelIds.has(
                        channel.id
                    )
            );


    const categories =
        all

            .filter(
                (
                    channel
                ): channel is CategoryChannel =>
                    channel.type ===
                    ChannelType.GuildCategory
            )

            .sort(
                (a, b) =>
                    a.rawPosition -
                    b.rawPosition
            );


    const categoryModels =
        categories.map(
            category => ({

                key:
                    channelKey(
                        category.id
                    ),

                name:
                    category.name,

                position:
                    category.rawPosition
            })
        );


    const channels:
        CanalModelo[] = [];


    let ignoredUnsupportedChannels =
        0;


    for (
        const channel
        of all
    ) {

        if (
            channel.type ===
            ChannelType.GuildCategory
        ) {
            continue;
        }


        const type =
            getChannelType(
                channel
            );


        if (
            !type
        ) {

            ignoredUnsupportedChannels++;

            continue;
        }


        const parentKey =
            channel.parentId

                ? channelKey(
                    channel.parentId
                )

                : null;


        if (
            channel.type ===
            ChannelType.GuildText
        ) {

            channels.push({

                key:
                    channelKey(
                        channel.id
                    ),

                name:
                    channel.name,

                type:
                    'text',

                parentKey,

                position:
                    channel.rawPosition,

                topic:
                    channel.topic,

                nsfw:
                    channel.nsfw,

                rateLimitPerUser:
                    channel.rateLimitPerUser ??
                    0,

                bitrate:
                    0,

                userLimit:
                    0,

                rtcRegion:
                    null
            });


            continue;
        }


        if (
            channel.type ===
            ChannelType.GuildAnnouncement
        ) {

            channels.push({

                key:
                    channelKey(
                        channel.id
                    ),

                name:
                    channel.name,

                type:
                    'announcement',

                parentKey,

                position:
                    channel.rawPosition,

                topic:
                    channel.topic,

                nsfw:
                    channel.nsfw,

                rateLimitPerUser:
                    channel.rateLimitPerUser ??
                    0,

                bitrate:
                    0,

                userLimit:
                    0,

                rtcRegion:
                    null
            });


            continue;
        }


        if (
            channel.type ===
            ChannelType.GuildForum
        ) {

            channels.push({

                key:
                    channelKey(
                        channel.id
                    ),

                name:
                    channel.name,

                type:
                    'forum',

                parentKey,

                position:
                    channel.rawPosition,

                topic:
                    channel.topic,

                nsfw:
                    channel.nsfw,

                rateLimitPerUser:
                    channel.rateLimitPerUser ??
                    0,

                bitrate:
                    0,

                userLimit:
                    0,

                rtcRegion:
                    null
            });


            continue;
        }


        if (
            channel.type ===
            ChannelType.GuildVoice
        ) {

            channels.push({

                key:
                    channelKey(
                        channel.id
                    ),

                name:
                    channel.name,

                type:
                    'voice',

                parentKey,

                position:
                    channel.rawPosition,

                topic:
                    null,

                nsfw:
                    false,

                rateLimitPerUser:
                    0,

                bitrate:
                    channel.bitrate,

                userLimit:
                    channel.userLimit,

                rtcRegion:
                    channel.rtcRegion
            });


            continue;
        }


        if (
            channel.type ===
            ChannelType.GuildStageVoice
        ) {

            channels.push({

                key:
                    channelKey(
                        channel.id
                    ),

                name:
                    channel.name,

                type:
                    'stage',

                parentKey,

                position:
                    channel.rawPosition,

                topic:
                    null,

                nsfw:
                    false,

                rateLimitPerUser:
                    0,

                bitrate:
                    channel.bitrate,

                userLimit:
                    0,

                rtcRegion:
                    channel.rtcRegion
            });
        }
    }


    function specialKey(
        id: string | null
    ): string | null {

        if (
            !id
        ) {
            return null;
        }


        const key =
            channelKey(
                id
            );


        return channels.some(
            channel =>
                channel.key ===
                key
        )

            ? key

            : null;
    }


    return {

        categories:
            categoryModels,

        channels,

        rulesChannelKey:
            specialKey(
                guild.rulesChannelId
            ),

        publicUpdatesChannelKey:
            specialKey(
                guild.publicUpdatesChannelId
            ),

        systemChannelKey:
            specialKey(
                guild.systemChannelId
            ),

        afkChannelKey:
            specialKey(
                guild.afkChannelId
            ),

        safetyAlertsChannelKey:
            specialKey(
                guild.safetyAlertsChannelId
            ),

        ignoredUnsupportedChannels
    };
}


async function captureRoles(
    guild: Guild
): Promise<CargosModelo> {

    await guild.roles.fetch();


    const all =
        [
            ...guild.roles.cache.values()
        ];


    const normalRoles =
        all

            .filter(
                role =>
                    role.id !==
                        guild.roles.everyone.id &&
                    !role.managed
            )

            .sort(
                (a, b) =>
                    a.position -
                    b.position
            );


    const managedRoles =
        all.filter(
            role =>
                role.id !==
                    guild.roles.everyone.id &&
                role.managed
        );


    const roles:
        CargoModelo[] =
        normalRoles.map(
            role => ({

                key:
                    roleKey(
                        role.id
                    ),

                name:
                    role.name,

                position:
                    role.position,

                color:
                    role.color,

                hoist:
                    role.hoist,

                mentionable:
                    role.mentionable,

                unicodeEmoji:
                    role.unicodeEmoji
            })
        );


    return {

        roles,

        ignoredManagedRoles:
            managedRoles.length
    };
}


function makeChannelReference(
    channel: RealGuildChannel
): ReferenciaCanalPermissao | null {

    const type =
        getPermissionTargetType(
            channel
        );


    if (
        !type
    ) {
        return null;
    }


    const parent =
        channel.parent;


    return {

        channelKey:
            channelKey(
                channel.id
            ),

        channelName:
            channel.name,

        channelType:
            type,

        position:
            channel.rawPosition,

        parentName:
            parent
                ? parent.name
                : null,

        parentPosition:
            parent
                ? parent.rawPosition
                : null
    };
}


async function capturePermissions(
    guild: Guild,
    ignoredChannelIds:
        ReadonlySet<string> =
        new Set<string>()
): Promise<PermissoesModelo> {

    await guild.roles.fetch();

    await guild.channels.fetch();


    const everyone =
        guild.roles.everyone;


    const roles:
        PermissaoCargoModelo[] =
        [
            ...guild.roles.cache.values()
        ]

            .filter(
                role =>
                    role.id !==
                        everyone.id &&
                    !role.managed
            )

            .sort(
                (a, b) =>
                    a.position -
                    b.position
            )

            .map(
                role => ({

                    roleKey:
                        roleKey(
                            role.id
                        ),

                    roleName:
                        role.name,

                    rolePosition:
                        role.position,

                    permissions:
                        role.permissions
                            .bitfield
                            .toString()
                })
            );


    const channelOverwrites:
        OverwritesCanalModelo[] = [];


    let ignoredManagedRoleOverwrites =
        0;


    const channels =
        [
            ...guild.channels.cache.values()
        ]

            .filter(
                isRealGuildChannel
            )

            .filter(
                isSupportedGuildChannel
            )

            .filter(
                channel =>
                    !ignoredChannelIds.has(
                        channel.id
                    )
            );


    for (
        const channel
        of channels
    ) {

        const target =
            makeChannelReference(
                channel
            );


        if (
            !target
        ) {
            continue;
        }


        const entries:
            OverwriteModelo[] = [];


        for (
            const overwrite
            of channel
                .permissionOverwrites
                .cache
                .values()
        ) {

            if (
                overwrite.type ===
                OverwriteType.Role
            ) {

                if (
                    overwrite.id ===
                    everyone.id
                ) {

                    entries.push({

                        subjectType:
                            'everyone',

                        subjectKey:
                            '@everyone',

                        subjectName:
                            '@everyone',

                        sourceId:
                            everyone.id,

                        rolePosition:
                            0,

                        allow:
                            overwrite.allow
                                .bitfield
                                .toString(),

                        deny:
                            overwrite.deny
                                .bitfield
                                .toString()
                    });


                    continue;
                }


                const role =
                    guild.roles.cache.get(
                        overwrite.id
                    );


                if (
                    !role
                ) {
                    continue;
                }


                if (
                    role.managed
                ) {

                    ignoredManagedRoleOverwrites++;

                    continue;
                }


                entries.push({

                    subjectType:
                        'role',

                    subjectKey:
                        roleKey(
                            role.id
                        ),

                    subjectName:
                        role.name,

                    sourceId:
                        role.id,

                    rolePosition:
                        role.position,

                    allow:
                        overwrite.allow
                            .bitfield
                            .toString(),

                    deny:
                        overwrite.deny
                            .bitfield
                            .toString()
                });


                continue;
            }


            const member =
                guild.members.cache.get(
                    overwrite.id
                );


            entries.push({

                subjectType:
                    'member',

                subjectKey:
                    `member:${overwrite.id}`,

                subjectName:
                    member
                        ? member.user.username
                        : overwrite.id,

                sourceId:
                    overwrite.id,

                rolePosition:
                    0,

                allow:
                    overwrite.allow
                        .bitfield
                        .toString(),

                deny:
                    overwrite.deny
                        .bitfield
                        .toString()
            });
        }


        channelOverwrites.push({

            target,

            entries
        });
    }


    return {

        everyonePermissions:
            everyone.permissions
                .bitfield
                .toString(),

        roles,

        channelOverwrites,

        ignoredManagedRoleOverwrites
    };
}


export async function capturarModelo(
    guild: Guild,
    userId: string,
    nome: string,
    modulos: ModulosModelo,
    automatico: boolean
): Promise<ModeloServidor> {

    const trimmedName =
        nome.trim();


    if (
        trimmedName.length ===
        0
    ) {

        throw new Error(
            'O nome do modelo não pode ficar vazio.'
        );
    }


    const avisos:
        string[] = [];


    const activeTicketChannelIds =
        (
            modulos.estrutura ||
            modulos.permissoes
        )

            ? await getActiveTicketChannelIds(
                guild
            )

            : new Set<string>();


    if (
        activeTicketChannelIds.size >
        0
    ) {

        avisos.push(
            `${activeTicketChannelIds.size} canal(is) temporário(s) de ticket foram ignorados pelo snapshot.`
        );
    }


    let estrutura:
        EstruturaModelo | null =
        null;


    let cargos:
        CargosModelo | null =
        null;


    let permissoes:
        PermissoesModelo | null =
        null;


    if (
        modulos.estrutura
    ) {

        estrutura =
            await captureStructure(
                guild,
                activeTicketChannelIds
            );


        if (
            estrutura
                .ignoredUnsupportedChannels >
            0
        ) {

            avisos.push(
                `${estrutura.ignoredUnsupportedChannels} canal(is) de tipo ainda não suportado foram ignorados.`
            );
        }
    }


    if (
        modulos.cargos
    ) {

        cargos =
            await captureRoles(
                guild
            );


        if (
            cargos
                .ignoredManagedRoles >
            0
        ) {

            avisos.push(
                `${cargos.ignoredManagedRoles} cargo(s) gerenciado(s) pelo Discord/bots foram ignorados.`
            );
        }
    }


    if (
        modulos.permissoes
    ) {

        permissoes =
            await capturePermissions(
                guild,
                activeTicketChannelIds
            );


        if (
            permissoes
                .ignoredManagedRoleOverwrites >
            0
        ) {

            avisos.push(
                `${permissoes.ignoredManagedRoleOverwrites} overwrite(s) de cargos managed foram ignorados.`
            );
        }
    }


    const now =
        new Date()
            .toISOString();


    return {

        schemaVersion:
            1,

        id:
            randomUUID(),

        nome:
            trimmedName,

        criadoPor:
            userId,

        criadoEm:
            now,

        atualizadoEm:
            now,

        origemGuildId:
            guild.id,

        origemGuildNome:
            guild.name,

        automatico,

        modulos,

        estrutura,

        cargos,

        permissoes,

        avisos
    };
}


export function criarNomeBackupAutomatico():
    string {

    const now =
        new Date();


    const pad =
        (
            value: number
        ): string =>
            String(
                value
            ).padStart(
                2,
                '0'
            );


    const date =
        [

            now.getFullYear(),

            pad(
                now.getMonth() + 1
            ),

            pad(
                now.getDate()
            )

        ].join(
            ''
        );


    const time =
        [

            pad(
                now.getHours()
            ),

            pad(
                now.getMinutes()
            ),

            pad(
                now.getSeconds()
            )

        ].join(
            ''
        );


    return (
        `backup-auto-${date}-${time}-${randomUUID().slice(0, 4)}`
    );
}


function assertModelHasModules(
    model: ModeloServidor,
    modules: ModulosModelo
): void {

    const missing:
        string[] = [];


    if (
        modules.estrutura &&
        !model.estrutura
    ) {

        missing.push(
            'estrutura'
        );
    }


    if (
        modules.cargos &&
        !model.cargos
    ) {

        missing.push(
            'cargos'
        );
    }


    if (
        modules.permissoes &&
        !model.permissoes
    ) {

        missing.push(
            'permissões'
        );
    }


    if (
        missing.length >
        0
    ) {

        throw new Error(

            [

                `O modelo "${model.nome}" não contém:`,

                '',

                ...missing.map(
                    item =>
                        `• ${item}`
                )

            ].join(
                '\n'
            )
        );
    }
}


export async function validarRestauracao(
    guild: Guild,
    model: ModeloServidor,
    modules: ModulosModelo
): Promise<void> {

    assertModelHasModules(
        model,
        modules
    );


    const me =
        await guild.members.fetchMe();


    if (
        modules.estrutura
    ) {

        if (
            !me.permissions.has(
                PermissionFlagsBits.ManageChannels
            )
        ) {

            throw new Error(
                'O bot precisa da permissão Gerenciar Canais.'
            );
        }


        if (
            !me.permissions.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {

            throw new Error(
                'O bot precisa da permissão Gerenciar Servidor.'
            );
        }


        const structure =
            model.estrutura;


        if (
            !structure
        ) {

            throw new Error(
                'O modelo não possui estrutura.'
            );
        }


        const needsCommunity =
            structure.channels.some(
                channel =>
                    channel.type ===
                        'announcement' ||
                    channel.type ===
                        'forum' ||
                    channel.type ===
                        'stage'
            );


        const destinationIsCommunity =
            guild.features.includes(
                GuildFeature.Community
            );


        if (
            needsCommunity &&
            !destinationIsCommunity
        ) {

            throw new Error(

                [

                    'Esse modelo possui canais que precisam do recurso Comunidade.',

                    '',

                    'Ative Comunidade no servidor antes de restaurar.'

                ].join(
                    '\n'
                )
            );
        }


        if (
            destinationIsCommunity
        ) {

            const missingSpecialChannels:
                string[] = [];


            if (
                !structure.rulesChannelKey
            ) {

                missingSpecialChannels.push(
                    'canal de regras'
                );
            }


            if (
                !structure.publicUpdatesChannelKey
            ) {

                missingSpecialChannels.push(
                    'canal de atualizações da comunidade'
                );
            }


            if (
                missingSpecialChannels.length >
                0
            ) {

                throw new Error(

                    [

                        'O servidor de destino está com Comunidade ativada, mas este modelo não possui todos os canais obrigatórios da comunidade.',

                        '',

                        ...missingSpecialChannels.map(
                            item =>
                                `• ${item}`
                        ),

                        '',

                        'Salve novamente o modelo a partir de um servidor Community já configurado, ou desative Comunidade no destino antes de restaurar um modelo que não possua esses canais.'

                    ].join(
                        '\n'
                    )
                );
            }


            const rulesExists =
                structure.channels.some(
                    channel =>
                        channel.key ===
                        structure.rulesChannelKey
                );


            const updatesExists =
                structure.channels.some(
                    channel =>
                        channel.key ===
                        structure.publicUpdatesChannelKey
                );


            if (
                !rulesExists ||
                !updatesExists
            ) {

                throw new Error(

                    [

                        'O modelo contém referências de Comunidade inválidas.',

                        '',

                        'O canal de regras ou o canal de atualizações salvo não existe dentro da estrutura do próprio modelo.',

                        '',

                        'Salve o modelo novamente antes de restaurá-lo.'

                    ].join(
                        '\n'
                    )
                );
            }
        }


        await guild.channels.fetch();


        const unsupported =
            [
                ...guild.channels.cache.values()
            ]

                .filter(
                    isRealGuildChannel
                )

                .filter(
                    channel =>
                        !isSupportedGuildChannel(
                            channel
                        )
                );


        if (
            unsupported.length >
            0
        ) {

            throw new Error(

                [

                    'O servidor atual possui tipos de canais que esta versão ainda não sabe recriar.',

                    '',

                    'Por segurança, a restauração da estrutura foi bloqueada.',

                    '',

                    ...unsupported

                        .slice(
                            0,
                            10
                        )

                        .map(
                            channel =>
                                `• ${channel.name}`
                        )

                ].join(
                    '\n'
                )
            );
        }
    }


    if (
        modules.cargos &&
        !me.permissions.has(
            PermissionFlagsBits.ManageRoles
        )
    ) {

        throw new Error(
            'O bot precisa da permissão Gerenciar Cargos.'
        );
    }


    if (
        modules.permissoes
    ) {

        if (
            !me.permissions.has(
                PermissionFlagsBits.ManageRoles
            )
        ) {

            throw new Error(
                'O bot precisa de Gerenciar Cargos para aplicar permissões.'
            );
        }


        if (
            !me.permissions.has(
                PermissionFlagsBits.ManageChannels
            )
        ) {

            throw new Error(
                'O bot precisa de Gerenciar Canais para aplicar overwrites.'
            );
        }
    }
}


async function restoreRoles(
    guild: Guild,
    snapshot: CargosModelo,
    warnings: string[]
): Promise<{
    deleted: number;
    created: number;
    protected: number;
    map: Map<string, string>;
}> {

    await guild.roles.fetch();


    const me =
        await guild.members.fetchMe();


    const protectedRoleIds =
        new Set<string>(
            me.roles.cache.keys()
        );


    const roles =
        [
            ...guild.roles.cache.values()
        ];


    const deletable =
        roles

            .filter(
                role =>
                    role.id !==
                        guild.roles.everyone.id &&
                    !role.managed &&
                    role.editable &&
                    !protectedRoleIds.has(
                        role.id
                    )
            )

            .sort(
                (a, b) =>
                    b.position -
                    a.position
            );


    const protectedCount =
        roles.filter(
            role =>
                role.id !==
                    guild.roles.everyone.id &&
                (
                    role.managed ||
                    !role.editable ||
                    protectedRoleIds.has(
                        role.id
                    )
                )
        ).length;


    let deleted =
        0;


    for (
        const role
        of deletable
    ) {

        await role.delete(
            REASON
        );


        deleted++;
    }


    const roleMap =
        new Map<
            string,
            string
        >();


    const ordered =
        [
            ...snapshot.roles
        ]

            .sort(
                (a, b) =>
                    a.position -
                    b.position
            );


    const createdRoles: {
        snapshot: CargoModelo;
        role: Role;
    }[] = [];


    for (
        const roleSnapshot
        of ordered
    ) {

        const createdRole =
            await guild.roles.create({

                name:
                    roleSnapshot.name,

                color:
                    roleSnapshot.color,

                hoist:
                    roleSnapshot.hoist,

                mentionable:
                    roleSnapshot.mentionable,

                permissions:
                    0n,

                reason:
                    REASON
            });


        roleMap.set(
            roleSnapshot.key,
            createdRole.id
        );


        createdRoles.push({

            snapshot:
                roleSnapshot,

            role:
                createdRole
        });


        if (
            roleSnapshot.unicodeEmoji
        ) {

            try {

                await createdRole
                    .setUnicodeEmoji(
                        roleSnapshot.unicodeEmoji,
                        REASON
                    );

            } catch {

                warnings.push(
                    `Não consegui restaurar o emoji do cargo "${roleSnapshot.name}".`
                );
            }
        }
    }


    for (
        let index = 0;
        index <
        createdRoles.length;
        index++
    ) {

        const item =
            createdRoles[
                index
            ];


        if (
            !item
        ) {
            continue;
        }


        try {

            await item.role
                .setPosition(
                    index + 1,
                    {
                        reason:
                            REASON
                    }
                );

        } catch {

            warnings.push(
                `Não consegui posicionar exatamente o cargo "${item.snapshot.name}".`
            );
        }
    }


    return {

        deleted,

        created:
            createdRoles.length,

        protected:
            protectedCount,

        map:
            roleMap
    };
}


async function createSnapshotChannel(
    guild: Guild,
    snapshot: CanalModelo,
    parentId: string | null
): Promise<RealGuildChannel> {

    switch (
        snapshot.type
    ) {

        case 'text': {

            return await guild.channels.create({

                name:
                    snapshot.name,

                type:
                    ChannelType.GuildText,

                parent:
                    parentId,

                nsfw:
                    snapshot.nsfw,

                rateLimitPerUser:
                    snapshot.rateLimitPerUser,

                position:
                    snapshot.position,

                ...(
                    snapshot.topic !==
                    null

                        ? {
                            topic:
                                snapshot.topic
                        }

                        : {}
                ),

                reason:
                    REASON
            });
        }


        case 'announcement': {

            return await guild.channels.create({

                name:
                    snapshot.name,

                type:
                    ChannelType.GuildAnnouncement,

                parent:
                    parentId,

                nsfw:
                    snapshot.nsfw,

                rateLimitPerUser:
                    snapshot.rateLimitPerUser,

                position:
                    snapshot.position,

                ...(
                    snapshot.topic !==
                    null

                        ? {
                            topic:
                                snapshot.topic
                        }

                        : {}
                ),

                reason:
                    REASON
            });
        }


        case 'forum': {

            return await guild.channels.create({

                name:
                    snapshot.name,

                type:
                    ChannelType.GuildForum,

                parent:
                    parentId,

                nsfw:
                    snapshot.nsfw,

                rateLimitPerUser:
                    snapshot.rateLimitPerUser,

                position:
                    snapshot.position,

                ...(
                    snapshot.topic !==
                    null

                        ? {
                            topic:
                                snapshot.topic
                        }

                        : {}
                ),

                reason:
                    REASON
            });
        }


        case 'voice': {

            return await guild.channels.create({

                name:
                    snapshot.name,

                type:
                    ChannelType.GuildVoice,

                parent:
                    parentId,

                bitrate:
                    snapshot.bitrate,

                userLimit:
                    snapshot.userLimit,

                position:
                    snapshot.position,

                ...(
                    snapshot.rtcRegion !==
                    null

                        ? {
                            rtcRegion:
                                snapshot.rtcRegion
                        }

                        : {}
                ),

                reason:
                    REASON
            });
        }


        case 'stage': {

            return await guild.channels.create({

                name:
                    snapshot.name,

                type:
                    ChannelType.GuildStageVoice,

                parent:
                    parentId,

                bitrate:
                    snapshot.bitrate,

                position:
                    snapshot.position,

                ...(
                    snapshot.rtcRegion !==
                    null

                        ? {
                            rtcRegion:
                                snapshot.rtcRegion
                        }

                        : {}
                ),

                reason:
                    REASON
            });
        }
    }
}


async function syncPreservedCommunityTextChannel(
    channel: TextChannel,
    snapshot: CanalModelo,
    parentId: string | null
): Promise<void> {

    if (
        snapshot.type !==
        'text'
    ) {

        throw new Error(

            [

                `O canal especial "${snapshot.name}" do modelo não é um canal de texto comum.`,

                '',

                'Rules e Community Updates precisam ser canais de texto para serem reutilizados com segurança.'

            ].join(
                '\n'
            )
        );
    }


    if (
        channel.parentId !==
        parentId
    ) {

        await channel.setParent(
            parentId,
            {
                lockPermissions:
                    false
            }
        );
    }


    if (
        channel.name !==
        snapshot.name
    ) {

        await channel.setName(
            snapshot.name,
            REASON
        );
    }


    if (
        channel.topic !==
        snapshot.topic
    ) {

        await channel.setTopic(
            snapshot.topic,
            REASON
        );
    }


    if (
        channel.nsfw !==
        snapshot.nsfw
    ) {

        await channel.setNSFW(
            snapshot.nsfw,
            REASON
        );
    }


    if (
        (
            channel.rateLimitPerUser ??
            0
        ) !==
        snapshot.rateLimitPerUser
    ) {

        await channel.setRateLimitPerUser(
            snapshot.rateLimitPerUser,
            REASON
        );
    }


    await channel.permissionOverwrites.set(
        [],
        REASON
    );
}


async function cleanupCreatedStructure(
    guild: Guild,
    createdIds: string[]
): Promise<void> {

    for (
        const id
        of [
            ...createdIds
        ].reverse()
    ) {

        const channel =
            await guild.channels

                .fetch(
                    id
                )

                .catch(
                    () => null
                );


        if (
            !channel
        ) {
            continue;
        }


        await channel

            .delete(
                `${REASON} - rollback de criação parcial`
            )

            .catch(
                () => null
            );
    }
}


async function restoreStructure(
    guild: Guild,
    snapshot: EstruturaModelo,
    warnings: string[],
    activeTicketChannelIds:
        ReadonlySet<string>
): Promise<{
    deleted: number;
    createdCategories: number;
    createdChannels: number;
    map: Map<string, string>;
}> {

    console.log(
        `[MODELO] Engine ${ENGINE_VERSION}: iniciando reconstrução segura da estrutura...`
    );


    await guild.fetch();

    await guild.channels.fetch();


    const oldAll =
        [
            ...guild.channels.cache.values()
        ]

            .filter(
                isRealGuildChannel
            );


    const oldNormalChannels =
        oldAll

            .filter(
                (
                    channel
                ): channel is Exclude<
                    RealGuildChannel,
                    CategoryChannel
                > =>
                    channel.type !==
                    ChannelType.GuildCategory
            )

            .sort(
                (a, b) =>
                    b.rawPosition -
                    a.rawPosition
            );


    const oldCategories =
        oldAll

            .filter(
                (
                    channel
                ): channel is CategoryChannel =>
                    channel.type ===
                    ChannelType.GuildCategory
            )

            .sort(
                (a, b) =>
                    b.rawPosition -
                    a.rawPosition
            );


    const destinationIsCommunity =
        guild.features.includes(
            GuildFeature.Community
        );


    const currentRulesChannel =
        destinationIsCommunity

            ? guild.rulesChannel

            : null;


    const currentPublicUpdatesChannel =
        destinationIsCommunity

            ? guild.publicUpdatesChannel

            : null;


    if (
        destinationIsCommunity
    ) {

        if (
            !snapshot.rulesChannelKey ||
            !snapshot.publicUpdatesChannelKey
        ) {

            throw new Error(

                [

                    'O servidor de destino está com Comunidade ativada, mas o modelo não possui as referências de Rules e Community Updates.',

                    '',

                    'Nada foi apagado.'

                ].join(
                    '\n'
                )
            );
        }


        if (
            snapshot.rulesChannelKey ===
            snapshot.publicUpdatesChannelKey
        ) {

            throw new Error(

                [

                    'O modelo aponta Rules e Community Updates para o mesmo canal.',

                    '',

                    'Para uma restauração segura em Community, eles precisam ser canais separados.',

                    'Nada foi apagado.'

                ].join(
                    '\n'
                )
            );
        }


        if (
            !currentRulesChannel ||
            !currentPublicUpdatesChannel
        ) {

            throw new Error(

                [

                    'O servidor está marcado como Community, mas o Discord não retornou os canais obrigatórios atuais.',

                    '',

                    'Confira as configurações de Comunidade e tente novamente.',

                    'Nada foi apagado.'

                ].join(
                    '\n'
                )
            );
        }


        const rulesSnapshot =
            snapshot.channels.find(
                channel =>
                    channel.key ===
                    snapshot.rulesChannelKey
            );


        const updatesSnapshot =
            snapshot.channels.find(
                channel =>
                    channel.key ===
                    snapshot.publicUpdatesChannelKey
            );


        if (
            !rulesSnapshot ||
            !updatesSnapshot
        ) {

            throw new Error(

                [

                    'O modelo possui referências de Community inválidas.',

                    '',

                    'Não encontrei no snapshot o canal de regras ou o canal de atualizações.',

                    'Nada foi apagado.'

                ].join(
                    '\n'
                )
            );
        }


        if (
            rulesSnapshot.type !==
                'text' ||

            updatesSnapshot.type !==
                'text'
        ) {

            throw new Error(

                [

                    'Os canais especiais de Community do modelo precisam ser canais de texto comuns.',

                    '',

                    `Rules: ${rulesSnapshot.name} (${rulesSnapshot.type})`,

                    `Updates: ${updatesSnapshot.name} (${updatesSnapshot.type})`,

                    '',

                    'Nada foi apagado.'

                ].join(
                    '\n'
                )
            );
        }
    }


    const channelMap =
        new Map<
            string,
            string
        >();


    const createdIds:
        string[] = [];


    let createdCategories =
        0;


    let createdChannels =
        0;


    let deleted =
        0;


    let deletionStarted =
        false;


    const protectedOldChannelIds =
        new Set<string>();


    if (
        currentRulesChannel
    ) {

        protectedOldChannelIds.add(
            currentRulesChannel.id
        );
    }


    if (
        currentPublicUpdatesChannel
    ) {

        protectedOldChannelIds.add(
            currentPublicUpdatesChannel.id
        );
    }


    if (
        guild.safetyAlertsChannelId
    ) {

        protectedOldChannelIds.add(
            guild.safetyAlertsChannelId
        );
    }


    const reusedSnapshotChannelCount =
        destinationIsCommunity
            ? 2
            : 0;


    console.log(
        `[MODELO] Engine ${ENGINE_VERSION}: Community=${destinationIsCommunity}; rules=${guild.rulesChannelId ?? 'null'}; updates=${guild.publicUpdatesChannelId ?? 'null'}; safety=${guild.safetyAlertsChannelId ?? 'null'}.`
    );


    try {

        const orderedCategories =
            [
                ...snapshot.categories
            ]

                .sort(
                    (a, b) =>
                        a.position -
                        b.position
                );


        console.log(
            `[MODELO] Estrutura: criando ${orderedCategories.length} categoria(s)...`
        );


        for (
            const category
            of orderedCategories
        ) {

            const created =
                await guild.channels.create({

                    name:
                        category.name,

                    type:
                        ChannelType.GuildCategory,

                    reason:
                        REASON
                });


            channelMap.set(
                category.key,
                created.id
            );


            createdIds.push(
                created.id
            );


            createdCategories++;
        }


        const orderedChannels =
            [
                ...snapshot.channels
            ]

                .sort(
                    (a, b) =>
                        a.position -
                        b.position
                );


        const channelsToCreate =
            orderedChannels.filter(
                channel =>
                    !destinationIsCommunity ||
                    (
                        channel.key !==
                            snapshot.rulesChannelKey &&

                        channel.key !==
                            snapshot.publicUpdatesChannelKey
                    )
            );


        console.log(
            `[MODELO] Estrutura: criando ${channelsToCreate.length} canal(is) novo(s)...`
        );


        for (
            const channel
            of channelsToCreate
        ) {

            const parentId =
                channel.parentKey

                    ? (
                        channelMap.get(
                            channel.parentKey
                        ) ??
                        null
                    )

                    : null;


            if (
                channel.parentKey &&
                !parentId
            ) {

                throw new Error(
                    `Não encontrei a categoria de destino do canal "${channel.name}".`
                );
            }


            const created =
                await createSnapshotChannel(
                    guild,
                    channel,
                    parentId
                );


            channelMap.set(
                channel.key,
                created.id
            );


            createdIds.push(
                created.id
            );


            createdChannels++;
        }


        if (
            destinationIsCommunity
        ) {

            const rulesKey =
                snapshot.rulesChannelKey;


            const updatesKey =
                snapshot.publicUpdatesChannelKey;


            if (
                !rulesKey ||
                !updatesKey ||
                !currentRulesChannel ||
                !currentPublicUpdatesChannel
            ) {

                throw new Error(
                    'Não foi possível resolver os canais obrigatórios de Community.'
                );
            }


            const rulesSnapshot =
                snapshot.channels.find(
                    channel =>
                        channel.key ===
                        rulesKey
                );


            const updatesSnapshot =
                snapshot.channels.find(
                    channel =>
                        channel.key ===
                        updatesKey
                );


            if (
                !rulesSnapshot ||
                !updatesSnapshot
            ) {

                throw new Error(
                    'Não foi possível localizar os canais especiais dentro do snapshot.'
                );
            }


            const rulesParentId =
                rulesSnapshot.parentKey

                    ? (
                        channelMap.get(
                            rulesSnapshot.parentKey
                        ) ??
                        null
                    )

                    : null;


            const updatesParentId =
                updatesSnapshot.parentKey

                    ? (
                        channelMap.get(
                            updatesSnapshot.parentKey
                        ) ??
                        null
                    )

                    : null;


            if (
                rulesSnapshot.parentKey &&
                !rulesParentId
            ) {

                throw new Error(
                    `Não encontrei a categoria do canal especial "${rulesSnapshot.name}".`
                );
            }


            if (
                updatesSnapshot.parentKey &&
                !updatesParentId
            ) {

                throw new Error(
                    `Não encontrei a categoria do canal especial "${updatesSnapshot.name}".`
                );
            }


            console.log(
                `[MODELO] Community: reutilizando Rules atual (${currentRulesChannel.id}) como "${rulesSnapshot.name}"...`
            );


            await syncPreservedCommunityTextChannel(
                currentRulesChannel,
                rulesSnapshot,
                rulesParentId
            );


            console.log(
                `[MODELO] Community: reutilizando Updates atual (${currentPublicUpdatesChannel.id}) como "${updatesSnapshot.name}"...`
            );


            await syncPreservedCommunityTextChannel(
                currentPublicUpdatesChannel,
                updatesSnapshot,
                updatesParentId
            );


            channelMap.set(
                rulesKey,
                currentRulesChannel.id
            );


            channelMap.set(
                updatesKey,
                currentPublicUpdatesChannel.id
            );


            await guild.setRulesChannel(
                currentRulesChannel.id,
                REASON
            );


            await guild.setPublicUpdatesChannel(
                currentPublicUpdatesChannel.id,
                REASON
            );
        }


        const resolveMappedId =
            (
                key: string | null
            ): string | null => {

                if (
                    !key
                ) {
                    return null;
                }


                return (
                    channelMap.get(
                        key
                    ) ??
                    null
                );
            };


        const newSafetyAlertsChannelId =
            resolveMappedId(
                snapshot.safetyAlertsChannelKey
            );


        const newSystemChannelId =
            resolveMappedId(
                snapshot.systemChannelKey
            );


        const newAfkChannelId =
            resolveMappedId(
                snapshot.afkChannelKey
            );


        if (
            destinationIsCommunity
        ) {

            const fallbackCommunityChannel =
                snapshot.publicUpdatesChannelKey

                    ? (
                        channelMap.get(
                            snapshot.publicUpdatesChannelKey
                        ) ??
                        null
                    )

                    : null;


            if (
                guild.safetyAlertsChannelId ||
                newSafetyAlertsChannelId
            ) {

                await guild.setSafetyAlertsChannel(

                    newSafetyAlertsChannelId ??
                    fallbackCommunityChannel,

                    REASON
                );
            }

        } else {

            await guild.setRulesChannel(

                resolveMappedId(
                    snapshot.rulesChannelKey
                ),

                REASON
            );


            await guild.setPublicUpdatesChannel(

                resolveMappedId(
                    snapshot.publicUpdatesChannelKey
                ),

                REASON
            );


            await guild.setSafetyAlertsChannel(
                newSafetyAlertsChannelId,
                REASON
            );
        }


        await guild.setSystemChannel(
            newSystemChannelId,
            REASON
        );


        await guild.setAFKChannel(
            newAfkChannelId,
            REASON
        );


        /*
        |--------------------------------------------------------------------------
        | PRESERVAR TICKETS ATIVOS
        |--------------------------------------------------------------------------
        |
        | Antes de apagar a categoria antiga, removemos temporariamente
        | cada ticket ativo dela.
        |
        | O canal continua existindo, com todas as mensagens.
        |
        |--------------------------------------------------------------------------
        */

        for (
            const ticketChannelId
            of activeTicketChannelIds
        ) {

            const ticketChannel =
                guild.channels.cache.get(
                    ticketChannelId
                );


            if (
                !ticketChannel ||
                !isRealGuildChannel(
                    ticketChannel
                ) ||
                ticketChannel.type ===
                    ChannelType.GuildCategory
            ) {

                continue;
            }


            if (
                ticketChannel.parentId !==
                null
            ) {

                try {

                    await ticketChannel.setParent(
                        null,
                        {
                            lockPermissions:
                                false,

                            reason:
                                `${REASON} - preservando ticket ativo durante restauração`
                        }
                    );

                } catch (error) {

                    console.error(

                        `[MODELO] Não consegui desacoplar o ticket ativo "${ticketChannel.name}" (${ticketChannel.id}) da categoria antiga.`,

                        error
                    );


                    warnings.push(
                        `Não consegui mover temporariamente o ticket ativo "${ticketChannel.name}" para fora da categoria antiga.`
                    );
                }
            }
        }


        deletionStarted =
            true;


        const oldChannelsToDelete =
            oldNormalChannels.filter(
                channel =>
                    !protectedOldChannelIds.has(
                        channel.id
                    ) &&
                    !activeTicketChannelIds.has(
                        channel.id
                    )
            );


        console.log(
            `[MODELO] Estrutura: removendo ${oldChannelsToDelete.length} canal(is) antigo(s); ${protectedOldChannelIds.size} canal(is) Community protegido(s); ${activeTicketChannelIds.size} ticket(s) ativo(s) preservado(s)...`
        );


        const deletionFailures:
            string[] = [];


        for (
            const channel
            of oldChannelsToDelete
        ) {

            try {

                await channel.delete(
                    REASON
                );


                deleted++;

            } catch (error) {

                if (
                    isCommunityRequiredChannelError(
                        error
                    )
                ) {

                    protectedOldChannelIds.add(
                        channel.id
                    );


                    warnings.push(
                        `O Discord protegeu o canal "${channel.name}" (${channel.id}) como obrigatório da Comunidade; ele foi preservado.`
                    );


                    console.warn(
                        `[MODELO] Engine ${ENGINE_VERSION}: canal Community protegido pelo Discord foi preservado: "${channel.name}" (${channel.id}).`
                    );


                    continue;
                }


                console.error(

                    `[MODELO] Não consegui apagar o canal antigo "${channel.name}" (${channel.id}).`,

                    error
                );


                deletionFailures.push(
                    `canal "${channel.name}"`
                );
            }
        }


        console.log(
            `[MODELO] Estrutura: removendo ${oldCategories.length} categoria(s) antiga(s)...`
        );


        for (
            const category
            of oldCategories
        ) {

            try {

                await category.delete(
                    REASON
                );


                deleted++;

            } catch (error) {

                console.error(

                    `[MODELO] Não consegui apagar a categoria antiga "${category.name}" (${category.id}).`,

                    error
                );


                deletionFailures.push(
                    `categoria "${category.name}"`
                );
            }
        }


        if (
            deletionFailures.length >
            0
        ) {

            warnings.push(

                `${deletionFailures.length} item(ns) da estrutura antiga não puderam ser apagados: ${deletionFailures
                    .slice(
                        0,
                        5
                    )
                    .join(
                        ', '
                    )}${deletionFailures.length > 5 ? '...' : ''}`
            );
        }


        const categoryPositions =
            snapshot.categories.flatMap(
                category => {

                    const id =
                        channelMap.get(
                            category.key
                        );


                    if (
                        !id
                    ) {
                        return [];
                    }


                    return [

                        {
                            channel:
                                id,

                            position:
                                category.position
                        }
                    ];
                }
            );


        if (
            categoryPositions.length >
            0
        ) {

            try {

                await guild.channels.setPositions(
                    categoryPositions
                );

            } catch (error) {

                console.error(
                    '[MODELO] Falha ao reordenar categorias.',
                    error
                );


                warnings.push(
                    'A estrutura foi criada, mas não consegui restaurar exatamente a ordem de todas as categorias.'
                );
            }
        }


        const channelPositions =
            snapshot.channels.flatMap(
                channel => {

                    const id =
                        channelMap.get(
                            channel.key
                        );


                    if (
                        !id
                    ) {
                        return [];
                    }


                    return [

                        {
                            channel:
                                id,

                            position:
                                channel.position
                        }
                    ];
                }
            );


        if (
            channelPositions.length >
            0
        ) {

            try {

                await guild.channels.setPositions(
                    channelPositions
                );

            } catch (error) {

                console.error(
                    '[MODELO] Falha ao reordenar canais.',
                    error
                );


                warnings.push(
                    'A estrutura foi criada, mas não consegui restaurar exatamente a ordem de todos os canais.'
                );
            }
        }


        console.log(

            `[MODELO] Estrutura concluída: ${createdCategories} categoria(s) nova(s), ${createdChannels} canal(is) novo(s), ${protectedOldChannelIds.size} canal(is) Community reutilizado(s), ${deleted} item(ns) antigo(s) apagado(s).`
        );


        return {

            deleted,

            createdCategories,

            createdChannels:
                createdChannels +
                reusedSnapshotChannelCount,

            map:
                channelMap
        };

    } catch (error) {

        console.error(
            '[MODELO] Falha durante a reconstrução da estrutura.',
            error
        );


        if (
            !deletionStarted
        ) {

            console.log(
                '[MODELO] Estrutura antiga ainda não foi apagada. Limpando somente a criação parcial...'
            );


            await cleanupCreatedStructure(
                guild,
                createdIds
            );
        }


        throw error;
    }
}


function findExistingRole(
    guild: Guild,
    name: string,
    oldPosition: number
): Role | null {

    const candidates =
        [
            ...guild.roles.cache.values()
        ]

            .filter(
                role =>
                    !role.managed &&
                    role.id !==
                        guild.roles.everyone.id &&
                    role.name ===
                        name
            )

            .sort(
                (a, b) =>
                    Math.abs(
                        a.position -
                        oldPosition
                    ) -
                    Math.abs(
                        b.position -
                        oldPosition
                    )
            );


    return (
        candidates[0] ??
        null
    );
}


function matchesTargetType(
    channel: RealGuildChannel,
    type: TipoAlvoPermissao
): boolean {

    if (
        type ===
        'category'
    ) {

        return (
            channel.type ===
            ChannelType.GuildCategory
        );
    }


    return (
        getChannelType(
            channel
        ) ===
        type
    );
}


function findExistingChannel(
    guild: Guild,
    target: ReferenciaCanalPermissao
): RealGuildChannel | null {

    const candidates =
        [
            ...guild.channels.cache.values()
        ]

            .filter(
                isRealGuildChannel
            )

            .filter(
                channel => {

                    if (
                        !matchesTargetType(
                            channel,
                            target.channelType
                        )
                    ) {

                        return false;
                    }


                    if (
                        channel.name !==
                        target.channelName
                    ) {

                        return false;
                    }


                    if (
                        target.channelType ===
                        'category'
                    ) {

                        return true;
                    }


                    if (
                        target.parentName ===
                        null
                    ) {

                        return (
                            channel.parentId ===
                            null
                        );
                    }


                    return (
                        channel.parent?.name ===
                        target.parentName
                    );
                }
            )

            .sort(
                (a, b) => {

                    let scoreA =
                        Math.abs(
                            a.rawPosition -
                            target.position
                        );


                    let scoreB =
                        Math.abs(
                            b.rawPosition -
                            target.position
                        );


                    if (
                        target.parentPosition !==
                        null
                    ) {

                        scoreA +=
                            Math.abs(
                                (
                                    a.parent
                                        ?.rawPosition ??
                                    9999
                                ) -
                                target.parentPosition
                            );


                        scoreB +=
                            Math.abs(
                                (
                                    b.parent
                                        ?.rawPosition ??
                                    9999
                                ) -
                                target.parentPosition
                            );
                    }


                    return (
                        scoreA -
                        scoreB
                    );
                }
            );


    return (
        candidates[0] ??
        null
    );
}


async function resolveRole(
    guild: Guild,
    roleMap:
        Map<string, string>,
    roleKeyValue: string,
    roleName: string,
    rolePosition: number
): Promise<Role | null> {

    const mappedId =
        roleMap.get(
            roleKeyValue
        );


    if (
        mappedId
    ) {

        const mapped =
            await guild.roles

                .fetch(
                    mappedId
                )

                .catch(
                    () => null
                );


        if (
            mapped
        ) {

            return mapped;
        }
    }


    return findExistingRole(
        guild,
        roleName,
        rolePosition
    );
}


async function resolveChannel(
    guild: Guild,
    channelMap:
        Map<string, string>,
    target:
        ReferenciaCanalPermissao
): Promise<RealGuildChannel | null> {

    const mappedId =
        channelMap.get(
            target.channelKey
        );


    if (
        mappedId
    ) {

        const mapped =
            await guild.channels

                .fetch(
                    mappedId
                )

                .catch(
                    () => null
                );


        if (
            mapped &&
            isRealGuildChannel(
                mapped
            )
        ) {

            return mapped;
        }
    }


    return findExistingChannel(
        guild,
        target
    );
}


async function restorePermissions(
    guild: Guild,
    snapshot:
        PermissoesModelo,
    roleMap:
        Map<string, string>,
    channelMap:
        Map<string, string>,
    warnings:
        string[],
    activeTicketChannelIds:
        ReadonlySet<string>
): Promise<{
    rolesApplied: number;
    channelsApplied: number;
    skipped: number;
}> {

    await guild.roles.fetch();

    await guild.channels.fetch();


    let rolesApplied =
        0;


    let channelsApplied =
        0;


    let skipped =
        0;


    try {

        await guild.roles.everyone
            .setPermissions(

                BigInt(
                    snapshot
                        .everyonePermissions
                ),

                REASON
            );


        rolesApplied++;

    } catch {

        warnings.push(
            'Não consegui restaurar todas as permissões globais de @everyone.'
        );


        skipped++;
    }


    for (
        const rolePermission
        of snapshot.roles
    ) {

        const role =
            await resolveRole(
                guild,
                roleMap,
                rolePermission.roleKey,
                rolePermission.roleName,
                rolePermission.rolePosition
            );


        if (
            !role
        ) {

            warnings.push(
                `Cargo ausente para permissões: "${rolePermission.roleName}".`
            );


            skipped++;


            continue;
        }


        if (
            !role.editable
        ) {

            warnings.push(
                `O cargo "${role.name}" não pode ser editado pelo bot.`
            );


            skipped++;


            continue;
        }


        try {

            await role
                .setPermissions(

                    BigInt(
                        rolePermission.permissions
                    ),

                    REASON
                );


            rolesApplied++;

        } catch {

            warnings.push(
                `Não consegui aplicar permissões globais em "${role.name}".`
            );


            skipped++;
        }
    }


    for (
        const channelPermission
        of snapshot.channelOverwrites
    ) {

        const channel =
            await resolveChannel(
                guild,
                channelMap,
                channelPermission.target
            );


        if (
            !channel
        ) {

            warnings.push(
                `Canal não encontrado para permissões: "${channelPermission.target.channelName}".`
            );


            skipped++;


            continue;
        }


        /*
         * Mesmo modelos antigos que eventualmente contenham
         * um ticket não poderão sobrescrever um ticket ativo.
         */

        if (
            activeTicketChannelIds.has(
                channel.id
            )
        ) {

            skipped++;

            continue;
        }


        const overwrites: Array<{

            id: string;

            type:
                OverwriteType;

            allow:
                bigint;

            deny:
                bigint;

        }> = [];


        for (
            const entry
            of channelPermission.entries
        ) {

            if (
                entry.subjectType ===
                'everyone'
            ) {

                overwrites.push({

                    id:
                        guild.roles
                            .everyone
                            .id,

                    type:
                        OverwriteType.Role,

                    allow:
                        BigInt(
                            entry.allow
                        ),

                    deny:
                        BigInt(
                            entry.deny
                        )
                });


                continue;
            }


            if (
                entry.subjectType ===
                'role'
            ) {

                const role =
                    await resolveRole(
                        guild,
                        roleMap,
                        entry.subjectKey,
                        entry.subjectName,
                        entry.rolePosition
                    );


                if (
                    !role
                ) {

                    warnings.push(
                        `Overwrite ignorado: cargo "${entry.subjectName}" não existe.`
                    );


                    skipped++;


                    continue;
                }


                overwrites.push({

                    id:
                        role.id,

                    type:
                        OverwriteType.Role,

                    allow:
                        BigInt(
                            entry.allow
                        ),

                    deny:
                        BigInt(
                            entry.deny
                        )
                });


                continue;
            }


            const member =
                await guild.members

                    .fetch(
                        entry.sourceId
                    )

                    .catch(
                        () => null
                    );


            if (
                !member
            ) {

                warnings.push(
                    `Overwrite de membro ignorado: "${entry.subjectName}" não está neste servidor.`
                );


                skipped++;


                continue;
            }


            overwrites.push({

                id:
                    member.id,

                type:
                    OverwriteType.Member,

                allow:
                    BigInt(
                        entry.allow
                    ),

                deny:
                    BigInt(
                        entry.deny
                    )
            });
        }


        try {

            await channel
                .permissionOverwrites
                .set(
                    overwrites,
                    REASON
                );


            channelsApplied++;

        } catch {

            warnings.push(
                `Não consegui aplicar os overwrites em "${channel.name}".`
            );


            skipped++;
        }
    }


    return {

        rolesApplied,

        channelsApplied,

        skipped
    };
}


export async function restaurarModelo(
    guild: Guild,
    model: ModeloServidor,
    modules: ModulosModelo
): Promise<ResultadoRestauracao> {

    console.log(
        `[MODELO] Usando modelo-engine ${ENGINE_VERSION}.`
    );


    await validarRestauracao(
        guild,
        model,
        modules
    );


    /*
    |--------------------------------------------------------------------------
    | TICKETS ATIVOS ANTES DA RESTAURAÇÃO
    |--------------------------------------------------------------------------
    |
    | Esses IDs serão protegidos durante todo o processo.
    |
    |--------------------------------------------------------------------------
    */

    const activeTicketChannelIds =
        await getActiveTicketChannelIds(
            guild
        );


    const warnings:
        string[] = [];


    let roleMap =
        new Map<
            string,
            string
        >();


    let channelMap =
        new Map<
            string,
            string
        >();


    let deletedChannels =
        0;


    let createdCategories =
        0;


    let createdChannels =
        0;


    let deletedRoles =
        0;


    let createdRoles =
        0;


    let protectedRoles =
        0;


    let rolePermissionsApplied =
        0;


    let channelPermissionsApplied =
        0;


    let skippedPermissions =
        0;


    /*
    |--------------------------------------------------------------------------
    | 1. CARGOS
    |--------------------------------------------------------------------------
    */

    if (
        modules.cargos
    ) {

        if (
            !model.cargos
        ) {

            throw new Error(
                'O modelo não possui módulo de cargos.'
            );
        }


        const result =
            await restoreRoles(
                guild,
                model.cargos,
                warnings
            );


        deletedRoles =
            result.deleted;


        createdRoles =
            result.created;


        protectedRoles =
            result.protected;


        roleMap =
            result.map;
    }


    /*
    |--------------------------------------------------------------------------
    | 2. ESTRUTURA
    |--------------------------------------------------------------------------
    */

    if (
        modules.estrutura
    ) {

        if (
            !model.estrutura
        ) {

            throw new Error(
                'O modelo não possui módulo de estrutura.'
            );
        }


        const result =
            await restoreStructure(
                guild,
                model.estrutura,
                warnings,
                activeTicketChannelIds
            );


        deletedChannels =
            result.deleted;


        createdCategories =
            result.createdCategories;


        createdChannels =
            result.createdChannels;


        channelMap =
            result.map;
    }


    /*
    |--------------------------------------------------------------------------
    | 3. PERMISSÕES
    |--------------------------------------------------------------------------
    */

    if (
        modules.permissoes
    ) {

        if (
            !model.permissoes
        ) {

            throw new Error(
                'O modelo não possui módulo de permissões.'
            );
        }


        const result =
            await restorePermissions(
                guild,
                model.permissoes,
                roleMap,
                channelMap,
                warnings,
                activeTicketChannelIds
            );


        rolePermissionsApplied =
            result.rolesApplied;


        channelPermissionsApplied =
            result.channelsApplied;


        skippedPermissions =
            result.skipped;
    }


    /*
    |--------------------------------------------------------------------------
    | SINCRONIZAR TICKETS DEPOIS DO /MODELO
    |--------------------------------------------------------------------------
    |
    | Exemplo:
    |
    | @Staff antigo foi apagado
    | ↓
    | @Staff novo foi recriado
    | ↓
    | ticket-resolver repara o ID
    | ↓
    | ticket-service reaplica o cargo nos tickets
    |
    | A mesma coisa vale para a categoria TICKETS.
    |
    |--------------------------------------------------------------------------
    */

    if (
        activeTicketChannelIds.size >
        0
    ) {

        try {

            const ticketSync =
                await synchronizeTickets(
                    guild
                );


            warnings.push(
                `${ticketSync.synchronized} ticket(s) ativo(s) foram preservados e sincronizados após a restauração.`
            );


            if (
                ticketSync.removedStale >
                0
            ) {

                warnings.push(
                    `${ticketSync.removedStale} registro(s) antigo(s) de ticket foram limpos durante a sincronização.`
                );
            }


            warnings.push(
                ...ticketSync.warnings
            );

        } catch (error) {

            console.error(

                '[MODELO] Os tickets ativos foram preservados, mas a sincronização automática falhou.',

                error
            );


            warnings.push(
                'Os canais de tickets ativos foram preservados, mas não consegui sincronizar automaticamente categoria, staff e permissões. Use /ticket sincronizar.'
            );
        }
    }


    return {

        deletedChannels,

        createdCategories,

        createdChannels,

        deletedRoles,

        createdRoles,

        protectedRoles,

        rolePermissionsApplied,

        channelPermissionsApplied,

        skippedPermissions,

        warnings
    };
}