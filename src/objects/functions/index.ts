import {
  Record,
  Partial,
  String,
  Array,
  Literal,
  Union,
  Static,
  match,
  Tuple,
} from "runtypes";
import { PgIdentifier, ManyObjectProvider } from "../core";
import { PoolClient } from "pg";
import { RunContextI } from "../../runners";

const FunctionArgument = Record({
  name: PgIdentifier,
  type: PgIdentifier,
}).And(
  Partial({
    default: String,
  }),
);

export const FunctionRecord = Record({
  name: PgIdentifier,
  arguments: Array(FunctionArgument),
  returns: PgIdentifier,
  language: Union(Literal("plpgsql"), Literal("sql")),
  security: Union(Literal("invoker"), Literal("definer")),
  volatility: Union(
    Literal("volatile"),
    Literal("stable"),
    Literal("immutable"),
  ),
  body: String,
}).And(
  Partial({
    previous_name: PgIdentifier,
    implements: Array(String),
  }),
);

export interface FunctionI extends Static<typeof FunctionRecord> {}

export const ContractRecord = Record({
  name: String,
  arguments: Array(FunctionArgument),
  returns: PgIdentifier,
});

export interface ContractI extends Static<typeof ContractRecord> {}

interface PgFunc {
  name: string;
  body: string;
  volatility: "s" | "i" | "v";
  language: string;
  return_type: string;
  is_security_definer: boolean;
  input_arguments: {
    argname: string;
    argtype: string;
  }[];
}

const introspectMany = async (
  client: PoolClient,
  context: RunContextI,
): Promise<FunctionI[]> => {
  const { rows } = await client.query<PgFunc>(
    `
      SELECT 
        func.oid as oid_to_discard,
        func.pronargs as nargs_to_discard,
        func.proname as name,
        func.prosrc as body,
        func.provolatile as volatility,
        lang.lanname as language,
        return_type.typname as return_type,
        func.prosecdef as is_security_definer,
        case 
          when pronargs = 0 then ARRAY[]::json[]
          else
            array_agg(
              json_build_object(
                'argname', argument_names.argname,
                'argtype', input_type.typname
              )
              order by argument_names.ordinality
            )
        end as input_arguments
      FROM pg_proc as func
      JOIN pg_type as return_type
        ON return_type.oid = func.prorettype
      JOIN pg_language as lang
        ON lang.oid = func.prolang
      LEFT JOIN LATERAL UNNEST(proargtypes) with ordinality as argument_types (type_oid, ordinality)
        ON true
      LEFT JOIN LATERAL UNNEST(proargnames) with ordinality as argument_names (argname, ordinality)
        ON argument_names.ordinality = argument_types.ordinality
      LEFT JOIN pg_type as input_type
        ON input_type.oid = argument_types.type_oid
      WHERE func.prokind = 'f'
        AND func.pronamespace = to_regnamespace($1)::oid
        AND return_type.typname <> 'trigger'
      GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
    `,
    [context.schema],
  );

  return rows.map(p => ({
    name: p.name,
    body: p.body.trim(),
    returns: p.return_type,
    language: p.language as "sql" | "plpgsql",
    security: p.is_security_definer ? "definer" : "invoker",
    volatility: {
      s: "stable",
      i: "immutable",
      v: "volatile",
    }[p.volatility] as "stable" | "immutable" | "volatile",
    arguments: p.input_arguments.map(a => ({
      name: a.argname,
      type: a.argtype,
    })),
  }));
};

const CreateFunctionInput = Tuple(FunctionRecord, Literal(undefined));
const DropFunctionInput = Tuple(Literal(undefined), FunctionRecord);
const AlterFunctionInput = Tuple(FunctionRecord, FunctionRecord);

const ReconcileFunctionInput = Union(
  CreateFunctionInput,
  DropFunctionInput,
  AlterFunctionInput,
);

enum FunctionOpCodes {
  CreateFunction = "create_function",
  ReplaceFunction = "replace_function",
  DropFunction = "drop_function",
  RenameFunction = "rename_function",
  AlterFunctionVolatility = "alter_function_volatility",
  AlterFunctionSecurity = "alter_function_security",
}

const CreateFunctionOperation = Record({
  code: Literal(FunctionOpCodes.CreateFunction),
  func: FunctionRecord,
});

const ReplaceFunctionOperation = Record({
  code: Literal(FunctionOpCodes.ReplaceFunction),
  func: FunctionRecord,
});

const DropFunctionOperation = Record({
  code: Literal(FunctionOpCodes.DropFunction),
  func: FunctionRecord,
});

const RenameFunctionOperation = Record({
  code: Literal(FunctionOpCodes.RenameFunction),
  func: FunctionRecord,
});

const AlterFunctionVolatilityOperation = Record({
  code: Literal(FunctionOpCodes.AlterFunctionVolatility),
  func: FunctionRecord,
});

const AlterFunctionSecurityOperation = Record({
  code: Literal(FunctionOpCodes.AlterFunctionSecurity),
  func: FunctionRecord,
});

export const FunctionOperation = Union(
  CreateFunctionOperation,
  ReplaceFunctionOperation,
  DropFunctionOperation,
  RenameFunctionOperation,
  AlterFunctionVolatilityOperation,
  AlterFunctionSecurityOperation,
);

