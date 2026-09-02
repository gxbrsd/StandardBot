import {
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    writeFileSync
} from 'node:fs';

import { dirname, resolve } from 'node:path';

export interface GuildConfig {
    staffRoleId?: string;
    rulesChannelId?: string;
    rulesMessageId?: string;
}

type GuildConfigs = Record<string, GuildConfig>;

const DATA_FILE = resolve(
    process.cwd(),
    'data',
    'guilds.json'
);

function readConfigs(): GuildConfigs {
    if (!existsSync(DATA_FILE)) {
        return {};
    }

    const content = readFileSync(DATA_FILE, 'utf8');

    if (!content.trim()) {
        return {};
    }

    return JSON.parse(content);
}

function writeConfigs(configs: GuildConfigs): void {
    mkdirSync(dirname(DATA_FILE), {
        recursive: true
    });

    const temporaryFile = `${DATA_FILE}.tmp`;

    writeFileSync(
        temporaryFile,
        JSON.stringify(configs, null, 2),
        'utf8'
    );

    renameSync(temporaryFile, DATA_FILE);
}

export function getGuildConfig(
    guildId: string
): GuildConfig {

    const configs = readConfigs();

    return configs[guildId] ?? {};
}

export function updateGuildConfig(
    guildId: string,
    changes: Partial<GuildConfig>
): GuildConfig {

    const configs = readConfigs();

    const updatedConfig = {
        ...configs[guildId],
        ...changes
    };

    configs[guildId] = updatedConfig;

    writeConfigs(configs);

    return updatedConfig;
}