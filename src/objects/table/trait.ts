import { String } from "runtypes";

import { TableI, TraitI } from "./records";

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

  const traitRequirement = trait.requires || {};

  if (
    traitRequirement.columns !== undefined &&
    traitRequirement.columns.length > 0
  ) {
    const columnImplementations = implementation.via
      ? implementation.via.columns || {}
      : {};

    for (const requiredColumn of traitRequirement.columns) {
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
    traitRequirement.getters !== undefined &&
    traitRequirement.getters.length > 0
  ) {
    const getterImplementations = implementation.via
      ? implementation.via.getters || {}
      : {};

    for (const requiredgetter of traitRequirement.getters) {
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
