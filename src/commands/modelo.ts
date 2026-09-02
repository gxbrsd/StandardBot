import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
} from "discord.js";

import {
  capturarModelo,
  conteudoLabel,
  conteudoParaModulos,
  criarNomeBackupAutomatico,
  isConteudoModelo,
  restaurarModelo,
  validarRestauracao,
} from "../services/modelo-engine.js";

import {
  buscarModeloPorNome,
  excluirModelo,
  listarModelos,
  salvarModelo,
} from "../services/modelo-store.js";

import type {
  ConteudoModelo,
  ModeloServidor,
  ModulosModelo,
} from "../modelos/types.js";


/*
|--------------------------------------------------------------------------
| EMBED
|--------------------------------------------------------------------------
*/

function baseEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(
      0x2b2d31,
    );
}


/*
|--------------------------------------------------------------------------
| ERRO -> TEXTO
|--------------------------------------------------------------------------
*/

function errorText(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return String(error);
}


/*
|--------------------------------------------------------------------------
| IMPORTANTE: TODA INTERAÇÃO /MODELO É ADIADA IMEDIATAMENTE
|--------------------------------------------------------------------------
|
| O Discord exige que uma interação seja reconhecida rapidamente.
|
| Alguns comandos deste sistema fazem:
|
| - leitura de arquivos
| - guild.channels.fetch()
| - guild.roles.fetch()
| - validações
| - backups
|
| Isso pode levar mais do que o tempo permitido para o primeiro reply.
|
| Por isso, execute() chama deferReply() ANTES de qualquer trabalho pesado.
|
| Depois disso, todas as respostas deste arquivo usam editReply().
|
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| PARSE DO CONTEÚDO
|--------------------------------------------------------------------------
*/

function getConteudo(
  interaction:
    ChatInputCommandInteraction,
): ConteudoModelo {
  const value =
    interaction.options
      .getString(
        "conteudo",
        true,
      );

  if (
    !isConteudoModelo(
      value,
    )
  ) {
    throw new Error(
      "Conteúdo de modelo inválido.",
    );
  }

  return value;
}


/*
|--------------------------------------------------------------------------
| FORMATAÇÃO DOS MÓDULOS
|--------------------------------------------------------------------------
*/

function formatModules(
  modules: ModulosModelo,
): string {
  return [
    `${modules.estrutura ? "✓" : "✗"} Estrutura`,
    `${modules.cargos ? "✓" : "✗"} Cargos`,
    `${modules.permissoes ? "✓" : "✗"} Permissões`,
  ].join(
    "\n",
  );
}


/*
|--------------------------------------------------------------------------
| CONFIRMAÇÃO
|--------------------------------------------------------------------------
|
| Como /modelo já foi deferido em execute(),
| aqui NÃO usamos interaction.reply().
|
| Usamos editReply() no placeholder criado pelo deferReply().
|
|--------------------------------------------------------------------------
*/

async function confirmAction(
  interaction:
    ChatInputCommandInteraction,
  title: string,
  description: string,
  confirmLabel: string,
  danger: boolean,
): Promise<boolean> {
  const confirmId =
    `modelo-confirm-${interaction.id}`;

  const cancelId =
    `modelo-cancel-${interaction.id}`;

  const confirm =
    new ButtonBuilder()
      .setCustomId(
        confirmId,
      )
      .setLabel(
        confirmLabel,
      )
      .setStyle(
        danger
          ? ButtonStyle.Danger
          : ButtonStyle.Success,
      );

  const cancel =
    new ButtonBuilder()
      .setCustomId(
        cancelId,
      )
      .setLabel(
        "Cancelar",
      )
      .setStyle(
        ButtonStyle.Secondary,
      );

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        confirm,
        cancel,
      );

  await interaction.editReply({
    embeds: [
      baseEmbed()
        .setTitle(
          title,
        )
        .setDescription(
          description,
        ),
    ],

    components: [
      row,
    ],
  });

  const message =
    await interaction.fetchReply();

  let button:
    ButtonInteraction;

  try {
    button =
      await message
        .awaitMessageComponent({
          componentType:
            ComponentType.Button,

          filter:
            (component) =>
              component.user.id ===
                interaction.user.id &&
              (
                component.customId ===
                  confirmId ||
                component.customId ===
                  cancelId
              ),

          time:
            60_000,
        });
  } catch {
    await interaction.editReply({
      embeds: [
        baseEmbed()
          .setTitle(
            "Operação cancelada",
          )
          .setDescription(
            "O tempo para confirmar terminou.",
          ),
      ],

      components: [],
    });

    return false;
  }

  /*
   * O clique no botão também é uma interação e precisa
   * ser reconhecido rapidamente.
   */
  await button.deferUpdate();

  if (
    button.customId ===
    cancelId
  ) {
    await interaction.editReply({
      embeds: [
        baseEmbed()
          .setTitle(
            "Cancelado",
          )
          .setDescription(
            "Nada foi alterado.",
          ),
      ],

      components: [],
    });

    return false;
  }

  return true;
}


