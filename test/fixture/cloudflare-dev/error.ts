import { defineErrorHandler } from "nitro";

export default defineErrorHandler((error) => new Response(error.message, { status: 500 }));
