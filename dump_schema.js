const mysql = require("mysql2/promise");
const fs = require("fs");

async function main() {
  const pool = mysql.createPool({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "betix_db"
  });

  const [tables] = await pool.query("SHOW TABLES");
  const tableNames = tables.map(t => Object.values(t)[0]);

  let output = "";

  for (const name of tableNames) {
    output += `\n-- Struktur tabel: ${name}\n`;
    const [desc] = await pool.query(`DESCRIBE ${name}`);
    desc.forEach(row => {
      output += `${row.Field}\t${row.Type}\t${row.Null}\t${row.Key}\t${row.Default}\t${row.Extra}\n`;
    });

    const [count] = await pool.query(`SELECT COUNT(*) AS total FROM ${name}`);
    output += `Rows: ${count[0].total}\n`;
  }

  fs.writeFileSync("schema_dump.txt", output, "utf8");
  console.log("Schema dump selesai → schema_dump.txt");
  process.exit(0);
}

main();
