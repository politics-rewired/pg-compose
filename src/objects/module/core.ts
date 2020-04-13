import { Partial, Static, Array } from "runtypes";
import { TableRecord, TraitRecord } from "../table";
import { TestRecord } from "../test";
import { TableExtension } from "../table/records";

export const ModuleRecord = Partial({
  tables: Array(TableRecord),
  traits: Array(TraitRecord),
  tests: Array(TestRecord),
  extensions: Array(TableExtension),
});

export interface ModuleI extends Static<typeof ModuleRecord> {}
