import { Record, Literal, Static, Union } from "runtypes";
import {
  ColumnI,
  TableI,
  Table,
  IndexI,
  TriggerI,
  foreign_keyI,
} from "./records";
import { ColumnOperationType, makeReconcileColumns } from "./columns";
import {
  createOperationsForNameableObject,
  createOperationsForObjectWithIdentityFunction,
} from "../core";
import { IndexOperationType, makeReconcileIndexes } from "./tableIndex";
import { TriggerOperationType, makeReconcileTriggers } from "./triggers";
import {
  foreign_keyOperationType,
  makeReconcileforeign_keys,
} from "./foreignKeys";
import { isEqual, sortBy } from "lodash";

/**
 * -------------------- Tables --------------------
 */

export enum TableOpCodes {
  NoOp = "noop",
  CreateFunction = "create_function",
  CreateTable = "create_table",
  RenameTable = "rename_table",
}

export const CreateTableOperation = Record({
  code: Literal(TableOpCodes.CreateTable),
  table: Table,
});

export const RenameTableOperation = Record({
  code: Literal(TableOpCodes.RenameTable),
  table: Table,
});

export const TableOperation = Union(CreateTableOperation, RenameTableOperation);

export type TableOperationType =
  | Static<typeof TableOperation>
  | ColumnOperationType
  | IndexOperationType
  | TriggerOperationType
  | foreign_keyOperationType;

export const reconcileTables = (
  desired: TableI,
  current: TableI | undefined,
): TableOperationType[] => {
  const operations: TableOperationType[] = [];

  if (current === undefined) {
    // Create table
    operations.push({
      code: TableOpCodes.CreateTable,
      table: desired,
    });
  } else {
    // Check for rename
    if (current.name !== desired.name) {
      operations.push({
        code: TableOpCodes.RenameTable,
        table: desired,
      });
    }
  }

  const columnOperations = createOperationsForNameableObject<
    ColumnI,
    ColumnOperationType
  >(
    desired.columns,
    current === undefined ? [] : current.columns,
    makeReconcileColumns(desired),
  );

  // Accumulate primary key reconciliations
  const indexOperations = createOperationsForNameableObject<
    IndexI,
    IndexOperationType
  >(
    desired.indexes,
    current === undefined ? [] : current.indexes,
    makeReconcileIndexes(desired),
  );

  // Accumulate trigger reconciliations
  const triggerOperations = createOperationsForNameableObject<
    TriggerI,
    TriggerOperationType
  >(
    desired.triggers,
    current === undefined ? [] : current.triggers,
    makeReconcileTriggers(desired),
  );

  // Accumulate foreign key reconciliations
  const fkIdentityFn = (desiredFk: foreign_keyI, currentFk: foreign_keyI) =>
    isEqual(
      sortBy(desiredFk.on, c => c),
      sortBy(currentFk.on, c => c),
    ) &&
    desiredFk.references.table === currentFk.references.table &&
    isEqual(
      sortBy(desiredFk.references.columns, c => c),
      sortBy(currentFk.references.columns, c => c),
    );

  const foreign_keyOperations = createOperationsForObjectWithIdentityFunction<
    foreign_keyI,
    foreign_keyOperationType
  >(
    desired.foreign_keys,
    current === undefined ? [] : current?.foreign_keys,
    makeReconcileforeign_keys(desired),
    fkIdentityFn,
  );

  return operations
    .concat(columnOperations)
    .concat(indexOperations)
    .concat(triggerOperations)
    .concat(foreign_keyOperations);
};
