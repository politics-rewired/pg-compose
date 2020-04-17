import { Partial, Static, Array } from "runtypes";
import { TableRecord, TraitRecord } from "../table";
import { TestRecord } from "../test";
import { TableExtension } from "../table/records";
import { FunctionRecord } from "../functions";
import { CronJobRecord } from "./cronjobs";
import { Task } from "graphile-worker";

export const ModuleRecord = Partial({
  tables: Array(TableRecord),
  traits: Array(TraitRecord),
  tests: Array(TestRecord),
  extensions: Array(TableExtension),
  functions: Array(FunctionRecord),
  cronJobs: Array(CronJobRecord),
});

export interface ModuleI extends Static<typeof ModuleRecord> {
  taskList?: {
    [taskName: string]: Task;
  };
}
