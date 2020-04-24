# pg-compose

A system for declarative Postgresql migrations, tests, and higher-order types.

TODO: Explanation of what this is and what it's for.

## Installation

```bash
npm install -g pg-compose
```

## Usage

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
worker):

```bash
SECRET=secret pg-compose run -d "postgresql://localhost:5432/postgres" -f "./**/*.yaml"
```

## Documentation

### Tables

You can create tables via:

```
kind: Table
name: people
columns:
  id:
    type: uuid
    default:
      type: function
      fn: uuid_generate_v1mc()
    nullable: false
  first_name
    type: text
    nullable: false
    default: 'John'
  last_name:
    type: text
    nullable: true
indexes:
  people_pkey:
    unique: true
    primary_key: true
    on:
      - column: id
triggers:
  before_insert:
    - language: plpgsql
      for_each: row
      name:
      order: 1
```

### Special Job Payload Components

#### \_\_secret

#### \_\_after + \_\_context
