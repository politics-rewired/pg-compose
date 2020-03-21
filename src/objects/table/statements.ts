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
          `ALTER TABLE "${context.schema}"."${op.table.name}" add column ${op.columnName} ${op.column.type}`,
        ]
          .concat(
            op.column.nullable === true || op.column.nullable === undefined
              ? []
              : ["NOT NULL"],
          )
          .concat(
            op.column.default === undefined
              ? []
              : [`DEFAULT '${op.column.default}'`],
          )
          .join(" "),
    ],
    [
      RenameColumnOperation,
      op =>
        `ALTER TABLE "${context.schema}"."${op.table.name}" alter column ${op.column.previous_name} rename to ${op.columnName}`,
    ],
    [
      SetColumnDataTypeOperation,
      op =>
        `ALTER TABLE "${context.schema}"."${op.table.name}" column ${op.columnName} set data type ${op.column.type}`,
    ],
    [
      SetColumnDefaultOperation,
      op =>
        `ALTER TABLE "${context.schema}"."${op.table.name}" alter column ${
          op.columnName
        } ${
          op.column.default === undefined
            ? `set default '${op.column.default}'`
            : "drop default"
        }`,
    ],
    [
      SetColumnNullableOperation,
      op =>
        `ALTER TABLE "${context.schema}"."${op.table.name}" alter column ${
          op.columnName
        } ${op.column.nullable ? "DROP NOT NULL" : "SET NOT NULL"}`,
    ],
  );
