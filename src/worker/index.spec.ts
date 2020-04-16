import { Pool } from "pg";
// import { migrate, encryptSecret, getSecret, GraphileSecrets } from "./index";
import {
  migrate,
  encryptSecret,
  GraphileSecrets,
  getSecret,
  setSecret,
  GraphileUnencryptedSecrets,
} from "./index";
import { PoolClient } from "pg";
import * as faker from "faker";
import { runTaskListOnce, TaskList } from "graphile-worker";
import Cryptr = require("cryptr");

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

describe("secret management", () => {
  beforeAll(async () => {
    await pool.query("drop schema if exists graphile_secrets cascade;");
    await migrate(pool);
  });

  test("symmetric encryption job - inserting a secret causes replacement w/ encrypted secret", async () => {
    const cryptr = new Cryptr(faker.random.alphaNumeric());

    const client = await pool.connect();
    await client.query("begin");
    await clearJobsAndSchedules(client);

    const ref = faker.random.alphaNumeric();
    const unencryptedSecret = faker.random.alphaNumeric();

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

  test("getSecret gets the unencrypted secret if the encrypted secret is not available yet", async () => {
    const cryptr = new Cryptr(faker.random.alphaNumeric());
    const client = await pool.connect();
    await client.query("begin");
    await clearJobsAndSchedules(client);

    const ref = faker.random.alphaNumeric();
    const unencryptedSecret = faker.random.alphaNumeric();

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

  test("setSecret(ref, unencrypted_secret) inserts into secrets and the unlogged table", async () => {
    const client = await pool.connect();
    await client.query("begin");
    await clearJobsAndSchedules(client);

    const ref = faker.random.alphaNumeric();
    const unencryptedSecret = faker.random.alphaNumeric();

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

  test("setSecret + getSecret isomorphism w/ job", async () => {
    const cryptr = new Cryptr(faker.random.alphaNumeric());
    const client = await pool.connect();
    await client.query("begin");
    await clearJobsAndSchedules(client);

    const ref = faker.random.alphaNumeric();
    const unencryptedSecret = faker.random.alphaNumeric();

    await setSecret(client, ref, unencryptedSecret);

    const taskList = makeTaskList(client, cryptr);

    // run the worker job via runTaskListOnce
    await runTaskListOnce({ pgPool: pool }, taskList, client);

    const resolvedUnencryptedSecret = await getSecret(client, cryptr, ref);
    expect(resolvedUnencryptedSecret).toEqual(unencryptedSecret);
  });

  test("setSecret + getSecret isomorphism w/o job", async () => {
    const cryptr = new Cryptr(faker.random.alphaNumeric());
    const client = await pool.connect();
    await client.query("begin");
    await clearJobsAndSchedules(client);

    const ref = faker.random.alphaNumeric();
    const unencryptedSecret = faker.random.alphaNumeric();

    await setSecret(client, ref, unencryptedSecret);

    const resolvedUnencryptedSecret = await getSecret(client, cryptr, ref);
    expect(resolvedUnencryptedSecret).toEqual(unencryptedSecret);
  });
});
