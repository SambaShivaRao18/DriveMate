const fs = require('fs');
const path = require('path');

const uploadDirs = [
  'public/uploads/problems',
  'public/uploads/temp'
];

uploadDirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Created directory: ${fullPath}`);
  }
});

console.log('📁 Upload directories ready!');