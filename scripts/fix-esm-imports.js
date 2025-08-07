const fs = require('fs');
const path = require('path');

function fixEsmImports(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      fixEsmImports(filePath);
    } else if (file.name.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Fix relative imports without .js extension
      content = content.replace(
        /from\s+['"](\.[^'"]+)(?<!\.js)['"];?/g,
        (match, importPath) => {
          // Don't add .js if it's already there or if it's a directory import
          if (importPath.endsWith('.js') || importPath.endsWith('/')) {
            return match;
          }
          return match.replace(importPath, importPath + '.js');
        }
      );
      
      // Fix export from statements
      content = content.replace(
        /export\s+.*?\s+from\s+['"](\.[^'"]+)(?<!\.js)['"];?/g,
        (match, importPath) => {
          if (importPath.endsWith('.js') || importPath.endsWith('/')) {
            return match;
          }
          return match.replace(importPath, importPath + '.js');
        }
      );
      
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
}

// Run the fix on the ESM output directory
const esmDir = path.join(__dirname, '..', 'dist', 'esm');
console.log('Fixing ESM imports in:', esmDir);
fixEsmImports(esmDir);
console.log('ESM imports fixed!');