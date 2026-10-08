import { createApp } from "./app.js";
import { openDb } from "./db/connection.js";

const db = openDb();
const app = createApp(db);
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
