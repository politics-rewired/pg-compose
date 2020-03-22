import {
  CreateColumnOperation,
  RenameColumnOperation,
  SetColumnDataTypeOperation,
  SetColumnDefaultOperation,
  SetColumnNullableOperation,
} from "./columns";
import { CreateTableOperation, RenameTableOperation } from "./reconcile";
import { match } from "runtypes";
import { RunContextI } from "../core";
import {
  ColumnDefaultI,
  ColumnFunctionDefault,
  ColumnLiteralDefault,
} from "./records";

export const makeDefaultString = (columnDefault: ColumnDefaultI) =>
  match(
    [ColumnFunctionDefault, ({ fn }) => fn],
    [ColumnLiteralDefault, l => `'${l}'`],
  )(columnDefault);

export const makeToStatement = (context: RunContextI) =>
  match(
    [
      CreateTableOperation,
      op => `CREATE TABLE "${context.schema}"."${op.table.name}" ()`,
    ],
    [
      RenameTableOperation,
      op =>
        `ALTER TABLE "${context.schema}"."${op.table.previous_name}" rename to "${op.table.name}"`,
    ],
    [
      CreateColumnOperation,
      op =>
        [
          `ALTER TABLE "${context.schema}"."${op.table.name}" add column ${op.column.name} ${op.column.type}`,
        ]
          .concat(
            op.column.nullable === true || op.column.nullable === undefined
              ? []
              : ["NOT NULL"],
          )
          .concat(
            op.column.default === undefined
              ? []
              : [`DEFAULT ${makeDefaultString(op.column.default)}`],
          )
          .join(" "),
    ],
    [
      RenameColumnOperation,
      op =>
        `ALTER TABLE "${context.schema}"."${op.table.name}" alter column ${op.column.previous_name} rename to ${op.column.name}`,
    ],
    [
      SetColumnDataTypeOperation,
      op =>
        `ALTER TABLE "${context.schema}"."${op.table.name}" column ${op.column.name} set data type ${op.column.type}`,
    ],
    [
      SetColumnDefaultOperation,
      op =>
        `ALTER TABLE "${context.schema}"."${op.table.name}" alter column ${
          op.column.name
        } ${
          op.column.default === undefined
            ? "drop default"
            : `set default ${makeDefaultString(op.column.default)}`
        }`,
    ],
    [
      SetColumnNullableOperation,
      op =>
        `ALTER TABLE "${context.schema}"."${op.table.name}" alter column ${
          op.column.name
        } ${op.column.nullable ? "DROP NOT NULL" : "SET NOT NULL"}`,
    ],
  );
