import { isEqual, sortBy } from "lodash";
import { Literal, Record, Static, Union } from "runtypes";

import {
  createOperationsForNameableObject,
  createOperationsForObjectWithIdentityFunction,
} from "../core";
import {
  ColumnOperation,
  ColumnOperationType,
  makeReconcileColumns,
} from "./columns";
import {
  ForeignKeyOperation,
  ForeignKeyOperationType,
  makeReconcileForeignKeys,
} from "./foreignKeys";
import {
  ColumnI,
  ForeignKeyI,
  IndexI,
  Table,
  TableI,
  TriggerI,
} from "./records";
import {
  IndexOperation,
  IndexOperationType,
  makeReconcileIndexes,
} from "./tableIndex";
import {
  makeReconcileTriggers,
  TriggerOperation,
  TriggerOperationType,
} from "./triggers";

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

export const AllTableOperation = Union(
  TableOperation,
  ColumnOperation,
  IndexOperation,
  TriggerOperation,
  ForeignKeyOperation,
);

export type AllTableOperationType = Static<typeof AllTableOperation>;

export const reconcileTables = async (
  desired: TableI,
  current: TableI | undefined,
): Promise<AllTableOperationType[]> => {
  const operations: AllTableOperationType[] = [];

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

  const columnOperations = await createOperationsForNameableObject<
    ColumnI,
    ColumnOperationType
  >(
    desired.columns,
    current === undefined ? [] : current.columns,
    makeReconcileColumns(desired),
  );

  // Accumulate primary key reconciliations
  const indexOperations = await createOperationsForNameableObject<
    IndexI,
    IndexOperationType
  >(
    desired.indexes,
    current === undefined ? [] : current.indexes,
    makeReconcileIndexes(desired),
  );

  // Accumulate trigger reconciliations
  const triggerOperations = await createOperationsForNameableObject<
    TriggerI,
    TriggerOperationType
  >(
    desired.triggers,
    current === undefined ? [] : current.triggers,
    makeReconcileTriggers(desired),
  );

  // Accumulate foreign key reconciliations
  const fkIdentityFn = (desiredFk: ForeignKeyI, currentFk: ForeignKeyI) =>
    isEqual(
      sortBy(desiredFk.on, c => c),
      sortBy(currentFk.on, c => c),
    ) &&
    desiredFk.references.table === currentFk.references.table &&
    isEqual(
      sortBy(desiredFk.references.columns, c => c),
      sortBy(currentFk.references.columns, c => c),
    );

  const foreignKeyOperations = await createOperationsForObjectWithIdentityFunction<
    ForeignKeyI,
    ForeignKeyOperationType
  >(
    desired.foreign_keys,
    current === undefined ? [] : current?.foreign_keys,
    makeReconcileForeignKeys(desired),
    fkIdentityFn,
  );

  return operations
    .concat(columnOperations)
    .concat(indexOperations)
    .concat(triggerOperations)
    .concat(foreignKeyOperations);
};
