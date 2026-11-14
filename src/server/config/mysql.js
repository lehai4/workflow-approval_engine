// Kết nối MySQL dùng chung cho toàn bộ backend FastWork.
// Pool được tạo lười (lần gọi đầu tiên) và gắn vào globalThis để Next.js dev (HMR)
// không tạo thêm pool mới sau mỗi lần reload module.
const mysql = require("mysql2");

const config = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "workflow_db",
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_SIZE || "10", 10),
  queueLimit: 0,

  dateStrings: true,
  charset: "utf8mb4",
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
  connectTimeout: 60000,
};

// Múi giờ cho NOW()/CURRENT_TIMESTAMP của mỗi phiên MySQL. Code nghiệp vụ dùng NOW() và giả định
// giờ Việt Nam; MySQL trong Docker mặc định chạy UTC nên phải đặt cho từng kết nối.
const DB_TIMEZONE = process.env.DB_TIMEZONE || "+07:00";

const getPool = () => {
  if (!globalThis.__fwMysqlPool) {
    const pool = mysql.createPool({ ...config, timezone: DB_TIMEZONE });
    pool.on("connection", (conn) => {
      conn.query("SET time_zone = ?", [DB_TIMEZONE]);
    });
    globalThis.__fwMysqlPool = pool.promise();
  }
  return globalThis.__fwMysqlPool;
};

const query = async (sql, params = []) => {
  try {
    const [results] = await getPool().execute(sql, params);
    return results;
  } catch (error) {
    console.error("❌ MySQL Query Error:", { sql, params, error: error.message });
    throw error;
  }
};

const getConnection = () => getPool().getConnection();

const transaction = async (callback) => {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  init: async () => getPool(),
  query,
  getConnection,
  transaction,
  getPool,
};
