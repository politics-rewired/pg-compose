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
  TriggerOperation,
  CreateTriggerOperation,
  DropTriggerOperation,
  ReorderTriggerOperation,
} from "./triggers";
import {
  ForeignKeyOperation,
  CreateForeignKeyOperation,
  DropForeignKeyOperation,
} from "./foreignKeys";
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

const generateTriggerName = (name: string, order: number, table: string) =>
  `_${order.toString().padStart(3, "0")}_${table}_${name}`;

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

export const makeTriggerToStatement = (context: RunContextI) =>
  match(
    [
      CreateTriggerOperation,
      op => {
        const functionName = `tg__${op.table.name}__${op.trigger.name}`;

        const triggerName = generateTriggerName(
          op.trigger.name,
          op.trigger.order,
          op.table.name,
        );

        const createOrReplaceFunctionStatement = `
          CREATE OR REPLACE FUNCTION "${context.schema}".${functionName}() returns trigger as $$ ${op.trigger.body} $$ language plpgsql strict;
        `;

        const createTriggerStatement = `
          CREATE TRIGGER ${triggerName}
            ${op.trigger.timing.replace("_", " ")}
            ON ${makeTableIdentifier(context.schema, op.table.name)}
            FOR EACH ROW
            ${op.trigger.when ? "WHEN ${op.trigger.when" : ""}
            EXECUTE FUNCTION ${functionName}();
        `;

        return `${createOrReplaceFunctionStatement} ${createTriggerStatement}`;
      },
    ],
    [
      DropTriggerOperation,
      op => {
        const functionName = `tg__${op.table.name}__${op.trigger.name}`;

        const triggerName = generateTriggerName(
          op.trigger.name,
          op.trigger.order,
          op.table.name,
        );

        const dropFunctionStatement = `DROP FUNCTION "${context.schema}".${functionName};`;
        const dropTriggerStatement = `DROP TRIGGER ${triggerName} ON ${makeTableIdentifier(
          context.schema,
          op.table.name,
        )};`;

        return `${dropTriggerStatement} ${dropFunctionStatement}`;
      },
    ],
    [
      ReorderTriggerOperation,
      op => {
        const oldTriggerName = generateTriggerName(
          op.trigger.name,
          op.trigger.previous_order as number,
          op.table.name,
        );

        const newTriggerName = generateTriggerName(
          op.trigger.name,
          op.trigger.order,
          op.table.name,
        );

        return `ALTER TRIGGER ${oldTriggerName} ON ${makeTableIdentifier(
          context.schema,
          op.table.name,
        )} RENAME TO ${newTriggerName};`;
      },
    ],
    [
      Unknown,
      op => {
        throw new Error(`Unknown operation: ${JSON.stringify(op, null, 2)}`);
      },
    ],
  );

export const makeForeignKeyToStatement = (context: RunContextI) =>
  match(
    [
      CreateForeignKeyOperation,
      op =>
        `ALTER TABLE ${makeTableIdentifier(
          context.schema,
          op.table.name,
        )} ADD FOREIGN KEY (${op.foreignKey.on.join(
          ", ",
        )}) REFERENCES ${makeTableIdentifier(
          context.schema,
          op.foreignKey.references.table,
        )} (${op.foreignKey.references.columns.join(", ")});`,
    ],
    [
      DropForeignKeyOperation,
      op =>
        `ALTER TABLE ${makeTableIdentifier(
          context.schema,
          op.table.name,
        )} DROP CONSTRAINT ${op.foreignKey.name};`,
    ],
  );

export const makeToStatement = (context: RunContextI) =>
  match(
    [TableOperation, makeTableToStatement(context)],
    [ColumnOperation, makeColumnToStatement(context)],
    [IndexOperation, makeIndexToStatement(context)],
    [TriggerOperation, makeTriggerToStatement(context)],
    [ForeignKeyOperation, makeForeignKeyToStatement(context)],
    [
      Unknown,
      op => {
        throw new Error(`Unknown operation: ${JSON.stringify(op, null, 2)}`);
      },
    ],
  );
