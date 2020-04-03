import { ForeignKey, ForeignKeyI, Table, TableI } from "./records";
import { Tuple, Literal, Record, Union, Static, match } from "runtypes";

export enum ForeignKeyOpCodes {
  CreateForeignKey = "create_foreign_key",
  DropForeignKey = "drop_foreign_key",
}

export const CreateForeignKeyOperation = Record({
  code: Literal(ForeignKeyOpCodes.CreateForeignKey),
  foreignKey: ForeignKey,
  table: Table,
});

export const DropForeignKeyOperation = Record({
  code: Literal(ForeignKeyOpCodes.DropForeignKey),
  foreignKey: ForeignKey,
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
          foreignKey: desired,
          table: desiredTable,
        },
      ],
    ],
    [
      DropForeignKeyInput,
      ([_, current]) => [
        {
          code: ForeignKeyOpCodes.DropForeignKey,
          foreignKey: current,
          table: desiredTable,
        },
      ],
    ],
  );

export const makeReconcileForeignKeys = (desiredTable: TableI) => (
  desired: ForeignKeyI | undefined,
  current: ForeignKeyI | undefined,
): ForeignKeyOperationType[] => {
  const input = [desired, current];

  if (ReconcileForeignKeysInput.guard(input)) {
    return matchFn(desiredTable)(input);
  }

  return [];
};
