import {
  checkIdempotency,
  checkIdempotencyAfterTransitions,
} from "../test-helpers";
import { TableProvider } from "./index";

describe("table index idempotency", () => {
  test("basic index", async () => {
    const newOperationList = await checkIdempotency(
      TableProvider,
      {
        kind: "Table",
        name: "people",
        columns: [{ name: "first", type: "text" }],
        indexes: [{ name: "first_idx", on: [{ column: "first" }] }],
      },
      "people",
    );
    expect(newOperationList).toHaveLength(0);
  });

  test("create primary key", async () => {
    const newOperationList = await checkIdempotency(
      TableProvider,
      {
        kind: "Table",
        name: "people",
        columns: [
          {
            name: "id",
            type: "uuid",
            default: { type: "function", fn: "uuid_generate_v1mc()" },
            nullable: false,
          },
        ],
        indexes: [
          {
            name: "people_id_idx",
            on: [{ column: "id" }],
            primaryKey: true,
            unique: true,
          },
        ],
      },
      "people",
    );
    expect(newOperationList).toHaveLength(0);
  });

  test("create primary key with include", async () => {
    const newOperationList = await checkIdempotency(
      TableProvider,
      {
        kind: "Table",
        name: "people",
        columns: [
          {
            name: "id",
            type: "uuid",
            default: { type: "function", fn: "uuid_generate_v1mc()" },
            nullable: false,
          },
          {
            name: "first_name",
            type: "text",
          },
        ],
        indexes: [
          {
            name: "people_id_idx",
            on: [{ column: "id" }],
            include: [{ column: "first_name" }],
            primaryKey: true,
            unique: true,
          },
        ],
      },
      "people",
    );
    expect(newOperationList).toHaveLength(0);
  });

  test("partial unique with include", async () => {
    const newOperationList = await checkIdempotency(
      TableProvider,
      {
        kind: "Table",
        name: "people",
        columns: [
          {
            name: "id",
            type: "uuid",
            default: { type: "function", fn: "uuid_generate_v1mc()" },
            nullable: false,
          },
          {
            name: "first_name",
            type: "text",
          },
          {
            name: "archived_at",
            type: "timestamp",
          },
        ],
        indexes: [
          {
            name: "people_id_idx",
            on: [{ column: "id" }],
            include: [{ column: "first_name" }],
            where: "archived_at is null",
            unique: true,
          },
        ],
      },
      "people",
    );
    expect(newOperationList).toHaveLength(0);
  });
});

describe("table index idempotency after transitions", () => {
  test("can rename index", async () => {
    const newOperationList = await checkIdempotencyAfterTransitions(
      TableProvider,
      [
        {
          kind: "Table",
          name: "people",
          columns: [{ name: "first", type: "text" }],
          indexes: [{ name: "first_idx", on: [{ column: "first" }] }],
        },
        {
          kind: "Table",
          name: "people",
          columns: [{ name: "first", type: "text" }],
          indexes: [
            {
              name: "first_name_idx",
              previous_name: "first_idx",
              on: [{ column: "first" }],
            },
          ],
        },
      ],
      "people",
    );
    expect(newOperationList).toHaveLength(0);
  });

  test("can make an index a primary key", async () => {
    const newOperationList = await checkIdempotencyAfterTransitions(
      TableProvider,
      [
        {
          kind: "Table",
          name: "people",
          columns: [
            {
              name: "id",
              type: "uuid",
              default: { type: "function", fn: "uuid_generate_v1mc()" },
              nullable: false,
            },
          ],
          indexes: [{ name: "people_pkey", on: [{ column: "id" }] }],
        },
        {
          kind: "Table",
          name: "people",
          columns: [
            {
              name: "id",
              type: "uuid",
              default: { type: "function", fn: "uuid_generate_v1mc()" },
              nullable: false,
            },
          ],
          indexes: [
            {
              name: "people_pkey",
              on: [{ column: "id" }],
              primaryKey: true,
              unique: true,
            },
          ],
        },
      ],
      "people",
    );
    expect(newOperationList).toHaveLength(0);
  });
});
