const fs = require('fs');
const content = `DATABASE_URL="file:./dev.db"
PORT=3000
FRONTEND_URL="http://127.0.0.1:5500"
SERVER_URL="http://localhost:3000"
JWT_SECRET="oluhle-scents-secret-key-9876543210"
JWT_EXPIRES_IN="7d"
# CUSTOMER PAYFAST CREDENTIALS
PAYFAST_MERCHANT_ID="10047344"
PAYFAST_MERCHANT_KEY="z9ztj92m599tp"
PAYFAST_PASSPHRASE="jt7NOEXcQIdPwRN"
PAYFAST_SANDBOX="true"`;
fs.writeFileSync('.env', content);
console.log('.env file updated with new PayFast credentials');
