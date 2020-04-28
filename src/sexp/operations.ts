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

interface OperationSpec {
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
      type => type.length === 1 && type[0] === CoreTypes.Integer,
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

const equals: OperationSpec = {
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

const isNull: OperationSpec = {
  arguments: [{ name: "value", types: AnyCoreType }],
  description: "Returns a boolean indicating whether the value is null",
  returns: [CoreTypes.Boolean],
  template: ([value]) => `${value} is null`,
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
  add,
  equals,
  isNull,
  not,
  floor,
};
