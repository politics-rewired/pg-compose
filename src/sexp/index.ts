import { zip } from "lodash";
import { Array, match, Number, String, Tuple, Union, Unknown } from "runtypes";

import { operations } from "./operations";

// type SExpr = string | ["column", string] | [string, [SExpr, SExpr]];
type SExpr = string | number | [string, SExpr[]];

const SExprValue = Union(String, Number);
// const SExprValue = String;
// const SExprColumn = Tuple(Literal("column"), String);
const SExprOperation = Tuple(String, Array(Unknown));

export interface CompiledExpression {
  expression: string | number;
  types: string[];
}

const Integer = Number.withConstraint(n => Math.floor(n) === Math.ceil(n));

const compile = (sexp: SExpr): CompiledExpression =>
  match(
    [
      SExprOperation,
      ([opName, operands]) => {
        const operation = operations[opName];

        if (operands.length !== operation.arguments.length) {
          throw new Error(
            `Operation ${opName} expects ${operation.arguments.length} arguments, but was passed ${operands.length}`,
          );
        }

        const compiledOperands = operands.map((op: SExpr) => compile(op));

        const operandArgumentPairs = zip(
          compiledOperands,
          operation.arguments,
          operands,
        );

        for (const opArgPair of operandArgumentPairs) {
          const operand = opArgPair[0]! as any;
          const argSpec = opArgPair[1]! as any;

          const disallowedOperandTypes = operand.types.filter(
            (type: any) => !argSpec.types.includes(type),
          );
          if (disallowedOperandTypes.length > 0) {
            throw new Error(
              `Operation ${opName} expects one of ${argSpec.types.join(
                ", ",
              )} for ${
                argSpec.name
              }, but the value it was given could be a ${disallowedOperandTypes.join(
                ", ",
              )}`,
            );
          }
        }

        const returnTypes =
          operation.dynamicReturns !== undefined
            ? operation.dynamicReturns(
                compiledOperands.map((i: any) => i.types),
              )
            : operation.returns;

        return {
          expression: operation.template(
            compiledOperands.map((i: any) => `(${i.expression})`),
          ),
          types: returnTypes,
        };
      },
    ],
    [
      SExprValue,
      val => {
        return {
          expression: val,
          types: [
            match(
              [Integer, () => "integer"],
              [Number, () => "decimal"],
              [String, () => "string"],
            )(val),
          ],
        };
      },
    ],
  )(sexp);

export { compile, operations };
