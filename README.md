# pga

## Progress

- [x] Columns
- [x] Indexes
- [ ] Foreign keys
- [ ] Table dropping
- [ ] Functions
- [ ] Triggers
- [ ] Extension
- [ ] Traits

## Goals

The goal is to implement a pga package, which exposes objects (tables,
functions, and jobs) and traits.

Objects can declare variables and defaults, and use them as well.

For example, there's a `billing` package that exposes a `billable_unit` trait.

To implement billable unit, you have to implement
`get_billing_unit_info_for(table_object)`;

```yaml
kind: Trait
name: billable_unit
triggers:
  after_insert:
    - language: plpgsql
      body: >
        insert into charges (amount) values
        (get_charge_amount_for({implementor}))
required_methods:
  get_charge_amount_for:
    # parameters:
    returns: numeric
```

```yaml
kind: Trait
name: causes_slack_notification
triggers: ---
required_methods:
  should_notify:
    returns: boolean
  get_notification_text:
    returns: text
```

```yaml
kind: Table
name: message
implements: billable_unit
methods:
  get_charge_amount_for: >
    select '.01'
columns: ...
```

When you declare your table, `message`, a `billable_unit`, you need to implement
that, and that is enforced at compile time.

Another example of a trait would be `SlackNotifiable`, which requires:
`should_notify(old, new)` and `get_notification_text(table_object)`.

Traits need to also be able add triggers to other tables.

Objects can be extended - when an object is extended, you can add indexes,
triggers, and columns.

When you extend an object, you're actually replacing it.

If you're changing its name, other things need to know to reference it
accordingly.

When you extend an object,you can also disable triggers, indexes, etc - but the
original object can mark things as protected, meaning they can't be disabled or
overwritten.

There are two phases - compile time and migration time. There is no runtime,
there is just the operation of the database.

Migration time takes a final set of objects and installs them on the database.

Compile time produces the final set of objects.

They do not depend on each other!

I want to write a table like:

```yaml
kind: Table
name: people
columns:
  - name: first_name
    type: string
    default:
    nullable: true
  - name: last_name
    type: string
indexes:
  - name: name
    on: col, col, col
    type: btree
    where: amsd
    unique: false
    include: a, b, c
foreignKeys:
  - on_column: first_name:
    references:
      table: table_name
      column: column_name
primaryKey: first_name
primaryKey:
  - first_name
    last_name
implements:
  - billable_unit
triggers:
  before_insert:
    - language: plpgsql
      when:
      body: >
        insert into {}....
    - language: plpgsql
      function: ajsdfjasd
  after_insert:
    - language: plpgsql
rls_enabled: true / false
```

I want to write a function like:

```yaml
kind: Function
name: insert_person
return_type: person
parameters:
  - name: first_name
    type: text
language: plpgsql
body: >
  insert into
filePath: ./person-functions
block: $insert$
```

And define a type like:

```yaml
kind: CompositeType
name: person
attributes:
  first_name: string
```

And

```yaml
kind: EnumType
name: occupation
options:
  - nurse clerk cook
```

And a job like

```yaml
kind: Job
```

There are 3 "sublibraries":

- objects, which exports types with validation
- introspect, which turns the current database into an objects array
- migrate, which takes the desired database objects, the current database
  objects, and generates an operation list
- run, which either serializes the operation list to sql (with an optional
  zero-downtime option) or actually runs the migrations
- watch, which takes a dir path to watch changes for and then continually calls
  run on changes

That's a good migration experience!

Next, we need traits, object extension, and function extension.

Then, we need to add a compilation stage to the front of that, with explicit
imports.

Then, need to make a module object which exports other objects under a name.

Root is either a module or a package - both have imports and exports. A packages
exports is what gets installed, and it's got to be all filled in with any
variables and a schema, etc.

# Package

```yaml
kind: Template
includes:
  - contactable outbound_messages, inbound_messages, phone_numbers, etc.
variables:
  contactable_table: Table
```

