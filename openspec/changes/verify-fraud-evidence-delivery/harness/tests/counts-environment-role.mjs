import "../lib/role-guard.mjs";
import { environmentLabel } from "../counts/environment.mjs";

process.stdout.write(JSON.stringify(environmentLabel()));
