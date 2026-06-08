const express = require('express');
const Imap = require('imap');
const nodemailer = require('nodemailer');

// 1. DUMMY HTTP SERVER (Keeps Render active)
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.status(200).send('Bot is Live!'));
app.listen(port, () => console.log(`[SERVER] HTTP Server active on port ${port}`));

// 2. ENVIRONMENT VARIABLES
const EMAIL = process.env.EMAIL_USER;
const PASSWORD = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL, pass: PASSWORD }
});

const imap = new Imap({
  user: EMAIL,
  password: PASSWORD,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  keepalive: { interval: 10000, idleInterval: 300000, forceNoop: true } 
});

// 3. HYBRID CONNECTION LISTENERS
imap.once('ready', () => {
  console.log('[IMAP] Connection Successful. Inbox monitoring started...');
  
  imap.openBox('INBOX', false, (err, box) => {
    if (err) {
      console.error('[IMAP BOX ERROR]', err.message);
      return;
    }
    
    // Instant Push Alert
    imap.on('mail', () => {
      console.log('[ALERT] Push event triggered! Checking for unread emails...');
      replyToUnreadEmails();
    });

    // Guaranteed Pull Scan (Runs forcefully every 30 seconds)
    setInterval(() => {
      replyToUnreadEmails();
    }, 30000);
  });
});

imap.on('error', (err) => console.error('[IMAP ERROR]', err.message));
imap.once('end', () => {
  console.log('[IMAP] Connection lost. Reconnecting in 10 seconds...');
  setTimeout(() => imap.connect(), 10000);
});

// 4. DIRECT CORE LOGIC (Native Header Processing)
function replyToUnreadEmails() {
  imap.search(['UNSEEN'], (err, results) => {
    if (err) {
      console.error('[SEARCH ERROR]', err.message);
      return;
    }
    if (!results || results.length === 0) return;

    console.log(`[SYSTEM] Found ${results.length} unread email(s). Fetching headers...`);

    // CRITICAL FIX: Only fetch FROM and SUBJECT fields. No heavy body download.
    const fetchStream = imap.fetch(results, { 
      bodies: 'HEADER.FIELDS (FROM SUBJECT)', 
      markSeen: true 
    });

    fetchStream.on('message', (msg) => {
      let headerBuffer = '';

      msg.on('body', (stream) => {
        stream.on('data', (chunk) => {
          headerBuffer += chunk.toString();
        });
      });

      msg.once('end', async () => {
        try {
          // Natively parse headers without external heavy libraries
          const parsedHeader = Imap.parseHeader(headerBuffer);
          
          const rawFrom = parsedHeader.from ? parsedHeader.from[0] : '';
          const originalSubject = parsedHeader.subject ? parsedHeader.subject[0] : 'No Subject';

          // Extract clean email address from "Name <email@gmail.com>"
          const emailMatch = rawFrom.match(/<(.+)>/);
          const senderEmail = emailMatch ? emailMatch[1] : rawFrom;

          if (!senderEmail) {
            console.error('[FILTER] Could not extract clean email from:', rawFrom);
            return;
          }

          // Loop protection: Don't reply to yourself
          if (senderEmail.toLowerCase() === EMAIL.toLowerCase()) {
            console.log('[FILTER] Skipped self-sent email.');
            return;
          }

          console.log(`[ACTION] Target identified. Dispatched reply to: ${senderEmail}`);

          const replyBody = `Hello,\n\nThank you for your message. This is an automated response to confirm that we have received your email.\n\nOur team will get back to you shortly.\n\nBest Regards,\nSupport Team`;
          
          await transporter.sendMail({
            from: EMAIL,
            to: senderEmail,
            subject: `Re: ${originalSubject}`,
            text: replyBody
          });

          console.log(`[SUCCESS] Auto-reply delivered to: ${senderEmail}`);

        } catch (error) {
          console.error('[PROCESS ERROR] Critical failure in sending block:', error.message);
        }
      });
    });

    fetchStream.once('error', (err) => {
      console.error('[FETCH STREAM ERROR]', err.message);
    });
  });
}

// Start Project
imap.connect();
