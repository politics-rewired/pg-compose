import { Partial, Static, Array } from "runtypes";
import { TableRecord, TraitRecord } from "../table";

export const ModuleRecord = Partial({
  tables: Array(TableRecord),
  traits: Array(TraitRecord),
});

export interface ModuleI extends Static<typeof ModuleRecord> {}
