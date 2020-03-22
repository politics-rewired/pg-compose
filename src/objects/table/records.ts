import {
  Boolean,
  String,
  Literal,
  Array,
  Record,
  Union,
  Partial,
  Static,
} from "runtypes";
import { PgIdentifier } from "../core";

const ColumnFunctionDefault = Record({
  type: Literal("function"),
  fn: String,
});

const ColumnLiteralDefault = String;

const ColumnDefault = Union(ColumnFunctionDefault, ColumnLiteralDefault);

const Column = Record({
  name: PgIdentifier,
  type: String,
})
  .And(
    Partial({
      previous_name: PgIdentifier,
      default: ColumnDefault,
      nullable: Boolean,
    }),
  )
  .withConstraint(
    col => {
      if (
        col.default === undefined ||
        ColumnFunctionDefault.guard(col.default)
      ) {
        return true;
      }

      if (["numeric", "decimal", "real"].includes(col.type.toLowerCase())) {
        const defaultAsFloat = parseFloat(col.default);
        return parseFloat(defaultAsFloat.toString()) == parseFloat(col.default);
      }

      if (["timestamp", "date", "time"].includes(col.type.toLowerCase())) {
        const defaultAsDate = new Date(col.default);
        return new Date(defaultAsDate.toString()) == new Date(col.default);
      }

      return true;
    },
    { name: "Column default must be numeric if its type is numeric" },
  );

const ForeignKey = Record({
  name: PgIdentifier,
  on_column: PgIdentifier,
  references: Record({
    table: PgIdentifier,
    column: PgIdentifier,
  }),
});

const Index = Record({
  name: PgIdentifier,
  on_columns: Union(PgIdentifier, Array(PgIdentifier)),
}).And(
  Partial({
    type: String,
    previous_name: PgIdentifier,
    where: String,
    unique: Boolean,
    include: Union(PgIdentifier, Array(PgIdentifier)),
    primaryKey: Boolean,
  }),
);

const Trigger = Record({
  name: PgIdentifier,
  when: String,
  for_each: Union(Literal("row"), Literal("statement")),
}).And(
  Record({
    language: PgIdentifier,
    body: String,
  }).Or(
    Record({
      function: PgIdentifier,
    }),
  ),
);

const Table = Record({
  kind: Literal("Table"),
  name: PgIdentifier,
  columns: Array(Column),
})
  .And(
    Partial({
      previous_name: PgIdentifier,
      indexes: Array(Index),
      foreignKeys: Array(ForeignKey),
      triggers: Record({
        before_insert: Array(Trigger),
        after_insert: Array(Trigger),
        instead_of_insert: Array(Trigger),
        before_update: Array(Trigger),
        after_update: Array(Trigger),
        instead_of_update: Array(Trigger),
        before_delete: Array(Trigger),
        after_delete: Array(Trigger),
        instead_of_delete: Array(Trigger),
      }),
      rls_enabled: Boolean,
    }),
  )
  .withConstraint(
    table => {
      const indexes = table.indexes;

      if (indexes === undefined) {
        return true;
      }

      return indexes.filter(index => index.primaryKey === true).length <= 1;
    },
    { name: "Only 1 primary key per table" },
  );

interface TableI extends Static<typeof Table> {}
interface ColumnI extends Static<typeof Column> {}
interface ForeignKeyI extends Static<typeof ForeignKey> {}
interface IndexI extends Static<typeof Index> {}
type TriggerI = Static<typeof Trigger>;
type ColumnDefaultI = Static<typeof ColumnDefault>;

export {
  Table,
  Column,
  ForeignKey,
  Index,
  ColumnFunctionDefault,
  ColumnLiteralDefault,
  TableI,
  ColumnI,
  ForeignKeyI,
  IndexI,
  TriggerI,
  ColumnDefaultI,
};
