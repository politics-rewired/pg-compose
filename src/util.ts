import { readFileSync } from "fs";
import { parse as parseYaml } from "yaml";
import { groupBy } from "lodash";

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
