import { Record, String, Array, Static } from "runtypes";
import { ModuleI } from "../module/core";
import { installModule } from "../..";
import { RunContextI, Runner } from "../../runners";
import * as tape from "tape";

export const Assertion = Record({
  name: String,
  return: String,
  expect: String,
});

export const TestRecord = Record({
  name: String,
  setup: String,
  assertions: Array(Assertion),
});

export interface TestI extends Static<typeof TestRecord> {}

interface TestContext {
  runContext: RunContextI;
  runner: Runner;
}

type TestResetFn = () => Promise<void>;

export const setupTests = async (
  m: ModuleI,
  context: TestContext,
): Promise<TestResetFn> => {
  const { runContext, runner } = context;
  const { client } = runContext;

  await client.query("begin");
  await installModule(m, runner, runContext);
  await client.query("savepoint after_migrate;");

  const reset: TestResetFn = async () => {
    await client.query("rollback to after_migrate");
  };

  return reset;
};

export const runTest = async (
  test: TestI,
  context: TestContext,
  reset: TestResetFn,
) => {
  const { runContext } = context;

  const { client } = runContext;
  tape(test.name, async t => {
    await client.query(test.setup);

    for (const assertion of test.assertions) {
      const {
        rows: [result],
      } = await client.query(assertion.return);
      const unpacked = result[Object.keys(result)[0]];
      t.equal(unpacked.toString(), assertion.expect.toString());
    }

    await reset();
    t.end();
  });
};
