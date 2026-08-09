import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import { sendCampaignBroadcast } from './src/utils/email.js';

async function run() {
  const email = 'muzi.mlimi@gmail.com';
  const unsubscribeToken = 'test-unsub-token-12345';
  
  const campaign = {
    subject: 'TOCA - Aromatic Test Campaign',
    contentHtml: `
      <h2>Hello Muzi!</h2>
      <p>This is a test campaign broadcast directly from the backend system.</p>
      <div style="text-align: center; margin: 30px 0;">
        <img src="https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=600&q=80" alt="Luxury Perfume" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
      </div>
      <p>The system successfully supports plain text conversions seamlessly, activating/deactivating subscribers, and natively embedding images into broadcasts.</p>
      <p>Best regards,<br/>The TOCA System</p>
    `,
    attachments: []
  };

  try {
    console.log('Sending test campaign email to', email);
    await sendCampaignBroadcast(email, unsubscribeToken, campaign);
    console.log('SUCCESS: Email sent perfectly.');
  } catch (err) {
    console.error('ERROR:', err);
  }
}

run();
