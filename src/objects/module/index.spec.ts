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
    { name: "updated_at", type: "timestamptz" },
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

const updatedTrait: TraitI = {
  name: "auto_update",
  requires: {
    columns: [{ name: "updated_at", type: "timestamptz" }],
  },
  provides: {
    triggers: [
      {
        name: "auto_update_updated_at",
        timing: "before_update",
        language: "plpgsql",
        body: "begin NEW.{{ updated_at }} = now(); return NEW; end;",
        for_each: "row",
        order: 1,
      },
    ],
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

  test("can install a trait with a trigger", async () => {
    const tableWithTraitWithoutForeignKey = Object.assign({}, peopleTable, {
      implements: [{ trait: "auto_update" }],
      foreignKeys: [],
    });

    const newOperationList = await checkIdempotency(
      ModuleProvider,
      {
        tables: [tableWithTraitWithoutForeignKey],
        traits: [updatedTrait],
      },
      "",
    );
    expect(newOperationList).toHaveLength(0);
  });
});
