import { Record, Partial, Union, Boolean, Static, String } from "runtypes";
import { PgIdentifier } from "../objects/core";
import { PoolClient } from "pg";
import { promises as fs } from "fs";

export const RunContext = Record({
  schema: PgIdentifier,
}).And(
  Partial({
    dropObjects: Union(
      Boolean,
      Record({
        tables: Boolean,
      }),
    ),
  }),
);

export const ToFileRunContext = RunContext.And(
  Record({
    outFile: String,
  }),
);

export interface RunContextI extends Static<typeof RunContext> {
  client: PoolClient;
}

export interface ToFileRunContextI extends Static<typeof ToFileRunContext> {
  client: PoolClient;
}

type ToStatementFunction<OperationType> = (
  operation: OperationType,
  context: RunContextI,
) => string;

// type Runner<OperationType> = (
//   operations: OperationType[],
//   toStatement: ToStatementFunction<OperationType>,
//   context: RunContextI,
// ) => Promise<void>;

export const directRunner = async <OperationType>(
  operations: OperationType[],
  toStatement: ToStatementFunction<OperationType>,
  context: RunContextI,
): Promise<void> => {
  for (const op of operations) {
    const statement = toStatement(op, context);

    try {
      await context.client.query(statement);
    } catch (ex) {
      console.error(`Error running operation ${JSON.stringify(op)}: `, ex);
    }
  }
};

export const fileRunner = async <OperationType>(
  operations: OperationType[],
  toStatement: ToStatementFunction<OperationType>,
  context: ToFileRunContextI,
): Promise<void> => {
  const allStatements = operations.map(op => toStatement(op, context));
  const contents = allStatements.join("\n");

  await fs.writeFile(context.outFile, contents);
};
