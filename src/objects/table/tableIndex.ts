import { Literal, match, Record, Static, Tuple, Union } from "runtypes";

import { Index, IndexI, Table, TableI } from "./records";

export enum IndexOpCodes {
  CreateIndex = "create_index",
  RenameIndex = "rename_index",
  DropIndex = "drop_index",
  MakeIndexprimary_key = "make_index_primary_key",
  Dropprimary_key = "drop_primary_key",
}

export const CreateIndexOperation = Record({
  code: Literal(IndexOpCodes.CreateIndex),
  index: Index,
  table: Table,
});

export const RenameIndexOperation = Record({
  code: Literal(IndexOpCodes.RenameIndex),
  index: Index,
  table: Table,
});

export const DropIndexOperation = Record({
  code: Literal(IndexOpCodes.DropIndex),
  index: Index,
  table: Table,
});

export const MakeIndexprimary_keyOperation = Record({
  code: Literal(IndexOpCodes.MakeIndexprimary_key),
  index: Index,
  table: Table,
});

export const Dropprimary_keyOperation = Record({
  code: Literal(IndexOpCodes.Dropprimary_key),
  index: Index,
  table: Table,
});

export const IndexOperation = Union(
  CreateIndexOperation,
  RenameIndexOperation,
  DropIndexOperation,
  MakeIndexprimary_keyOperation,
  Dropprimary_keyOperation,
);

export type IndexOperationType = Static<typeof IndexOperation>;

const CreateIndexInput = Tuple(Index, Literal(undefined));
const DropIndexInput = Tuple(Literal(undefined), Index);
const AlterIndexInput = Tuple(Index, Index);

const ReconcileIndexInput = Union(
  CreateIndexInput,
  DropIndexInput,
  AlterIndexInput,
);

const matchFn = (desiredTable: TableI) =>
  match(
    [
      CreateIndexInput,
      ([desired]) =>
        [
          {
            code: IndexOpCodes.CreateIndex,
            index: desired,
            table: desiredTable,
          },
        ].concat(
          desired.primary_key
            ? [
                {
                  code: IndexOpCodes.MakeIndexprimary_key,
                  index: desired,
                  table: desiredTable,
                },
              ]
            : [],
        ),
    ],
    [
      DropIndexInput,
      ([_, current]) => [
        {
          code:
            current.primary_key === true
              ? IndexOpCodes.Dropprimary_key
              : IndexOpCodes.DropIndex,
          index: current,
          table: desiredTable,
        },
      ],
    ],
    [
      AlterIndexInput,
      ([desired, current]) => {
        const operations: IndexOperationType[] = [];

        if (
          desired.name !== current.name &&
          desired.previous_name === current.name
        ) {
          operations.push({
            code: IndexOpCodes.RenameIndex,
            index: desired,
            table: desiredTable,
          });
        }

        if (desired.unique === true && desired.unique !== current.unique) {
          operations.push({
            code: IndexOpCodes.RenameIndex,
            index: Object.assign({}, desired, {
              previous_name: desired.name,
              name: `${desired.name}_cordoned`,
            }),
            table: desiredTable,
          });

          operations.push({
            code: IndexOpCodes.CreateIndex,
            index: desired,
            table: desiredTable,
          });

          operations.push({
            code: IndexOpCodes.DropIndex,
            index: Object.assign({}, current, {
              previous_name: desired.name,
              name: `${desired.name}_cordoned`,
            }),
            table: desiredTable,
          });
        }

        if (
          desired.primary_key === true &&
          desired.primary_key !== current.primary_key
        ) {
          operations.push({
            code: IndexOpCodes.MakeIndexprimary_key,
            index: desired,
            table: desiredTable,
          });
        }

        if (
          current.primary_key === true &&
          desired.primary_key !== current.primary_key
        ) {
          operations.push({
            code: IndexOpCodes.CreateIndex,
            index: desired,
            table: desiredTable,
          });

          operations.push({
            code: IndexOpCodes.Dropprimary_key,
            index: current,
            table: desiredTable,
          });
        }

        return operations;
      },
    ],
  );

export const makeReconcileIndexes = (desiredTable: TableI) => async (
  desired: IndexI | undefined,
  current: IndexI | undefined,
): Promise<IndexOperationType[]> => {
  const input = [desired, current];

  if (ReconcileIndexInput.guard(input)) {
    return matchFn(desiredTable)(input);
  }

  return [];
};
