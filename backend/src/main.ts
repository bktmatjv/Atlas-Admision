import { createApp } from "./bootstrap.js";
import { settings } from "./config.js";
const app = await createApp();
await app.listen(settings().PORT, settings().HOST);
console.log(`CALIBRA API: http://localhost:${settings().PORT}/api/v1/salud`);
