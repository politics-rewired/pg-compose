import { Trait, Table, TableI } from "./records";
import { reconcileTables, TableOperationType } from "./reconcile";
import { ObjectProvider } from "../core";
import { makeToStatement } from "./statements";
import { introspectTable } from "./introspect";

export const TableProvider: ObjectProvider<TableI, TableOperationType> = {
  record: Table,
  introspect: introspectTable,
  reconcile: reconcileTables,
  toStatement: makeToStatement,
};

export const TableRecord = Table;

export const TraitRecord = Trait;