/*
|--------------------------------------------------------------------------
| /MODELO SALVAR
|--------------------------------------------------------------------------
*/

async function saveCommand(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  const guild =
    interaction.guild;

  if (!guild) {
    await interaction.editReply({
      content:
        "Este comando só funciona dentro de um servidor.",
    });

    return;
  }

  try {
    const nome =
      interaction.options
        .getString(
          "nome",
          true,
        );

    const conteudo =
      getConteudo(
        interaction,
      );

    const modules =
      conteudoParaModulos(
        conteudo,
      );

    const substituir =
      interaction.options
        .getBoolean(
          "substituir",
        ) ?? false;

    const model =
      await capturarModelo(
        guild,
        interaction.user.id,
        nome,
        modules,
        false,
      );

    const saved =
      await salvarModelo(
        interaction.user.id,
        model,
        substituir,
      );

    const lines = [
      `Modelo: **${saved.nome}**`,
      "",
      `Conteúdo: **${conteudoLabel(conteudo)}**`,
      "",
      formatModules(
        saved.modulos,
      ),
      "",
      `Servidor de origem: **${saved.origemGuildNome}**`,
    ];

    if (
      saved.estrutura
    ) {
      lines.push(
        "",
        `Categorias: **${saved.estrutura.categories.length}**`,
        `Canais: **${saved.estrutura.channels.length}**`,
      );
    }

    if (
      saved.cargos
    ) {
      lines.push(
        `Cargos: **${saved.cargos.roles.length}**`,
      );
    }

    if (
      saved.permissoes
    ) {
      lines.push(
        `Cargos com permissões: **${saved.permissoes.roles.length + 1}**`,
        `Alvos de overwrites: **${saved.permissoes.channelOverwrites.length}**`,
      );
    }

    if (
      saved.avisos.length >
      0
    ) {
      lines.push(
        "",
        "**Avisos:**",
        ...saved.avisos
          .slice(
            0,
            5,
          )
          .map(
            (warning) =>
              `• ${warning}`,
          ),
      );
    }

    await interaction.editReply({
      embeds: [
        baseEmbed()
          .setTitle(
            substituir
              ? "Modelo atualizado"
              : "Modelo salvo",
          )
          .setDescription(
            lines.join(
              "\n",
            ),
          ),
      ],
    });
  } catch (error) {
    console.error(
      "[MODELO] Erro ao salvar:",
      error,
    );

    await interaction.editReply({
      embeds: [
        baseEmbed()
          .setTitle(
            "Não foi possível salvar",
          )
          .setDescription(
            errorText(
              error,
            ).slice(
              0,
              3500,
            ),
          ),
      ],

      components: [],
    });
  }
}


/*
|--------------------------------------------------------------------------
| /MODELO LISTAR
|--------------------------------------------------------------------------
*/

async function listCommand(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  try {
    const models =
      await listarModelos(
        interaction.user.id,
      );

    if (
      models.length ===
      0
    ) {
      await interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle(
              "Seus modelos",
            )
            .setDescription(
              [
                "Você ainda não salvou nenhum modelo.",
                "",
                "Use:",
                "",
                "`/modelo salvar`",
              ].join("\n"),
            ),
        ],
      });

      return;
    }

    const lines:
      string[] = [];

    for (
      const model
      of models.slice(
        0,
        20,
      )
    ) {
      const labels:
        string[] = [];

      if (
        model.modulos
          .estrutura
      ) {
        labels.push(
          "estrutura",
        );
      }

      if (
        model.modulos
          .cargos
      ) {
        labels.push(
          "cargos",
        );
      }

      if (
        model.modulos
          .permissoes
      ) {
        labels.push(
          "permissões",
        );
      }

      lines.push(
        `${model.automatico ? "↩ " : ""}**${model.nome}**`,
        `${labels.join(" + ")} • origem: ${model.origemGuildNome}`,
        `<t:${Math.floor(
          new Date(
            model.atualizadoEm,
          ).getTime() /
          1000
        )}:R>`,
        "",
      );
    }

    if (
      models.length >
      20
    ) {
      lines.push(
        `...e mais **${models.length - 20}** modelo(s).`,
      );
    }

    lines.push(
      "",
      "↩ = backup automático",
    );

    await interaction.editReply({
      embeds: [
        baseEmbed()
          .setTitle(
            `Seus modelos — ${models.length}`,
          )
          .setDescription(
            lines.join(
              "\n",
            ),
          ),
      ],
    });
  } catch (error) {
    console.error(
      "[MODELO] Erro ao listar:",
      error,
    );

    await interaction.editReply({
      embeds: [
        baseEmbed()
          .setTitle(
            "Não foi possível listar",
          )
          .setDescription(
            errorText(
              error,
            ).slice(
              0,
              3500,
            ),
          ),
      ],
    });
  }
}


