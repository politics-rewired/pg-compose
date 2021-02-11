import { LogFunctionFactory, Logger } from "graphile-worker";
import { LogLevel, LogMeta } from "graphile-worker/dist/logger";

const DefaultLogFactory: LogFunctionFactory = scope => (
  level: LogLevel,
  message: string,
  meta?: LogMeta,
) => {
  switch (level) {
    case LogLevel.DEBUG:
      return console.debug(scope, message, meta);
    case LogLevel.INFO:
      return console.info(scope, message, meta);
    case LogLevel.WARNING:
      return console.warn(scope, message, meta);
    case LogLevel.ERROR:
      return console.error(scope, message, meta);
    default:
      return console.log(scope, message, meta);
  }
};

export const DefaultLogger = new Logger(DefaultLogFactory);
