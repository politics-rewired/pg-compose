import { PoolClient } from "pg";
import { PgIdentifierI, RunContextI } from "../core";
import { TableI, ColumnI } from "./records";

interface PgAttribute {
  attname: string;
  typname: string;
  attnotnull: boolean;
  default_expr: string | null;
}

export const introspectTable = async (
  client: PoolClient,
  identifier: PgIdentifierI,
  context: RunContextI,
): Promise<TableI> => {
  const result = await client.query(
    `
      select col.attname,
        type.typname,
        col.attnotnull,
        col.atthasdef,
        case 
          when col_default.adbin is null then null
          else pg_get_expr(col_default.adbin, tab.oid, true)
        end as default_expr
      from pg_catalog.pg_class as tab
      join pg_catalog.pg_attribute as col
        on col.attrelid = tab.oid
      join pg_catalog.pg_type as type
        on type.oid = col.atttypid
      left join pg_catalog.pg_attrdef as col_default
        on col_default.adrelid = tab.oid
        and col_default.adnum = col.attnum
      where true
        and relnamespace = to_regnamespace($1)::oid
        and relname = $2
        and attnum > 0
    `,
    [context.schema, identifier],
  );

  const pgAttributes: PgAttribute[] = result.rows;

  const columns: {
    [columnName: string]: ColumnI;
  } = {};

  for (const attr of pgAttributes) {
    columns[attr.attname] = {
      type: attr.typname,
      nullable: !attr.attnotnull,
      default: attr.default_expr || undefined,
    };
  }

  const table: TableI = {
    kind: "Table",
    name: identifier,
    columns: columns,
  };

  return table;
};
