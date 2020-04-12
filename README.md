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
