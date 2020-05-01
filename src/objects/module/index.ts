import { match } from "runtypes";
import { TableProvider } from "../table";
import {
  createOperationsForNameableObject,
  createOperationsForObjectWithIdentityFunction,
} from "../core";
import { introspectModule } from "./introspect";
import { AllTableOperation, AllTableOperationType } from "../table/reconcile";
import { TableI } from "../table/records";
import { ModuleI, ModuleRecord } from "./core";
import { SingleObjectProvider } from "../core";
import { enforceTrait } from "../table/trait";
import { extendTable } from "../table/extend";
import {
  FunctionProvider,
  FunctionOperationType,
  FunctionOperation,
  checkFunctionContractsMatch,
  FunctionI,
} from "../functions";
import { RunContextI } from "../../runners";
import { render } from "mustache";

export type ModuleOperationType = AllTableOperationType | FunctionOperationType;

type ModuleLoader = () => Promise<ModuleI>;

const DEPENDENCY_REQUIRE_PREFIX = "pgc-";

const reconcile = async (
  desired: ModuleI,
  current: ModuleI | undefined,
): Promise<ModuleOperationType[]> => {
  const shouldDropTables = false;

  // Expand module with dependencies
  const moduleLoaders: ModuleLoader[] = [];

  for (const dependencyName of desired.dependencies || []) {
    const loader = (await import(
      DEPENDENCY_REQUIRE_PREFIX + dependencyName
    )) as ModuleLoader;
    moduleLoaders.push(loader);
  }

  const aggregateDesired = await rollupDependencies(desired, moduleLoaders);

  // Removed satisfied fallback tables
  const withoutSatisfiedFallbackTables = (aggregateDesired.tables || []).filter(
    table => {
      if (table.fallback_for !== undefined) {
        const trait = table.fallback_for;
        const otherTableThatImplementsTrait = (aggregateDesired.tables || [])
          .filter(other => other.name !== table.name)
          .find(other =>
            other.implements?.find(
              traitImplementation => traitImplementation.trait === trait,
            ),
          );

        return otherTableThatImplementsTrait === undefined;
      }

      return true;
    },
  );

  // Expand tables with extensions and traits
  const expandedTables = withoutSatisfiedFallbackTables.map(
    maybeExpandTable(aggregateDesired),
  );

  // Create table operations
  const tableOperations = await createOperationsForNameableObject(
    expandedTables,
    current === undefined ? [] : current.tables,
    TableProvider.reconcile,
    { dropObjects: shouldDropTables },
  );

  // Check function contract satisfaction
  for (const func of aggregateDesired.functions || []) {
    if (func.implements !== undefined) {
      for (const contractName of func.implements) {
        const contract = (aggregateDesired.contracts || []).find(
          c => c.name === contractName,
        );

        if (contract === undefined) {
          throw new Error(
            `Function ${func.name} implements ${contractName}, but that contract does not exist`,
          );
        }

        const successOrErrors = checkFunctionContractsMatch(func, contract);

        if (Array.isArray(successOrErrors)) {
          throw new Error(successOrErrors.join("\n"));
        }
      }
    }
  }

  const expandedFunctions = (aggregateDesired.functions || []).map(
    maybeExpandFunction(aggregateDesired),
  );

  // Create function operations
  const functionOperations = await createOperationsForObjectWithIdentityFunction(
    expandedFunctions,
    current === undefined ? [] : current.functions,
    FunctionProvider.reconcile,
    FunctionProvider.identityFn,
    { dropObjects: true },
  );

  return (tableOperations as ModuleOperationType[]).concat(
    functionOperations as ModuleOperationType[],
  );
};

export const ModuleProvider: SingleObjectProvider<
  ModuleI,
  ModuleOperationType
