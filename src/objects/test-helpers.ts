import { ObjectProvider, PgIdentifierI } from "./core";
import { RunContextI } from "../runners";
import { Pool } from "pg";

const pool = new Pool();

export const checkIdempotency = async <ObjectType, OperationType>(
  object: ObjectProvider<ObjectType, OperationType>,
  desired: ObjectType,
  identifier: PgIdentifierI,
): Promise<OperationType[]> => {
  const client = await pool.connect();
  await client.query("begin");

  const context: RunContextI = { schema: "public", client };

  const operationList = object.reconcile(desired, undefined);
  const statements = operationList.map(o => object.toStatement(context)(o));

  for (const statement of statements) {
    await client.query(statement);
  }

  const current = await object.introspect(client, identifier, context);

  await client.query("rollback");
  return object.reconcile(desired, current);
};

export const checkIdempotencyOnSecondTable = async <ObjectType, OperationType>(
  object: ObjectProvider<ObjectType, OperationType>,
  before: ObjectType,
  toTest: ObjectType,
  identifier: PgIdentifierI,
): Promise<OperationType[]> => {
  const client = await pool.connect();
  await client.query("begin");

  const context: RunContextI = { schema: "public", client };

  const beforeOperationList = object.reconcile(before, undefined);
  const beforeStatements = beforeOperationList.map(o =>
    object.toStatement(context)(o),
  );

  for (const statement of beforeStatements) {
    await client.query(statement);
  }

  const operationList = object.reconcile(toTest, undefined);
  const statements = operationList.map(o => object.toStatement(context)(o));

  for (const statement of statements) {
    await client.query(statement);
  }

  const current = await object.introspect(client, identifier, context);

  await client.query("rollback");
  return object.reconcile(toTest, current);
};

export const checkIdempotencyAfterTransitions = async <
  ObjectType,
  OperationType
>(
  object: ObjectProvider<ObjectType, OperationType>,
  desireds: ObjectType[],
  identifier: PgIdentifierI,
): Promise<OperationType[]> => {
  const client = await pool.connect();
  await client.query("begin");

  const context: RunContextI = { schema: "public", client };

  let runs = 0;
  let current = undefined;
  let desired = desireds[0];

  while (runs < desireds.length) {
    desired = desireds[runs];

    const operationList = object.reconcile(desired, current);
    const statements = operationList.map(o => object.toStatement(context)(o));

    for (const statement of statements) {
      await client.query(statement);
    }

    current = await object.introspect(client, identifier, context);
    runs++;
  }

  await client.query("rollback");
  return object.reconcile(desired, current);
};
