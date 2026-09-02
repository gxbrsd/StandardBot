import {
    PermissionFlagsBits
} from 'discord.js';

import type {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    GuildMember
} from 'discord.js';


/*
|--------------------------------------------------------------------------
| INTERAÇÕES SUPORTADAS
|--------------------------------------------------------------------------
*/

export type PermissionInteraction =
    ChatInputCommandInteraction |
    AutocompleteInteraction;


/*
|--------------------------------------------------------------------------
| TIPOS DE AUTORIZAÇÃO
|--------------------------------------------------------------------------
*/

export type CommandPermissionRequirement =

    | 'everyone'

    | 'owner'

    | 'administrator'

    | 'ban-members'

    | 'kick-members'

    | 'moderate-members'

    | 'manage-messages'

    | 'manage-channels';


export interface CommandPermissionResult {

    allowed:
        boolean;

    requirement:
        CommandPermissionRequirement;

    message:
        string | null;
}


/*
|--------------------------------------------------------------------------
| MEMBRO
|--------------------------------------------------------------------------
*/

async function getInteractionMember(
    interaction:
        PermissionInteraction
):
    Promise<GuildMember | null> {

    const guild =
        interaction.guild;


    if (
        !guild
    ) {

        return null;
    }


    const cached =
        guild.members.cache.get(
            interaction.user.id
        );


    if (
        cached
    ) {

        return cached;
    }


    return guild.members.fetch(
        interaction.user.id
    )

        .catch(
            () => null
        );
}


/*
|--------------------------------------------------------------------------
| DONO
|--------------------------------------------------------------------------
*/

function isGuildOwner(
    interaction:
        PermissionInteraction
):
    boolean {

    return (
        interaction.guild !==
            null &&

        interaction.user.id ===
            interaction.guild.ownerId
    );
}


/*
|--------------------------------------------------------------------------
| ADMINISTRADOR
|--------------------------------------------------------------------------
*/

function memberIsAdministrator(
    member:
        GuildMember
):
    boolean {

    return member.permissions.has(
        PermissionFlagsBits.Administrator
    );
}


/*
|--------------------------------------------------------------------------
| SUBCOMANDO
|--------------------------------------------------------------------------
*/

function getSubcommand(
    interaction:
        PermissionInteraction
):
    string | null {

    try {

        return interaction.options
            .getSubcommand(
                false
            );

    } catch {

        return null;
    }
}


/*
|--------------------------------------------------------------------------
| REGRA DE CADA COMANDO
|--------------------------------------------------------------------------
|
| IMPORTANTE:
|
| Não usamos nome de cargo.
|
| "Moderador", "Staff", "Gerente", "Cachorro Espacial", etc.
| não fazem diferença.
|
| O que vale é a permissão NATIVA que o Discord deu ao membro.
|
|--------------------------------------------------------------------------
*/

