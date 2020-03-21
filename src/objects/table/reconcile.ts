import { Record, Literal, Static, Union } from "runtypes";
import { TableI, Table } from "./records";
import { ColumnOperationType, reconcileColumns } from "./columns";

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
  | ColumnOperationType;

export const reconcileTables = (
  desired: TableI,
  current: TableI | undefined,
): TableOperationType[] => {
  const operations: TableOperationType[] = [];

  if (!current) {
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

  // For columns, we need a mock current
  const maybeMockCurrent = current
    ? current
    : Object.assign({}, desired, { columns: {} });

  // Accumulate column reconciliations
  const columnOperations = Object.keys(desired.columns).reduce(
    (acc: ColumnOperationType[], columnName) => {
      const desiredColumn = desired.columns[columnName];
      const currentColumn = desiredColumn.previous_name
        ? maybeMockCurrent.columns[columnName] ||
          maybeMockCurrent.columns[desiredColumn.previous_name]
        : maybeMockCurrent.columns[columnName];

      return acc.concat(
        reconcileColumns(
          desiredColumn,
          currentColumn,
          columnName,
          desired,
          maybeMockCurrent,
        ),
      );
    },
    [],
  );

  // Accumulate primary key reconciliations
  // Accumulate index reconciliations
  // Accumulate foreign key reconciliations
  // Accumulate trigger reconciliations

  return operations.concat(columnOperations);
};
