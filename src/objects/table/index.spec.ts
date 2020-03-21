import { TableObject } from "./index";
import { Pool } from "pg";
import { checkIdempotency } from "../test-helpers";

const pool = new Pool();

describe("after migration, the operation list should be empty", () => {
  test("basic table", async () => {
    const newOperationList = await checkIdempotency(
      pool,
      TableObject,
      {
        kind: "Table",
        name: "people",
        columns: {
          first_name: {
            type: "text",
          },
          last_name: {
            type: "text",
          },
        },
      },
      "people",
    );
    expect(newOperationList).toHaveLength(0);
  });

  test("table with default and not nullable columns", async () => {
    const newOperationList = await checkIdempotency(
      pool,
      TableObject,
      {
        kind: "Table",
        name: "people",
        columns: {
          first_name: {
            type: "text",
            nullable: false,
          },
          last_name: {
            type: "text",
            default: "Smith",
          },
        },
      },
      "people",
    );
    expect(newOperationList).toHaveLength(0);
  });
});
