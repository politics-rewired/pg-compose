import { Loader } from "../core";
import { ModuleI } from "../../objects/module/core";
import { Record, Literal, Static } from "runtypes";
import { TableI, TraitI } from "../../objects/table/records";
import * as glob from "glob";
import { parseAllDocuments } from "yaml";
import { promises as fs } from "fs";
import { flatMap } from "lodash";
import { flattenKeyToProp } from "../../util";
import { TestI } from "../../objects/test";

interface YamlLoaderOpts {
  include: string;
}

export const loadYaml: Loader<YamlLoaderOpts> = async (
  opts: YamlLoaderOpts,
): Promise<ModuleI> => {
  const files: string[] = await new Promise((resolve, _reject) =>
    glob(opts.include, (_err: any, f: string[]) => resolve(f)),
  );

  const allFileContents = (
    await Promise.all(files.map(f => fs.readFile(f)))
  ).map(b => b.toString());

  const allYamlDocuments = flatMap(allFileContents, contents =>
    parseAllDocuments(contents),
  );

  const allYamlObjects = allYamlDocuments.map(d => d.toJSON());

  const tables = allYamlObjects
    .map(t => (YamlTable.guard(t) ? toTable(t) : undefined))
    .filter(IsNotUndefined);

  const traits = allYamlObjects
    .map(t => (YamlTrait.guard(t) ? toTrait(t) : undefined))
    .filter(IsNotUndefined);

  const tests = allYamlObjects
    .map(t => (YamlTest.guard(t) ? toTest(t) : undefined))
    .filter(IsNotUndefined);

  return {
    tables,
    traits,
    tests,
  };
};

const IsNotUndefined = <T>(x: T | undefined): x is T => x !== undefined;

const YamlTable = Record({
  kind: Literal("Table"),
});

const YamlTrait = Record({
  kind: Literal("Trait"),
});

const YamlTest = Record({
  kind: Literal("Test"),
});

interface YamlTableI extends Static<typeof YamlTable> {
  [key: string]: any;
}

interface YamlTraitI extends Static<typeof YamlTrait> {
  [key: string]: any;
}

interface YamlTestI extends Static<typeof YamlTest> {
  [key: string]: any;
}

export const toTable = (yaml: YamlTableI): TableI => ({
  name: yaml.name,
  implements: yaml.implements,
  columns: flattenKeyToProp(yaml.columns, "name"),
  indexes: flattenKeyToProp(yaml.indexes, "name"),
  previous_name: yaml.previous_name,
  triggers: flattenKeyToProp(yaml.triggers, "timing"),
});

export const toTrait = (yaml: YamlTraitI): TraitI => ({
  name: yaml.name,
  requires: {
    columns: flattenKeyToProp(yaml.requires.columns, "name"),
  },
  provides: {
    triggers: addOrder(
      flattenKeyToProp(yaml.provides ? yaml.provides.triggers : {}, "timing"),
    ),
    columns: flattenKeyToProp(yaml.provides.columns, "name"),
  },
});

export const toTest = (yaml: YamlTestI): TestI => ({
  name: yaml.name,
  setup: yaml.setup,
  assertions: yaml.assertions,
});

const addOrder = <T>(arr: T[]): (T & { order: number })[] =>
  arr.map((el, idx) => Object.assign(el, { order: idx + 1 }));