/*
|--------------------------------------------------------------------------
| TEXTO DOS DETALHES
|--------------------------------------------------------------------------
*/

function modelDetails(
  model: ModeloServidor,
): string {
  const lines = [
    `**${model.nome}**`,
    "",
    `Origem: **${model.origemGuildNome}**`,
    `Salvo: <t:${Math.floor(
      new Date(
        model.atualizadoEm,
      ).getTime() /
      1000
    )}:F>`,
    "",
    "**Conteúdo disponível**",
    formatModules(
      model.modulos,
    ),
  ];

  if (
    model.estrutura
  ) {
    const structure =
      model.estrutura;

    const text =
      structure.channels.filter(
        (channel) =>
          channel.type ===
            "text" ||
          channel.type ===
            "announcement",
      ).length;

    const forums =
      structure.channels.filter(
        (channel) =>
          channel.type ===
          "forum",
      ).length;

    const voices =
      structure.channels.filter(
        (channel) =>
          channel.type ===
            "voice" ||
          channel.type ===
            "stage",
      ).length;

    lines.push(
      "",
      "**Estrutura**",
      `Categorias: **${structure.categories.length}**`,
      `Texto/anúncios: **${text}**`,
      `Fóruns: **${forums}**`,
      `Voz/palco: **${voices}**`,
    );
  }

  if (
    model.cargos
  ) {
    lines.push(
      "",
      "**Cargos**",
      `Cargos comuns: **${model.cargos.roles.length}**`,
      `Managed ignorados: **${model.cargos.ignoredManagedRoles}**`,
    );
  }

  if (
    model.permissoes
  ) {
    lines.push(
      "",
      "**Permissões**",
      `Configurações globais: **${model.permissoes.roles.length + 1}**`,
      `Categorias/canais registrados: **${model.permissoes.channelOverwrites.length}**`,
      `Overwrites managed ignorados: **${model.permissoes.ignoredManagedRoleOverwrites}**`,
    );
  }

  if (
    model.avisos.length >
    0
  ) {
    lines.push(
      "",
      "**Avisos do snapshot**",
      ...model.avisos
        .slice(
          0,
          6,
        )
        .map(
          (warning) =>
            `• ${warning}`,
        ),
    );
  }

  return lines.join(
    "\n",
  );
}


/*
|--------------------------------------------------------------------------
| /MODELO DETALHES
|--------------------------------------------------------------------------
*/

async function detailsCommand(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  try {
    const nome =
      interaction.options
        .getString(
          "nome",
          true,
        );

    const model =
      await buscarModeloPorNome(
        interaction.user.id,
        nome,
      );

    if (!model) {
      await interaction.editReply({
        content:
          `Não encontrei o modelo "${nome}". Use \`/modelo listar\`.`,
      });

      return;
    }

    await interaction.editReply({
      embeds: [
        baseEmbed()
          .setTitle(
            "Detalhes do modelo",
          )
          .setDescription(
            modelDetails(
              model,
            ),
          ),
      ],
    });
  } catch (error) {
    console.error(
      "[MODELO] Erro nos detalhes:",
      error,
    );

    await interaction.editReply({
      embeds: [
        baseEmbed()
          .setTitle(
            "Não foi possível abrir o modelo",
          )
          .setDescription(
            errorText(
              error,
            ).slice(
              0,
              3500,
            ),
          ),
      ],
    });
  }
}


/*
|--------------------------------------------------------------------------
| PREVIEW DA RESTAURAÇÃO
|--------------------------------------------------------------------------
*/