export function getCommandPermissionRequirement(
    interaction:
        PermissionInteraction
):
    CommandPermissionRequirement {

    switch (
        interaction.commandName
    ) {

        /*
        |--------------------------------------------------------------------------
        | PÚBLICO
        |--------------------------------------------------------------------------
        */

        case 'ajuda':

            return 'everyone';


        /*
        |--------------------------------------------------------------------------
        | OWNER
        |--------------------------------------------------------------------------
        */

        case 'setup':

            return 'owner';


        /*
        |--------------------------------------------------------------------------
        | MODELOS
        |--------------------------------------------------------------------------
        |
        | Todo mundo com Administrator pode:
        |
        | - salvar
        | - listar
        | - detalhes
        | - excluir
        | - limpar backups
        |
        | Apenas o DONO pode restaurar.
        |
        |--------------------------------------------------------------------------
        */

        case 'modelo':

            return (
                getSubcommand(
                    interaction
                ) ===
                    'restaurar'
            )

                ? 'owner'

                : 'administrator';


        /*
        |--------------------------------------------------------------------------
        | TICKETS
        |--------------------------------------------------------------------------
        |
        | Slash command /ticket = administração do sistema.
        |
        | Usuários normais abrem pelo PAINEL.
        | Suporte atende pelos BOTÕES.
        |
        |--------------------------------------------------------------------------
        */

        case 'ticket':

            return 'administrator';


        /*
        |--------------------------------------------------------------------------
        | ADMINISTRAÇÃO
        |--------------------------------------------------------------------------
        */

        case 'moderacao':

        case 'regras':

        case 'mensagens':

            return 'administrator';


        /*
        |--------------------------------------------------------------------------
        | BAN
        |--------------------------------------------------------------------------
        */

        case 'banir':

        case 'banir-id':

        case 'desbanir':

            return 'ban-members';


        /*
        |--------------------------------------------------------------------------
        | KICK
        |--------------------------------------------------------------------------
        */

        case 'expulsar':

            return 'kick-members';


        /*
        |--------------------------------------------------------------------------
        | MODERAÇÃO DE MEMBROS
        |--------------------------------------------------------------------------
        */

        case 'mutar':

        case 'desmutar':

        case 'aviso':

            return 'moderate-members';


        /*
        |--------------------------------------------------------------------------
        | MENSAGENS
        |--------------------------------------------------------------------------
        */

        case 'limpar':

            return 'manage-messages';


        /*
        |--------------------------------------------------------------------------
        | CANAIS
        |--------------------------------------------------------------------------
        */

        case 'lock':

        case 'unlock':

        case 'nuke':

            return 'manage-channels';


        /*
        |--------------------------------------------------------------------------
        | FUTUROS COMANDOS
        |--------------------------------------------------------------------------
        |
        | Como o StandardBot atualmente é administrativo,
        | um comando novo NÃO vira público acidentalmente.
        |
        | Se criarmos um comando público no futuro, adicionamos
        | explicitamente como "everyone".
        |
        |--------------------------------------------------------------------------
        */

        default:

            return 'administrator';
    }
}


/*
|--------------------------------------------------------------------------
| TEXTO DA PERMISSÃO
|--------------------------------------------------------------------------
*/

function permissionDeniedMessage(
    requirement:
        CommandPermissionRequirement
):
    string {

    switch (
        requirement
    ) {

        case 'owner':

            return (
                '❌ Este comando só pode ser usado pelo ' +
                '**proprietário do servidor**.'
            );


        case 'administrator':

            return (
                '❌ Você precisa da permissão ' +
                '**Administrador** para usar este comando.'
            );


        case 'ban-members':

            return (
                '❌ Você precisa da permissão ' +
                '**Banir membros** para usar este comando.'
            );


        case 'kick-members':

            return (
                '❌ Você precisa da permissão ' +
                '**Expulsar membros** para usar este comando.'
            );


        case 'moderate-members':

            return (
                '❌ Você precisa da permissão ' +
                '**Moderar membros** para usar este comando.'
            );


        case 'manage-messages':

            return (
                '❌ Você precisa da permissão ' +
                '**Gerenciar mensagens** para usar este comando.'
            );


        case 'manage-channels':

            return (
                '❌ Você precisa da permissão ' +
                '**Gerenciar canais** para usar este comando.'
            );


        case 'everyone':

            return '';
    }
}


/*
|--------------------------------------------------------------------------
| VERIFICAR UMA PERMISSÃO NATIVA
|--------------------------------------------------------------------------
*/

function memberHasRequirement(
    member:
        GuildMember,
    requirement:
        CommandPermissionRequirement
):
    boolean {

    switch (
        requirement
    ) {

        case 'everyone':

            return true;


        case 'administrator':

            return memberIsAdministrator(
                member
            );


        case 'ban-members':

            return member.permissions.has(
                PermissionFlagsBits.BanMembers
            );


        case 'kick-members':

            return member.permissions.has(
                PermissionFlagsBits.KickMembers
            );


        case 'moderate-members':

            return member.permissions.has(
                PermissionFlagsBits.ModerateMembers
            );


        case 'manage-messages':

            return member.permissions.has(
                PermissionFlagsBits.ManageMessages
            );


        case 'manage-channels':

            return member.permissions.has(
                PermissionFlagsBits.ManageChannels
            );


        /*
         * Owner é tratado antes,
         * pois não existe um bit "GuildOwner".
         */

        case 'owner':

            return false;
    }
}


