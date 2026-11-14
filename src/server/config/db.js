// Tương thích với code cũ dùng mysql2/promise pool trực tiếp:
// pool.query() trả về [rows, fields].
const { getPool } = require("./mysql");

module.exports = {
  query: (...args) => getPool().query(...args),
  execute: (...args) => getPool().execute(...args),
  getConnection: () => getPool().getConnection(),
};
