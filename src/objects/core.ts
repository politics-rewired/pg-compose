import { String, Runtype, Static, Record } from "runtypes";
import { PoolClient } from "pg";

export const PgIdentifier = String.withConstraint(
  s => s.match(/[^a-z0-9_]/) === null,
  { name: "PgIdentifier should be all alphanumeric lower case" },
).withConstraint(s => s[0].match(/[0-9]/) === null, {
  name: "PgIdentifier should not start with a number",
});

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

interface NameableObject {
  name: string;
  previous_name?: string;
}

export const createOperationsForNameableObject = <ObjectType, OperationType>(
  desiredObjects: (NameableObject & ObjectType)[] | undefined,
  currentObjects: (NameableObject & ObjectType)[] | undefined,
  reconcileFn: (
    desired: ObjectType | undefined,
    current: ObjectType | undefined,
  ) => OperationType[],
): OperationType[] => {
  const dObjects = desiredObjects || [];
  const cObjects = currentObjects || [];

  // Accumulate create or alter operations
  const createOrAlterOperations: OperationType[] = dObjects.reduce(
    (acc: OperationType[], desired) => {
      const current =
        cObjects.find(current => current.name === desired.name) ||
        cObjects.find(current => current.name === desired.previous_name);

      return acc.concat(reconcileFn(desired, current));
    },
    [],
  );

  const dropOperations: OperationType[] = cObjects.reduce(
    (acc: OperationType[], current) => {
      const desired =
        dObjects.find(desired => desired.name === current.name) ||
        dObjects.find(desired => desired.previous_name === current.name);

      return acc.concat(
        desired === undefined ? reconcileFn(undefined, current) : [],
      );
    },
    [],
  );

  return createOrAlterOperations.concat(dropOperations);
};
