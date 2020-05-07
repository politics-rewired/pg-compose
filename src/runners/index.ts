import { Record, Partial, Union, Boolean, Static, String } from "runtypes";
import { PgIdentifier } from "../objects/core";
import { ModuleOperationType } from "../objects/module";
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

export type Runner = (
  operations: ModuleOperationType[],
  toStatement: ToStatementFunction<ModuleOperationType>,
  context: RunContextI | ToFileRunContextI,
) => Promise<void>;

export const directRunner: Runner = async (
  operations: ModuleOperationType[],
  toStatement: ToStatementFunction<ModuleOperationType>,
  context: RunContextI,
): Promise<void> => {
  for (const op of operations) {
    const statement = toStatement(op, context);

    try {
      await context.client.query(statement);
    } catch (ex) {
      console.error(
        `Error running operation ${op.code}. Tried statement: \n\n${statement}\n\nGot error: `,
        ex,
      );
      // process.exit(1);
    }
  }
};

export const fileRunner: Runner = async (
  operations: ModuleOperationType[],
  toStatement: ToStatementFunction<ModuleOperationType>,
  context: ToFileRunContextI,
): Promise<void> => {
  const allStatements = operations.map(op => toStatement(op, context));
  const contents = allStatements.join("\n");

  await fs.writeFile(context.outFile, contents);
};
