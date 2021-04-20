import {
  checkIdempotency,
  checkIdempotencyAfterTransitions,
} from "../test-helpers";
import {
  checkFunctionContractsMatch,
  ContractI,
  FunctionI,
  FunctionProvider,
} from "./index";

describe("idempotency", () => {
  test("basic sql", async () => {
    const newOperationList = await checkIdempotency(
      FunctionProvider,
      {
        name: "say_hi",
        arguments: [],
        language: "sql",
        body: "select 'hi'",
        security: "invoker",
        volatility: "immutable",
        returns: "text",
      },
      "",
    );

    expect(newOperationList).toHaveLength(0);
  });

  test("basic plpgsql", async () => {
    const newOperationList = await checkIdempotency(
      FunctionProvider,
      {
        name: "say_hi",
        arguments: [],
        language: "plpgsql",
        body: "begin return 'hi'; end;",
        security: "invoker",
        volatility: "immutable",
        returns: "text",
      },
      "",
    );

    expect(newOperationList).toHaveLength(0);
  });

  test("sql with arguments", async () => {
    const newOperationList = await checkIdempotency(
      FunctionProvider,
      {
        name: "say_hi",
        arguments: [
          {
            name: "a",
            type: "integer",
          },
        ],
        language: "sql",
        body: "select a::text",
        security: "invoker",
        volatility: "immutable",
        returns: "text",
      },
      "",
    );

    expect(newOperationList).toHaveLength(0);
  });

  test("plpgsql with arguments", async () => {
    const newOperationList = await checkIdempotency(
      FunctionProvider,
      {
        name: "say_hi",
        arguments: [
          {
            name: "a",
            type: "integer",
          },
        ],
        language: "plpgsql",
        body: "begin return a::text; end;",
        security: "invoker",
        volatility: "immutable",
        returns: "text",
      },
      "",
    );

    expect(newOperationList).toHaveLength(0);
  });
});

describe("idempotency after transitions", () => {
  const f: FunctionI = {
    name: "say_hi",
    arguments: [
      {
        name: "a",
        type: "integer",
      },
    ],
    language: "plpgsql",
    body: "begin return a::text; end;",
    security: "invoker",
    volatility: "immutable",
    returns: "text",
  };

  test("transitioning security setting", async () => {
    const newOperationList = await checkIdempotencyAfterTransitions(
      FunctionProvider,
      [{ ...f }, { ...f, ...{ security: "definer" } }],
      "",
    );

    expect(newOperationList).toHaveLength(0);
  });

  test("transitioning volatility", async () => {
    const newOperationList = await checkIdempotencyAfterTransitions(
      FunctionProvider,
      [{ ...f }, { ...f, ...{ volatility: "volatile" } }],
      "",
    );

    expect(newOperationList).toHaveLength(0);
  });

  test("replacing the body", async () => {
    const newOperationList = await checkIdempotencyAfterTransitions(
      FunctionProvider,
      [
        { ...f },
        { ...f, ...{ body: "begin return a::text || ' my func'; end;" } },
      ],
      "",
    );

    expect(newOperationList).toHaveLength(0);
  });

  test("renaming", async () => {
    const newOperationList = await checkIdempotencyAfterTransitions(
      FunctionProvider,
      [
        { ...f, ...{ name: "say_hello" } },
        { ...f, ...{ previous_name: "say_hello" } },
      ],
      "",
    );

    expect(newOperationList).toHaveLength(0);
  });
});

describe("function contracts", () => {
  test("function can pass contract", () => {
    const func: FunctionI = {
      name: "add",
      implements: ["binary_integer_operator"],
      language: "sql",
      security: "invoker",
      volatility: "immutable",
      body: "select a + b",
      returns: "integer",
      arguments: [
        { name: "a", type: "integer" },
        { name: "b", type: "integer" },
      ],
    };

    const contract: ContractI = {
      name: "binary_integer_operator",
      arguments: [
        { name: "a", type: "integer" },
        { name: "b", type: "integer" },
      ],
      returns: "integer",
    };

    const successOrErrors = checkFunctionContractsMatch(func, contract);
    expect(successOrErrors).toBe(true);
  });

  test("function can fail contract for return mismatch", () => {
    const func: FunctionI = {
      name: "add",
      implements: ["binary_integer_operator"],
      language: "sql",
      security: "invoker",
      volatility: "immutable",
      body: "select a + b",
      returns: "integer",
      arguments: [
        { name: "a", type: "integer" },
        { name: "b", type: "integer" },
      ],
    };

    const contract: ContractI = {
      name: "binary_integer_operator",
      arguments: [
        { name: "a", type: "integer" },
        { name: "b", type: "integer" },
      ],
      returns: "text",
    };

    const successOrErrors = checkFunctionContractsMatch(func, contract);
    expect(Array.isArray(successOrErrors)).toBe(true);
    expect(successOrErrors).toHaveLength(1);
  });

  test("function can fail contract for arg length mismatch", () => {
    const func: FunctionI = {
      name: "add",
      implements: ["binary_integer_operator"],
      language: "sql",
      security: "invoker",
      volatility: "immutable",
      body: "select a + b",
      returns: "integer",
      arguments: [
        { name: "a", type: "integer" },
        { name: "b", type: "integer" },
      ],
    };

    const contract: ContractI = {
      name: "binary_integer_operator",
      arguments: [{ name: "a", type: "integer" }],
      returns: "integer",
    };

    const successOrErrors = checkFunctionContractsMatch(func, contract);
    expect(Array.isArray(successOrErrors)).toBe(true);
    expect(successOrErrors).toHaveLength(1);
  });

  test("function can fail contract for arg type mismatch", () => {
    const func: FunctionI = {
      name: "add",
      implements: ["binary_integer_operator"],
      language: "sql",
      security: "invoker",
      volatility: "immutable",
      body: "select a + b",
      returns: "integer",
      arguments: [
        { name: "a", type: "integer" },
        { name: "b", type: "integer" },
      ],
    };

    const contract: ContractI = {
      name: "binary_integer_operator",
      arguments: [
        { name: "a", type: "text" },
        { name: "b", type: "integer" },
      ],
      returns: "integer",
    };

    const successOrErrors = checkFunctionContractsMatch(func, contract);
    expect(Array.isArray(successOrErrors)).toBe(true);
    expect(successOrErrors).toHaveLength(1);
  });
});
