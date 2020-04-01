import { enforceTrait } from "./trait";
import { TraitI } from "./records";

describe("trait enforcement - column", () => {
  const hasFirstNameTrait: TraitI = {
    kind: "Trait",
    name: "nameable",
    requires: {
      columns: [{ name: "given_name", type: "text" }],
    },
  };

  const hasNotNullFirstNameTrait: TraitI = {
    kind: "Trait",
    name: "nameable",
    requires: {
      columns: [{ name: "given_name", type: "text", nullable: false }],
    },
  };

  test("basic - passes", () => {
    const successOrErrors = enforceTrait(hasFirstNameTrait, {
      kind: "Table",
      name: "people",
      implements: [{ trait: "nameable" }],
      columns: [{ name: "given_name", type: "text" }],
    });

    expect(successOrErrors).toBe(true);
  });

  test("basic - fails", () => {
    const successOrErrors = enforceTrait(hasFirstNameTrait, {
      kind: "Table",
      name: "people",
      implements: [{ trait: "nameable" }],
      columns: [{ name: "first_name", type: "text" }],
    });

    expect(Array.isArray(successOrErrors)).toBe(true);
    expect(successOrErrors).toHaveLength(1);
  });

  test("passes with via", () => {
    const successOrErrors = enforceTrait(hasFirstNameTrait, {
      kind: "Table",
      name: "people",
      implements: [
        { trait: "nameable", via: { columns: { given_name: "first_name" } } },
      ],
      columns: [{ name: "first_name", type: "text" }],
    });

    expect(successOrErrors).toBe(true);
  });

  test("fails with bad alias", () => {
    const successOrErrors = enforceTrait(hasFirstNameTrait, {
      kind: "Table",
      name: "people",
      implements: [
        { trait: "nameable", via: { columns: { given_name: "first_name" } } },
      ],
      columns: [{ name: "given_name", type: "text" }],
    });

    expect(Array.isArray(successOrErrors)).toBe(true);
    expect(successOrErrors).toHaveLength(1);
  });

  test("fails with type mismatch", () => {
    const successOrErrors = enforceTrait(hasFirstNameTrait, {
      kind: "Table",
      name: "people",
      implements: [{ trait: "nameable" }],
      columns: [{ name: "given_name", type: "integer" }],
    });

    expect(Array.isArray(successOrErrors)).toBe(true);
    expect(successOrErrors).toHaveLength(1);
  });

  test("not nullable - fails with nullable mismatch", () => {
    const successOrErrors = enforceTrait(hasNotNullFirstNameTrait, {
      kind: "Table",
      name: "people",
      implements: [{ trait: "nameable" }],
      columns: [{ name: "given_name", type: "text" }],
    });

    expect(Array.isArray(successOrErrors)).toBe(true);
    expect(successOrErrors).toHaveLength(1);
  });

  test("passes with not-nullable", () => {
    const successOrErrors = enforceTrait(hasNotNullFirstNameTrait, {
      kind: "Table",
      name: "people",
      implements: [{ trait: "nameable" }],
      columns: [{ name: "given_name", type: "text", nullable: false }],
    });

    expect(successOrErrors).toBe(true);
  });

  test("passes with getter", () => {
    const successOrErrors = enforceTrait(hasFirstNameTrait, {
      kind: "Table",
      name: "people",
      implements: [
        {
          trait: "nameable",
          via: {
            columns: { given_name: { type: "getter", name: "first_name" } },
          },
        },
      ],
      columns: [{ name: "full_name", type: "text" }],
      getters: [
        {
          language: "sql" as "sql",
          name: "first_name",
          volatility: "stable" as "stable",
          body: `select string_to_array(full_name, ' ')[1]`,
          returns: "text",
        },
      ],
    });

    expect(successOrErrors).toBe(true);
  });

  test("fails with getter type mismatch", () => {
    const successOrErrors = enforceTrait(hasFirstNameTrait, {
      kind: "Table",
      name: "people",
      implements: [
        {
          trait: "nameable",
          via: {
            columns: { given_name: { type: "getter", name: "first_name" } },
          },
        },
      ],
      columns: [{ name: "full_name", type: "text" }],
      getters: [
        {
          language: "sql" as "sql",
          name: "first_name",
          volatility: "stable" as "stable",
          body: `select array_length(string_to_array(full_name, ' '), 1)`,
          returns: "integer",
        },
      ],
    });

    expect(Array.isArray(successOrErrors)).toBe(true);
    expect(successOrErrors).toHaveLength(1);
  });
});

describe("trait enforcement - getter", () => {
  const hasFirstNameGetterTrait: TraitI = {
    kind: "Trait",
    name: "nameable",
    requires: {
      getters: [
        {
          name: "first_name",
          returns: "text",
        },
      ],
    },
  };

  test("basic getter - passes", () => {
    const successOrErrors = enforceTrait(hasFirstNameGetterTrait, {
      kind: "Table",
      name: "people",
      implements: [
        {
          trait: "nameable",
        },
      ],
      columns: [{ name: "full_name", type: "text" }],
      getters: [
        {
          language: "sql" as "sql",
          name: "first_name",
          volatility: "stable" as "stable",
          body: `select string_to_array(full_name, ' ')[1]`,
          returns: "text",
        },
      ],
    });

    expect(successOrErrors).toBe(true);
  });

  test("basic getter - fails because missing", () => {
    const successOrErrors = enforceTrait(hasFirstNameGetterTrait, {
      kind: "Table",
      name: "people",
      implements: [
        {
          trait: "nameable",
        },
      ],
      columns: [{ name: "first_name", type: "text" }],
    });

    expect(Array.isArray(successOrErrors)).toBe(true);
    expect(successOrErrors).toHaveLength(1);
  });

  test("passes with via", () => {
    const successOrErrors = enforceTrait(hasFirstNameGetterTrait, {
      kind: "Table",
      name: "people",
      implements: [
        {
          trait: "nameable",
          via: {
            getters: { first_name: "given_name" },
          },
        },
      ],
      columns: [{ name: "full_name", type: "text" }],
      getters: [
        {
          language: "sql" as "sql",
          name: "given_name",
          volatility: "stable" as "stable",
          body: `select string_to_array(full_name, ' ')[1]`,
          returns: "text",
        },
      ],
    });

    expect(successOrErrors).toBe(true);
  });

  test("fails with returns mismatch", () => {
    const successOrErrors = enforceTrait(hasFirstNameGetterTrait, {
      kind: "Table",
      name: "people",
      implements: [
        {
          trait: "nameable",
          via: {
            getters: { first_name: "given_name" },
          },
        },
      ],
      columns: [{ name: "full_name", type: "text" }],
      getters: [
        {
          language: "sql" as "sql",
          name: "given_name",
          volatility: "stable" as "stable",
          body: `select array_length(string_to_array(full_name, ' '), 1)`,
          returns: "integer",
        },
      ],
    });

    expect(Array.isArray(successOrErrors)).toBe(true);
    expect(successOrErrors).toHaveLength(1);
  });
});
