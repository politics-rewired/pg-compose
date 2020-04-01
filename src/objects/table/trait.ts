import {
  TraitI,
  TableI,
  TableExtensionI,
  Index,
  TraitRequirementI,
} from "./records";
import { String, match, Array } from "runtypes";
import { PgIdentifierI } from "../core";

export const enforceTrait = (trait: TraitI, table: TableI): true | string[] => {
  const errors = [];

  const implementation = (table.implements || []).find(
    i => i.trait === trait.name,
  );

  if (implementation === undefined) {
    throw new Error(
      `Table ${table.name} is not declared as implementing trait ${trait.name}`,
    );
  }

  if (
    trait.requires.columns !== undefined &&
    trait.requires.columns.length > 0
  ) {
    const columnImplementations = implementation.via
      ? implementation.via.columns || {}
      : {};

    for (const requiredColumn of trait.requires.columns) {
      const columnImplementation =
        columnImplementations[requiredColumn.name] || requiredColumn.name;

      if (String.guard(columnImplementation)) {
        const implementedColumn = table.columns.find(
          col => col.name === columnImplementation,
        );

        if (!implementedColumn) {
          errors.push(
            `Table ${table.name} does not satisfy trait ${trait.name}: ${trait.name} requires column ${requiredColumn.name}, but the table has no column ${columnImplementation}`,
          );
          continue;
        }

        if (implementedColumn.type !== requiredColumn.type) {
          errors.push(
            `Table ${table.name} does not satisfy trait ${trait.name}: ${implementedColumn.name} is of type ${implementedColumn.type} and should be of type ${requiredColumn.type}`,
          );
        }

        if (
          requiredColumn.nullable === false &&
          implementedColumn.nullable !== requiredColumn.nullable
        ) {
          errors.push(
            `Table ${table.name} does not satisfy trait ${trait.name}: ${implementedColumn.name} is nullable and should not be`,
          );
        }
      } else {
        const getterAsColumn = (table.getters || []).find(
          m => m.name === columnImplementation.name,
        );

        if (getterAsColumn === undefined) {
          errors.push(
            `Table ${table.name} does not satisfy trait ${trait.name}: ${trait.name} requires column ${requiredColumn.name}, but the table has no getter ${columnImplementation.name}`,
          );
          continue;
        }

        if (getterAsColumn.returns !== requiredColumn.type) {
          errors.push(
            `Table ${table.name} does not satisfy trait ${trait.name}: ${getterAsColumn.name} is of type ${getterAsColumn.returns} and should be of type ${requiredColumn.type}`,
          );
        }
      }
    }
  }

  if (
    trait.requires.getters !== undefined &&
    trait.requires.getters.length > 0
  ) {
    const getterImplementations = implementation.via
      ? implementation.via.getters || {}
      : {};

    for (const requiredgetter of trait.requires.getters) {
      const getterImplementation =
        getterImplementations[requiredgetter.name] || requiredgetter.name;

      const implementedgetter = (table.getters || []).find(
        m => m.name === getterImplementation,
      );

      if (implementedgetter === undefined) {
        errors.push(
          `Table ${table.name} does not satisfy trait ${trait.name}: ${trait.name} requires getter ${requiredgetter.name} but the table has no getter ${getterImplementation}`,
        );
        continue;
      }

      if (implementedgetter.returns !== requiredgetter.returns) {
        errors.push(
          `Table ${table.name} does not satisfy trait ${trait.name}: ${requiredgetter.name} should return a ${requiredgetter.returns} but ${implementedgetter.name} returns a ${implementedgetter.returns}`,
        );
      }
    }
  }

  return errors.length === 0 || errors;
};
