import { Array, Partial, Static } from "runtypes";

import { TaskList } from "../../worker";
import { ContractRecord, FunctionRecord } from "../functions";
import { TableRecord, TraitRecord } from "../table";
import { TableExtension } from "../table/records";
import { TestRecord } from "../test";
import { CronJobRecord } from "./cronjobs";
import { DependencyRecord } from "./dependency";

export const ModuleRecord = Partial({
  tables: Array(TableRecord),
  traits: Array(TraitRecord),
  tests: Array(TestRecord),
  extensions: Array(TableExtension),
  functions: Array(FunctionRecord),
  contracts: Array(ContractRecord),
  cronJobs: Array(CronJobRecord),
  dependencies: Array(DependencyRecord),
});

export interface ModuleI extends Static<typeof ModuleRecord> {
  taskList?: TaskList;
}
