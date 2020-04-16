import * as yargs from "yargs";
import {
  fileRunner,
  directRunner,
  Runner,
  RunContextI,
  ToFileRunContextI,
} from "./runners";
import { Pool } from "pg";
import { installModule } from ".";
import { loadYaml } from "./loaders/yaml";
import { runTest, setupTests } from "./objects/test";
import * as tape from "tape";

interface CliOpts {
  database: string;
  files: string;
  schema: string;
  out?: string;
  testFiles: string;
}

const install = async (argv: CliOpts) => {
  const pool = new Pool({ connectionString: argv.database });

  const client = await pool.connect();

  const m = await loadYaml({
    include: argv.files,
  });

  const runner: Runner =
    argv.out === undefined ? (true ? directRunner : directRunner) : fileRunner;

  const context: RunContextI | ToFileRunContextI = {
    schema: argv.schema,
    client,
    outFile: argv.out,
  };

  await installModule(m, runner, context);
};

const test = async (argv: CliOpts) => {
  const pool = new Pool({ connectionString: argv.database });

  const client = await pool.connect();

  const m = await loadYaml({
    include: argv.files,
  });

  const runner = directRunner;

  const runContext: RunContextI | ToFileRunContextI = {
    schema: argv.schema,
    client,
  };

  const testContext = {
    runContext,
    runner,
  };

  const reset = await setupTests(m, testContext);

  for (const test of m.tests || []) {
    await runTest(test, testContext, reset);
  }

  tape.onFinish(() => {
    setTimeout(process.exit, 30);
  });
};

yargs
  .options({
    database: {
      alias: "d",
      demandOption: true,
      describe: "postgresql connection string url",
      type: "string",
    },
    files: {
      alias: "f",
      demandOption: true,
      describe: "the yaml files to include",
      type: "string",
    },
    schema: {
      alias: "s",
      demandOption: true,
      default: "public",
      type: "string",
    },
    out: {
      alias: "o",
      demandOption: false,
      describe: "optional output file to write a migration too",
      type: "string",
    },
  })
  .command({
    command: "install",
    handler: install,
  })
  .command({
    command: "test",
    handler: test,
  })
  .demandCommand()
  .help().argv;
