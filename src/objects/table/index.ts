import {
  identityFunctionForNameableObject,
  SingleObjectProvider,
} from "../core";
import { introspectTable } from "./introspect";
import { AllTableOperationType, reconcileTables } from "./reconcile";
import { Table, TableI, Trait } from "./records";
import { makeToStatement } from "./statements";

export const TableProvider: SingleObjectProvider<
  TableI,
  AllTableOperationType
> = {
  record: Table,
  introspect: introspectTable,
  reconcile: reconcileTables,
  toStatement: makeToStatement,
  identityFn: identityFunctionForNameableObject,
  type: "single",
};

export const TableRecord = Table;
export const TraitRecord = Trait;
