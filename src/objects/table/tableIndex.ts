import { IndexI, Index, Table, TableI } from "./records";
import { Record, Literal, Static, Tuple, Union, Void, match } from "runtypes";

export enum IndexOpCodes {
  CreateIndex = "create_index",
  RenameIndex = "rename_index",
  DropIndex = "drop_index",
  MakeIndexPrimaryKey = "make_index_primary_key",
  DropPrimaryKey = "drop_primary_key",
}

const CreateIndexOperation = Record({
  code: Literal(IndexOpCodes.CreateIndex),
  index: Index,
  table: Table,
});

const RenameIndexOperation = Record({
  code: Literal(IndexOpCodes.RenameIndex),
  index: Index,
  table: Table,
});

const DropIndexOperation = Record({
  code: Literal(IndexOpCodes.DropIndex),
  index: Index,
  table: Table,
});

const MakeIndexPrimaryKeyOperation = Record({
  code: Literal(IndexOpCodes.MakeIndexPrimaryKey),
  index: Index,
  table: Table,
});

const DropPrimaryKeyOperation = Record({
  code: Literal(IndexOpCodes.DropPrimaryKey),
  index: Index,
  table: Table,
});

const IndexOperation = Union(
  CreateIndexOperation,
  RenameIndexOperation,
  DropIndexOperation,
  MakeIndexPrimaryKeyOperation,
  DropPrimaryKeyOperation,
);

export type IndexOperationType = Static<typeof IndexOperation>;

const CreateIndexInput = Tuple(Index, Void);
const DropIndexInput = Tuple(Void, Index);
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
      ([desired]) => [
        { code: IndexOpCodes.CreateIndex, index: desired, table: desiredTable },
      ],
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
            index: current,
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
          current.primaryKey == true &&
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

export const reconileIndex = (
  desired: IndexI | undefined,
  current: IndexI | undefined,
  desiredTable: TableI,
): IndexOperationType[] => {
  const input = [desired, current];

  if (ReconcileIndexInput.guard(input)) {
    return matchFn(desiredTable)(input);
  }

  return [];
};
