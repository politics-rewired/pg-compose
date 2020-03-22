import { PgObject, RunContextI, PgIdentifierI } from "./core";
import { Pool } from "pg";

const pool = new Pool();

export const checkIdempotency = async <ObjectType, OperationType>(
  object: PgObject<ObjectType, OperationType>,
  desired: ObjectType,
  identifier: PgIdentifierI,
): Promise<OperationType[]> => {
  const client = await pool.connect();
  await client.query("begin");

  const context: RunContextI = { schema: "public" };

  const operationList = object.reconcile(desired, undefined);
  const statements = operationList.map(o => object.toStatement(context)(o));

  for (const statement of statements) {
    await client.query(statement);
  }

  const current = await object.introspect(client, identifier, context);

  await client.query("rollback");
  return object.reconcile(desired, current);
};