```yaml
kind: Function
name: send_message_to_contact
body: >
  insert into sms.outbound_messages (text, to_number) values (text,
  get_phone_number_from_contactable_table({contactable_table}))
```

# Using It

```yaml
imports: contactables
kind: Table
name: voter
implements:
  contactable_table
    cell: phone_number
columns:
  first_name:
    type: text
```

# Package

```yaml
kind: Table
name: contact
columns:
  id:
    type: uuid
    default: uuid_generate_v1()
  first_name:
    type: text
    nullable: false
  last_name:
    type: text
    nullable: true
```

```yaml
kind: Table
name: conversation
columns:
  status:
    type: ConversationSatus
    nullable: false
  contact_id:
    type: uuid
  ...
foriegnKeys:
  - on_column: contact_id
    references:
      table: contact
      column: id
...
```

# Using it in my application

```yaml
kind: Table
name: contact
extends: crm_v4.Contact
addColumns:
modifyColumns:
addIndexes:
addTriggers:
```

```yaml
kind: Table
name: volunteer
isA:
  table: contact
  via: contact_id
```

- contact
  - first_name
- conversation
- ...

- volunteer
  - contact_id
- voter

# Complex Migrations With Backfills And Stuff

nullable to not nullable w/o default

```
kind: Table
...
columns:
  campaign_id:
    nullable: false
    backfill_via: fn
```

.babelrc

```json
{
  "plugins": ["esnext"]
}
```

# Spoke Syncing

interaction_step ( id answer_option text answer_option_actions [{ }, { }]
parent_interaction_step_id )

interaction_step_action ( interaction_step_id external_question_id
external_question_response )

-- Database values for interaction_step (1, null, null) (2, Yes, 1) (3, No, 1)

question_response ( interaction_step_id value )

-- Database values for question_response (1, Yes)

interaction_step_answer_option_external_mappings ( interaction_step_id
external_question_id external_question_resposne )

external_question ( id system question response_option )

external_question_response_option ( external_question_id response_option )

external_question_response ( interaction_step_id
external_question_response_option_id )

-- Database values (1, 5) (1, 10) (1, 12)

external_questions ( id question response_option [] system )

van_script_questions ( external_question_id question response_option )

van_survey_responses - this is a table that when you insert into it it syncs to
van

```yaml
import: pdi_integration
name: question_response
extends: question_response
secrets:
  pdi_api_key: aspda-pdi
add_triggers:
  after_insert:
    - when: system === 'pdi'
      body: insert into pdi_question_response (...) values (...)   -
```

```yaml
name: van_script_questions
implements: spoke_external_question
columns: ...
methods:
  get_question:
    language: sql
    body: >
      select question
  get_response:
    language: sql
    body: >
      select response
  get_system:
    language: sql
    body: >
      select 'van'
```

# Secrets

assemble_worker

- jobs
- queues
- secrets - unlogged
  - ref: as0d8a-pdi
  - value: <redacted>
  - mask: total, partial

job payload:

```json
{ "pdiUser": "ben", "pdiSecret": { "secretRef": "pdi" } }
```

Worker needs pluggable secret resolvers

Postgraphile plugin for writing secrets and anonymizing already encrypted
secrets

- Store the preview separately or decrypt it and toss away most of it

# Notes

Roadblock implementing primary keys -> foreign keys.

If the primary keys on a table change, foreign keys pointing to it will need to
as well.

Therefore, we'll have to group primary keys on a table and foreign keys pointing
to a table in one group. This can be done by adding groupings to ops, one group
being "of or relating to the primary keys on table x".

If a table's primary keys are being changed, its foreign keys will need to be
dropped and recreated in between the change of the primary key.

We can circumvent that totally just by doing:

1. Column migrations
2. Build new index for primary keys if required
3. Down of any constraints
4. Change primary keys
5. Redo constraints
