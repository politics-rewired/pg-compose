import { readFileSync } from "fs";
import { parse as parseYaml } from "yaml";
import { groupBy, flatMap } from "lodash";

export const readYaml = (path: string) =>
  parseYaml(readFileSync(path).toString());

export const groupByAndPluckFirst = <T>(arr: T[], fn: (item: T) => string) => {
  const groupedBy = groupBy(arr, fn);
  const result: {
    [key: string]: T;
  } = {};

  for (const key of Object.keys(groupedBy)) {
    result[key] = groupedBy[key][0];
  }

  return result;
};

export const flattenKeyToProp = <T, U>(
  obj: { [key: string]: T } | undefined,
  prop: string,
): U[] => {
  if (obj === undefined) return [];

  const keys = Object.keys(obj);

  return flatMap(keys, k => {
    if (Array.isArray(obj[k])) {
      const u = (obj[k] as any).map((o: any) =>
        Object.assign({}, o, { [prop]: k }),
      ) as U[];
      return u;
    } else {
      const u = (Object.assign({}, obj[k], { [prop]: k }) as unknown) as U;

      return u;
    }
  });
};

export const addOneIndexedOrder = <T>(arr: T[]): (T & { order: number })[] =>
  arr.map((t, idx) => Object.assign({}, t, { order: idx + 1 }));

/**
 * Convert an Error instance to a plain object, including all its non-iterable properties.
 * @param err Error to convert to Object
 * @returns Object representation of the error
 */
export const errToObj = (err: any): any =>
  Object.getOwnPropertyNames(err).reduce<any>((acc, name) => {
    acc[name] = err[name];
    return acc;
  }, {});
