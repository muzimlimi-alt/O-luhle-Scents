const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

// XLSX is just a ZIP. We can try to use standard unzip or a node library if available.
// Since we don't have libraries, let's try to use powershell to unzip it to a specific folder.
const xlsxPath = path.join(__dirname, 'extra', 'Product Rules.xlsx');
const targetDir = path.join(__dirname, 'extra', 'extracted_rules');

try {
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Using powershell to expand archive
    const cmd = `powershell -Command "Expand-Archive -Path '${xlsxPath}' -DestinationPath '${targetDir}' -Force"`;
    console.log(`Running: ${cmd}`);
    execSync(cmd);
    
    const sharedStringsPath = path.join(targetDir, 'xl', 'sharedStrings.xml');
    if (fs.existsSync(sharedStringsPath)) {
        const content = fs.readFileSync(sharedStringsPath, 'utf8');
        // Simple regex to extract <t>text</t>
        const matches = content.match(/<t(.*?)>(.*?)<\/t>/g);
        if (matches) {
            const strings = matches.map(m => m.replace(/<t(.*?)>/, '').replace('</t>', ''));
            console.log('--- SHARED STRINGS ---');
            console.log(JSON.stringify(strings, null, 2));
        }
    } else {
        console.log('sharedStrings.xml not found');
    }
} catch (err) {
    console.error('Error:', err.message);
}
