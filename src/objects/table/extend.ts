import {
  TableI,
  TableExtensionSpecI,
  TraitImplementationI,
  TraitRequirementI,
  TriggerI,
} from "./records";
import { render } from "mustache";

const identity = (
  _traitImplementation: TraitImplementationI | undefined,
  _traitRequirement: TraitRequirementI | undefined,
) => (x: any) => x;

const makeTransformTrigger = (
  traitImplementation: TraitImplementationI | undefined,
  traitRequirement: TraitRequirementI | undefined,
) => (trigger: TriggerI) => {
  if (traitImplementation === undefined || traitRequirement === undefined) {
    return trigger;
  }

  const traitVars = (traitRequirement.columns || []).reduce(
    (acc, col) =>
      Object.assign(acc, {
        [col.name]:
          traitImplementation.via && traitImplementation.via.columns
            ? traitImplementation.via.columns[col.name]
            : col.name,
      }),
    {},
  );

  return Object.assign({}, trigger, {
    body: render(trigger.body, traitVars),
  });
};

type Transformer<T> = (
  TraitImplementation: TraitImplementationI | undefined,
  traitRequirement: TraitRequirementI | undefined,
) => (el: T) => T;

const propsWithTransformers: [string, Transformer<any>][] = [
  ["columns", identity],
  ["indexes", identity],
  ["triggers", makeTransformTrigger],
  ["checks", identity],
  ["uniques", identity],
  ["foreign_keys", identity],
];

export const extendTable = (
  table: TableI,
  extension: TableExtensionSpecI,
  traitImplementation?: TraitImplementationI,
  traitRequirement?: TraitRequirementI,
): TableI => {
  const result = Object.assign({}, table);

  for (const [prop, transformer] of propsWithTransformers) {
    result[prop] = (table[prop] || []).concat(
      (extension[prop] || []).map((el: any) =>
        transformer(traitImplementation, traitRequirement)(el),
      ),
    );
  }

  return result;
};
