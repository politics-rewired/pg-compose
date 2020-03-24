import { Record, Literal, Static, Union } from "runtypes";
import { ColumnI, TableI, Table, IndexI } from "./records";
import { ColumnOperationType, makeReconcileColumns } from "./columns";
import { createOperationsForNameableObject } from "../core";
import { IndexOperationType, makeReconcileIndexes } from "./tableIndex";

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
  | IndexOperationType;

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

  // Accumulate foreign key reconciliations
  // Accumulate trigger reconciliations

  return operations.concat(columnOperations).concat(indexOperations);
};
