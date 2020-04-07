import { ModuleProvider } from "./objects/module";
import { Runner, RunContextI } from "./runners";
import { ModuleI } from "./objects/module/core";

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