> = {
  record: ModuleRecord,
  introspect: introspectModule,
  reconcile,
  toStatement: (context: RunContextI) =>
    match(
      [AllTableOperation, TableProvider.toStatement(context)],
      [FunctionOperation, FunctionProvider.toStatement(context)],
    ),
  type: "single",
  identityFn: (_a: ModuleI, _b: ModuleI) => true,
};

export const rollupDependencies = async (
  firstModule: ModuleI,
  loaders: ModuleLoader[],
): Promise<ModuleI> => {
  const dependencies = await Promise.all(loaders.map(l => l()));

  for (const nextModule of dependencies) {
    firstModule.contracts = (firstModule.contracts || []).concat(
      nextModule.contracts || [],
    );

    firstModule.cronJobs = (firstModule.cronJobs || []).concat(
      nextModule.cronJobs || [],
    );

    firstModule.extensions = (firstModule.extensions || []).concat(
      nextModule.extensions || [],
    );

    firstModule.functions = (firstModule.functions || []).concat(
      nextModule.functions || [],
    );

    firstModule.tables = (firstModule.tables || []).concat(
      nextModule.tables || [],
    );

    firstModule.taskList = Object.assign(
      {},
      firstModule.taskList,
      nextModule.taskList || {},
    );

    firstModule.traits = (firstModule.traits || []).concat(
      nextModule.traits || [],
    );
  }

  return firstModule;
};

const maybeExpandFunction = (desired: ModuleI) => (
  func: FunctionI,
): FunctionI => {
  if (func.requires === undefined || func.requires.length === 0) {
    return func;
  }

  // TODO - support multiple required traits
  // const requiredTraits = func.requires.map(r => r.trait);

  const requiredTraitName = func.requires[0].trait;
  const requiredTrait = (desired.traits || []).find(
    trait => trait.name === requiredTraitName,
  );

  if (requiredTrait === undefined) {
    throw new Error(
      `Function ${func.name} requires trait ${requiredTraitName} but no such trait exists`,
    );
  }

  const tableThatImplementsTrait = (desired.tables || []).find(t =>
    (t.implements || []).find(i => i.trait === requiredTraitName),
  );

  if (tableThatImplementsTrait === undefined) {
    throw new Error(
      `Function ${func.name} requires trait ${requiredTraitName} but no table implements this trait`,
    );
  }

  const implementation = (tableThatImplementsTrait.implements || []).find(
    i => i.trait === requiredTraitName,
  );

  const bodyVars = (requiredTrait.requires.columns || []).reduce(
    (acc, col) =>
      Object.assign(acc, {
        [col.name]:
          implementation!.via && implementation!.via.columns
            ? implementation!.via.columns[col.name]
            : col.name,
      }),
    {},
  );

  bodyVars[requiredTraitName] = tableThatImplementsTrait.name;

  return Object.assign({}, func, {
    body: render(func.body, bodyVars),
  });
};

const maybeExpandTable = (desired: ModuleI) => (table: TableI): TableI => {
  let nextTable = table;

  // Apply table extensions
  const extensionsForTable = (desired.extensions || []).filter(
    ext => ext.table === table.name,
  );

  for (const extension of extensionsForTable) {
    nextTable = extendTable(nextTable, extension);
  }

  if (table.implements === undefined) {
    return nextTable;
  }

  const implementedTraits = table.implements;

  // Implement all traits
  for (const traitImplementation of implementedTraits) {
    const trait = (desired.traits || []).find(
      t => t.name === traitImplementation.trait,
    );

    if (trait === undefined) {
      throw new Error(
        `Table ${table.name} implements trait ${traitImplementation.trait}, but that trait does not exist`,
      );
    }

    const enforcementResult = enforceTrait(trait, table);

    if (enforcementResult !== true) {
      throw new Error(enforcementResult.join("\n"));
    }

    if (trait.provides !== undefined) {
      nextTable = extendTable(
        nextTable,
        trait.provides,
        traitImplementation,
        trait.requires,
      );
    }
  }

  return nextTable;
};
