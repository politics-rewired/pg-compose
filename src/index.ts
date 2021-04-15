import { JobHelpers } from "graphile-worker";

import { makeCli } from "./cli-factory";
import { loadYaml } from "./loaders/yaml";
import { ModuleProvider } from "./objects/module";
import { ModuleI } from "./objects/module/core";
import { RunContextI, Runner } from "./runners";
import { compile, CompiledExpression, operations } from "./sexp";
import { PgComposeWorker, run, runMigrations, Task, TaskList } from "./worker";

export const installModule = async (
  m: ModuleI,
  runner: Runner,
  context: RunContextI,
) => {
  const currentModule = await ModuleProvider.introspect(
    context.client,
    "",
    context,
  );

  const operationList = await ModuleProvider.reconcile(m, currentModule);

  await runner(operationList, ModuleProvider.toStatement(context), context);
};

const sexp = { operations, compile };

export {
  CompiledExpression,
  JobHelpers,
  loadYaml,
  makeCli,
  ModuleI,
  PgComposeWorker,
  run,
  runMigrations,
  sexp,
  Task,
  TaskList,
};
