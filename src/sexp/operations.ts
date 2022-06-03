enum CoreTypes {
  Integer = "integer",
  Decimal = "decimal",
  Boolean = "boolean",
  Text = "text",
}

const AnyCoreType = [
  CoreTypes.Integer,
  CoreTypes.Decimal,
  CoreTypes.Boolean,
  CoreTypes.Text,
];

interface ArgSpec {
  name: string;
  types: string[];
}

export interface OperationSpec {
  arguments: ArgSpec[];
  description: string;
  returns: string[];
  template: (args: (string | number)[]) => string;
  dynamicReturns?: (inputTypeOptions: string[][]) => string[];
}

const add: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Integer, CoreTypes.Decimal] },
    { name: "b", types: [CoreTypes.Integer, CoreTypes.Decimal] },
  ],
  description: "Adds a and b",
  template: ([a, b]) => `${a} + ${b}`,
  returns: [CoreTypes.Integer, CoreTypes.Decimal],
  dynamicReturns: (inputTypeOptions: string[][]) =>
    inputTypeOptions.every(
      (type) => type.length === 1 && type[0] === CoreTypes.Integer,
    )
      ? [CoreTypes.Integer]
      : [CoreTypes.Decimal],
};

const floor: OperationSpec = {
  arguments: [{ name: "value", types: [CoreTypes.Integer, CoreTypes.Decimal] }],
  description: "Floors the input",
  returns: [CoreTypes.Integer],
  template: ([value]) => `floor(${value})`,
};

const equalTo: OperationSpec = {
  arguments: [
    {
      name: "a",
      types: AnyCoreType,
    },
    {
      name: "b",
      types: AnyCoreType,
    },
  ],
  description: "Returns a boolean indicating whether a and b are equal",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} = ${b}`,
};

const not: OperationSpec = {
  arguments: [{ name: "value", types: [CoreTypes.Boolean] }],
  description: "Returns the opposite of the input boolean",
  returns: [CoreTypes.Boolean],
  template: ([value]) => `not ${value}`,
};

const and: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Boolean] },
    { name: "b", types: [CoreTypes.Boolean] },
  ],
  description: "AND",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} AND ${b}`,
};

const or: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Boolean] },
    { name: "b", types: [CoreTypes.Boolean] },
  ],
  description: "OR",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} OR ${b}`,
};

const isNull: OperationSpec = {
  arguments: [
    { name: "value", types: AnyCoreType },
    { name: "isNull", types: [CoreTypes.Boolean] },
  ],
  description: "Returns a boolean indicating whether the value is null",
  returns: [CoreTypes.Boolean],
  template: ([value, isNull]) => `${value} is ${isNull ? "" : "not"} null`,
};

const lessThan: OperationSpec = {
  arguments: [
    { name: "a", types: AnyCoreType },
    { name: "b", types: AnyCoreType },
  ],
  description: "less than",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} < ${b}`,
};

const lessThanOrEqualTo: OperationSpec = {
  arguments: [
    { name: "a", types: AnyCoreType },
    { name: "b", types: AnyCoreType },
  ],
  description: "less than or equal to",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} <= ${b}`,
};

const greaterThan: OperationSpec = {
  arguments: [
    { name: "a", types: AnyCoreType },
    { name: "b", types: AnyCoreType },
  ],
  description: "greater than",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} > ${b}`,
};

const greaterThanOrEqualTo: OperationSpec = {
  arguments: [
    { name: "a", types: AnyCoreType },
    { name: "b", types: AnyCoreType },
  ],
  description: "greater than",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} >= ${b}`,
};

const includes: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "includes",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} LIKE '%${b}%'`,
};

const notIncludes: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "not includes",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} NOT LIKE '%${b}%'`,
};

const includesInsensitive: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "includes insensitive",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} ILIKE '%${b}%'`,
};

const notIncludesInsensitive: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "not includes insensitive",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} NOT ILIKE '%${b}%'`,
};

const startsWith: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "starts with",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} LIKE '${b}%'`,
};

const notStartsWith: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "starts with",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} NOT LIKE '${b}%'`,
};

const startsWithInsensitive: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "starts with insensitive",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} ILIKE '${b}%'`,
};

const notStartsWithInsensitive: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "starts with insensitive",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} NOT ILIKE '${b}%'`,
};

const endsWith: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "ends with",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} LIKE '%${b}'`,
};

const notEndsWith: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "not ends with",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} NOT LIKE '%${b}'`,
};

const endsWithInsensitive: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "ends with insensitive",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} LIKE '%${b}'`,
};

const notEndsWithInsensitive: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "not ends with insensitive",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} NOT LIKE '%${b}'`,
};

const like: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "like",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} LIKE '%${b}'`,
};

const notLike: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "not like",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} NOT LIKE '%${b}'`,
};

const likeInsensitive: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "like insensitive",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} ILIKE '%${b}'`,
};

const notLikeInsensitive: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "not like insensitive",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} NOT ILIKE '%${b}'`,
};

const similarTo: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "similar to",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} SIMILAR TO '%${b}'`,
};

const notSimilarTo: OperationSpec = {
  arguments: [
    { name: "a", types: [CoreTypes.Text] },
    { name: "b", types: [CoreTypes.Text] },
  ],
  description: "not similar to",
  returns: [CoreTypes.Boolean],
  template: ([a, b]) => `${a} NOT SIMILAR TO '%${b}'`,
};

/* GOAL
const recordWithMin: OperationSpec => {
  arguments: [
    {name: 'related table', types: [CoreTypes.Table]},
    {name: 'to_minimize', types: AnyCoreType},
  ]
  description: ...,
  dynamicReturns: // returns the related table type
  returns: [RecordType],
  template: ([related_table, to_minimize]) => `
    select *
    from ${related_table}
    order by ${to_minimize}, asc
    limit 1
  `
}

const distance: OperationSpec => {
  arguments: [
    { name: a, type: [CoreTypes.Point]},
    { name: b, type: [CoreTypes.Point]},
  ],
  description: ...,
  returns: [CoreTypes.Decimal] ,
  template: ([a, b]) => `a <-> b`
}

compile(
  [
    'recordWithMin',
    [
      'events',
      [
        distance,
        [
          { table: 'person', column: 'location' }
          { table: 'event', column: 'location' }
        ]
      ]
    ]
  ]
)
*/

export const operations: { [key: string]: OperationSpec } = {
  // Logical comparators
  not,
  and,
  or,
  // Basic boolean operators
  equalTo,
  isNull,
  lessThan,
  lessThanOrEqualTo,
  greaterThan,
  greaterThanOrEqualTo,
  // String -> Boolean
  includes,
  includesInsensitive,
  notIncludes,
  notIncludesInsensitive,
  like,
  likeInsensitive,
  notLike,
  notLikeInsensitive,
  startsWith,
  startsWithInsensitive,
  notStartsWith,
  notStartsWithInsensitive,
  endsWith,
  endsWithInsensitive,
  notEndsWith,
  notEndsWithInsensitive,
  similarTo,
  notSimilarTo,
  // Basic math
  floor,
  add,
};
