<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

**Table of Contents** _generated with
[DocToc](https://github.com/thlorenz/doctoc)_

- [pg-compose](#pg-compose)
  - [Installation](#installation)
  - [Basic CLI Usage](#basic-cli-usage)
  - [Adding Tasks](#adding-tasks)
    - [After and Context Hooks](#after-and-context-hooks)
    - [Secret Management](#secret-management)
  - [Packaging Your Module](#packaging-your-module)
    - [What are packages?](#what-are-packages)
    - [Preparing a Package](#preparing-a-package)
    - [Preparing a Typescript Package](#preparing-a-typescript-package)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# pg-compose

A system for declarative Postgresql migrations, tests, and more.

TODO: Explanation of what this is and what it's for.

## Installation

Local installation:

```bash
npm install pg-compose --save
yarn add pg-compose
```

Global installation:

```bash
npm install -g pg-compose
yarn global add pg-compose
```

## Basic CLI Usage

Run your migrations:

```bash
pg-compose install -d "postgresql://localhost:5432/postgres" -f "./**/*.yaml"
```

To dry run (just generate the output to a SQL file), pass a `-o` option:

```bash
pg-compose install -d "postgresql://localhost:5432/postgres" -f "./**/*.yaml" -o up.sql
```

To run your tests:

```bash
pg-compose test -d "postgresql://localhost:5432/postgres" -f "./**/*.yaml"
```

And then to actually run the instance (run your migrations and start graphile
worker and scheduler):

```bash
SECRET=secret pg-compose run -d "postgresql://localhost:5432/postgres" -f "./**/*.yaml"
```

## Adding Tasks

`pg-compose` uses `graphile-worker` to run tasks and `graphile-scheduler` to
schedule its cron jobs.

Since these are written in Javascript / Typescript, you need to pass your task
list to `pg-compose` and re-recreate the CLI:

```typescript
// your-project/cli.ts
import { makeCli, TaskList, JobHelpers } from "pg-compose";

interface SendWebhookPayload {
  destination: string;
  body: any;
}

const taskList: TaskList = {
  "send-webhook": async (payload: SendWebhookPayload, helpers: JobHelpers) => {
    await request.post(payload.destination).send(payload.body);
  },
};

makeCli(taskList);
```

Now, you can use `your-project/cli.(j|t)s` just like you would the `pg-compose`
cli (`node cli.js (install|test|run) -d ...`).

### After and Context Hooks

To enable additional code re-use of Javascript jobs, we added after hooks on top
of `graphile-worker` - this allows you to pass the result of a job in Javascript
land to a Postgres function that can take some additional action with the
information.

The call signature of the after function is:

```plsql
select my_after_function(payload json, result json, context json)
```

Where `payload` is the initial payload that the job was queued with, `result` is
what was returned by the Javascript task, and `context` is a JSON blob that you
initially passed to the job.

For example, if I wanted to send an email and update the email as sent with the
ID of the email as defined by some external system, I could do:

```
create or replace function
	mark_email_sent(payload json, result json, context json)
	returns void as $$
		update emails_to_send
		set sender_id = result->>'id'
		where id = (context->>'id')::uuid
$$ language sql volatile;

-- and then somewhere else in code...
select graphile_worker.add_job('send-email',
	json_build_object(
		'to': email_to_send.to,
		'from': email_to_send.from,
		'__after': 'mark_email_sent',
		'__context': json_build_object('id', email_to_send.id)
	)
);
```

### Secret Management

We found that we were reproducing a lot of the same encryption / decryption
logic to avoid storing customers' API keys or other sensitive information
unencrypted in the database, so we created a minimal and secure secret
management system that does not require external system dependencies.

When you run `pg-compose`, you pass it a `SECRET` - that secret is used for
symmetric encryption / decryption of sensitive information.

To set a secret, call:

```plsql
=# select graphile_secrets.set_secret('my-secret', 'asmdvasdfqy');
 set_secret
------------
 my-secret
(1 row)
```

As long as your worker is running, if you then try to see the secret you just
inserted, you'll see:

```plsql
=# select * from graphile_secrets.secrets ;
    ref    | encrypted_secret
-----------+------------------
 my-secret | aamsdva0s8fy0asdfa0smvasdmfaseq
(1 row)

=# select * from graphile_secrets.unencrypted_secrets ;
    ref    | encrypted_secret
-----------+------------------
(0 rows)
```

Even though you passed your unencrypted value through your database, it never
touched disk or WAL logs or any of the sensitive places that we don't want
unencrypted values to go - it only temporarily touched
`graphile_secrets.unencrypted_secrets`, which is an
[unlogged table](https://www.postgresql.org/docs/9.1/sql-createtable.html).

To use a secret in a task, pass its reference inside a
`{"__secret": "my-secret"}` json singleton to `graphile-worker`

```plsql
select graphile_worker.add_job('send-email',
	json_build_object(
    'to', email_to_send.to,
    'from', email_to_send.from,
    'mailgun_api_key', json_build_object('__secret', 'my-mailgun-api-key')
  )
);
```

And then your task will be called with its decrypted value:

```typescript
interface SendEmailPayload {
  from: string;
  to: string;
  mailgun_api_key: string;
}

const sendEmail = async (payload: SendEmailPayload) => {
  const mailgun = mailgun({ apiKey: payload.mailgun_api_key })
  mailgun.messages.send(...)
}
```

## Packaging Your Module

### What are packages?

`pg-compose` module's are package and distributed as ES Modules via NPM. If you
add a dependency inside of your module via YAML, like:

```yaml
kind: Dependency
name: stripe
```

Because you want extend your customers table to integrate with Stripe:

```yaml
kind: Table
name: customer
implements:
	- trait: stripe_customer
```

You need to install the module `pgc-stripe` to your project, similar to how
Babel uses the `babel-plugin` prefix for all of its plugins.

### Preparing a Package

`pg-compose` modules must export a default asynchronous function which returns a
`pg-compose` module, i.e.:

```type
type ModuleLoader = () => Promise<ModuleI>;
```

The easiest way to do that is to use the `loadYaml` function provided by
`pg-compose`, for example:

```javascript
// your-project/index.js
import { taskList } from "./task-list";
import { loadYaml, ModuleI } from "pg-compose";

// pg-compose modules should export an asynchronous function which resolves to a module
export default async () => {
  const m = await loadYaml({ include: `${__dirname}/**.yaml` });
  m.taskList = taskList;
  return m;
};
```

Make sure to:

- Use `__dirname` in the path to your yaml so that in correctly resolves inside
  of someone else's `node_modules` folder, and
- Copy your YAML files if you have a build setup so that it resolves correctly

### Preparing a Typescript Package

If you are building a `pg-compose` package in Typescript, you need to make sure
that you copy any included YAML files to your dist folder. I'd recommend using
the npm package `copy`, and adding a build command like:

```json
{
  "name": "pgc-your-project",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "rm -Rf dist && tsc && copy src/**/*.yaml dist",
  },
  "dependencies": {
    "copy": "^0.3.2",
    ...
  },
  ...
}
```

to your `package.json`. This assumes that you are transpiling your Typescript to
a `dist/`folder. For reference, this is the `tsconfig.json` we use with our
`pg-compose` modules with tasks written in Typescript:

```json
{
  "compilerOptions": {
    "rootDir": "src",
    "declarationDir": "./dist",
    "outDir": "./dist",
    "declaration": true,
    "allowJs": false,
    "target": "es2018",
    "module": "commonjs",
    "moduleResolution": "node",
    "sourceMap": true,
    "pretty": true,
    "importHelpers": true,
    "experimentalDecorators": true,
    "noImplicitAny": true,
    "suppressImplicitAnyIndexErrors": true,
    "strictNullChecks": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedParameters": true,
    "noUnusedLocals": true,
    "preserveWatchOutput": true,
    "lib": ["es2018", "esnext.asynciterable"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```
