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
} from "../functions";
import { RunContextI } from "../../runners";

export type ModuleOperationType = AllTableOperationType | FunctionOperationType;

const reconcile = (
  desired: ModuleI,
  current: ModuleI | undefined,
): ModuleOperationType[] => {
  // Install tables
  // const shouldDropTables = match(
  //   [Boolean, x => x],
  //   [Record({ tables: Boolean }), x => x.tables],
  // );
  const shouldDropTables = false;

  const maybeExpandTable = (table: TableI): TableI => {
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

  const withoutSatisfiedFallbackTables = (desired.tables || []).filter(
    table => {
      if (table.fallback_for !== undefined) {
        const trait = table.fallback_for;
        const otherTableThatImplementsTrait = (desired.tables || [])
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

  const expandedTables = withoutSatisfiedFallbackTables.map(maybeExpandTable);

  const tableOperations = createOperationsForNameableObject(
    expandedTables,
    current === undefined ? [] : current.tables,
    TableProvider.reconcile,
    { dropObjects: shouldDropTables },
  );

  for (const func of desired.functions || []) {
    if (func.implements !== undefined) {
      for (const contractName of func.implements) {
        const contract = (desired.contracts || []).find(
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

  const functionOperations = createOperationsForObjectWithIdentityFunction(
    desired.functions,
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
