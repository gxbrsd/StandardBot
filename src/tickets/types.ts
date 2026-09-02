export type TicketChannelReferenceType =
    | 'category'
    | 'text';


export interface TicketChannelReference {

    /*
     * ID atual no Discord.
     *
     * Pode mudar depois de /modelo restaurar.
     */

    id:
        string | null;


    /*
     * Nome usado como fallback para recuperar
     * a referência quando o ID mudar.
     */

    name:
        string;


    type:
        TicketChannelReferenceType;
}


export interface TicketRoleReference {

    /*
     * ID atual do cargo.
     */

    id:
        string | null;


    /*
     * Nome usado para reencontrar o cargo
     * depois de uma restauração.
     */

    name:
        string;
}


export interface TicketConfig {

    /*
    |--------------------------------------------------------------------------
    | CATEGORIA
    |--------------------------------------------------------------------------
    */

    category:
        TicketChannelReference | null;


    /*
    |--------------------------------------------------------------------------
    | STAFF
    |--------------------------------------------------------------------------
    */

    staffRole:
        TicketRoleReference | null;


    /*
    |--------------------------------------------------------------------------
    | LOGS
    |--------------------------------------------------------------------------
    */

    logsChannel:
        TicketChannelReference | null;


    /*
    |--------------------------------------------------------------------------
    | PAINEL
    |--------------------------------------------------------------------------
    */

    panelChannel:
        TicketChannelReference | null;


    panelMessageId:
        string | null;


    /*
    |--------------------------------------------------------------------------
    | ATUALIZAÇÃO
    |--------------------------------------------------------------------------
    */

    updatedAt:
        string;
}


export interface ActiveTicket {

    /*
    |--------------------------------------------------------------------------
    | NÚMERO
    |--------------------------------------------------------------------------
    |
    | #0001
    | #0002
    | #0003
    |
    */

    sequence:
        number;


    /*
    |--------------------------------------------------------------------------
    | CANAL
    |--------------------------------------------------------------------------
    */

    channelId:
        string;


    channelName:
        string;


    /*
    |--------------------------------------------------------------------------
    | AUTOR
    |--------------------------------------------------------------------------
    */

    openerId:
        string;


    /*
    |--------------------------------------------------------------------------
    | DATA
    |--------------------------------------------------------------------------
    */

    openedAt:
        string;


    /*
    |--------------------------------------------------------------------------
    | ATENDENTE
    |--------------------------------------------------------------------------
    */

    claimedById:
        string | null;


    /*
    |--------------------------------------------------------------------------
    | USUÁRIOS ADICIONAIS
    |--------------------------------------------------------------------------
    */

    extraUserIds:
        string[];


    /*
    |--------------------------------------------------------------------------
    | MENSAGEM PRINCIPAL DO TICKET
    |--------------------------------------------------------------------------
    |
    | É a mensagem que contém:
    |
    | Atendimento #0001
    |
    | [ Assumir ticket ]
    | [ Fechar ticket ]
    |
    |
    | A partir de agora vamos salvar esse ID para conseguir:
    |
    | - atualizar a menção de @Staff;
    | - atualizar os botões;
    | - atualizar a embed;
    | - reparar a mensagem depois de /modelo restaurar.
    |
    |
    | O campo é opcional de propósito.
    |
    | Tickets criados antes desta atualização não possuem
    | messageId no JSON.
    |
    | Dessa forma eles continuam compatíveis.
    |
    */

    messageId?:
        string | null;
}


export interface TicketGuildData {

    schemaVersion:
        1;


    guildId:
        string;


    config:
        TicketConfig;


    activeTickets:
        ActiveTicket[];


    nextSequence:
        number;
}


export type TicketReferenceStatus =
    | 'not-configured'
    | 'ok'
    | 'repaired'
    | 'missing'
    | 'ambiguous';