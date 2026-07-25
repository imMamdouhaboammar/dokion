import catalog from "../../dokion.json";
import { manifestCliCommands } from "../cli/command-registry.ts";

export const builtinCatalog = {
  ...catalog,
  dokion_cli: {
    ...catalog.dokion_cli,
    commands: manifestCliCommands()
  }
};
