import { reconcileTables, TableOpCodes } from "./reconcile";
import { TableI } from "./records";
import { ColumnOpCodes, CreateColumnOperation } from "./columns";

describe("table migrations", () => {
  test("should return a create table operation", () => {
    const desired: TableI = {
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
          nullable: false,
        },
      ],
    };

    const operations = reconcileTables(desired, undefined);

    expect(operations[0]).toHaveProperty("code");
    expect(operations[0].code).toEqual(TableOpCodes.CreateTable);
  });

  test("should return a create table operation", () => {
    const desired: TableI = {
      kind: "Table",
      name: "people_2",
      previous_name: "people",
      columns: [
        {
          name: "first_name",
          type: "text",
          nullable: false,
        },
        {
          name: "last_name",
          type: "text",
          nullable: false,
        },
      ],
    };

    const current: TableI = {
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
          nullable: false,
        },
      ],
    };

    const operations = reconcileTables(desired, current);

    expect(operations[0]).toHaveProperty("code");
    expect(operations[0].code).toEqual(TableOpCodes.RenameTable);
  });

  test("should return a create column operation", () => {
    const desiredTables: TableI = {
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
          nullable: false,
        },
      ],
    };

    const currentTables: TableI = {
      kind: "Table",
      name: "people",
      columns: [
        {
          name: "first_name",
          type: "text",
          nullable: false,
        },
      ],
    };

    const operations = reconcileTables(desiredTables, currentTables);

    const op = operations[0];

    expect(op.code).toBe(ColumnOpCodes.CreateColumn);
    expect(CreateColumnOperation.guard(op)).toBe(true);

    if (CreateColumnOperation.guard(op)) {
      expect(op.column.name).toBe("last_name");
    }
  });

  test("should return a rename column operation", () => {
    const desired: TableI = {
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
          previous_name: "given_name",
          type: "text",
          nullable: false,
        },
      ],
    };

    const current: TableI = {
      kind: "Table",
      name: "people",
      columns: [
        {
          name: "first_name",
          type: "text",
          nullable: false,
        },
        {
          name: "given_name",
          type: "text",
          nullable: false,
        },
      ],
    };

    const operations = reconcileTables(desired, current);

    const op = operations[0];
    expect(op.code).toBe(ColumnOpCodes.RenameColumn);
  });

  test("should return  change data type and nullable operations", () => {
    const desired: TableI = {
      kind: "Table",
      name: "people",
      columns: [
        {
          name: "first_name",
          type: "integer",
          nullable: true,
          default: "George",
        },
      ],
    };

    const current: TableI = {
      kind: "Table",
      name: "people",
      columns: [
        {
          name: "first_name",
          type: "text",
          nullable: false,
        },
      ],
    };

    const operations = reconcileTables(desired, current);

    const op1 = operations[0];
    const op2 = operations[1];
    const op3 = operations[2];

    expect(op1.code).toBe(ColumnOpCodes.SetColumnDefault);
    expect(op2.code).toBe(ColumnOpCodes.SetColumnNullable);
    expect(op3.code).toBe(ColumnOpCodes.SetColumnDataType);
  });

  test("should return drop column operations", () => {
    const desired: TableI = {
      kind: "Table",
      name: "people",
      columns: [
        {
          name: "first_name",
          type: "text",
          nullable: true,
        },
      ],
    };

    const current: TableI = {
      kind: "Table",
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
          nullable: false,
        },
      ],
    };

    const operations = reconcileTables(desired, current);
    expect(operations[0].code).toBe(ColumnOpCodes.DropColumn);
  });
});
