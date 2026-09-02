import 'dotenv/config';

import {
    Client,
    Events,
    GatewayIntentBits,
    MessageFlags
} from 'discord.js';

import type {
    ChatInputCommandInteraction
} from 'discord.js';

import {
    commandMap
} from './commands/index.js';

import {
    handleTicketButton
} from './interactions/ticket-buttons.js';

import {
    checkCommandPermission
} from './services/permissions.js';

import {
    sendWelcomeMessage
} from './services/message-config.js';


/*
|--------------------------------------------------------------------------
| TOKEN
|--------------------------------------------------------------------------
*/

const token =
    process.env.DISCORD_TOKEN;


if (
    !token
) {

    throw new Error(
        'DISCORD_TOKEN não foi definido no .env.'
    );
}


/*
|--------------------------------------------------------------------------
| CLIENT
|--------------------------------------------------------------------------
*/

const client =
    new Client({

        intents: [

            /*
             * Necessário para slash commands,
             * canais e funcionamento básico
             * dentro das guilds.
             */

            GatewayIntentBits.Guilds,


            /*
             * Necessário para receber
             * GuildMemberAdd.
             *
             * Também precisa estar ativado em:
             *
             * Developer Portal
             * -> Bot
             * -> Privileged Gateway Intents
             * -> SERVER MEMBERS INTENT
             */

            GatewayIntentBits.GuildMembers
        ]
    });


/*
|--------------------------------------------------------------------------
| READY
|--------------------------------------------------------------------------
*/

client.once(
    Events.ClientReady,

    readyClient => {

        console.log(
            `✅ Bot online como ${readyClient.user.tag}`
        );
    }
);


/*
|--------------------------------------------------------------------------
| NOVO MEMBRO
|--------------------------------------------------------------------------
|
| Dispara automaticamente quando alguém entra no servidor.
|
| Toda a lógica de:
|
| - canal
| - texto/embed
| - variáveis
| - menção
| - reparação do canal
|
| fica dentro de message-config.ts.
|
|--------------------------------------------------------------------------
*/

client.on(
    Events.GuildMemberAdd,

    async member => {

        try {

            const result =
                await sendWelcomeMessage(
                    member
                );


            /*
             * Sistema desativado não é erro.
             */

            if (
                !result.sent &&
                result.reason !==
                    'disabled'
            ) {

                console.warn(
                    `[MENSAGENS] Boas-vindas não enviada em "${member.guild.name}" para ${member.user.tag}: ${result.reason ?? 'motivo desconhecido'}`
                );
            }

        } catch (error) {

            /*
             * Uma falha nas boas-vindas nunca deve
             * derrubar o bot.
             */

            console.error(
                `[MENSAGENS] Erro ao enviar boas-vindas para ${member.user.tag} em "${member.guild.name}":`,
                error
            );
        }
    }
);


/*
|--------------------------------------------------------------------------
| RESPOSTA SEGURA
|--------------------------------------------------------------------------
*/

async function safeInteractionMessage(
    interaction:
        ChatInputCommandInteraction,
    content:
        string
):
    Promise<void> {

    try {

        if (
            interaction.deferred
        ) {

            await interaction.editReply({

                content,

                embeds:
                    [],

                components:
                    []
            });


            return;
        }


        if (
            interaction.replied
        ) {

            await interaction.followUp({

                content,

                flags:
                    MessageFlags.Ephemeral
            });


            return;
        }


        await interaction.reply({

            content,

            flags:
                MessageFlags.Ephemeral
        });

    } catch (
        responseError
    ) {

        console.error(
            `[INTERACTION] Não consegui enviar uma resposta para /${interaction.commandName}:`,
            responseError
        );
    }
}


/*
|--------------------------------------------------------------------------
| INTERAÇÕES
|--------------------------------------------------------------------------
*/

