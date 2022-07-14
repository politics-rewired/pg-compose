import { fromPairs } from "lodash";
import { render } from "mustache";
import { match } from "runtypes";

import { RunContextI } from "../../runners";
import {
  createOperationsForNameableObject,
  createOperationsForObjectWithIdentityFunction,
  SingleObjectProvider,
} from "../core";
import {
  checkFunctionContractsMatch,
  FunctionI,
  FunctionOperation,
  FunctionOperationType,
  FunctionProvider,
} from "../functions";
import { TableProvider } from "../table";
import { extendTable } from "../table/extend";
import { AllTableOperation, AllTableOperationType } from "../table/reconcile";
import { TableI } from "../table/records";
import { enforceTrait } from "../table/trait";
import { ModuleI, ModuleRecord } from "./core";
import { introspectModule } from "./introspect";

export type ModuleOperationType = AllTableOperationType | FunctionOperationType;

type ModuleLoader = () => Promise<ModuleI>;

const DEPENDENCY_REQUIRE_PREFIX = "pgc-";

export const rollupModule = (m: ModuleI) => {
  // Expand module with dependencies
  const moduleLoaders: ModuleLoader[] = [];

  for (const dependency of m.dependencies || []) {
    const loader = require(`${DEPENDENCY_REQUIRE_PREFIX}${dependency.module}`);

    if (typeof loader === "function") {
      moduleLoaders.push(loader as ModuleLoader);
    } else if (typeof loader.default === "function") {
      moduleLoaders.push(loader.default as ModuleLoader);
    } else {
      throw new Error(
        `Dependency error: ${dependency.module} does not export a default that loads a module`,
      );
    }
  }

  return rollupDependencies(m, moduleLoaders);
};

const reconcile = async (
  desired: ModuleI,
  current: ModuleI | undefined,
): Promise<ModuleOperationType[]> => {
  const shouldDropTables = false;

  const aggregateDesired = await rollupModule(desired);

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

  // Remove satisfied fallback functions
  const withoutSatisfiedFallbackFunctions = (
    aggregateDesired.functions || []
  ).filter(func => {
    if (func.fallback_for === undefined) {
      return true;
    }

    const contractThatFuncIsFallbackFor = (
      aggregateDesired.contracts || []
    ).find(con => con.name === func.fallback_for);

    if (contractThatFuncIsFallbackFor === undefined) {
      throw new Error(
        `Func ${func.name} is declared as a fallback for contract ${func.fallback_for}, but that contract does not exist`,
      );
    }

    const otherImplementationOfContract = (
      aggregateDesired.functions || []
    ).find(
      otherFunc =>
        otherFunc.name !== func.name &&
        (otherFunc.implements || []).includes(
          contractThatFuncIsFallbackFor.name,
        ),
    );

    return otherImplementationOfContract === undefined;
  });

  const expandedFunctions = withoutSatisfiedFallbackFunctions.map(
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
  const dependencies = await Promise.all(
    loaders.map(l => {
      return l();
    }),
  );

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

  const bodyVars = fromPairs(
    ((requiredTrait.requires || {}).columns || []).map(col => [
      col.name,
      (implementation!.via &&
        implementation!.via.columns &&
        implementation!.via.columns[col.name]) ||
        col.name,
    ]),
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
