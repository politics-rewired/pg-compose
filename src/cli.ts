import * as yargs from "yargs";
import {
  fileRunner,
  directRunner,
  interactiveRunner,
  Runner,
  RunContextI,
  ToFileRunContextI,
} from "./runners";
import { Pool } from "pg";
import { installModule } from ".";
import { loadYaml } from "./loaders/yaml";

const argv = yargs
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
  .help().argv;

const main = async () => {
  const pool = new Pool({ connectionString: argv.database });

  const client = await pool.connect();

  const m = await loadYaml({
    include: argv.files,
  });

  const runner: Runner =
    argv.out === undefined
      ? false
        ? directRunner
        : interactiveRunner
      : fileRunner;

  const context: RunContextI | ToFileRunContextI = {
    schema: argv.schema,
    client,
    outFile: argv.out,
  };

  await installModule(m, runner, context);
};

main()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
