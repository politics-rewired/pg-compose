import { Loader } from "../core";
import { ModuleI } from "../../objects/module/core";
import { Record, Literal, Static } from "runtypes";
import { TableI, TraitI } from "../../objects/table/records";
import * as glob from "glob";
import { parse as parseYaml } from "yaml";
import { promises as fs } from "fs";
import { flatMap } from "lodash";
import { flattenKeyToProp } from "../../util";

interface YamlLoaderOpts {
  include: string;
}

export const loadYaml: Loader<YamlLoaderOpts> = async (
  opts: YamlLoaderOpts,
): Promise<ModuleI> => {
  const files: string[] = await new Promise((resolve, _reject) =>
    glob(opts.include, (_err: any, f: string[]) => resolve(f)),
  );

  const allFileContents = files
    .map(f => fs.readFile(f))
    .map(buffer => buffer.toString());

  const allYamlObjects = flatMap(allFileContents, contents =>
    parseYaml(contents),
  );

  const tables = allYamlObjects
    .filter(obj => YamlTable.guard(obj))
    .map(toTable);

  const traits = allYamlObjects
    .filter(obj => YamlTrait.guard(obj))
    .map(toTrait);

  return {
    tables,
    traits,
  };
};

const YamlTable = Record({
  kind: Literal("Table"),
});

const YamlTrait = Record({
  kind: Literal("Trait"),
});

interface YamlTableI extends Static<typeof YamlTable> {
  [key: string]: any;
}

interface YamlTraitI extends Static<typeof YamlTrait> {
  [key: string]: any;
}

export const toTable = (yaml: YamlTableI): TableI => ({
  name: yaml.name,
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
    triggers: flattenKeyToProp(yaml.provides.triggers, "timing"),
    columns: flattenKeyToProp(yaml.provides.columns, "name"),
  },
});