function restorePreview(
  model: ModeloServidor,
  conteudo: ConteudoModelo,
  modules: ModulosModelo,
): string {
  const lines = [
    `Modelo: **${model.nome}**`,
    `Origem: **${model.origemGuildNome}**`,
    "",
    `Será restaurado: **${conteudoLabel(conteudo)}**`,
    "",
    formatModules(
      modules,
    ),
    "",
  ];

  if (
    modules.estrutura
  ) {
    lines.push(
      "⚠ **ESTRUTURA**",
      "A estrutura atual será substituída pela estrutura do snapshot.",
      "As mensagens dos canais removidos serão perdidas.",
      "Os IDs de canais recriados mudarão.",
      "",
      "Como permissões são um módulo separado, a estrutura é criada inicialmente **sem permission overwrites do snapshot**.",
      "",
    );
  }

  if (
    modules.cargos
  ) {
    lines.push(
      "⚠ **CARGOS**",
      "Cargos comuns que o bot pode gerenciar serão removidos e recriados.",
      "Cargos do próprio bot, integrações e outros cargos managed são protegidos.",
      "",
      "Os cargos recriados começam com **permissões globais = 0**.",
      "",
    );
  }

  if (
    modules.permissoes
  ) {
    lines.push(
      "**PERMISSÕES**",
      "As permissões globais dos cargos serão restauradas.",
      "Os permission overwrites salvos substituirão os overwrites dos canais correspondentes.",
      "",
    );
  }

  if (
    modules.cargos &&
    !modules.permissoes
  ) {
    lines.push(
      "Observação: ao recriar cargos sem o módulo de permissões, eles ficarão sem permissões globais.",
      "",
    );
  }

  lines.push(
    "✓ Antes de qualquer alteração será criado um **backup automático completo** do estado atual.",
  );

  return lines.join(
    "\n",
  );
}


/*
|--------------------------------------------------------------------------
| /MODELO RESTAURAR
|--------------------------------------------------------------------------
*/

async function restoreCommand(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  const guild =
    interaction.guild;

  if (!guild) {
    await interaction.editReply({
      content:
        "Este comando só funciona dentro de um servidor.",
    });

    return;
  }

  try {
    const nome =
      interaction.options
        .getString(
          "nome",
          true,
        );

    /*
     * Agora isso pode demorar quanto precisar:
     * execute() já reconheceu a interação com deferReply().
     */
    const model =
      await buscarModeloPorNome(
        interaction.user.id,
        nome,
      );

    if (!model) {
      await interaction.editReply({
        content:
          `Não encontrei o modelo "${nome}". Use \`/modelo listar\`.`,
      });

      return;
    }

    const conteudo =
      getConteudo(
        interaction,
      );

    const modules =
      conteudoParaModulos(
        conteudo,
      );

    /*
     * Essa validação faz requests ao Discord.
     * Antes ela acontecia ANTES do primeiro reply
     * e podia gerar DiscordAPIError[10062].
     *
     * Agora a interação já está deferida.
     */
    await validarRestauracao(
      guild,
      model,
      modules,
    );

    const confirmed =
      await confirmAction(
        interaction,

        `Restaurar "${model.nome}"?`,

        restorePreview(
          model,
          conteudo,
          modules,
        ),

        "Restaurar modelo",

        true,
      );

    if (!confirmed) {
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | BACKUP AUTOMÁTICO
    |--------------------------------------------------------------------------
    */

    await interaction.editReply({
      embeds: [
        baseEmbed()
          .setTitle(
            "Criando backup",
          )
          .setDescription(
            "Salvando o estado atual antes da restauração...",
          ),
      ],

      components: [],
    });

    const backupName =
      criarNomeBackupAutomatico();

    const backup =
      await capturarModelo(
        guild,
        interaction.user.id,
        backupName,
        {
          estrutura: true,
          cargos: true,
          permissoes: true,
        },
        true,
      );

    await salvarModelo(
      interaction.user.id,
      backup,
      false,
    );

    /*
    |--------------------------------------------------------------------------
    | RESTAURAÇÃO
    |--------------------------------------------------------------------------
    */

    await interaction.editReply({
      embeds: [
        baseEmbed()
          .setTitle(
            "Restaurando servidor",
          )
          .setDescription(
            [
              `Backup criado: **${backupName}**`,
              "",
              `Restaurando **${conteudoLabel(conteudo)}** do modelo **${model.nome}**...`,
              "",
              "Não interrompa o bot.",
            ].join("\n"),
          ),
      ],

      components: [],
    });

    console.log(
      `[MODELO] Iniciando restauração "${model.nome}" (${conteudoLabel(conteudo)}).`,
    );

    const result =
      await restaurarModelo(
        guild,
        model,
        modules,
      );

    const lines = [
      `Modelo: **${model.nome}**`,
      `Conteúdo: **${conteudoLabel(conteudo)}**`,
      "",
      `Backup anterior: **${backupName}**`,
    ];

    if (
      modules.estrutura
    ) {
      lines.push(
        "",
        "**Estrutura**",
        `Itens antigos apagados: **${result.deletedChannels}**`,
        `Categorias criadas: **${result.createdCategories}**`,
        `Canais criados: **${result.createdChannels}**`,
      );
    }

    if (
      modules.cargos
    ) {
      lines.push(
        "",
        "**Cargos**",
        `Cargos antigos apagados: **${result.deletedRoles}**`,
        `Cargos criados: **${result.createdRoles}**`,
        `Cargos protegidos: **${result.protectedRoles}**`,
      );
    }

    if (
      modules.permissoes
    ) {
      lines.push(
        "",
        "**Permissões**",
        `Permissões globais aplicadas: **${result.rolePermissionsApplied}**`,
        `Canais/categorias configurados: **${result.channelPermissionsApplied}**`,
        `Itens ignorados: **${result.skippedPermissions}**`,
      );
    }

    if (
      result.warnings.length >
      0
    ) {
      lines.push(
        "",
        "**Avisos**",
        ...result.warnings
          .slice(
            0,
            8,
          )
          .map(
            (warning) =>
              `• ${warning}`,
          ),
      );
    }

    await interaction.editReply({
      embeds: [
        baseEmbed()
          .setTitle(
            "Modelo restaurado",
          )
          .setDescription(
            lines.join(
              "\n",
            ),
          ),
      ],

      components: [],
    });

    console.log(
      `[MODELO] Restauração "${model.nome}" concluída.`,
    );
  } catch (error) {
    console.error(
      "[MODELO] Erro na restauração:",
      error,
    );

    /*
     * A interação já foi deferida, portanto nunca usamos reply()
     * aqui. Isso evita o erro 40060:
     * "Interaction has already been acknowledged."
     */
    try {
      await interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle(
              "A restauração parou",
            )
            .setDescription(
              [
                errorText(
                  error,
                ).slice(
                  0,
                  3000,
                ),
                "",
                "Se um backup automático chegou a ser criado, ele continua disponível em `/modelo listar`.",
              ].join("\n"),
            ),
        ],

        components: [],
      });
    } catch (
      responseError
    ) {
      /*
       * Não deixamos um erro ao RESPONDER derrubar o processo do bot.
       */
      console.error(
        "[MODELO] Também não consegui atualizar a mensagem de erro:",
        responseError,
      );
    }
  }
}


