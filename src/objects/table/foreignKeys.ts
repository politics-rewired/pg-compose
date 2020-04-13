import { foreign_key, foreign_keyI, Table, TableI } from "./records";
import { Tuple, Literal, Record, Union, Static, match } from "runtypes";

export enum foreign_keyOpCodes {
  Createforeign_key = "create_foreign_key",
  Dropforeign_key = "drop_foreign_key",
}

export const Createforeign_keyOperation = Record({
  code: Literal(foreign_keyOpCodes.Createforeign_key),
  foreign_key: foreign_key,
  table: Table,
});

export const Dropforeign_keyOperation = Record({
  code: Literal(foreign_keyOpCodes.Dropforeign_key),
  foreign_key: foreign_key,
  table: Table,
});

export const foreign_keyOperation = Union(
  Createforeign_keyOperation,
  Dropforeign_keyOperation,
);

export type foreign_keyOperationType = Static<typeof foreign_keyOperation>;

const Createforeign_keyInput = Tuple(foreign_key, Literal(undefined));
const Dropforeign_keyInput = Tuple(Literal(undefined), foreign_key);

const Reconcileforeign_keysInput = Union(
  Createforeign_keyInput,
  Dropforeign_keyInput,
);

const matchFn = (desiredTable: TableI) =>
  match(
    [
      Createforeign_keyInput,
      ([desired]) => [
        {
          code: foreign_keyOpCodes.Createforeign_key,
          foreign_key: desired,
          table: desiredTable,
        },
      ],
    ],
    [
      Dropforeign_keyInput,
      ([_, current]) => [
        {
          code: foreign_keyOpCodes.Dropforeign_key,
          foreign_key: current,
          table: desiredTable,
        },
      ],
    ],
  );

export const makeReconcileforeign_keys = (desiredTable: TableI) => (
  desired: foreign_keyI | undefined,
  current: foreign_keyI | undefined,
): foreign_keyOperationType[] => {
  const input = [desired, current];

  if (Reconcileforeign_keysInput.guard(input)) {
    return matchFn(desiredTable)(input);
  }

  return [];
};