client.on(
    Events.InteractionCreate,

    async interaction => {

        /*
        |--------------------------------------------------------------------------
        | BOTÕES DE TICKET
        |--------------------------------------------------------------------------
        |
        | Botões NÃO passam pelas permissões dos slash commands.
        |
        | Isso é proposital:
        |
        | - qualquer usuário pode abrir ticket
        | - autor pode fechar o próprio ticket
        | - suporte configurado pode assumir/fechar
        | - administrador pode gerenciar
        |
        |--------------------------------------------------------------------------
        */

        if (
            interaction.isButton() &&
            interaction.customId.startsWith(
                'ticket:'
            )
        ) {

            await handleTicketButton(
                interaction
            );


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | AUTOCOMPLETE
        |--------------------------------------------------------------------------
        |
        | Também checamos autorização aqui.
        |
        | Assim alguém sem BanMembers não consegue usar o autocomplete
        | de /desbanir para consultar a lista de banidos.
        |
        | E alguém sem acesso a /modelo não consegue consultar nomes de
        | modelos pelo autocomplete.
        |
        |--------------------------------------------------------------------------
        */

        if (
            interaction.isAutocomplete()
        ) {

            const command =
                commandMap.get(
                    interaction.commandName
                );


            if (
                !command ||
                !command.autocomplete
            ) {

                try {

                    await interaction.respond(
                        []
                    );

                } catch {

                    // Nada a fazer.
                }


                return;
            }


            try {

                const permission =
                    await checkCommandPermission(
                        interaction
                    );


                if (
                    !permission.allowed
                ) {

                    await interaction.respond(
                        []
                    );


                    return;
                }


                await command.autocomplete(
                    interaction
                );

            } catch (error) {

                console.error(
                    `Erro no autocomplete de /${interaction.commandName}:`,
                    error
                );


                try {

                    await interaction.respond(
                        []
                    );

                } catch {

                    // Nada a fazer.
                }
            }


            return;
        }


        /*
        |--------------------------------------------------------------------------
        | CHAT INPUT
        |--------------------------------------------------------------------------
        */

        if (
            !interaction.isChatInputCommand()
        ) {

            return;
        }


        const command =
            commandMap.get(
                interaction.commandName
            );


        if (
            !command
        ) {

            return;
        }


        try {

            /*
            |--------------------------------------------------------------------------
            | /MODELO
            |--------------------------------------------------------------------------
            |
            | Mantemos o defer imediato porque a arquitetura antiga já foi
            | testada assim e operações de modelo podem ser demoradas.
            |
            |--------------------------------------------------------------------------
            */

            if (
                interaction.commandName ===
                    'modelo' &&

                !interaction.deferred &&

                !interaction.replied
            ) {

                await interaction.deferReply({

                    flags:
                        MessageFlags.Ephemeral
                });
            }


            /*
            |--------------------------------------------------------------------------
            | AUTORIZAÇÃO CENTRAL
            |--------------------------------------------------------------------------
            |
            | NÃO existe mais dependência de cargo Staff.
            |
            | A regra é definida pela função real do comando.
            |
            |--------------------------------------------------------------------------
            */

            const permission =
                await checkCommandPermission(
                    interaction
                );


            if (
                !permission.allowed
            ) {

                await safeInteractionMessage(
                    interaction,
                    permission.message ??
                    '❌ Você não possui permissão para usar este comando.'
                );


                return;
            }


            /*
            |--------------------------------------------------------------------------
            | EXECUTAR
            |--------------------------------------------------------------------------
            */

            await command.execute(
                interaction
            );

        } catch (error) {

            console.error(
                `Erro em /${interaction.commandName}:`,
                error
            );


            await safeInteractionMessage(
                interaction,
                '❌ Ocorreu um erro ao executar esse comando.'
            );
        }
    }
);


/*
|--------------------------------------------------------------------------
| ERROS DO CLIENT
|--------------------------------------------------------------------------
*/

client.on(
    Events.Error,

    error => {

        console.error(
            'Erro no cliente do Discord:',
            error
        );
    }
);


/*
|--------------------------------------------------------------------------
| ÚLTIMA BARREIRA
|--------------------------------------------------------------------------
*/

process.on(
    'unhandledRejection',

    error => {

        console.error(
            'Promise rejeitada sem tratamento:',
            error
        );
    }
);


/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

client.login(
    token
);