/*
|--------------------------------------------------------------------------
| VERIFICAÇÃO CENTRAL
|--------------------------------------------------------------------------
*/

export async function checkCommandPermission(
    interaction:
        PermissionInteraction
):
    Promise<CommandPermissionResult> {

    const requirement =
        getCommandPermissionRequirement(
            interaction
        );


    /*
    |--------------------------------------------------------------------------
    | COMANDO PÚBLICO
    |--------------------------------------------------------------------------
    */

    if (
        requirement ===
        'everyone'
    ) {

        return {

            allowed:
                true,

            requirement,

            message:
                null
        };
    }


    /*
    |--------------------------------------------------------------------------
    | PRECISA ESTAR EM SERVIDOR
    |--------------------------------------------------------------------------
    */

    if (
        !interaction.guild
    ) {

        return {

            allowed:
                false,

            requirement,

            message:
                '❌ Este comando só pode ser usado dentro de um servidor.'
        };
    }


    /*
    |--------------------------------------------------------------------------
    | DONO TEM ACESSO TOTAL
    |--------------------------------------------------------------------------
    |
    | O proprietário sempre passa em qualquer permissão administrativa.
    |
    |--------------------------------------------------------------------------
    */

    if (
        isGuildOwner(
            interaction
        )
    ) {

        return {

            allowed:
                true,

            requirement,

            message:
                null
        };
    }


    /*
    |--------------------------------------------------------------------------
    | OWNER-ONLY
    |--------------------------------------------------------------------------
    */

    if (
        requirement ===
        'owner'
    ) {

        return {

            allowed:
                false,

            requirement,

            message:
                permissionDeniedMessage(
                    requirement
                )
        };
    }


    /*
    |--------------------------------------------------------------------------
    | BUSCAR MEMBRO
    |--------------------------------------------------------------------------
    */

    const member =
        await getInteractionMember(
            interaction
        );


    if (
        !member
    ) {

        return {

            allowed:
                false,

            requirement,

            message:
                '❌ Não consegui verificar suas permissões neste servidor.'
        };
    }


    /*
    |--------------------------------------------------------------------------
    | VERIFICAR
    |--------------------------------------------------------------------------
    |
    | Discord.js considera Administrator como superpermissão no has().
    |
    | Portanto um Administrador também passa em:
    |
    | BanMembers
    | KickMembers
    | ModerateMembers
    | ManageMessages
    | ManageChannels
    |
    |--------------------------------------------------------------------------
    */

    if (
        memberHasRequirement(
            member,
            requirement
        )
    ) {

        return {

            allowed:
                true,

            requirement,

            message:
                null
        };
    }


    return {

        allowed:
            false,

        requirement,

        message:
            permissionDeniedMessage(
                requirement
            )
    };
}


/*
|--------------------------------------------------------------------------
| COMPATIBILIDADE COM O CÓDIGO ANTIGO
|--------------------------------------------------------------------------
|
| Alguns arquivos antigos ainda chamam:
|
| canUseStaffCommands()
|
| NÃO vamos precisar sair alterando 15 arquivos agora.
|
| A partir desta versão:
|
| "staff global" NÃO EXISTE MAIS.
|
| Esta função antiga passa a significar somente:
|
| - proprietário
| - Administrator
|
| Ela NÃO consulta cargo configurado pelo /setup.
|
| O cargo Staff configurado no sistema de TICKETS continua sendo tratado
| exclusivamente pelo módulo de tickets.
|
|--------------------------------------------------------------------------
*/

export async function canUseStaffCommands(
    interaction:
        PermissionInteraction
):
    Promise<boolean> {

    if (
        !interaction.guild
    ) {

        return false;
    }


    if (
        isGuildOwner(
            interaction
        )
    ) {

        return true;
    }


    const member =
        await getInteractionMember(
            interaction
        );


    if (
        !member
    ) {

        return false;
    }


    return memberIsAdministrator(
        member
    );
}