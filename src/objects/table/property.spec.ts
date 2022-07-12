import fc, { Arbitrary } from "fast-check";
import { sample } from "lodash";

import { PgIdentifier } from "../core";
import { checkIdempotency } from "../test-helpers";
import { TableProvider } from "./index";
import { Column, TableI } from "./records";

const PgIdentifierArbitrary = fc
  .unicodeString({ minLength: 1, maxLength: 20 })
  .filter(PgIdentifier.guard);

type RecordShape = {
  name: string;
  type: string;
  default: string | number | undefined;
  nullable: boolean;
};

type RecordTypeDefaultArbitrary = {
  [A in keyof Pick<RecordShape, "type" | "default">]: Arbitrary<RecordShape[A]>;
};

const pairings: RecordTypeDefaultArbitrary[] = [
  {
    type: fc.constant("text"),
    default: fc.oneof(fc.constant(undefined), fc.asciiString()),
  },
  {
    type: fc.constant("numeric"),
    default: fc.oneof(fc.constant(undefined), fc.float()),
  },
  {
    type: fc.constant("integer"),
    default: fc.oneof(fc.constant(undefined), fc.integer()),
  },
  {
    type: fc.constant("timestamp"),
    default: fc.oneof(fc.constant(undefined), fc.integer()),
  },
];

const ColumnArbitrary = fc
  .record<RecordShape>({
    name: PgIdentifierArbitrary,
    nullable: fc.boolean(),
    ...sample(pairings)!,
  })
  .filter(Column.guard);

const TableArbitary = fc.record({
  kind: fc.constant("Table"),
  name: PgIdentifierArbitrary,
  columns: fc.array(ColumnArbitrary),
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
