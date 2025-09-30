// const sql = require('mssql');
// require("dotenv").config();
// // SQL Server configuration
// const config = {
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   server: process.env.DB_SERVER,
//   database: process.env.DB_NAME,
//     options: {
//       encrypt: false, // Use SSL
//       trustServerCertificate: true, // Allow self-signed certificates
//     },
//   };

// async function connectToDB() {
//   try {
//     const pool = await sql.connect(config);
//     console.log('Connected to SQL DB');
//     return pool;
//   } catch (err) {
//     console.error('Database connection failed:', err.message);
//     throw err;
//   }
// }

// module.exports = { connectToDB };
