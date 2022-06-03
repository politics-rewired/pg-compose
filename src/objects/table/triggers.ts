import { Literal, match, Record, Static, Tuple, Union } from "runtypes";

import { Table, TableI, Trigger, TriggerI } from "./records";

export enum TriggerOpCodes {
  CreateTrigger = "create_trigger",
  RenameTrigger = "rename_trigger",
  ReorderTrigger = "reorder_trigger",
  DropTrigger = "drop_trigger",
}

export const CreateTriggerOperation = Record({
  code: Literal(TriggerOpCodes.CreateTrigger),
  trigger: Trigger,
  table: Table,
});

export const RenameTriggerOperation = Record({
  code: Literal(TriggerOpCodes.RenameTrigger),
  trigger: Trigger,
  table: Table,
});

export const ReorderTriggerOperation = Record({
  code: Literal(TriggerOpCodes.ReorderTrigger),
  trigger: Trigger,
  table: Table,
});

export const DropTriggerOperation = Record({
  code: Literal(TriggerOpCodes.DropTrigger),
  trigger: Trigger,
  table: Table,
});

export const TriggerOperation = Union(
  CreateTriggerOperation,
  DropTriggerOperation,
  RenameTriggerOperation,
  ReorderTriggerOperation,
);

export type TriggerOperationType = Static<typeof TriggerOperation>;

const CreateTriggerInput = Tuple(Trigger, Literal(undefined));
const DropTriggerInput = Tuple(Literal(undefined), Trigger);
const AlterTriggerInput = Tuple(Trigger, Trigger);

const ReconcileTriggersInput = Union(
  CreateTriggerInput,
  DropTriggerInput,
  AlterTriggerInput,
);

const normalizeWhitespace = (s: string): string =>
  s.trim().replace(/\s+/g, " ");

const matchFn = (desiredTable: TableI) =>
  match(
    [
      CreateTriggerInput,
      ([desired]) => [
        {
          code: TriggerOpCodes.CreateTrigger,
          trigger: desired,
          table: desiredTable,
        },
      ],
    ],
    [
      DropTriggerInput,
      ([_, current]) => [
        {
          code: TriggerOpCodes.DropTrigger,
          trigger: current,
          table: desiredTable,
        },
      ],
    ],
    [
      AlterTriggerInput,
      ([desired, current]) => {
        const operations: TriggerOperationType[] = [];

        if (
          normalizeWhitespace(desired.body) !==
            normalizeWhitespace(current.body) ||
          desired.language !== current.language ||
          desired.for_each !== current.for_each ||
          desired.timing !== current.timing ||
          desired.when !== current.when
        ) {
          operations.push({
            code: TriggerOpCodes.DropTrigger,
            trigger: current,
            table: desiredTable,
          });

          operations.push({
            code: TriggerOpCodes.CreateTrigger,
            trigger: desired,
            table: desiredTable,
          });

          return operations;
        }

        // Now we can assume any change is either a rename or a reorder
        if (
          desired.name !== current.name &&
          desired.previous_name === current.name
        ) {
          operations.push({
            code: TriggerOpCodes.RenameTrigger,
            trigger: desired,
            table: desiredTable,
          });
        }

        if (desired.order !== current.order) {
          desired.previous_order = current.order;

          operations.push({
            code: TriggerOpCodes.ReorderTrigger,
            trigger: desired,
            table: desiredTable,
          });
        }

        return operations;
      },
    ],
  );

export const makeReconcileTriggers =
  (desiredTable: TableI) =>
  async (
    desired: TriggerI | undefined,
    current: TriggerI | undefined,
  ): Promise<TriggerOperationType[]> => {
    const input = [desired, current];

    if (ReconcileTriggersInput.guard(input)) {
      return matchFn(desiredTable)(input);
    }

    return [];
  };