/*
|--------------------------------------------------------------------------
| /MODELO EXCLUIR
|--------------------------------------------------------------------------
*/

async function deleteCommand(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  try {
    const nome =
      interaction.options
        .getString(
          "nome",
          true,
        );

    const model =
      await buscarModeloPorNome(
        interaction.user.id,
        nome,
      );

    if (!model) {
      await interaction.editReply({
        content:
          `Não encontrei o modelo "${nome}".`,
      });

      return;
    }

    const confirmed =
      await confirmAction(
        interaction,

        `Excluir "${model.nome}"?`,

        [
          "Isso **não altera o servidor**.",
          "",
          "Apenas remove este snapshot da sua biblioteca de modelos.",
          "",
          "Depois de excluído, ele não poderá mais ser restaurado.",
        ].join("\n"),

        "Excluir modelo",

        true,
      );

    if (!confirmed) {
      return;
    }

    await excluirModelo(
      interaction.user.id,
      model.id,
    );

    await interaction.editReply({
      embeds: [
        baseEmbed()
          .setTitle(
            "Modelo excluído",
          )
          .setDescription(
            `O modelo **${model.nome}** foi removido da biblioteca.`,
          ),
      ],

      components: [],
    });
  } catch (error) {
    console.error(
      "[MODELO] Erro ao excluir:",
      error,
    );

    try {
      await interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle(
              "Não foi possível excluir",
            )
            .setDescription(
              errorText(
                error,
              ).slice(
                0,
                3500,
              ),
            ),
        ],

        components: [],
      });
    } catch (
      responseError
    ) {
      console.error(
        "[MODELO] Também não consegui atualizar a mensagem de erro:",
        responseError,
      );
    }
  }
}



/*
|--------------------------------------------------------------------------
| /MODELO LIMPAR-BACKUPS
|--------------------------------------------------------------------------
|
| Remove somente snapshots marcados como automatico: true.
|
| "manter" permite conservar os N backups automáticos mais recentes.
|
| Exemplos:
|
| /modelo limpar-backups
| -> apaga todos os backups automáticos
|
| /modelo limpar-backups manter:3
| -> mantém os 3 backups automáticos mais recentes
|
|--------------------------------------------------------------------------
*/

