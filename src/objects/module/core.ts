import { Partial, Static, Array } from "runtypes";
import { TableRecord, TraitRecord } from "../table";
import { TestRecord } from "../test";

export const ModuleRecord = Partial({
  tables: Array(TableRecord),
  traits: Array(TraitRecord),
  tests: Array(TestRecord),
});

export interface ModuleI extends Static<typeof ModuleRecord> {}
