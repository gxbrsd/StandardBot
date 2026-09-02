/*
|--------------------------------------------------------------------------
| CONTEÚDO DO MODELO
|--------------------------------------------------------------------------
*/

export type ConteudoModelo =
  | "estrutura"
  | "cargos"
  | "permissoes"
  | "estrutura-cargos"
  | "estrutura-permissoes"
  | "cargos-permissoes"
  | "completo";


export interface ModulosModelo {
  estrutura: boolean;
  cargos: boolean;
  permissoes: boolean;
}


/*
|--------------------------------------------------------------------------
| TIPOS DE CANAL SUPORTADOS
|--------------------------------------------------------------------------
*/

export type TipoCanalModelo =
  | "text"
  | "announcement"
  | "forum"
  | "voice"
  | "stage";


export type TipoAlvoPermissao =
  | "category"
  | TipoCanalModelo;


/*
|--------------------------------------------------------------------------
| ESTRUTURA
|--------------------------------------------------------------------------
*/

export interface CategoriaModelo {
  /*
   * Identificador interno do snapshot.
   *
   * Não é o ID que será usado no servidor novo.
   */
  key: string;

  name: string;

  position: number;
}


export interface CanalModelo {
  key: string;

  name: string;

  type: TipoCanalModelo;

  /*
   * null = canal sem categoria.
   */
  parentKey: string | null;

  position: number;

  /*
   * Configurações de texto/fórum.
   *
   * Para canais onde não se aplicam,
   * ficam com valores neutros.
   */
  topic: string | null;

  nsfw: boolean;

  rateLimitPerUser: number;

  /*
   * Configurações de voz.
   */
  bitrate: number;

  userLimit: number;

  rtcRegion: string | null;
}


export interface EstruturaModelo {
  categories: CategoriaModelo[];

  channels: CanalModelo[];

  /*
   * Configurações especiais do Discord.
   *
   * A key aponta para um CanalModelo.
   */
  rulesChannelKey: string | null;

  publicUpdatesChannelKey: string | null;

  systemChannelKey: string | null;

  afkChannelKey: string | null;

  safetyAlertsChannelKey: string | null;

  /*
   * Quantos tipos de canais que ainda não
   * suportamos foram ignorados ao salvar.
   */
  ignoredUnsupportedChannels: number;
}


/*
|--------------------------------------------------------------------------
| CARGOS
|--------------------------------------------------------------------------
*/

export interface CargoModelo {
  key: string;

  name: string;

  /*
   * Usada principalmente para preservar
   * a ordem relativa dos cargos.
   */
  position: number;

  color: number;

  hoist: boolean;

  mentionable: boolean;

  unicodeEmoji: string | null;
}


export interface CargosModelo {
  roles: CargoModelo[];

  /*
   * Cargos managed:
   *
   * - cargos de bot
   * - integrações
   * - booster
   * - etc.
   *
   * não são recriados pelo sistema.
   */
  ignoredManagedRoles: number;
}


/*
|--------------------------------------------------------------------------
| REFERÊNCIAS PARA PERMISSÕES
|--------------------------------------------------------------------------
*/

export interface ReferenciaCargoPermissao {
  roleKey: string;

  roleName: string;

  rolePosition: number;
}


export interface ReferenciaCanalPermissao {
  channelKey: string;

  channelName: string;

  channelType: TipoAlvoPermissao;

  position: number;

  parentName: string | null;

  parentPosition: number | null;
}


/*
|--------------------------------------------------------------------------
| PERMISSÕES GLOBAIS DOS CARGOS
|--------------------------------------------------------------------------
*/

export interface PermissaoCargoModelo
  extends ReferenciaCargoPermissao {
  /*
   * BigInt não pode ser serializado diretamente
   * em JSON, então salvamos como string.
   */
  permissions: string;
}


/*
|--------------------------------------------------------------------------
| PERMISSION OVERWRITES
|--------------------------------------------------------------------------
*/

export type TipoSujeitoPermissao =
  | "everyone"
  | "role"
  | "member";


export interface OverwriteModelo {
  subjectType: TipoSujeitoPermissao;

  /*
   * Para cargo:
   * role:<id-antigo>
   *
   * Para @everyone:
   * @everyone
   *
   * Para membro:
   * member:<id>
   */
  subjectKey: string;

  subjectName: string;

  /*
   * Útil principalmente para membro.
   *
   * Em outro servidor o ID pode não existir,
   * portanto ele poderá ser ignorado.
   */
  sourceId: string;

  /*
   * Só tem significado para cargo.
   */
  rolePosition: number;

  allow: string;

  deny: string;
}


export interface OverwritesCanalModelo {
  target: ReferenciaCanalPermissao;

  /*
   * Pode estar vazio.
   *
   * Isso é importante:
   * vazio significa "este canal não tinha
   * overwrites no momento do snapshot".
   */
  entries: OverwriteModelo[];
}


/*
|--------------------------------------------------------------------------
| MÓDULO DE PERMISSÕES
|--------------------------------------------------------------------------
*/

export interface PermissoesModelo {
  /*
   * Permissões globais do @everyone.
   */
  everyonePermissions: string;

  /*
   * Permissões globais dos cargos normais.
   */
  roles: PermissaoCargoModelo[];

  /*
   * Permissões específicas de canais/categorias.
   */
  channelOverwrites: OverwritesCanalModelo[];

  /*
   * Overwrites de cargos managed não são
   * portáveis entre servidores.
   */
  ignoredManagedRoleOverwrites: number;
}


/*
|--------------------------------------------------------------------------
| MODELO COMPLETO
|--------------------------------------------------------------------------
*/

export interface ModeloServidor {
  schemaVersion: 1;

  id: string;

  nome: string;

  criadoPor: string;

  criadoEm: string;

  atualizadoEm: string;

  /*
   * Servidor onde o snapshot nasceu.
   */
  origemGuildId: string;

  origemGuildNome: string;

  /*
   * Backup automático criado antes de restaurar?
   */
  automatico: boolean;

  modulos: ModulosModelo;

  estrutura: EstruturaModelo | null;

  cargos: CargosModelo | null;

  permissoes: PermissoesModelo | null;

  avisos: string[];
}


/*
|--------------------------------------------------------------------------
| RESULTADO DA RESTAURAÇÃO
|--------------------------------------------------------------------------
*/

export interface ResultadoRestauracao {
  deletedChannels: number;

  createdCategories: number;

  createdChannels: number;

  deletedRoles: number;

  createdRoles: number;

  protectedRoles: number;

  rolePermissionsApplied: number;

  channelPermissionsApplied: number;

  skippedPermissions: number;

  warnings: string[];
}