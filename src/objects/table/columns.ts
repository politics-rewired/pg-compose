import { Record, Literal, Static, Union, Tuple, match } from "runtypes";
import {
  TableI,
  ColumnI,
  Table,
  Column,
  ColumnFunctionDefault,
  ColumnDefaultI,
} from "./records";
import { trim } from "lodash";

export enum ColumnOpCodes {
  CreateColumn = "create_column",
  RenameColumn = "rename_column",
  DropColumn = "drop_column",
  SetColumnDataType = "set_column_data_type",
  SetColumnNullable = "set_column_nullable",
  SetColumnDefault = "set_column_default",
}

export const CreateColumnOperation = Record({
  code: Literal(ColumnOpCodes.CreateColumn),
  table: Table,
  column: Column,
});

export const RenameColumnOperation = Record({
  code: Literal(ColumnOpCodes.RenameColumn),
  table: Table,
  column: Column,
});

export const DropColumnOperation = Record({
  code: Literal(ColumnOpCodes.DropColumn),
  table: Table,
  column: Column,
});

export const SetColumnDefaultOperation = Record({
  code: Literal(ColumnOpCodes.SetColumnDefault),
  table: Table,
  column: Column,
});

export const SetColumnNullableOperation = Record({
  code: Literal(ColumnOpCodes.SetColumnNullable),
  table: Table,
  column: Column,
});

export const SetColumnDataTypeOperation = Record({
  code: Literal(ColumnOpCodes.SetColumnDataType),
  table: Table,
  column: Column,
});

export const ColumnOperation = Union(
  CreateColumnOperation,
  RenameColumnOperation,
  DropColumnOperation,
  SetColumnDefaultOperation,
  SetColumnNullableOperation,
  SetColumnDataTypeOperation,
);

export type ColumnOperationType = Static<typeof ColumnOperation>;

const CreateColumnInputPair = Tuple(Column, Literal(undefined));
const DropColumnInputPair = Tuple(Literal(undefined), Column);
const AlterColumnInputPair = Tuple(Column, Column);

const ReconcileColumnsInput = Union(
  CreateColumnInputPair,
  DropColumnInputPair,
  AlterColumnInputPair,
);

const matchFn = (desiredTable: TableI) =>
  match(
    [
      CreateColumnInputPair,
      ([desired]) => [
        {
          code: ColumnOpCodes.CreateColumn,
          table: desiredTable,
          column: desired,
        },
      ],
    ],
    [
      DropColumnInputPair,
      ([_, current]) => [
        {
          code: ColumnOpCodes.DropColumn,
          table: desiredTable,
          column: current,
        },
      ],
    ],
    [
      AlterColumnInputPair,
      ([desired, current]) => {
        const operations: ColumnOperationType[] = [];
        // Check for a rename
        if (
          desired.name !== current.name &&
          desired.previous_name === current.name
        ) {
          operations.push({
            code: ColumnOpCodes.RenameColumn,
            column: desired,
            table: desiredTable,
          });
        }

        // Check for a default change
        const stripTypeCoercion = (str: string) =>
          trim(str.replace(`::${desired.type}`, ""), "'");

        const produceColumnDefaultString = (
          columnDefault: ColumnDefaultI | undefined,
        ) =>
          ColumnFunctionDefault.guard(columnDefault)
            ? columnDefault.fn
            : stripTypeCoercion(columnDefault || "");

        if (
          produceColumnDefaultString(current.default) !==
          produceColumnDefaultString(desired.default)
        ) {
          operations.push({
            code: ColumnOpCodes.SetColumnDefault,
            table: desiredTable,
            column: desired,
          });
        }

        const desiredNullable =
          desired.nullable === undefined ? true : desired.nullable;

        const currentNullable =
          current.nullable === undefined ? true : current.nullable;

        // Check for a nullable change
        if (currentNullable !== desiredNullable) {
          operations.push({
            code: ColumnOpCodes.SetColumnNullable,
            table: desiredTable,
            column: desired,
          });
        }

        // Check for a data type change
        if (current.type !== desired.type) {
          operations.push({
            code: ColumnOpCodes.SetColumnDataType,
            table: desiredTable,
            column: desired,
          });
        }

        return operations;
      },
    ],
  );

export const makeReconcileColumns = (desiredTable: TableI) => async (
  desired: ColumnI | undefined,
  current: ColumnI | undefined,
): Promise<ColumnOperationType[]> => {
  const input = [desired, current];

  if (ReconcileColumnsInput.guard(input)) {
    return matchFn(desiredTable)(input);
  }

  return [];
};
