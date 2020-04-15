import {
  run as runWorker,
  // RunnerOptions as WorkerRunnerOptions,
} from "graphile-worker";

import {
  run as runScheduler,
  // RunnerOptions as SchedulerRunnerOptions,
} from "graphile-scheduler";

import { Pool, PoolClient } from "pg";
// import { ModuleI } from "../objects/module/core";
import { loadYaml } from "../loaders/yaml";
import Cryptr = require("cryptr");
import { installModule } from "..";
import { directRunner } from "../runners";

// type ComposeWorkerOptions = WorkerRunnerOptions &
//   SchedulerRunnerOptions & {
//     encryptionSecret: string;
//   };

// export const run = async (m: ModuleI, opts: ComposeWorkerOptions) => {
// const _worker = await runWorker(opts);
// const _scheduler = await runScheduler(opts);
// };

export const migrate = async (pgPool: Pool) => {
  const worker = await runWorker({ pgPool, taskList: {} });
  const scheduler = await runScheduler({ pgPool });

  await worker.stop();
  await scheduler.stop();

  const client = await pgPool.connect();

  await client.query("create schema if not exists graphile_secrets");

  const m = await loadYaml({ include: "./src/worker/graphile-secrets.yaml" });

  await installModule(m, directRunner, {
    client,
    schema: "graphile_secrets",
  });

  await client.query(
    "alter table graphile_secrets.unencrypted_secrets set unlogged",
  );

  await client.release();
};

export interface GraphileSecrets {
  ref: string;
  encrypted_secret: string;
}

export interface GraphileUnencryptedSecrets {
  ref: string;
  unencrypted_secret: string;
}

export const encryptSecret = async (
  client: PoolClient,
  cryptr: Cryptr,
  secretRef: string,
): Promise<void> => {
  const { rows } = await client.query<GraphileUnencryptedSecrets>(
    "select * from graphile_secrets.unencrypted_secrets where ref = $1",
    [secretRef],
  );

  const encryptedSecret = cryptr.encrypt(rows[0].unencrypted_secret);

  await client.query(
    "update graphile_secrets.secrets set encrypted_secret = $1 where ref = $2",
    [encryptedSecret, secretRef],
  );

  await client.query(
    "delete from graphile_secrets.unencrypted_secrets where ref = $1",
    [secretRef],
  );
};

export const getSecret = async (
  client: PoolClient,
  cryptr: Cryptr,
  secretRef: string,
): Promise<string> => {
  const { rows } = await client.query<GraphileSecrets>(
    "select * from graphile_secrets.secrets where ref = $1",
    [secretRef],
  );

  if (rows[0].encrypted_secret === null) {
    const { rows } = await client.query<GraphileUnencryptedSecrets>(
      "select * from graphile_secrets.unencrypted_secrets where ref = $1",
      [secretRef],
    );
    return rows[0].unencrypted_secret;
  }

  return cryptr.decrypt(rows[0].encrypted_secret);
};

export const setSecret = async (
  client: PoolClient,
  secretRef: string,
  unencryptedSecret: string,
): Promise<string> => {
  const { rows } = await client.query<{ ref: string }>(
    "select * from graphile_secrets.set_secret($1, $2)",
    [secretRef, unencryptedSecret],
  );

  return rows[0].ref;
};
