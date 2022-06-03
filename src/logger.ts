import { LogLevel } from "@graphile/logger";
import { LogFunctionFactory, Logger } from "graphile-worker";

const DefaultLogFactory: LogFunctionFactory =
  (scope) => (level, message, meta) => {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug(message, { ...meta, ...scope });
      case LogLevel.INFO:
        return console.info(message, { ...meta, ...scope });
      case LogLevel.WARNING:
        return console.warn(message, { ...meta, ...scope });
      case LogLevel.ERROR:
        return console.error(message, { ...meta, ...scope });
      default:
        return console.log(message, { ...meta, ...scope });
    }
  };

export const DefaultLogger = new Logger(DefaultLogFactory);
