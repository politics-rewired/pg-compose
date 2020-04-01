# Motivation

The popularity of the database-first applications (the type of thing built with
[Postgraphile](https://www.graphile.org/) ,
[Postgrest](http://postgrest.org/en/v6.0/), [Hasura](https://hasura.io/)) has
made building performant, secure applications easier, requiring less code.

However, it's introduced its own challenges which largely stem from the new
meaning of "code". Rather than code as a set of instructions and functions that
plug into frameworks and runtimes that invoke them, your application is a bundle
of database objects (tables, functions, views, security policies, etc.) and your
code (the thing you have in source control) is a set of instructions for
installing those database objects on to a database. In this paradigm, Postgresql
is less of a database than a live, stateful, persistent runtime like the
[BEAM](<https://en.wikipedia.org/wiki/BEAM_(Erlang_virtual_machine)>) or
[Smalltalk](https://en.wikipedia.org/wiki/Smalltalk) which have hot-code
reloading.

While Postgres is a super-featured database with many of the affordances of a
modern programming language (procedures, triggers, custom types), it lacks a few
critical features that are necessary for achieving composability and modularity
within Postgres first applications. There are no classes, interfaces, or
higher-order functions (without code injection), which makes writing
abstractions with hidden implementations difficult if not impossible.

There is also no package system that works at the migration level -
[PGXN](https://pgxn.org/), the Postgres extension network, provides a number of
modules that are useful if you're compiling your own Postgres image, which is
too low-level for many use cases and not applicable to hosted Postgres.

# Solution

Here are the principles guiding this solution:

- We should maintain a list of the current state of database objects, not
  installation instructions
- We should be able to extract functionality from specific contexts and re-use
  them
