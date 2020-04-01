import { TableI, TableExtensionI } from "./records";

const concatPropIfExists = (
  prop: string,
  addProp: string,
  table: TableI,
  extension: TableExtensionI,
) => (table[prop] || []).concat(extension[addProp] || []);

const propsToAddProps = [
  ["columns", "addColumns"],
  ["indexes", "addIndexes"],
  ["triggers", "addTriggers"],
  ["checks", "addCheckConstraints"],
  ["uniques", "addUniques"],
  ["foreignKeys", "addForeignKeys"],
];

export const extendTable = (
  table: TableI,
  extension: TableExtensionI,
): TableI => {
  const result = Object.assign({}, table);

  for (const [prop, addProp] of propsToAddProps) {
    result[prop] = concatPropIfExists(prop, addProp, table, extension);
  }

  return result;
};
