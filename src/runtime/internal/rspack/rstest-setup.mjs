import { afterAll, beforeAll } from "@rstest/core";
import { closeTestApp, registerTestApp } from "../test-app.mjs";

beforeAll(registerTestApp);
afterAll(closeTestApp);