export type FunctionOperationType = Static<typeof FunctionOperation>;

const reconcile = (
  desired: FunctionI | undefined,
  current: FunctionI | undefined,
): FunctionOperationType[] => {
  const input = [desired, current];

  if (ReconcileFunctionInput.guard(input)) {
    return match(
      [
        CreateFunctionInput,
        ([d]) => [
          {
            code: FunctionOpCodes.CreateFunction,
            func: d,
          },
        ],
      ],
      [
        DropFunctionInput,
        ([_, c]) => [
          {
            code: FunctionOpCodes.DropFunction,
            func: c,
          },
        ],
      ],
      [
        AlterFunctionInput,
        ([d, c]) => {
          const needsDropAndRecreate = d.returns !== c.returns;

          if (needsDropAndRecreate) {
            return [
              {
                code: FunctionOpCodes.DropFunction,
                func: c,
              },
              {
                code: FunctionOpCodes.CreateFunction,
                func: d,
              },
            ];
          }

          const operations: FunctionOperationType[] = [];

          if (d.name !== c.name && d.previous_name === c.name) {
            operations.push({
              code: FunctionOpCodes.RenameFunction,
              func: d,
            });
          }

          if (d.volatility !== c.volatility) {
            operations.push({
              code: FunctionOpCodes.AlterFunctionVolatility,
              func: d,
            });
          }

          if (d.security !== c.security) {
            operations.push({
              code: FunctionOpCodes.AlterFunctionSecurity,
              func: d,
            });
          }

          if (d.body !== c.body || d.language !== c.language) {
            operations.push({
              code: FunctionOpCodes.ReplaceFunction,
              func: d,
            });
          }

          return operations;
        },
      ],
    )(input);
  }

  return [];
};

const toStatement = (context: RunContextI) =>
  match(
    [
      CreateFunctionOperation,
      op =>
        `CREATE FUNCTION "${context.schema}".${
          op.func.name
        }(${op.func.arguments
          .map(p => [p.name, p.type].join(" "))
          .join(", ")}) RETURNS ${op.func.returns} as $$ ${
          op.func.body
        } $$ language ${op.func.language} ${op.func.volatility} SECURITY ${
          op.func.security
        } SET search_path = "${context.schema}";`,
    ],
    [
      ReplaceFunctionOperation,
      op =>
        `CREATE OR REPLACE FUNCTION "${context.schema}".${
          op.func.name
        }(${op.func.arguments
          .map(p => [p.name, p.type].join(" "))
          .join(", ")}) RETURNS ${op.func.returns} as $$ ${
          op.func.body
        } $$ language ${op.func.language} ${op.func.volatility} SECURITY ${
          op.func.security
        } SET search_path = "${context.schema}";`,
    ],
    [
      DropFunctionOperation,
      op => `DROP FUNCTION "${context.schema}".${op.func.name};`,
    ],
    [
      RenameFunctionOperation,
      op =>
        `ALTER FUNCTION "${context.schema}".${op.func.previous_name} RENAME TO ${op.func.name};`,
    ],
    [
      AlterFunctionVolatilityOperation,
      op =>
        `ALTER FUNCTION "${context.schema}".${op.func.name} ${op.func.volatility};`,
    ],
    [
      AlterFunctionSecurityOperation,
      op =>
        `ALTER FUNCTION "${context.schema}".${op.func.name} SECURITY ${op.func.security};`,
    ],
  );

const pgTypeAliases = {
  integer: "int4",
};

const areTypesEqual = (a: string, b: string) => {
  const aType = pgTypeAliases[a] || a;
  const bType = pgTypeAliases[b] || b;
  return aType === bType;
};

export const checkFunctionContractsMatch = (
  func: FunctionI | ContractI,
  contract: FunctionI | ContractI,
) => {
  const errors = [];

  if (func.returns !== contract.returns) {
    errors.push(
      `${func.name} incorrectly implements ${contract.name}: ${func.returns} does not match return type ${contract.returns}`,
    );
  }

  if (func.arguments.length !== contract.arguments.length) {
    errors.push(
      `${func.name} incorrectly implements ${contract.name}: has ${func.arguments.length} arguments but should have ${contract.arguments.length}`,
    );
  }

  func.arguments.forEach((arg, idx) => {
    if (
      contract.arguments[idx] !== undefined &&
      !areTypesEqual(arg.type, contract.arguments[idx].type)
    ) {
      errors.push(
        `${func.name} incorrectly implements ${contract.name}: ${arg.name} is of type ${arg.type} but should be of type ${contract.arguments[idx].type}`,
      );
    }
  });

  return errors.length === 0 ? true : errors;
};

const identityFn = (a: FunctionI, b: FunctionI) => {
  if (a.name !== b.name && b.name !== a.previous_name) {
    return false;
  }

  const successOrErrors = checkFunctionContractsMatch(a, b);
  return successOrErrors === true;
};

export const FunctionProvider: ManyObjectProvider<
  FunctionI,
  FunctionOperationType
> = {
  record: FunctionRecord,
  introspectMany,
  reconcile,
  toStatement,
  type: "many",
  identityFn,
};
