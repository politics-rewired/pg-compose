import {
  Boolean,
  String,
  Literal,
  Array,
  Record,
  Union,
  Partial,
  Dictionary,
  Static,
} from "runtypes";
import { PgIdentifier } from "../core";

const Column = Record({
  type: String,
}).And(
  Partial({
    previous_name: PgIdentifier,
    default: String,
    nullable: Boolean,
  }),
);

const ForeignKey = Record({
  on_column: PgIdentifier,
  references: Record({
    table: PgIdentifier,
    column: PgIdentifier,
  }),
});

const Index = Record({
  type: String,
  on_columns: Union(PgIdentifier, Array(PgIdentifier)),
}).And(
  Partial({
    where: String,
    unique: Boolean,
    include: Union(PgIdentifier, Array(PgIdentifier)),
  }),
);

const Table = Record({
  kind: Literal("Table"),
  name: PgIdentifier,
  columns: Dictionary(Column, "string"),
})
  .And(
    Partial({
      previous_name: PgIdentifier,
      indexes: Dictionary(Index, "string"),
      foreignKeys: Array(ForeignKey),
      primaryKey: Union(String, Array(String)),
      triggers: Record({
        before_insert: Array(Record({})),
        after_insert: Array(Record({})),
        instead_of_insert: Array(Record({})),
        before_update: Array(Record({})),
        after_update: Array(Record({})),
        instead_of_update: Array(Record({})),
        before_delete: Array(Record({})),
        after_delete: Array(Record({})),
        instead_of_delete: Array(Record({})),
      }),
      rls_enabled: Boolean,
    }),
  )
  .withConstraint(
    table =>
      Object.keys(table.columns).every(colName => PgIdentifier.guard(colName)),
    { name: "Column names must be safe PgIdentifiers" },
  )
  .withConstraint(
    table =>
      Object.keys(table.indexes || {}).every(indexName =>
        PgIdentifier.guard(indexName),
      ),
    { name: "Index names must be safe PgIdentifiers" },
  );

interface TableI extends Static<typeof Table> {}
interface ColumnI extends Static<typeof Column> {}
interface ForeignKeyI extends Static<typeof ForeignKey> {}
interface IndexI extends Static<typeof Index> {}

export {
  Table,
  Column,
  ForeignKey,
  Index,
  TableI,
  ColumnI,
  ForeignKeyI,
  IndexI,
};
