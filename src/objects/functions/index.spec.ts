import { FunctionProvider, FunctionI } from "./index";
import {
  checkIdempotency,
  checkIdempotencyAfterTransitions,
} from "../test-helpers";

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

describe("idempotency after transitions", async () => {
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
