import { flatten } from "lodash";
import { PoolClient } from "pg";
import { Runtype, Static, String } from "runtypes";

import { RunContextI } from "../runners";

export const PgIdentifier = String.withConstraint(
  (s) => s.match(/[^a-z0-9_]/) === null,
  { name: "PgIdentifier should be all alphanumeric lower case" },
)
  .withConstraint((s) => s.length > 0, {
    name: "PgIdentifier must have length > 0",
  })
  .withConstraint((s) => s[0].match(/[0-9]/) === null, {
    name: "PgIdentifier should not start with a number",
  });

export type PgIdentifierI = Static<typeof PgIdentifier>;

interface ObjectProviderCore<ObjectType, OperationType> {
  record: Runtype<ObjectType>;
  reconcile: (
    desired: ObjectType,
    current: ObjectType | undefined,
  ) => Promise<OperationType[]>;
  toStatement: (context: RunContextI) => (operation: OperationType) => string;
  identityFn: IdentityFunction<ObjectType>;
}

export interface SingleObjectProvider<ObjectType, OperationType>
  extends ObjectProviderCore<ObjectType, OperationType> {
  type: "single";
  introspect: (
    client: PoolClient,
    identifier: PgIdentifierI,
    context: RunContextI,
  ) => Promise<ObjectType>;
}

export interface ManyObjectProvider<ObjectType, OperationType>
  extends ObjectProviderCore<ObjectType, OperationType> {
  type: "many";
  introspectMany: (
    client: PoolClient,
    context: RunContextI,
  ) => Promise<ObjectType[]>;
}

export type ObjectProvider<ObjectType, OperationType> =
  | SingleObjectProvider<ObjectType, OperationType>
  | ManyObjectProvider<ObjectType, OperationType>;

interface NameableObject {
  name: string;
  previous_name?: string;
}

type IdentityFunction<T> = (desired: T, current: T) => boolean;

export const identityFunctionForNameableObject: IdentityFunction<
  NameableObject
> = (desired: NameableObject, current: NameableObject) =>
  desired.name === current.name || desired.previous_name === current.name;

export const createOperationsForNameableObject = <ObjectType, OperationType>(
  desiredObjects: (NameableObject & ObjectType)[] | undefined,
  currentObjects: (NameableObject & ObjectType)[] | undefined,
  reconcileFn: (
    desired: ObjectType | undefined,
    current: ObjectType | undefined,
  ) => Promise<OperationType[]>,
  opts?: CreateOperationsOpts | undefined,
): Promise<OperationType[]> => {
  const identityByName: IdentityFunction<ObjectType> = <ObjectType>(
    desired: NameableObject & ObjectType,
    current: NameableObject & ObjectType,
  ) => desired.name === current.name || desired.previous_name === current.name;

  return createOperationsForObjectWithIdentityFunction(
    desiredObjects,
    currentObjects,
    reconcileFn,
    identityByName,
    opts,
  );
};

interface CreateOperationsOpts {
  dropObjects: boolean;
}

export const createOperationsForObjectWithIdentityFunction = async <
  ObjectType,
  OperationType,
>(
  desiredObjects: ObjectType[] | undefined,
  currentObjects: ObjectType[] | undefined,
  reconcileFn: (
    desired: ObjectType | undefined,
    current: ObjectType | undefined,
  ) => Promise<OperationType[]>,
  identityFunction: IdentityFunction<ObjectType>,
  opts: CreateOperationsOpts | undefined = {
    dropObjects: true,
  },
): Promise<OperationType[]> => {
  const dObjects = desiredObjects || [];
  const cObjects = currentObjects || [];

  // Accumulate create or alter operations
  const createOrAlterOperations: OperationType[] = flatten(
    await Promise.all(
      dObjects.map(async (desired) => {
        const current = cObjects.find((current) =>
          identityFunction(desired, current),
        );

        return reconcileFn(desired, current);
      }),
    ),
  );

  if (opts.dropObjects === false) {
    return createOrAlterOperations;
  }

  const dropOperations: OperationType[] = flatten(
    await Promise.all(
      cObjects.map(async (current: ObjectType) => {
        const desired = dObjects.find((desired) =>
          identityFunction(desired, current),
        );

        return desired === undefined ? reconcileFn(undefined, current) : [];
      }),
    ),
  );

  return createOrAlterOperations.concat(dropOperations);
};
