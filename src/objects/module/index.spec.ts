import { TableI, TraitI, TableExtensionI } from "../table/records";
import { checkIdempotency } from "../test-helpers";
import { ModuleProvider } from "./index";
import { ModuleI } from "./core";

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
      primary_key: true,
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
  foreign_keys: [
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
    const tableWithTraitWithoutforeign_key = Object.assign({}, peopleTable, {
      implements: [{ trait: "nameable" }],
      foreign_keys: [],
    });
    const newOperationList = await checkIdempotency(
      ModuleProvider,
      {
        tables: [tableWithTraitWithoutforeign_key],
        traits: [hasFirstNameTrait],
      },
      "",
    );
    expect(newOperationList).toHaveLength(0);
  });

  test("can install a trait with a trigger", async () => {
    const tableWithTraitWithoutforeign_key = Object.assign({}, peopleTable, {
      implements: [{ trait: "auto_update" }],
      foreign_keys: [],
    });

    const newOperationList = await checkIdempotency(
      ModuleProvider,
      {
        tables: [tableWithTraitWithoutforeign_key],
        traits: [updatedTrait],
      },
      "",
    );
    expect(newOperationList).toHaveLength(0);
  });
});

describe("extension", () => {
  test("extension is applied in a module", () => {
    const baseTable: TableI = {
      name: "people",
      columns: [
        {
          name: "first_name",
          type: "text",
        },
      ],
    };

    const extension: TableExtensionI = {
      table: "people",
      columns: [
        {
          name: "last_name",
          type: "text",
        },
      ],
    };

    const moduleWithExtension: ModuleI = {
      tables: [baseTable],
      extensions: [extension],
    };

    const moduleWithoutExtension: ModuleI = {
      tables: [
        {
          name: "people",
          columns: [
            {
              name: "first_name",
              type: "text",
              nullable: true,
            },
            {
              name: "last_name",
              type: "text",
              nullable: true,
            },
          ],
        },
      ],
    };

    const moduleOperationList = ModuleProvider.reconcile(
      moduleWithExtension,
      moduleWithoutExtension,
    );
    expect(moduleOperationList).toHaveLength(0);
  });
});

describe("fallback tables", () => {
  test("a fallback vanishes if there's another table satisfying the trait", () => {
    const fallbackTable: TableI = {
      name: "people",
      fallback_for: "nameable",
      implements: [{ trait: "nameable" }],
      columns: [
        {
          name: "first_name",
          type: "text",
          nullable: true,
        },
      ],
    };

    const trait: TraitI = {
      name: "nameable",
      requires: {
        columns: [
          {
            name: "first_name",
            type: "text",
            nullable: true,
          },
        ],
      },
    };

    const implementation: TableI = {
      name: "voters",
      implements: [{ trait: "nameable" }],
      columns: [{ name: "first_name", type: "text" }],
    };

    const moduleWithFallback: ModuleI = {
      tables: [fallbackTable, implementation],
      traits: [trait],
    };

    const moduleWithoutFallback: ModuleI = {
      tables: [fallbackTable, implementation],
      traits: [trait],
    };

    const moduleOperationList = ModuleProvider.reconcile(
      moduleWithFallback,
      moduleWithoutFallback,
    );
    expect(moduleOperationList).toHaveLength(0);
  });

  test("a fallback persists if there's no other table satisfying the trait", () => {
    const fallbackTable: TableI = {
      name: "people",
      fallback_for: "nameable",
      implements: [{ trait: "nameable" }],
      columns: [
        {
          name: "first_name",
          type: "text",
          nullable: true,
        },
      ],
    };

    const nonFallbackClone: TableI = {
      name: "people",
      implements: [{ trait: "nameable" }],
      columns: [
        {
          name: "first_name",
          type: "text",
          nullable: true,
        },
      ],
    };

    const trait: TraitI = {
      name: "nameable",
      requires: {
        columns: [
          {
            name: "first_name",
            type: "text",
          },
        ],
      },
    };

    const moduleWithFallback: ModuleI = {
      tables: [fallbackTable],
      traits: [trait],
    };

    const moduleWithoutFallback: ModuleI = {
      tables: [nonFallbackClone],
      traits: [trait],
    };

    const moduleOperationList = ModuleProvider.reconcile(
      moduleWithFallback,
      moduleWithoutFallback,
    );
    expect(moduleOperationList).toHaveLength(0);
  });
});
