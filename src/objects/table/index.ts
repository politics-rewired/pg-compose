import { Table, TableI } from "./records";
import { reconcileTables, TableOperationType } from "./reconcile";
import { PgObject } from "../core";
import { makeToStatement } from "./statements";
import { introspectTable } from "./introspect";

export const TableObject: PgObject<TableI, TableOperationType> = {
  record: Table,
  introspect: introspectTable,
  reconcile: reconcileTables,
  toStatement: makeToStatement,
};
