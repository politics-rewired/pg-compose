import { ModuleI } from "../objects/module/core";

export type Loader<LoaderOpts> = (opts: LoaderOpts) => Promise<ModuleI>;
