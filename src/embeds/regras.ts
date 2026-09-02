import {
    EmbedBuilder
} from 'discord.js';


const DEFAULT_RULES_COLOR =
    0x2b2d31;


/**
 * Minimal fallback shown until an administrator customizes the rules with
 * `/mensagens regras editar`. No local image assets are required.
 */
export function buildRulesEmbed():
    EmbedBuilder {

    return new EmbedBuilder()
        .setColor(
            DEFAULT_RULES_COLOR
        )
        .setTitle(
            'Server Rules'
        )
        .setDescription(
            [
                'Configure the official rules for this server with:',
                '',
                '`/mensagens regras editar`',
                '',
                'Then publish them with `/regras publicar`.'
            ].join('\n')
        )
        .setFooter({
            text: 'StandardBot • Rules'
        });
}
