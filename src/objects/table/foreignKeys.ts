import { Literal, match, Record, Static, Tuple, Union } from "runtypes";

import { ForeignKey, ForeignKeyI, Table, TableI } from "./records";

export enum ForeignKeyOpCodes {
  CreateForeignKey = "create_foreign_key",
  DropForeignKey = "drop_foreign_key",
}

export const CreateForeignKeyOperation = Record({
  code: Literal(ForeignKeyOpCodes.CreateForeignKey),
  foreign_key: ForeignKey,
  table: Table,
});

export const DropForeignKeyOperation = Record({
  code: Literal(ForeignKeyOpCodes.DropForeignKey),
  foreign_key: ForeignKey,
  table: Table,
});

export const ForeignKeyOperation = Union(
  CreateForeignKeyOperation,
  DropForeignKeyOperation,
);

export type ForeignKeyOperationType = Static<typeof ForeignKeyOperation>;

const CreateForeignKeyInput = Tuple(ForeignKey, Literal(undefined));
const DropForeignKeyInput = Tuple(Literal(undefined), ForeignKey);

const ReconcileForeignKeysInput = Union(
  CreateForeignKeyInput,
  DropForeignKeyInput,
);

const matchFn = (desiredTable: TableI) =>
  match(
    [
      CreateForeignKeyInput,
      ([desired]) => [
        {
          code: ForeignKeyOpCodes.CreateForeignKey,
          foreign_key: desired,
          table: desiredTable,
        },
      ],
    ],
    [
      DropForeignKeyInput,
      ([_, current]) => [
        {
          code: ForeignKeyOpCodes.DropForeignKey,
          foreign_key: current,
          table: desiredTable,
        },
      ],
    ],
  );

export const makeReconcileForeignKeys = (desiredTable: TableI) => async (
  desired: ForeignKeyI | undefined,
  current: ForeignKeyI | undefined,
): Promise<ForeignKeyOperationType[]> => {
  const input = [desired, current];

  if (ReconcileForeignKeysInput.guard(input)) {
    return matchFn(desiredTable)(input);
  }

  return [];
};
