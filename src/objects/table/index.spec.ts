import { TableObject } from "./index";
import { checkIdempotency } from "../test-helpers";

describe("after migration, the operation list should be empty", () => {
  test("basic table", async () => {
    const newOperationList = await checkIdempotency(
      TableObject,
      {
        kind: "Table",
        name: "people",
        columns: [
          {
            name: "first_name",
            type: "text",
          },
          {
            name: "last_name",
            type: "text",
          },
        ],
      },
      "people",
    );

    expect(newOperationList).toHaveLength(0);
  });

  test("table with default and not nullable columns", async () => {
    const newOperationList = await checkIdempotency(
      TableObject,
      {
        kind: "Table",
        name: "people",
        columns: [
          {
            name: "first_name",
            type: "text",
            nullable: false,
          },
          {
            name: "last_name",
            type: "text",
            default: "Smith",
          },
        ],
      },
      "people",
    );

    expect(newOperationList).toHaveLength(0);
  });

  test("table with primary keys", async () => {
    const newOperationList = await checkIdempotency(
      TableObject,
      {
        kind: "Table",
        name: "people",
        columns: [
          {
            name: "id",
            type: "uuid",
            default: { type: "function", fn: "uuid_generate_v1mc()" },
          },
          {
            name: "full_name",
            type: "text",
            nullable: false,
          },
        ],
        indexes: [
          {
            name: "people_primary_key",
            on_columns: "id",
            primaryKey: true,
          },
        ],
      },
      "people",
    );

    expect(newOperationList).toHaveLength(0);
  });
});
