// tests/integration/no-isolated-vm.register.mjs
import { register } from "node:module";

register("./no-isolated-vm.hooks.mjs", import.meta.url);
