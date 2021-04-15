import { Record, Static, String } from "runtypes";

export const DependencyRecord = Record({
  module: String,
});

export interface DependencyI extends Static<typeof DependencyRecord> {}
