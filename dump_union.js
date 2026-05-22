const fs = require("fs");
const path = require("path");

// === CONFIG ===
// Path folder target
const targetDir = "D:\\DOWNLOAD\\betix-main\\public\\js";
// Ekstensi yang mau diambil (bisa ditambah)
const extensions = [".js"];

// === MAIN ===
function main() {
  // Buat nama file output unik (pakai timestamp biar nggak ditimpa)
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFile = `union_output_${timestamp}.txt`;

  // Ambil semua file di folder
  const files = fs.readdirSync(targetDir)
    .filter(f => extensions.includes(path.extname(f).toLowerCase()));

  let output = `Path: ${targetDir}\n\n`;

  files.forEach((file, index) => {
    const filePath = path.join(targetDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    output += `${index + 1}. ${file}\n\n${content}\n\n`;
  });

  fs.writeFileSync(outputFile, output, "utf8");
  console.log(`Gabungan selesai → ${outputFile}`);
}

main();
