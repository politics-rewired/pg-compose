import { Trait, Table, TableI } from "./records";
import { reconcileTables, AllTableOperationType } from "./reconcile";
import {
  SingleObjectProvider,
  identityFunctionForNameableObject,
} from "../core";
import { makeToStatement } from "./statements";
import { introspectTable } from "./introspect";

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
