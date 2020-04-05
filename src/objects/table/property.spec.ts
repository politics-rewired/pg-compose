import { checkIdempotency } from "../test-helpers";
import fc from "fast-check";
import { TableI, Column } from "./records";
import { TableProvider } from "./index";
import { PgIdentifier } from "../core";

const PgIdentifierArbitrary = fc
  .unicodeString(1, 20)
  .filter(PgIdentifier.guard);

const ColumnArbitrary = fc
  .record({
    name: PgIdentifierArbitrary,
    type: fc.oneof(
      fc.constant("text"),
      fc.constant("integer"),
      fc.constant("numeric"),
      fc.constant("timestamp"),
    ),
    default: fc.oneof(fc.constant(undefined), fc.asciiString()),
    nullable: fc.boolean(),
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
    );
  });
});
