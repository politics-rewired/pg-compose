/* eslint-disable no-useless-escape */

import { groupBy, sortBy } from "lodash";
import { PoolClient } from "pg";

import { RunContextI } from "../../runners";
import { PgIdentifierI } from "../core";
import {
  ColumnI,
  ForeignKeyI,
  GetterI,
  IndexI,
  TableI,
  TriggerI,
  TriggerTiming,
} from "./records";

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
    primary_key: idx.is_primary,
    where: makeUndefinedIfNull(idx.where_clause),
    primary_keyConstraintName: makeUndefinedIfNull(
      idx.primary_key_constraint_name,
    ),
    on: idx.columns
      .filter(c => c.is_key)
      .map(c => ({
        column: c.column,
        order: c.order,
        nulls: c.nulls_status,
      })),
    include: idx.columns
      .filter(c => !c.is_key)
      .map(c => ({
        column: c.column,
        order: c.order,
        nulls: c.nulls_status,
      })),
  }));
};

interface PgProc {
  name: string;
  body: string;
  volatility: string;
  language: "sql" | "plpgsql";
  return_type: string;
}

const introspectGetters = async (
  client: PoolClient,
  tableIdentifier: PgIdentifierI,
  context: RunContextI,
): Promise<GetterI[]> => {
  const results = await client.query(
    `
      SELECT 
        func.proname as name,
        func.prosrc as body,
        func.provolatile as volatility,
        lang.lanname as language,
        return_type.typname as return_type
      FROM pg_proc as func
      JOIN pg_type as return_type
        ON return_type.oid = func.prorettype
      JOIN pg_type as input_type
        ON input_type.oid = ANY(proargtypes)
      JOIN pg_class as tab
        ON input_type.oid = tab.reltype
      JOIN pg_language as lang
        ON lang.oid = func.prolang
      WHERE func.prokind = 'f'
        AND func.pronargs = 1
        AND func.provolatile = ANY(ARRAY['i', 's'])
        AND tab.relnamespace = to_regnamespace($1)::oid
        AND tab.relname = $2
    `,
    [context.schema, tableIdentifier],
  );

  const procs: PgProc[] = results.rows;

  return procs.map(p => {
    const v = p.volatility === "i" ? "immutable" : "stable";

    return {
      language: p.language,
      name: p.name,
      body: p.body,
      volatility: v,
      returns: p.return_type,
    };
  });
};

interface PgTrigger {
  trigger_name: string;
  body: string;
  language: "plpgsql";
  when_cond: string;
  cond_event: string;
  func_name: string;
}

const parseTriggerName = (actualName: string, tableName: string): string =>
  actualName.replace(/^_[0-9]+_/, "").replace(new RegExp(`^${tableName}_`), "");

