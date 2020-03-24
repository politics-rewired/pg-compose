import { PoolClient } from "pg";
import { PgIdentifierI, RunContextI } from "../core";
import { TableI, ColumnI, IndexI } from "./records";

interface PgAttribute {
  attname: string;
  typname: string;
  attnotnull: boolean;
  default_expr: string | null;
}

const introspectColumns = async (
  client: PoolClient,
  identifier: PgIdentifierI,
  context: RunContextI,
): Promise<ColumnI[]> => {
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

  return pgAttributes.map(attr => ({
    name: attr.attname,
    type: attr.typname,
    nullable: !attr.attnotnull,
    default: attr.default_expr || undefined,
  }));
};

enum IndexNullsOrder {
  First = "FIRST",
  Last = "LAST",
}

enum IndexOrder {
  Asc = "ASC",
  Desc = "DESC",
}

interface PgIndex {
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  where_clause: string;
  primary_key_constraint_name: string;
  columns: {
    column: string;
    order: IndexOrder;
    nulls_status: IndexNullsOrder;
    is_key: boolean;
  }[];
}

const introspectIndexes = async (
  client: PoolClient,
  tableIdentifier: PgIdentifierI,
  context: RunContextI,
): Promise<IndexI[]> => {
  const result = await client.query(
    `
      SELECT
        idx_rel.relname AS index_name,
        idx.indisunique AS is_unique,
        idx.indisprimary AS is_primary,
        cons.conname AS primary_key_constraint_name,
        case
          when idx.indpred is null then null
          else pg_get_expr(idx.indpred, tab.oid, true)
        end as where_clause,
        array_agg (
          json_build_object(
            'column', a.attname,
            'order', CASE o.option & 1 WHEN 1 THEN 'DESC' ELSE 'ASC' END,
            'nulls_status', CASE o.option & 2 WHEN 2 THEN 'FIRST' ELSE 'LAST' END,
            'is_key', c.ordinality <= idx.indnkeyatts
          )
          ORDER BY c.ordinality
        ) AS columns
      FROM pg_index AS idx
      JOIN pg_class AS tab ON tab.oid = idx.indrelid
      JOIN pg_class AS idx_rel ON idx_rel.oid = idx.indexrelid
      CROSS JOIN LATERAL unnest (idx.indkey) WITH ORDINALITY AS c (colnum, ordinality)
      LEFT JOIN LATERAL unnest (idx.indoption) WITH ORDINALITY AS o (option, ordinality)
        ON c.ordinality = o.ordinality
      JOIN pg_attribute AS a ON tab.oid = a.attrelid AND a.attnum = c.colnum
      LEFT JOIN pg_constraint AS cons
        ON cons.contype = 'p'
        AND cons.conrelid = tab.oid
        AND idx.indisprimary = true
      WHERE true
        and tab.relname = $2
        and tab.relnamespace = to_regnamespace($1)::oid
      GROUP BY 1, 2, 3, 4, 5
    `,
    [context.schema, tableIdentifier],
  );

  const indexes: PgIndex[] = result.rows;
  return indexes.map(idx => ({
    name: idx.index_name,
    unique: idx.is_unique,
    primaryKey: idx.is_primary,
    where: makeUndefinedIfNull(idx.where_clause),
    primaryKeyConstraintName: makeUndefinedIfNull(
      idx.primary_key_constraint_name,
    ),
    on: idx.columns
      .filter(c => c.is_key)
      .map(c => ({ column: c.column, order: c.order, nulls: c.nulls_status })),
    include: idx.columns
      .filter(c => !c.is_key)
      .map(c => ({ column: c.column, order: c.order, nulls: c.nulls_status })),
  }));
};

export const introspectTable = async (
  client: PoolClient,
  identifier: PgIdentifierI,
  context: RunContextI,
): Promise<TableI> => {
  const [columns, indexes] = await Promise.all([
    introspectColumns(client, identifier, context),
    introspectIndexes(client, identifier, context),
  ]);

  const table: TableI = {
    kind: "Table",
    name: identifier,
    columns: columns,
    indexes: indexes,
  };

  return table;
};

const makeUndefinedIfNull = (val: any) => (val === null ? undefined : val);
