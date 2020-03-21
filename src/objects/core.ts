import { String, Runtype, Static, Record } from "runtypes";
import { PoolClient } from "pg";

export const PgIdentifier = String.withConstraint(
  s => s.match(/[^a-z0-9_]/) === null,
  { name: "PgIdentifier should be all alphanumeric lower case" },
);

export type PgIdentifierI = Static<typeof PgIdentifier>;

export const RunContext = Record({
  schema: PgIdentifier,
});

export interface RunContextI extends Static<typeof RunContext> {}

export interface PgObject<ObjectType, OperationType> {
  record: Runtype<ObjectType>;
  introspect: (
    client: PoolClient,
    identifier: PgIdentifierI,
    context: RunContextI,
  ) => Promise<ObjectType>;
  reconcile: (
    desired: ObjectType,
    current: ObjectType | undefined,
  ) => OperationType[];
  toStatement: (context: RunContextI) => (operation: OperationType) => string;
}