export const introspectTriggers = async (
  client: PoolClient,
  tableIdentifier: PgIdentifierI,
  context: RunContextI,
): Promise<TriggerI[]> => {
  const result = await client.query(
    `
      SELECT 
        trig.tgname as trigger_name,
        func.proname as func_name,
        func.prosrc as body,
        lang.lanname as language,

        case
          when pg_has_role(tab.relowner, 'USAGE'::text) 
            THEN (regexp_match(pg_get_triggerdef(trig.oid), '.{35,} WHEN \((.+)\) EXECUTE PROCEDURE'::text))[1]
          else NULL::text
        end::text AS when_cond,

        COALESCE(
          CASE WHEN (tgtype::int::bit(7) & b'0000010')::int = 0 THEN NULL ELSE 'before' END,
          CASE WHEN (tgtype::int::bit(7) & b'0000010')::int = 0 THEN 'after' ELSE NULL END,
          CASE WHEN (tgtype::int::bit(7) & b'1000000')::int = 0 THEN NULL ELSE 'instead_of' END,
          ''
        )::text
        ||
        (CASE WHEN (tgtype::int::bit(7) & b'0000100')::int = 0 THEN '' ELSE '_insert' END) ||
        (CASE WHEN (tgtype::int::bit(7) & b'0001000')::int = 0 THEN '' ELSE '_delete' END) ||
        (CASE WHEN (tgtype::int::bit(7) & b'0010000')::int = 0 THEN '' ELSE '_update' END) as cond_event
      FROM pg_trigger as trig
      JOIN pg_class as tab
        on tab.oid = trig.tgrelid
      JOIN pg_proc as func
        on func.oid = trig.tgfoid
      JOIN pg_language as lang
        ON lang.oid = func.prolang
      WHERE tab.relnamespace = to_regnamespace($1)::oid
        AND tab.relname = $2
        AND lang.lanname <> 'internal'
    `,
    [context.schema, tableIdentifier],
  );

  const pgTriggers: PgTrigger[] = result.rows;
  const triggers: TriggerI[] = [];

  const groupedByEvent = groupBy(pgTriggers, t => t.cond_event);

  for (const event of Object.keys(groupedByEvent)) {
    if (TriggerTiming.guard(event)) {
      const sortedByName = sortBy(groupedByEvent[event], t => t.trigger_name);

      sortedByName.forEach((trig, idx) => {
        triggers.push({
          name: parseTriggerName(trig.trigger_name, tableIdentifier), // trigger names don't include their order prefix
          for_each: "row",
          timing: event,
          order: idx + 1,
          body: trig.body,
          function: trig.func_name,
          language: trig.language,
        });
      });
    }
  }

  return triggers;
};

interface PgFk {
  constraint_name: string;
  referenced_table_name: string;
  constrained_column_names: string[];
  referenced_column_names: string[];
}

export const introspectForeignKeys = async (
  client: PoolClient,
  tableIdentifier: PgIdentifierI,
  context: RunContextI,
): Promise<ForeignKeyI[]> => {
  const result = await client.query(
    `
      SELECT
        fk.conname as constraint_name,
        referenced_tab.relname as referenced_table_name,
        json_agg(constrained_columns.attname) as constrained_column_names,
        json_agg(referenced_columns.attname) as referenced_column_names
      FROM pg_constraint as fk
      JOIN pg_class as tab
        ON fk.conrelid = tab.oid
      JOIN pg_class as referenced_tab
        ON fk.confrelid = referenced_tab.oid
      JOIN pg_attribute as constrained_columns
        ON constrained_columns.attrelid = tab.oid
        AND constrained_columns.attnum = ANY(fk.conkey)
      JOIN pg_attribute as referenced_columns
        ON referenced_columns.attrelid = referenced_tab.oid
        AND referenced_columns.attnum = ANY(fk.confkey)
      WHERE fk.contype = 'f'
        AND tab.relnamespace = to_regnamespace($1)::oid
        AND tab.relname = $2
      GROUP BY 1, 2
    `,
    [context.schema, tableIdentifier],
  );

  const rows: PgFk[] = result.rows;

  const fks: ForeignKeyI[] = rows.map(fk => ({
    name: fk.constraint_name,
    on: fk.constrained_column_names,
    references: {
      table: fk.referenced_table_name,
      columns: fk.referenced_column_names,
    },
  }));

  return fks;
};

export const introspectTable = async (
  client: PoolClient,
  name: PgIdentifierI,
  context: RunContextI,
): Promise<TableI> => {
  const [
    columns,
    indexes,
    getters,
    triggers,
    foreign_keys,
  ] = await Promise.all([
    introspectColumns(client, name, context),
    introspectIndexes(client, name, context),
    introspectGetters(client, name, context),
    introspectTriggers(client, name, context),
    introspectForeignKeys(client, name, context),
  ]);

  const table: TableI = {
    name,
    columns,
    indexes,
    getters,
    triggers,
    foreign_keys,
  };

  return table;
};

const makeUndefinedIfNull = (val: any) => (val === null ? undefined : val);
