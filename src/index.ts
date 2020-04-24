import { ModuleProvider } from "./objects/module";
import { Runner, RunContextI } from "./runners";
import { ModuleI } from "./objects/module/core";
import { run, Task, TaskList } from "./worker";
import { loadYaml } from "./loaders/yaml";
import { makeCli } from "./cli-factory";

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

export { run, loadYaml, Task, TaskList, makeCli };
