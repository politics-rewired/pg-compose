import { extendTable } from "./extend";

describe("extend", () => {
  test("basic addColumns", () => {
    const extended = extendTable(
      {
        kind: "Table",
        name: "people",
        columns: [{ name: "first_name", type: "text" }],
      },
      {
        addColumns: [{ name: "last_name", type: "text" }],
      },
    );

    expect(extended.columns).toHaveLength(2);
    expect(extended.columns.find(n => n.name === "first_name")).not.toBeNull();
    expect(extended.columns.find(n => n.name === "last_name")).not.toBeNull();
  });
});
