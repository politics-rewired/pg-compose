import { ObjectProvider, PgIdentifierI } from "./core";
import { RunContextI } from "../runners";
import { Pool } from "pg";
import { DefaultLogger } from "../logger";

const pool = new Pool();

export const checkIdempotency = async <ObjectType, OperationType>(
  object: ObjectProvider<ObjectType, OperationType>,
  desired: ObjectType,
  identifier: PgIdentifierI,
): Promise<OperationType[]> => {
  const client = await pool.connect();
  await client.query("begin");

  const context: RunContextI = { schema: "public", client, logger: DefaultLogger };

  const operationList = await object.reconcile(desired, undefined);
  const statements = operationList.map(o => {
    return object.toStatement(context)(o);
  });

  for (const statement of statements) {
    await client.query(statement);
  }

  let current: ObjectType | undefined;

  if (object.type === "single") {
    current = await object.introspect(client, identifier, context);
  } else {
    const allOptions = await object.introspectMany(client, context);
    current = allOptions.find(opt => object.identityFn(desired, opt));
  }

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

  const context: RunContextI = { schema: "public", client, logger: DefaultLogger };

  const beforeOperationList = await object.reconcile(before, undefined);
  const beforeStatements = beforeOperationList.map(o =>
    object.toStatement(context)(o),
  );

  for (const statement of beforeStatements) {
    await client.query(statement);
  }

  const operationList = await object.reconcile(toTest, undefined);
  const statements = operationList.map(o => {
    const statement = object.toStatement(context)(o);
    return statement;
  });

  for (const statement of statements) {
    await client.query(statement);
  }

  let current: ObjectType | undefined;

  if (object.type === "single") {
    current = await object.introspect(client, identifier, context);
  } else {
    const allOptions = await object.introspectMany(client, context);
    current = allOptions.find(opt => object.identityFn(toTest, opt));
  }

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

  const context: RunContextI = { schema: "public", client, logger: DefaultLogger };

  let runs = 0;
  let current: ObjectType | undefined = undefined;
  let desired = desireds[0];

  while (runs < desireds.length) {
    desired = desireds[runs];

    const operationList = await object.reconcile(desired, current);
    const statements = operationList.map(o => object.toStatement(context)(o));

    for (const statement of statements) {
      await client.query(statement);
    }

    if (object.type === "single") {
      current = await object.introspect(client, identifier, context);
    } else {
      const allOptions = await object.introspectMany(client, context);
      current = allOptions.find(opt => object.identityFn(desired, opt));
    }

    runs++;
  }

  await client.query("rollback");
  return object.reconcile(desired, current);
};
