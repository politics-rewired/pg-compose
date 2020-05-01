import { Partial, Static, Array } from "runtypes";
import { TableRecord, TraitRecord } from "../table";
import { TestRecord } from "../test";
import { TableExtension } from "../table/records";
import { FunctionRecord, ContractRecord } from "../functions";
import { CronJobRecord } from "./cronjobs";
import { DependencyRecord } from "./dependency";
import { TaskList } from "../../worker";

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
