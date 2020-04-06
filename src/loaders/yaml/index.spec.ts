import { loadYaml } from "./index";
import { ModuleRecord } from "../../objects/module/core";

describe("yaml loader", () => {
  test("should produce a valid module", async () => {
    const m = await loadYaml({ include: "./src/loaders/yaml/test.yaml" });
    console.log(" m", m);
    console.log(ModuleRecord.validate(m));
    expect(ModuleRecord.guard(m)).toBe(true);
  });
});