async function cleanupBackupsCommand(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  try {
    const manter =
      interaction.options
        .getInteger(
          "manter",
        ) ?? 0;

    const models =
      await listarModelos(
        interaction.user.id,
      );

    /*
     * listarModelos() já entrega os modelos do mais
     * recentemente atualizado para o mais antigo.
     */
    const backups =
      models.filter(
        (model) =>
          model.automatico,
      );

    const toDelete =
      backups.slice(
        manter,
      );

    if (
      toDelete.length ===
      0
    ) {
      await interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle(
              "Nenhum backup para apagar",
            )
            .setDescription(
              backups.length === 0
                ? "Você não possui backups automáticos salvos."
                : `Você possui **${backups.length}** backup(s) automático(s), e todos estão dentro da quantidade escolhida para manter.`,
            ),
        ],

        components: [],
      });

      return;
    }

    const confirmed =
      await confirmAction(
        interaction,

        "Limpar backups automáticos?",

        [
          `Backups encontrados: **${backups.length}**`,
          `Backups que serão mantidos: **${Math.min(manter, backups.length)}**`,
          `Backups que serão excluídos: **${toDelete.length}**`,
          "",
          "Isso **não altera nenhum servidor**.",
          "",
          "Somente os snapshots automáticos serão removidos.",
          "Modelos criados manualmente não serão tocados.",
        ].join("\n"),

        "Limpar backups",

        true,
      );

    if (!confirmed) {
      return;
    }

    let deleted =
      0;

    let failed =
      0;

    for (
      const model
      of toDelete
    ) {
      try {
        await excluirModelo(
          interaction.user.id,
          model.id,
        );

        deleted++;
      } catch (error) {
        failed++;

        console.error(
          `[MODELO] Não consegui excluir o backup "${model.nome}":`,
          error,
        );
      }
    }

    await interaction.editReply({
      embeds: [
        baseEmbed()
          .setTitle(
            failed === 0
              ? "Backups limpos"
              : "Limpeza concluída com avisos",
          )
          .setDescription(
            [
              `Excluídos: **${deleted}**`,
              `Mantidos: **${Math.min(manter, backups.length)}**`,
              `Falharam: **${failed}**`,
              "",
              "Seus modelos manuais continuam intactos.",
            ].join("\n"),
          ),
      ],

      components: [],
    });
  } catch (error) {
    console.error(
      "[MODELO] Erro limpando backups:",
      error,
    );

    try {
      await interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle(
              "Não foi possível limpar os backups",
            )
            .setDescription(
              errorText(
                error,
              ).slice(
                0,
                3500,
              ),
            ),
        ],

        components: [],
      });
    } catch (
      responseError
    ) {
      console.error(
        "[MODELO] Também não consegui atualizar a mensagem de erro:",
        responseError,
      );
    }
  }
}


/*
|--------------------------------------------------------------------------
| AUTOCOMPLETE DOS NOMES
|--------------------------------------------------------------------------
|
| Permite:
|
| /modelo excluir nome:[digita]
| /modelo detalhes nome:[digita]
| /modelo restaurar nome:[digita]
|
| O Discord mostra até 25 sugestões.
|--------------------------------------------------------------------------
*/

