import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

import type {
  ModeloServidor,
} from "../modelos/types.js";


const ROOT_DIRECTORY =
  path.resolve(
    process.cwd(),
    "data",
    "modelos",
  );


/*
|--------------------------------------------------------------------------
| PASTA DO USUÁRIO
|--------------------------------------------------------------------------
*/

function userDirectory(
  userId: string,
): string {
  return path.join(
    ROOT_DIRECTORY,
    userId,
  );
}


/*
|--------------------------------------------------------------------------
| CAMINHO DO MODELO
|--------------------------------------------------------------------------
*/

function modelFile(
  userId: string,
  modelId: string,
): string {
  return path.join(
    userDirectory(userId),
    `${modelId}.json`,
  );
}


/*
|--------------------------------------------------------------------------
| GARANTIR PASTAS
|--------------------------------------------------------------------------
*/

async function ensureUserDirectory(
  userId: string,
): Promise<void> {
  await mkdir(
    userDirectory(userId),
    {
      recursive: true,
    },
  );
}


/*
|--------------------------------------------------------------------------
| VALIDAÇÃO BÁSICA
|--------------------------------------------------------------------------
*/

function isModeloServidor(
  value: unknown,
): value is ModeloServidor {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }


  const candidate =
    value as Partial<ModeloServidor>;


  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.id === "string" &&
    typeof candidate.nome === "string" &&
    typeof candidate.criadoPor === "string" &&
    typeof candidate.modulos === "object" &&
    candidate.modulos !== null
  );
}


/*
|--------------------------------------------------------------------------
| LER ARQUIVO
|--------------------------------------------------------------------------
*/

async function readModelFile(
  filePath: string,
): Promise<ModeloServidor | null> {
  try {
    const content =
      await readFile(
        filePath,
        "utf8",
      );


    const parsed:
      unknown =
      JSON.parse(
        content,
      );


    if (
      !isModeloServidor(
        parsed,
      )
    ) {
      return null;
    }


    return parsed;
  } catch {
    return null;
  }
}


/*
|--------------------------------------------------------------------------
| LISTAR
|--------------------------------------------------------------------------
*/

export async function listarModelos(
  userId: string,
): Promise<ModeloServidor[]> {
  await ensureUserDirectory(
    userId,
  );


  const entries =
    await readdir(
      userDirectory(
        userId,
      ),
      {
        withFileTypes: true,
      },
    );


  const models:
    ModeloServidor[] = [];


  for (
    const entry
    of entries
  ) {
    if (
      !entry.isFile() ||
      !entry.name.endsWith(
        ".json",
      )
    ) {
      continue;
    }


    const model =
      await readModelFile(
        path.join(
          userDirectory(
            userId,
          ),
          entry.name,
        ),
      );


    if (model) {
      models.push(
        model,
      );
    }
  }


  models.sort(
    (a, b) =>
      new Date(
        b.atualizadoEm,
      ).getTime() -
      new Date(
        a.atualizadoEm,
      ).getTime(),
  );


  return models;
}


/*
|--------------------------------------------------------------------------
| BUSCAR POR NOME
|--------------------------------------------------------------------------
*/

export async function buscarModeloPorNome(
  userId: string,
  nome: string,
): Promise<ModeloServidor | null> {
  const normalized =
    nome
      .trim()
      .toLocaleLowerCase();


  const models =
    await listarModelos(
      userId,
    );


  return (
    models.find(
      (model) =>
        model.nome
          .trim()
          .toLocaleLowerCase() ===
        normalized,
    ) ?? null
  );
}


/*
|--------------------------------------------------------------------------
| SALVAR
|--------------------------------------------------------------------------
|
| substituir = true:
|
| se já existir modelo com o mesmo nome,
| ele é atualizado usando o mesmo ID.
|
|--------------------------------------------------------------------------
*/

export async function salvarModelo(
  userId: string,
  incoming:
    ModeloServidor,
  substituir: boolean,
): Promise<ModeloServidor> {
  await ensureUserDirectory(
    userId,
  );


  const existing =
    await buscarModeloPorNome(
      userId,
      incoming.nome,
    );


  if (
    existing &&
    !substituir
  ) {
    throw new Error(
      [
        `Já existe um modelo chamado "${existing.nome}".`,
        "",
        "Use a opção `substituir: Sim` para sobrescrevê-lo.",
      ].join("\n"),
    );
  }


  const now =
    new Date().toISOString();


  const model:
    ModeloServidor =
    existing
      ? {
          ...incoming,

          id:
            existing.id,

          criadoEm:
            existing.criadoEm,

          atualizadoEm:
            now,
        }
      : {
          ...incoming,

          atualizadoEm:
            now,
        };


  const finalPath =
    modelFile(
      userId,
      model.id,
    );


  const temporaryPath =
    `${finalPath}.tmp`;


  /*
   * Escrita atômica simples.
   *
   * Primeiro .tmp,
   * depois renomeia.
   */

  await writeFile(
    temporaryPath,
    JSON.stringify(
      model,
      null,
      2,
    ),
    "utf8",
  );


  await rename(
    temporaryPath,
    finalPath,
  );


  return model;
}


/*
|--------------------------------------------------------------------------
| EXCLUIR
|--------------------------------------------------------------------------
*/

export async function excluirModelo(
  userId: string,
  modelId: string,
): Promise<void> {
  const filePath =
    modelFile(
      userId,
      modelId,
    );


  try {
    await unlink(
      filePath,
    );
  } catch (error) {
    const code =
      (
        error as {
          code?: string;
        }
      ).code;


    if (
      code === "ENOENT"
    ) {
      return;
    }


    throw error;
  }
}