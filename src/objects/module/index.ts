// import { match, Record, Boolean } from "runtypes";
import { TableProvider } from "../table";
import { createOperationsForNameableObject } from "../core";
import { introspectModule } from "./introspect";
import { TableOperationType } from "../table/reconcile";
import { TableI } from "../table/records";
import { ModuleI, ModuleRecord } from "./core";
import { ObjectProvider } from "..";
import { enforceTrait } from "../table/trait";
import { extendTable } from "../table/extend";

// const ModuleOperation = Union(TableOperation);
export type ModuleOperationType = TableOperationType;

const reconcile = (
  desired: ModuleI,
  current: ModuleI | undefined,
): TableOperationType[] => {
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

  const expandedTables = (desired.tables || []).map(maybeExpandTable);

  const tableOperations = createOperationsForNameableObject(
    expandedTables,
    current === undefined ? [] : current.tables,
    TableProvider.reconcile,
    { dropObjects: shouldDropTables },
  );

  return tableOperations;
};

export const ModuleProvider: ObjectProvider<ModuleI, ModuleOperationType> = {
  record: ModuleRecord,
  introspect: introspectModule,
  reconcile,
  toStatement: TableProvider.toStatement,
};
