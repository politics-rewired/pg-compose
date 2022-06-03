import {
  Array,
  Boolean,
  Dictionary,
  Literal,
  Number,
  Partial,
  Record,
  Static,
  String,
  Union,
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
    (col) => {
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
  on: Array(PgIdentifier),
  references: Record({
    table: PgIdentifier,
    columns: Array(PgIdentifier),
  }),
}).And(
  Partial({
    name: PgIdentifier,
  }),
);

const CheckConstraint = Record({
  name: PgIdentifier,
  expr: String,
}).And(
  Partial({
    previous_name: PgIdentifier,
  }),
);

const UniqueConstraint = Record({
  name: PgIdentifier,
  on: Array(PgIdentifier),
}).And(Partial({ previous_name: PgIdentifier }));

const IndexColumn = Record({
  column: PgIdentifier,
}).And(
  Partial({
    order: Union(Literal("ASC"), Literal("DESC")),
    nulls: Union(Literal("FIRST"), Literal("LAST")),
  }),
);

const Index = Record({
  name: PgIdentifier,
  on: Array(IndexColumn),
})
  .And(
    Partial({
      type: String,
      previous_name: PgIdentifier,
      where: String,
      unique: Boolean,
      include: Array(Record({ column: PgIdentifier })),
      primary_key: Boolean,
      primary_key_constraint_name: PgIdentifier,
    }),
  )
  .withConstraint(
    (idx) => (idx.primary_key === true ? idx.unique === true : true),
    { name: "Primary keys must be unique" },
  );

const TriggerTiming = Union(
  Literal("before_insert"),
  Literal("instead_of_insert"),
  Literal("after_insert"),
  Literal("before_update"),
  Literal("instead_of_update"),
  Literal("after_update"),
  Literal("before_delete"),
  Literal("instead_of_delete"),
  Literal("after_delete"),
);

const Trigger = Record({
  name: PgIdentifier,
  for_each: Union(
    Literal("row"),
    // Literal("statement")
  ),
  order: Number,
  language: Literal("plpgsql"),
  body: String,
  timing: TriggerTiming,
}).And(
  Partial({
    function: PgIdentifier,
    when: String,
    previous_name: PgIdentifier,
    previous_order: Number,
  }),
);

const TraitImplementation = Record({
  trait: String,
}).And(
  Partial({
    via: Partial({
      columns: Dictionary(
        Union(String, Record({ type: Literal("getter"), name: PgIdentifier })),
        "string",
      ),
      getters: Dictionary(String, "string"),
    }),
  }),
);

const GetterVolatility = Union(Literal("immutable"), Literal("stable"));
const PgLanguageOptions = Union(Literal("sql"), Literal("plpgsql"));

const GetterContract = Record({
  name: PgIdentifier,
  returns: String,
});

const Getter = GetterContract.And(
  Record({
    body: String,
    language: PgLanguageOptions,
    volatility: GetterVolatility,
  }),
);

const Table = Record({
  name: PgIdentifier,
  columns: Array(Column),
})
  .And(
    Partial({
      previous_name: PgIdentifier,
      indexes: Array(Index),
      foreign_keys: Array(ForeignKey),
      checks: Array(CheckConstraint),
      uniques: Array(UniqueConstraint),
      implements: Array(TraitImplementation),
      getters: Array(Getter),
      triggers: Array(Trigger),
      rls_enabled: Boolean,
      fallback_for: String,
    }),
  )
  .withConstraint(
    (table) => {
      const indexes = table.indexes;
      if (indexes === undefined) {
        return true;
      }
      return indexes.filter((index) => index.primary_key === true).length <= 1;
    },
    { name: "Only 1 primary key per table" },
  )
  .withConstraint(
    (table) => {
      const primary_key = table.indexes?.find((idx) => idx.primary_key);
      if (primary_key === undefined) {
        return true;
      }
      const columnsInprimary_key = primary_key.on.map((indexCol) =>
        table.columns.find((col) => col.name === indexCol.column),
      );
      return columnsInprimary_key.every((col) => col?.nullable === false);
    },
    {
      name: "Primary keys must be on non-nullable columns ",
    },
  );

const TableExtensionSpec = Partial({
  columns: Array(Column),
  indexes: Array(Index),
  triggers: Array(Trigger),
  checks: Array(CheckConstraint),
  uniques: Array(UniqueConstraint),
  foreign_keys: Array(ForeignKey),
});

const TableExtension = Record({
  table: PgIdentifier,
}).And(TableExtensionSpec);

const TraitRequirement = Partial({
  columns: Array(Column),
  getters: Array(GetterContract),
});

const Trait = Record({
  name: String,
}).And(
  Partial({
    requires: TraitRequirement,
    provides: TableExtensionSpec,
  }),
);

interface TableI extends Static<typeof Table> {}
interface ColumnI extends Static<typeof Column> {}
interface ForeignKeyI extends Static<typeof ForeignKey> {}
interface IndexI extends Static<typeof Index> {}
interface TableExtensionI extends Static<typeof TableExtension> {}
interface TableExtensionSpecI extends Static<typeof TableExtensionSpec> {}
interface TraitImplementationI extends Static<typeof TraitImplementation> {}
interface TraitRequirementI extends Static<typeof TraitRequirement> {}
interface TraitI extends Static<typeof Trait> {}
interface GetterI extends Static<typeof Getter> {}
type TriggerI = Static<typeof Trigger>;
type ColumnDefaultI = Static<typeof ColumnDefault>;
type GetterVolatilityI = Static<typeof GetterVolatility>;
type PgLanguageOptionsI = Static<typeof PgLanguageOptions>;

export {
  Column,
  ColumnDefault,
  ColumnDefaultI,
  ColumnFunctionDefault,
  ColumnI,
  ColumnLiteralDefault,
  ForeignKey,
  ForeignKeyI,
  Getter,
  GetterI,
  GetterVolatilityI,
  Index,
  IndexI,
  PgLanguageOptionsI,
  Table,
  TableExtension,
  TableExtensionI,
  TableExtensionSpecI,
  TableI,
  Trait,
  TraitI,
  TraitImplementation,
  TraitImplementationI,
  TraitRequirementI,
  Trigger,
  TriggerI,
  TriggerTiming,
};
