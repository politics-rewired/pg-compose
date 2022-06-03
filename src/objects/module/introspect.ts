import { PoolClient } from "pg";

import { RunContextI } from "../../runners";
import { PgIdentifierI } from "../core";
import { FunctionProvider } from "../functions";
import { TableProvider } from "../table";
import { ModuleI } from "./core";

interface PgTables {
  name: string;
}

export const introspectModule = async (
  client: PoolClient,
  _identifier: PgIdentifierI,
  context: RunContextI,
): Promise<ModuleI> => {
  const result = await client.query(
    `
      SELECT relname as name
      FROM pg_class
      WHERE relnamespace = to_regnamespace($1)::oid
        AND relkind = 'r'
    `,
    [context.schema],
  );

  const tableIdentifiers: PgTables[] = result.rows;

  const tables = await Promise.all(
    tableIdentifiers.map((t) =>
      TableProvider.introspect(client, t.name, context),
    ),
  );

  const functions = await FunctionProvider.introspectMany(client, context);

  return { tables, functions };
};
