import type {
    AutocompleteInteraction
} from 'discord.js';

import {
    setupCommand
} from './setup.js';

import {
    regrasCommand
} from './regras.js';

import {
    modeloCommand
} from './modelo.js';

import {
    ticketCommand
} from './ticket.js';

import {
    moderacaoCommand
} from './moderacao.js';

import {
    banirCommand
} from './banir.js';

import {
    banirIdCommand
} from './banir-id.js';

import {
    desbanirCommand
} from './desbanir.js';

import {
    expulsarCommand
} from './expulsar.js';

import {
    mutarCommand
} from './mutar.js';

import {
    desmutarCommand
} from './desmutar.js';

import {
    avisoCommand
} from './aviso.js';

import {
    limparCommand
} from './limpar.js';

import {
    lockCommand
} from './lock.js';

import {
    unlockCommand
} from './unlock.js';

import {
    nukeCommand
} from './nuke.js';

import {
    ajudaCommand
} from './ajuda.js';

import {
    mensagensCommand
} from './mensagens.js';

import {
    boostCommand
} from './boost.js';


export const commandList = [

    /*
    |--------------------------------------------------------------------------
    | BASE
    |--------------------------------------------------------------------------
    */

    setupCommand,

    regrasCommand,

    ajudaCommand,

    mensagensCommand,

    boostCommand,


    /*
    |--------------------------------------------------------------------------
    | MODELOS
    |--------------------------------------------------------------------------
    */

    modeloCommand,


    /*
    |--------------------------------------------------------------------------
    | TICKETS
    |--------------------------------------------------------------------------
    */

    ticketCommand,


    /*
    |--------------------------------------------------------------------------
    | MODERAÇÃO
    |--------------------------------------------------------------------------
    */

    moderacaoCommand,

    banirCommand,

    banirIdCommand,

    desbanirCommand,

    expulsarCommand,

    mutarCommand,

    desmutarCommand,

    avisoCommand,

    limparCommand,

    lockCommand,

    unlockCommand,

    nukeCommand
];


export type BotCommand =
    (typeof commandList)[number] & {

        /*
        |--------------------------------------------------------------------------
        | COMPATIBILIDADE
        |--------------------------------------------------------------------------
        */

        staffOnly?:
            boolean;


        /*
        |--------------------------------------------------------------------------
        | AUTOCOMPLETE
        |--------------------------------------------------------------------------
        */

        autocomplete?:
            (
                interaction:
                    AutocompleteInteraction
            ) => Promise<void>;
    };


export const commandMap =
    new Map<string, BotCommand>(

        commandList.map(
            command => [

                command.data.name,

                command as BotCommand
            ]
        )
    );


export const commands =
    commandList;