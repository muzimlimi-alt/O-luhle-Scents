const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetZip = path.join(__dirname, 'extra', 'temp_rules.zip');
const sourceXlsx = path.join(__dirname, 'extra', 'Product Rules.xlsx');
const targetDir = path.join(__dirname, 'extra', 'rules_v3');

try {
    fs.copyFileSync(sourceXlsx, targetZip);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    
    // Use Expand-Archive on the .zip
    const cmd = `powershell -Command "Expand-Archive -Path '${targetZip}' -DestinationPath '${targetDir}' -Force"`;
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
    }
} catch (e) {
    console.error('Error:', e.message);
} finally {
    if (fs.existsSync(targetZip)) fs.unlinkSync(targetZip);
}
