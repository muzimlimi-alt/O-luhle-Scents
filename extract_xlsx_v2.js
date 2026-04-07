const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetDir = path.join(__dirname, 'extra', 'rules_v2');

try {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    
    // Use relative paths to avoid the ' in "Muzi's Office"
    const cmd = `powershell -Command "Expand-Archive -Path 'extra/Product Rules.xlsx' -DestinationPath 'extra/rules_v2' -Force"`;
    console.log(`Executing: ${cmd}`);
    execSync(cmd);
    
    const sharedStringsPath = path.join(targetDir, 'xl', 'sharedStrings.xml');
    if (fs.existsSync(sharedStringsPath)) {
        const content = fs.readFileSync(sharedStringsPath, 'utf8');
        const strings = [];
        const regex = /<t[^>]*>(.*?)<\/t>/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            strings.push(match[1]);
        }
        console.log('EXTRACTED_STRINGS:');
        console.log(JSON.stringify(strings));
    } else {
        console.log('File not found at ' + sharedStringsPath);
    }
} catch (e) {
    console.error('Error:', e.message);
}
