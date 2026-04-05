import { builder } from "./builder";

// Run all side effects to add the fields
import.meta.glob("./schema/**/*.ts", { eager: true });

export const schema = builder.toSchema();
