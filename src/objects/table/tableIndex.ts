import { IndexI, Index, Table, TableI } from "./records";
import { Record, Literal, Static, Tuple, Union, match } from "runtypes";

export enum IndexOpCodes {
  CreateIndex = "create_index",
  RenameIndex = "rename_index",
  DropIndex = "drop_index",
  MakeIndexPrimaryKey = "make_index_primary_key",
  DropPrimaryKey = "drop_primary_key",
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

export const MakeIndexPrimaryKeyOperation = Record({
  code: Literal(IndexOpCodes.MakeIndexPrimaryKey),
  index: Index,
  table: Table,
});

export const DropPrimaryKeyOperation = Record({
  code: Literal(IndexOpCodes.DropPrimaryKey),
  index: Index,
  table: Table,
});

export const IndexOperation = Union(
  CreateIndexOperation,
  RenameIndexOperation,
  DropIndexOperation,
  MakeIndexPrimaryKeyOperation,
  DropPrimaryKeyOperation,
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
          desired.primaryKey
            ? [
                {
                  code: IndexOpCodes.MakeIndexPrimaryKey,
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
            current.primaryKey === true
              ? IndexOpCodes.DropPrimaryKey
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
          desired.primaryKey === true &&
          desired.primaryKey !== current.primaryKey
        ) {
          operations.push({
            code: IndexOpCodes.MakeIndexPrimaryKey,
            index: desired,
            table: desiredTable,
          });
        }

        if (
          current.primaryKey === true &&
          desired.primaryKey !== current.primaryKey
        ) {
          operations.push({
            code: IndexOpCodes.CreateIndex,
            index: desired,
            table: desiredTable,
          });

          operations.push({
            code: IndexOpCodes.DropPrimaryKey,
            index: current,
            table: desiredTable,
          });
        }

        return operations;
      },
    ],
  );

export const makeReconcileIndexes = (desiredTable: TableI) => (
  desired: IndexI | undefined,
  current: IndexI | undefined,
): IndexOperationType[] => {
  const input = [desired, current];

  if (ReconcileIndexInput.guard(input)) {
    return matchFn(desiredTable)(input);
  }

  return [];
};
