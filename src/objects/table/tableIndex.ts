import { IndexI, Index, Table, TableI } from "./records";
import { Record, Literal, Static, Union } from "runtypes";
import { PgIdentifier, PgIdentifierI } from "../core";

export enum IndexOpCodes {
  CreateIndex = "create_index",
  RenameIndex = "rename_index",
  DropIndex = "drop_index",
  MakeIndexPrimaryKey = "make_index_primary_key",
  MakeIndexNotPrimaryKey = "make_index_not_primary_key",
}

const CreateIndexOperation = Record({
  code: Literal(IndexOpCodes.CreateIndex),
  index: Index,
  indexName: PgIdentifier,
  table: Table,
});

const RenameIndexOperation = Record({
  code: Literal(IndexOpCodes.RenameIndex),
  index: Index,
  indexName: PgIdentifier,
  table: Table,
});

const DropIndexOperation = Record({
  code: Literal(IndexOpCodes.DropIndex),
  index: Index,
  indexName: PgIdentifier,
  table: Table,
});

const MakeIndexPrimaryKeyOperation = Record({
  code: Literal(IndexOpCodes.MakeIndexPrimaryKey),
  index: Index,
  indexName: PgIdentifier,
  table: Table,
});

const MakeIndexNotPrimaryKeyOperation = Record({
  code: Literal(IndexOpCodes.MakeIndexNotPrimaryKey),
  index: Index,
  indexName: PgIdentifier,
  table: Table,
});

const IndexOperation = Union(
  CreateIndexOperation,
  RenameIndexOperation,
  DropIndexOperation,
  MakeIndexPrimaryKeyOperation,
  MakeIndexNotPrimaryKeyOperation,
);

export type IndexOperationType = Static<typeof IndexOperation>;

export const reconileIndex = (
  desired: IndexI,
  current: IndexI | undefined,
  desiredTable: TableI,
  indexName: PgIdentifierI,
): IndexOperationType[] => {
  const operations: IndexOperationType[] = [];

  // Check for a creation
  if (current === undefined) {
    operations.push({
      code: IndexOpCodes.CreateIndex,
      index: desired,
      table: desiredTable,
      indexName,
    });
  }

  if (desired === undefined && Index.guard(current)) {
    operations.push({
      code: IndexOpCodes.DropIndex,
      index: current,
      table: desiredTable,
      indexName,
    });
  }

  // Check for a rename
  // if (desired.previous_name && desired.previous_name === ) {
  //   operations.push({
  //     code: IndexOpCodes.RenameIndex,
  //     index: desired,
  //     table: desiredTable,
  //     indexName,
  //   });
  // }

  return operations;
};
