import env from "./config/env.js";
import app from "./app.js";
import { connectDB } from "./config/db.js";


await connectDB();

app.listen(env.port, () => {
  console.log(
    `Server running in ${env.nodeEnv} mode on http://localhost:${env.port}`,
  );
});
