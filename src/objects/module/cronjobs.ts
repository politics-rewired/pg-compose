import { Record, Static, String } from "runtypes";

export const CronJobRecord = Record({
  name: String,
  time_zone: String,
  pattern: String,
  task_name: String,
});

export interface CronJobI extends Static<typeof CronJobRecord> {}
