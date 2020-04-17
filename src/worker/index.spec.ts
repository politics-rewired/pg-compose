import { Pool } from "pg";
import {
  migrate,
  encryptSecret,
  GraphileSecrets,
  getSecret,
  setSecret,
  GraphileUnencryptedSecrets,
  deepCloneWithSecretReplacement,
  wrapTask,
  run,
} from "./index";
import { PoolClient } from "pg";
import * as faker from "faker";
import { runTaskListOnce, TaskList, JobHelpers } from "graphile-worker";
import Cryptr = require("cryptr");
import { ModuleI } from "../objects/module/core";

const pool = new Pool();

const clearJobsAndSchedules = async (client: PoolClient): Promise<void> => {
  await client.query("delete from graphile_worker.jobs");
  await client.query("delete from graphile_scheduler.schedules");
};

const makeTaskList = (client: PoolClient, cryptr: Cryptr): TaskList => ({
  "encrypt-secret": async (payload: any, _helpers) => {
    await encryptSecret(client, cryptr, payload.ref);
  },
});

describe("worker secrets and task wrapping", () => {
  beforeAll(async () => {
    await pool.query("drop schema if exists graphile_secrets cascade;");
    await migrate(pool);
  });

  test("management: symmetric encryption job - inserting a secret causes replacement w/ encrypted secret", async () => {
    const cryptr = new Cryptr(faker.random.alphaNumeric(10));

    const client = await pool.connect();
    await client.query("begin");
    await clearJobsAndSchedules(client);

    const ref = faker.random.alphaNumeric(10);
    const unencryptedSecret = faker.random.alphaNumeric(10);

    // Set up job
    await client.query(
      `insert into graphile_secrets.secrets (ref) values ($1)`,
      [ref],
    );

    await client.query(
      `insert into graphile_secrets.unencrypted_secrets (ref, unencrypted_secret) values ($1, $2)`,
      [ref, unencryptedSecret],
    );

    const taskList = makeTaskList(client, cryptr);

    // run the worker job via runTaskListOnce
    await runTaskListOnce({ pgPool: pool }, taskList, client);

    // select encrypted_secret from graphile_secrets.secrets where ref = ref
    const { rows } = await client.query<GraphileSecrets>(
      "select * from graphile_secrets.secrets where ref = $1",
      [ref],
    );

    // unencrypt the secret
    const resolvedUnencryptedSecret = cryptr.decrypt(rows[0].encrypted_secret);

    // check that the unencrypted secret equals the original encrypted secret
    expect(unencryptedSecret).toEqual(resolvedUnencryptedSecret);

    await client.query("rollback");
    await client.release();
  });

  test("management: getSecret gets the unencrypted secret if the encrypted secret is not available yet", async () => {
    const cryptr = new Cryptr(faker.random.alphaNumeric(10));
    const client = await pool.connect();
    await client.query("begin");
    await clearJobsAndSchedules(client);

    const ref = faker.random.alphaNumeric(10);
    const unencryptedSecret = faker.random.alphaNumeric(10);

    // Set up job
    await client.query(
      `insert into graphile_secrets.secrets (ref) values ($1)`,
      [ref],
    );

    await client.query(
      `insert into graphile_secrets.unencrypted_secrets (ref, unencrypted_secret) values ($1, $2)`,
      [ref, unencryptedSecret],
    );

    // call getSecret without having run the encryption job
    const resolvedUnencryptedSecret = await getSecret(client, cryptr, ref);

    // check that the unencrypted secret equals the original encrypted secret

    // check that the unencrypted secret equals the original encrypted secret
    expect(unencryptedSecret).toEqual(resolvedUnencryptedSecret);

    await client.query("rollback");
    await client.release();
  });

  test("management: setSecret(ref, unencrypted_secret) inserts into secrets and the unlogged table", async () => {
    const client = await pool.connect();
    await client.query("begin");
    await clearJobsAndSchedules(client);

    const ref = faker.random.alphaNumeric(10);
    const unencryptedSecret = faker.random.alphaNumeric(10);

    await setSecret(client, ref, unencryptedSecret);

    const { rows } = await client.query<GraphileUnencryptedSecrets>(
      "select * from graphile_secrets.unencrypted_secrets where ref = $1",
      [ref],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].unencrypted_secret).toEqual(unencryptedSecret);

    await client.query("rollback");
    await client.release();
  });

  test("management: setSecret + getSecret isomorphism w/ job", async () => {
    const cryptr = new Cryptr(faker.random.alphaNumeric(10));
    const client = await pool.connect();
    await client.query("begin");
    await clearJobsAndSchedules(client);

    const ref = faker.random.alphaNumeric(10);
    const unencryptedSecret = faker.random.alphaNumeric(10);

    await setSecret(client, ref, unencryptedSecret);

    const taskList = makeTaskList(client, cryptr);

    // run the worker job via runTaskListOnce
    await runTaskListOnce({ pgPool: pool }, taskList, client);

    const resolvedUnencryptedSecret = await getSecret(client, cryptr, ref);
    expect(resolvedUnencryptedSecret).toEqual(unencryptedSecret);

    await client.query("rollback");
    await client.release();
  });

  test("management: setSecret + getSecret isomorphism w/o job", async () => {
    const cryptr = new Cryptr(faker.random.alphaNumeric(10));
    const client = await pool.connect();
    await client.query("begin");
    await clearJobsAndSchedules(client);

    const ref = faker.random.alphaNumeric(10);
    const unencryptedSecret = faker.random.alphaNumeric(10);

    await setSecret(client, ref, unencryptedSecret);

    const resolvedUnencryptedSecret = await getSecret(client, cryptr, ref);
    expect(resolvedUnencryptedSecret).toEqual(unencryptedSecret);
  });

  test("substitution: should substitute a deeply nested secret", async () => {
    const cryptr = new Cryptr(faker.random.alphaNumeric(10));
    const client = await pool.connect();
    await client.query("begin");
    await clearJobsAndSchedules(client);

    const company = faker.company.companyName();
    const account = faker.internet.email();
    const password = faker.internet.password();

    await setSecret(client, `${company}-password`, password);

    const payload = {
      company,
      credentials: { account, password: { __secret: `${company}-password` } },
    };

    const decryptedPayload = await deepCloneWithSecretReplacement(
      client,
      cryptr,
      payload,
    );

    expect(decryptedPayload).toEqual({
      company,
      credentials: { account, password },
    });

    await client.query("rollback");
    await client.release();
  });

  test("substitution: wrapTask should pass the decoded payload", async () => {
    const cryptr = new Cryptr(faker.random.alphaNumeric(10));
    const client = await pool.connect();
    await client.query("begin");
    await clearJobsAndSchedules(client);

    const company = faker.company.companyName();
    const account = faker.internet.email();
    const password = faker.internet.password();

    await setSecret(client, `${company}-password`, password);

    const payload = {
      company,
      credentials: { account, password: { __secret: `${company}-password` } },
    };

    const expectedPayload = {
      company,
      credentials: { account, password },
    };

    const myTask = jest.fn();
    const wrappedTask = wrapTask(client, cryptr, myTask);

    await wrappedTask(payload, (null as any) as JobHelpers);
    expect(myTask).toHaveBeenCalled();
    expect(myTask).toHaveBeenCalledWith(expectedPayload, null);
  });

  test("e2e: should be able to start the worker with module and have it call my task with a decoded payload", async () => {
    const encryptionSecret = faker.random.alphaNumeric(10);

    const myTask = jest.fn();

    const m: ModuleI = {
      taskList: {
        "mock-job": myTask,
      },
    };

    const worker = await run(m, {
      pgPool: pool,
      encryptionSecret,
    });

    const company = faker.company.companyName();
    const account = faker.internet.email();
    const password = faker.internet.password();

    await worker.setSecret(`${company}-password`, password);

    const payload = {
      company,
      credentials: { account, password: { __secret: `${company}-password` } },
    };

    const expectedPayload = {
      company,
      credentials: { account, password },
    };

    await worker.addJob("mock-job", payload);

    // Give the worker a second to do its thing
    await wait(1 * 1000);

    expect(myTask).toHaveBeenCalled();
    expect(myTask).toHaveBeenCalledWith(expectedPayload, expect.any(Object));
  });
});

const wait = (n: number): Promise<void> =>
  new Promise((resolve, _reject) => setTimeout(resolve, n));
