import { ModuleProvider } from "./objects/module";
import { Runner, RunContextI } from "./runners";
import { ModuleI } from "./objects/module/core";
import { run, runMigrations, Task, TaskList, PgComposeWorker } from "./worker";
import { loadYaml } from "./loaders/yaml";
import { makeCli } from "./cli-factory";
import { operations, compile, CompiledExpression } from "./sexp";
import { JobHelpers } from "graphile-worker";

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
  run,
  runMigrations,
  loadYaml,
  Task,
  TaskList,
  ModuleI,
  makeCli,
  sexp,
  CompiledExpression,
  JobHelpers,
  PgComposeWorker,
};
