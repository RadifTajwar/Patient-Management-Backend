require("dotenv").config();
const mysql = require("mysql2/promise");

async function initializeConnection() {
  console.log("⬜ [DB] Initializing MySQL connection...");

  try {
    const connectionConfig = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT),
      dateStrings: true,
      timezone: "+06:00",

      // Add connection timeout for debugging
      connectTimeout: 15000, // 15 seconds
    };

    console.log("⬜ [DB] Using connection config:", {
      host: connectionConfig.host,
      user: connectionConfig.user,
      database: connectionConfig.database,
      port: connectionConfig.port,
    });

    console.log("⬜ [DB] Attempting to connect...");

    const connection = await mysql.createConnection(connectionConfig);

    console.log("🟩 [DB] Successfully connected to MySQL!");
    return connection;
  } catch (err) {
    console.error("🟥 [DB] Error connecting to MySQL:", err);
    throw err;
  }
}

module.exports = { initializeConnection };
// const mysql = require("mysql2/promise");

// async function initializeConnection() {
//   try {
//     const connectionConfig = {
//       host: process.env.DB_HOST,
//       user: process.env.DB_USER,
//       password: process.env.DB_PASSWORD,
//       database: process.env.DB_NAME,
//       dateStrings: true,
//       timezone: "+06:00",
//     };

//     const connection = await mysql.createConnection(connectionConfig);
//     console.log("Connected to the database.");
//     return connection;
//   } catch (err) {
//     console.error("Error connecting to database:", err);
//     throw err;
//   }
// }

// module.exports = { initializeConnection };