async function autocompleteModelName(
  interaction:
    AutocompleteInteraction,
): Promise<void> {
  try {
    const subcommand =
      interaction.options
        .getSubcommand();

    if (
      subcommand !== "detalhes" &&
      subcommand !== "restaurar" &&
      subcommand !== "excluir"
    ) {
      await interaction.respond(
        [],
      );

      return;
    }

    const focused =
      interaction.options
        .getFocused(
          true,
        );

    if (
      focused.name !==
      "nome"
    ) {
      await interaction.respond(
        [],
      );

      return;
    }

    const typed =
      String(
        focused.value,
      )
        .trim()
        .toLocaleLowerCase();

    const models =
      await listarModelos(
        interaction.user.id,
      );

    const filtered =
      models
        .filter(
          (model) =>
            typed.length === 0 ||
            model.nome
              .toLocaleLowerCase()
              .includes(
                typed,
              ),
        )
        .sort(
          (a, b) => {
            const aName =
              a.nome
                .toLocaleLowerCase();

            const bName =
              b.nome
                .toLocaleLowerCase();

            const aStarts =
              typed.length > 0 &&
              aName.startsWith(
                typed,
              );

            const bStarts =
              typed.length > 0 &&
              bName.startsWith(
                typed,
              );

            if (
              aStarts !==
              bStarts
            ) {
              return aStarts
                ? -1
                : 1;
            }

            /*
             * Ao excluir, backups aparecem primeiro.
             * Isso facilita limpar um backup específico.
             */
            if (
              subcommand ===
                "excluir" &&
              a.automatico !==
                b.automatico
            ) {
              return a.automatico
                ? -1
                : 1;
            }

            return (
              new Date(
                b.atualizadoEm,
              ).getTime() -
              new Date(
                a.atualizadoEm,
              ).getTime()
            );
          },
        )
        .slice(
          0,
          25,
        );

    await interaction.respond(
      filtered.map(
        (model) => ({
          name:
            `${model.automatico ? "↩ " : ""}${model.nome}`.slice(
              0,
              100,
            ),

          value:
            model.nome.slice(
              0,
              100,
            ),
        }),
      ),
    );
  } catch (error) {
    console.error(
      "[MODELO] Erro no autocomplete:",
      error,
    );

    /*
     * Autocomplete não possui deferReply.
     * Se ainda for possível responder, retornamos lista vazia.
     */
    try {
      await interaction.respond(
        [],
      );
    } catch {
      // Nada a fazer.
    }
  }
}


/*
|--------------------------------------------------------------------------
| COMANDO /MODELO
|--------------------------------------------------------------------------
*/

