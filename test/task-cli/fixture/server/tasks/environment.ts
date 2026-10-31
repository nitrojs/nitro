import { defineTask } from "nitro/task";
import { FastResponse } from "srvx";

export default defineTask({ run: () => ({ result: { fastResponse: Response === FastResponse } }) });
