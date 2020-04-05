import { TableI, TraitI } from "../table/records";
import { checkIdempotency } from "../test-helpers";
import { ModuleProvider } from "./index";

const eventsTable: TableI = {
  name: "events",
  columns: [
    {
      name: "id",
      type: "uuid",
      default: { type: "function", fn: "uuid_generate_v1mc()" },
      nullable: false,
    },
    {
      name: "title",
      type: "text",
    },
    {
      name: "starts_at",
      type: "timestamptz",
    },
    {
      name: "ends_at",
      type: "timestamptz",
    },
  ],
  indexes: [
    {
      name: "event_pkey",
      on: [{ column: "id" }],
      primaryKey: true,
      unique: true,
    },
  ],
};

const peopleTable: TableI = {
  name: "people",
  columns: [
    { name: "first_name", type: "text" },
    { name: "last_name", type: "text" },
    { name: "attending_event", type: "uuid" },
  ],
  foreignKeys: [
    {
      on: ["attending_event"],
      references: {
        table: "events",
        columns: ["id"],
      },
    },
  ],
};

const hasFirstNameTrait: TraitI = {
  name: "nameable",
  requires: {
    columns: [{ name: "first_name", type: "text" }],
  },
  provides: {
    columns: [{ name: "other_thing", type: "text" }],
  },
};

describe("idempotency", () => {
  test("can install two tables", async () => {
    const newOperationList = await checkIdempotency(
      ModuleProvider,
      {
        tables: [eventsTable, peopleTable],
      },
      "",
    );

    expect(newOperationList).toHaveLength(0);
  });

  test("can install a trait", async () => {
    const tableWithTraitWithoutForeignKey = Object.assign({}, peopleTable, {
      implements: [{ trait: "nameable" }],
      foreignKeys: [],
    });
    const newOperationList = await checkIdempotency(
      ModuleProvider,
      {
        tables: [tableWithTraitWithoutForeignKey],
        traits: [hasFirstNameTrait],
      },
      "",
    );
    expect(newOperationList).toHaveLength(0);
  });
});