export const modeloCommand = {
  data:
    new SlashCommandBuilder()
      .setName(
        "modelo",
      )
      .setDescription(
        "Salva e restaura modelos do servidor.",
      )


      /*
      |--------------------------------------------------------------------------
      | /modelo salvar
      |--------------------------------------------------------------------------
      */

      .addSubcommand(
        (subcommand) =>
          subcommand
            .setName(
              "salvar",
            )
            .setDescription(
              "Salva o estado atual como um modelo.",
            )

            .addStringOption(
              (option) =>
                option
                  .setName(
                    "nome",
                  )
                  .setDescription(
                    "Nome do modelo.",
                  )
                  .setMinLength(
                    1,
                  )
                  .setMaxLength(
                    50,
                  )
                  .setRequired(
                    true,
                  ),
            )

            .addStringOption(
              (option) =>
                option
                  .setName(
                    "conteudo",
                  )
                  .setDescription(
                    "O que será salvo no modelo.",
                  )
                  .setRequired(
                    true,
                  )
                  .addChoices(
                    {
                      name:
                        "Somente estrutura",
                      value:
                        "estrutura",
                    },
                    {
                      name:
                        "Somente cargos",
                      value:
                        "cargos",
                    },
                    {
                      name:
                        "Somente permissões",
                      value:
                        "permissoes",
                    },
                    {
                      name:
                        "Estrutura + cargos",
                      value:
                        "estrutura-cargos",
                    },
                    {
                      name:
                        "Estrutura + permissões",
                      value:
                        "estrutura-permissoes",
                    },
                    {
                      name:
                        "Cargos + permissões",
                      value:
                        "cargos-permissoes",
                    },
                    {
                      name:
                        "Modelo completo",
                      value:
                        "completo",
                    },
                  ),
            )

            .addBooleanOption(
              (option) =>
                option
                  .setName(
                    "substituir",
                  )
                  .setDescription(
                    "Sobrescreve um modelo com o mesmo nome.",
                  )
                  .setRequired(
                    false,
                  ),
            ),
      )


      /*
      |--------------------------------------------------------------------------
      | /modelo listar
      |--------------------------------------------------------------------------
      */

      .addSubcommand(
        (subcommand) =>
          subcommand
            .setName(
              "listar",
            )
            .setDescription(
              "Mostra todos os seus modelos salvos.",
            ),
      )


      /*
      |--------------------------------------------------------------------------
      | /modelo detalhes
      |--------------------------------------------------------------------------
      */

      .addSubcommand(
        (subcommand) =>
          subcommand
            .setName(
              "detalhes",
            )
            .setDescription(
              "Mostra o conteúdo de um modelo.",
            )

            .addStringOption(
              (option) =>
                option
                  .setName(
                    "nome",
                  )
                  .setDescription(
                    "Nome exato do modelo.",
                  )
                  .setAutocomplete(
                    true,
                  )
                  .setRequired(
                    true,
                  ),
            ),
      )


      /*
      |--------------------------------------------------------------------------
      | /modelo restaurar
      |--------------------------------------------------------------------------
      */

      .addSubcommand(
        (subcommand) =>
          subcommand
            .setName(
              "restaurar",
            )
            .setDescription(
              "Restaura partes de um modelo no servidor.",
            )

            .addStringOption(
              (option) =>
                option
                  .setName(
                    "nome",
                  )
                  .setDescription(
                    "Modelo que será restaurado.",
                  )
                  .setAutocomplete(
                    true,
                  )
                  .setRequired(
                    true,
                  ),
            )

            .addStringOption(
              (option) =>
                option
                  .setName(
                    "conteudo",
                  )
                  .setDescription(
                    "Quais módulos serão restaurados.",
                  )
                  .setRequired(
                    true,
                  )
                  .addChoices(
                    {
                      name:
                        "Somente estrutura",
                      value:
                        "estrutura",
                    },
                    {
                      name:
                        "Somente cargos",
                      value:
                        "cargos",
                    },
                    {
                      name:
                        "Somente permissões",
                      value:
                        "permissoes",
                    },
                    {
                      name:
                        "Estrutura + cargos",
                      value:
                        "estrutura-cargos",
                    },
                    {
                      name:
                        "Estrutura + permissões",
                      value:
                        "estrutura-permissoes",
                    },
                    {
                      name:
                        "Cargos + permissões",
                      value:
                        "cargos-permissoes",
                    },
                    {
                      name:
                        "Modelo completo",
                      value:
                        "completo",
                    },
                  ),
            ),
      )


      /*
      |--------------------------------------------------------------------------
      | /modelo excluir
      |--------------------------------------------------------------------------
      */

      .addSubcommand(
        (subcommand) =>
          subcommand
            .setName(
              "excluir",
            )
            .setDescription(
              "Exclui um modelo salvo.",
            )

            .addStringOption(
              (option) =>
                option
                  .setName(
                    "nome",
                  )
                  .setDescription(
                    "Modelo que será excluído.",
                  )
                  .setAutocomplete(
                    true,
                  )
                  .setRequired(
                    true,
                  ),
            ),
      )

      /*
      |--------------------------------------------------------------------------
      | /modelo limpar-backups
      |--------------------------------------------------------------------------
      */

      .addSubcommand(
        (subcommand) =>
          subcommand
            .setName(
              "limpar-backups",
            )
            .setDescription(
              "Exclui backups automáticos salvos.",
            )

            .addIntegerOption(
              (option) =>
                option
                  .setName(
                    "manter",
                  )
                  .setDescription(
                    "Quantos backups automáticos recentes devem ser mantidos.",
                  )
                  .setMinValue(
                    0,
                  )
                  .setMaxValue(
                    20,
                  )
                  .setRequired(
                    false,
                  ),
            ),
      ),




  /*
  |--------------------------------------------------------------------------
  | SISTEMA DE STAFF EXISTENTE
  |--------------------------------------------------------------------------
  */

  staffOnly:
    true,




  /*
  |--------------------------------------------------------------------------
  | AUTOCOMPLETE
  |--------------------------------------------------------------------------
  */

  async autocomplete(
    interaction:
      AutocompleteInteraction,
  ): Promise<void> {
    await autocompleteModelName(
      interaction,
    );
  },


  /*
  |--------------------------------------------------------------------------
  | EXECUTE
  |--------------------------------------------------------------------------
  */

  async execute(
    interaction:
      ChatInputCommandInteraction,
  ): Promise<void> {
    /*
     * ESTE É O PONTO PRINCIPAL DA CORREÇÃO.
     *
     * A interação é reconhecida imediatamente.
     *
     * Daqui para baixo podemos:
     * - ler arquivo
     * - buscar canais
     * - validar permissões
     * - esperar botão
     * - gerar backup
     *
     * sem deixar o token inicial expirar.
     */
    if (
      !interaction.deferred &&
      !interaction.replied
    ) {
      await interaction.deferReply({
        flags:
          MessageFlags.Ephemeral,
      });
    }

    const subcommand =
      interaction.options
        .getSubcommand();

    switch (
      subcommand
    ) {
      case "salvar":
        await saveCommand(
          interaction,
        );

        return;

      case "listar":
        await listCommand(
          interaction,
        );

        return;

      case "detalhes":
        await detailsCommand(
          interaction,
        );

        return;

      case "restaurar":
        await restoreCommand(
          interaction,
        );

        return;

      case "excluir":
        await deleteCommand(
          interaction,
        );

        return;

      case "limpar-backups":
        await cleanupBackupsCommand(
          interaction,
        );

        return;

      default:
        await interaction.editReply({
          content:
            "Subcomando desconhecido.",
        });
    }
  },
};
