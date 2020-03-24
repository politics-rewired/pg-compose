import {
  CreateColumnOperation,
  RenameColumnOperation,
  SetColumnDataTypeOperation,
  SetColumnDefaultOperation,
  SetColumnNullableOperation,
  ColumnOperation,
} from "./columns";
import {
  CreateIndexOperation,
  RenameIndexOperation,
  DropIndexOperation,
  MakeIndexPrimaryKeyOperation,
  DropPrimaryKeyOperation,
  IndexOperation,
} from "./tableIndex";
import {
  CreateTableOperation,
  RenameTableOperation,
  TableOperation,
} from "./reconcile";
import { match, Unknown } from "runtypes";
import { RunContextI, PgIdentifierI } from "../core";
import {
  ColumnDefaultI,
  ColumnFunctionDefault,
  ColumnLiteralDefault,
} from "./records";

const makeTableIdentifier = (
  schemaName: PgIdentifierI,
  tableName: PgIdentifierI,
) => `"${schemaName}"."${tableName}"`;

const makeDefaultString = (columnDefault: ColumnDefaultI) =>
  match(
    [ColumnFunctionDefault, ({ fn }) => fn],
    [ColumnLiteralDefault, l => `'${l}'`],
  )(columnDefault);

const makeTableToStatement = (context: RunContextI) =>
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
  );

const makeColumnToStatement = (context: RunContextI) =>
  match(
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

export const makeIndexToStatement = (context: RunContextI) =>
  match(
    [
      CreateIndexOperation,
      op =>
        `CREATE ${op.index.unique ? "UNIQUE" : ""} INDEX ${
          op.index.name
        } ON ${makeTableIdentifier(
          context.schema,
          op.table.name,
        )} (${op.index.on
          .map(
            col =>
              `${col.column} ${col.order || "ASC"} ${
                col.nulls ? `NULLS ${col.nulls}` : ""
              }`,
          )
          .join(", ")}) ${
          op.index.include !== undefined
            ? `INCLUDE (${op.index.include.map(c => c.column).join(", ")})`
            : ""
        } ${op.index.where ? `WHERE ${op.index.where}` : ""}`,
    ],
    [
      RenameIndexOperation,
      op =>
        `ALTER INDEX "${context.schema}".${op.index.previous_name} rename to ${op.index.name}`,
    ],
    [
      DropIndexOperation,
      op => `DROP INDEX "${context.schema}".${op.index.name}`,
    ],
    [
      MakeIndexPrimaryKeyOperation,
      op =>
        `ALTER TABLE ${makeTableIdentifier(
          context.schema,
          op.table.name,
        )} ADD PRIMARY KEY USING INDEX ${op.index.name}`,
    ],
    [
      DropPrimaryKeyOperation,
      op =>
        `ALTER TABLE ${makeTableIdentifier(
          context.schema,
          op.table.name,
        )} DROP CONSTRAINT ${op.index.primaryKeyConstraintName}`,
    ],
    [
      Unknown,
      op => {
        throw new Error(`Could not match operation: ${JSON.stringify(op)}`);
      },
    ],
  );

export const makeToStatement = (context: RunContextI) =>
  match(
    [TableOperation, makeTableToStatement(context)],
    [ColumnOperation, makeColumnToStatement(context)],
    [IndexOperation, makeIndexToStatement(context)],
    [
      Unknown,
      op => {
        throw new Error(`Unknown operation: ${JSON.stringify(op, null, 2)}`);
      },
    ],
  );
