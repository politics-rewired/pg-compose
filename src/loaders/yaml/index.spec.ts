import { loadYaml } from "./index";
import { ModuleRecord } from "../../objects/module/core";

describe("yaml loader", () => {
  test("should produce a valid module", async () => {
    const m = await loadYaml({ include: "./src/loaders/yaml/test.yaml" });
    expect(ModuleRecord.guard(m)).toBe(true);
  });
});
