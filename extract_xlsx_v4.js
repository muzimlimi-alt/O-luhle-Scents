const fs = require('fs');
const { execSync } = require('child_process');

try {
    process.chdir('extra');
    fs.copyFileSync('Product Rules.xlsx', 'rules.zip');
    if (!fs.existsSync('x_rules')) fs.mkdirSync('x_rules');
    execSync('powershell -Command "Expand-Archive -Path rules.zip -DestinationPath x_rules -Force"');
    
    const sharedStrings = 'x_rules/xl/sharedStrings.xml';
    if (fs.existsSync(sharedStrings)) {
        const content = fs.readFileSync(sharedStrings, 'utf8');
        console.log(content);
    }
} catch (e) {
    console.error(e.message);
}
