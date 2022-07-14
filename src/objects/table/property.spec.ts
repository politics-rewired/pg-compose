import fc from "fast-check";

import { PgIdentifier } from "../core";
import { checkIdempotency } from "../test-helpers";
import { TableProvider } from "./index";
import { Column, TableI } from "./records";

const PgIdentifierArbitrary = fc
  .unicodeString(1, 20)
  .filter(PgIdentifier.guard);

type RecordShape = {
  name: string;
  type: string;
  default: string | number | undefined;
  nullable: boolean;
};

const ColumnArbitrary = fc.oneof(
  // text
  fc
    .record<RecordShape>({
      name: PgIdentifierArbitrary,
      nullable: fc.constant(true),
      type: fc.constant("text"),
      default: fc.oneof(fc.constant(undefined), fc.asciiString()),
    })
    .filter(Column.guard),
  // NOT NULL text
  fc
    .record<RecordShape>({
      name: PgIdentifierArbitrary,
      nullable: fc.constant(false),
      type: fc.constant("text"),
      default: fc.oneof(fc.asciiString()),
    })
    .filter(Column.guard),
  // numeric
  fc
    .record<RecordShape>({
      name: PgIdentifierArbitrary,
      nullable: fc.constant(true),
      type: fc.constant("numeric"),
      default: fc.oneof(fc.constant(undefined), fc.float()),
    })
    .filter(Column.guard),
  // NOT NULL numeric
  fc
    .record<RecordShape>({
      name: PgIdentifierArbitrary,
      nullable: fc.constant(false),
      type: fc.constant("numeric"),
      default: fc.oneof(fc.float()),
    })
    .filter(Column.guard),
  // integer
  fc
    .record<RecordShape>({
      name: PgIdentifierArbitrary,
      nullable: fc.constant(true),
      type: fc.constant("integer"),
      default: fc.oneof(fc.constant(undefined), fc.integer()),
    })
    .filter(Column.guard),
  // NOT NULL integer
  fc
    .record<RecordShape>({
      name: PgIdentifierArbitrary,
      nullable: fc.constant(false),
      type: fc.constant("integer"),
      default: fc.oneof(fc.integer()),
    })
    .filter(Column.guard),
  // timestamp
  fc
    .record<RecordShape>({
      name: PgIdentifierArbitrary,
      nullable: fc.constant(true),
      type: fc.constant("timestamp"),
      default: fc.oneof(fc.constant(undefined), fc.integer()),
    })
    .filter(Column.guard),
  // NOT NULL timestamp
  fc
    .record<RecordShape>({
      name: PgIdentifierArbitrary,
      nullable: fc.constant(false),
      type: fc.constant("timestamp"),
      default: fc.oneof(fc.integer()),
    })
    .filter(Column.guard),
);

const TableArbitary = fc.record({
  kind: fc.constant("Table"),
  name: PgIdentifierArbitrary,
  columns: fc.uniqueArray(ColumnArbitrary, {
    maxLength: 2,
    selector: c => c.name,
  }),
  rls_enabled: fc.boolean(),
});

const ONE_SECOND = 1000;
const TIME_LIMIT = 4 * ONE_SECOND;

fc.configureGlobal({
  interruptAfterTimeLimit: TIME_LIMIT,
  markInterruptAsFailure: false,
});

describe("table property tests", () => {
  test("idempotency", async () => {
    await fc.assert(
      fc.asyncProperty(TableArbitary, async table => {
        const newOperationList = await checkIdempotency(
          TableProvider,
          table as TableI,
          table.name,
        );
        return newOperationList.length === 0;
      }),
      { verbose: true },
    );
  });
});
