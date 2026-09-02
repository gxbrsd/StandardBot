import 'dotenv/config';

import {
    REST,
    Routes
} from 'discord.js';

import {
    commandList
} from './commands/index.js';

const token =
    process.env.DISCORD_TOKEN;

const clientId =
    process.env.CLIENT_ID;

const devGuildId =
    process.env.DEV_GUILD_ID;

const globalDeploy =
    process.argv.includes('--global');

if (!token) {
    throw new Error(
        'DISCORD_TOKEN não definido.'
    );
}

if (!clientId) {
    throw new Error(
        'CLIENT_ID não definido.'
    );
}

if (!globalDeploy && !devGuildId) {
    throw new Error(
        'DEV_GUILD_ID não definido.'
    );
}

const rest =
    new REST({ version: '10' })
        .setToken(token);

const commands =
    commandList.map(
        command => command.data.toJSON()
    );

async function deployCommands() {

    console.log(
        globalDeploy
            ? '🌎 Registrando comandos globalmente...'
            : '🧪 Registrando comandos no servidor de desenvolvimento...'
    );

    const route =
        globalDeploy

            ? Routes.applicationCommands(
                clientId!
            )

            : Routes.applicationGuildCommands(
                clientId!,
                devGuildId!
            );

    await rest.put(
        route,
        {
            body: commands
        }
    );

    console.log(
        '✅ Comandos registrados com sucesso!'
    );
}

deployCommands().catch(console.error);