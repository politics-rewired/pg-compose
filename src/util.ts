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
  obj: { [key: string]: T },
  prop: string,
): U[] => {
  const keys = Object.keys(obj);

  return flatMap(keys, k => {
    const u = (Object.assign({}, obj[k], { [prop]: k }) as unknown) as U | U[];

    return u;
  });
};
