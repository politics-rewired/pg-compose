import { Record, Literal, Static, Union } from "runtypes";
import { TableI, ColumnI, Table, Column } from "./records";
import { PgIdentifier } from "../core";
import { trim } from "lodash";

export enum ColumnOpCodes {
  CreateColumn = "create_column",
  RenameColumn = "rename_column",
  SetColumnDataType = "set_column_data_type",
  SetColumnNullable = "set_column_nullable",
  SetColumnDefault = "set_column_default",
}

export const CreateColumnOperation = Record({
  code: Literal(ColumnOpCodes.CreateColumn),
  table: Table,
  columnName: PgIdentifier,
  column: Column,
});

export const RenameColumnOperation = Record({
  code: Literal(ColumnOpCodes.RenameColumn),
  table: Table,
  columnName: PgIdentifier,
  column: Column,
});

export const SetColumnDefaultOperation = Record({
  code: Literal(ColumnOpCodes.SetColumnDefault),
  table: Table,
  columnName: PgIdentifier,
  column: Column,
});

export const SetColumnNullableOperation = Record({
  code: Literal(ColumnOpCodes.SetColumnNullable),
  table: Table,
  columnName: PgIdentifier,
  column: Column,
});

export const SetColumnDataTypeOperation = Record({
  code: Literal(ColumnOpCodes.SetColumnDataType),
  table: Table,
  columnName: PgIdentifier,
  column: Column,
});

export const ColumnOperation = Union(
  CreateColumnOperation,
  RenameColumnOperation,
  SetColumnDefaultOperation,
  SetColumnNullableOperation,
  SetColumnDataTypeOperation,
);

export type ColumnOperationType = Static<typeof ColumnOperation>;

export const reconcileColumns = (
  desired: ColumnI,
  current: ColumnI,
  desiredColumnName: string,
  desiredTable: TableI,
  currentTable: TableI,
): ColumnOperationType[] => {
  const operations: ColumnOperationType[] = [];

  if (!current) {
    operations.push({
      code: ColumnOpCodes.CreateColumn,
      table: desiredTable,
      columnName: desiredColumnName,
      column: desired,
    });
  } else {
    // Check for a rename
    if (!currentTable.columns[desiredColumnName]) {
      operations.push({
        code: ColumnOpCodes.RenameColumn,
        table: desiredTable,
        columnName: desiredColumnName,
        column: desired,
      });
    }

    // Check for a default change
    const stripTypeCoercion = (str: string) =>
      trim(str.replace(`::${desired.type}`, ""), "'");

    if (
      stripTypeCoercion(current.default || "") !==
      stripTypeCoercion(desired.default || "")
    ) {
      operations.push({
        code: ColumnOpCodes.SetColumnDefault,
        table: desiredTable,
        columnName: desiredColumnName,
        column: desired,
      });
    }

    const desiredNullable =
      desired.nullable === undefined ? true : desired.nullable;

    // Check for a nullable change
    if (current.nullable !== desiredNullable) {
      operations.push({
        code: ColumnOpCodes.SetColumnNullable,
        table: desiredTable,
        columnName: desiredColumnName,
        column: desired,
      });
    }

    // Check for a data type change
    if (current.type !== desired.type) {
      operations.push({
        code: ColumnOpCodes.SetColumnDataType,
        table: desiredTable,
        columnName: desiredColumnName,
        column: desired,
      });
    }
  }
  return operations;
};
