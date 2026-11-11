import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import app from './app.js';
import { startScheduler, stopScheduler } from './jobs/scheduler.js';

await connectDB();

const server = app.listen(env.port, () => {
  console.log(`Server running in ${env.nodeEnv} mode on http://localhost:${env.port}`);
  startScheduler();
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down gracefully...`);

  stopScheduler()
  server.close(() => {
    disconnectDB()
      .then(() => {
        console.log('Shutdown complete');
        process.exit(0);
      })
      .catch((error: unknown) => {
        console.error('Error during shutdown:', error);
        process.exit(1);
      });
  });

  setTimeout(() => {
    console.error('Shutdown took too long, forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled promise rejection:', reason);
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});