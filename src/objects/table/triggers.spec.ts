import {
  checkIdempotency,
  checkIdempotencyAfterTransitions,
} from "../test-helpers";
import { TableObject } from "./index";
import { TriggerI, TableI } from "./records";

const makeCoreTestingTable = (triggers: TriggerI[]): TableI => ({
  kind: "Table" as "Table",
  name: "people",
  columns: [
    {
      name: "first_name",
      type: "text",
    },
    {
      name: "last_name",
      type: "text",
    },
    {
      name: "full_name",
      type: "text",
    },
  ],
  triggers,
});

describe("idempotency", () => {
  test("basic before insert trigger", async () => {
    const newOperationList = await checkIdempotency(
      TableObject,
      makeCoreTestingTable([
        {
          name: "make_full_name",
          language: "plpgsql" as "plpgsql",
          body: `begin NEW.full_name := first_name || ' ' || last_name; return NEW; end;`,
          timing: "before_insert" as "before_insert",
          order: 1,
          for_each: "row" as "row",
        },
      ]),
      "people",
    );

    expect(newOperationList).toHaveLength(0);
  });

  test("two before insert triggers", async () => {
    const newOperationList = await checkIdempotency(
      TableObject,
      makeCoreTestingTable([
        {
          name: "make_full_name",
          language: "plpgsql" as "plpgsql",
          body: `begin NEW.full_name := first_name || ' ' || last_name; return NEW; end;`,
          timing: "before_insert" as "before_insert",
          order: 1,
          for_each: "row" as "row",
        },
        {
          name: "no_john_smiths_name",
          language: "plpgsql" as "plpgsql",
          body: `begin if NEW.full_name = 'John Smith' then raise 'No John Smiths'; end if; return NEW; end;`,
          timing: "before_insert" as "before_insert",
          order: 2,
          for_each: "row" as "row",
        },
      ]),
      "people",
    );

    expect(newOperationList).toHaveLength(0);
  });
});

describe("idempotency with changes", () => {
  test("changing trigger body", async () => {
    const newOperationList = await checkIdempotencyAfterTransitions(
      TableObject,
      [
        makeCoreTestingTable([
          {
            name: "make_full_name",
            language: "plpgsql" as "plpgsql",
            body: `begin NEW.full_name := first_name || '_' || last_name; return NEW; end;`,
            timing: "before_insert" as "before_insert",
            order: 1,
            for_each: "row" as "row",
          },
        ]),
        makeCoreTestingTable([
          {
            name: "make_full_name",
            language: "plpgsql" as "plpgsql",
            body: `begin NEW.full_name := first_name || ' ' || last_name; return NEW; end;`,
            timing: "before_insert" as "before_insert",
            order: 1,
            for_each: "row" as "row",
          },
        ]),
      ],
      "people",
    );

    expect(newOperationList).toHaveLength(0);
  });

  test("reordering triggers", async () => {
    const newOperationList = await checkIdempotencyAfterTransitions(
      TableObject,
      [
        makeCoreTestingTable([
          {
            name: "make_full_name",
            language: "plpgsql" as "plpgsql",
            body: `begin NEW.full_name := first_name || ' ' || last_name; return NEW; end;`,
            timing: "before_insert" as "before_insert",
            order: 1,
            for_each: "row" as "row",
          },
          {
            name: "no_john_smiths_name",
            language: "plpgsql" as "plpgsql",
            body: `begin if NEW.full_name = 'John Smith' then raise 'No John Smiths'; end if; return NEW; end;`,
            timing: "before_insert" as "before_insert",
            order: 2,
            for_each: "row" as "row",
          },
        ]),
        makeCoreTestingTable([
          {
            name: "no_john_smiths_name",
            language: "plpgsql" as "plpgsql",
            body: `begin if NEW.full_name = 'John Smith' then raise 'No John Smiths'; end if; return NEW; end;`,
            timing: "before_insert" as "before_insert",
            order: 1,
            for_each: "row" as "row",
          },
          {
            name: "make_full_name",
            language: "plpgsql" as "plpgsql",
            body: `begin NEW.full_name := first_name || ' ' || last_name; return NEW; end;`,
            timing: "before_insert" as "before_insert",
            order: 2,
            for_each: "row" as "row",
          },
        ]),
      ],
      "people",
    );

    expect(newOperationList).toHaveLength(0);
  });
});
