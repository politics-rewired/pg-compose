import { compile } from ".";

describe("basic type checking", () => {
  test("adding a string and an integer throws an error", () => {
    expect(() =>
      compile(["add", [3, "hi"]]),
    ).toThrowErrorMatchingInlineSnapshot(
      `"Operation add expects one of integer, decimal for b, but the value it was given could be a string"`,
    );
  });

  test("adding two integers compiles", () => {
    const result = compile(["add", [3, 3]]);
    expect(result.expression).toEqual("(3) + (3)");
  });
});

describe("recursive type checking", () => {
  test("adding an integer and the result of an equals operation throws an error", () => {
    expect(() =>
      compile(["add", [3, ["equals", [5, 5]]]]),
    ).toThrowErrorMatchingInlineSnapshot(
      `"Operation add expects one of integer, decimal for b, but the value it was given could be a boolean"`,
    );
  });

  test("comparing two integers, one of which is the result of addition compiles", () => {
    const result = compile(["equals", [3, ["add", [1, 2]]]]);
    expect(result.expression).toEqual("(3) = ((1) + (2))");
  });
});

describe("type functions", () => {
  test("when we add an integer and a decimal, we know the result will be a decimal", () => {
    const result = compile(["add", [3, 3.5]]);
    expect(result.types).toEqual(["decimal"]);
  });

  test("when we add an integer and a floored decimal, we know the result will be an integer", () => {
    const result = compile(["add", [3, ["floor", [3.5]]]]);
    expect(result.types).toEqual(["integer"]);
  });
});
