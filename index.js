const express = require('express');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');

// ---------------------------------------------------------
// 1. DUMMY HTTP SERVER (Required to keep Render instances alive)
// ---------------------------------------------------------
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.status(200).send('Ultimate Auto-Reply Bot is Active and Running!'));
app.listen(port, () => console.log(`[SERVER] HTTP Web Server listening on port ${port}`));

// ---------------------------------------------------------
// 2. ENVIRONMENT VARIABLES (Credentials injected from Render)
// ---------------------------------------------------------
const EMAIL = process.env.EMAIL_USER;
const PASSWORD = process.env.EMAIL_PASS;

if (!EMAIL || !PASSWORD) {
  console.error('[FATAL ERROR] Email credentials are missing in Environment Variables.');
  process.exit(1);
}

// ---------------------------------------------------------
// 3. STARTUP TIMESTAMP (Prevents replying to older backlog emails)
// ---------------------------------------------------------
const startupTime = new Date();
console.log(`[SYSTEM] Bot Boot Timestamp: ${startupTime.toISOString()}`);

// ---------------------------------------------------------
// 4. NODEMAILER CONFIGURATION (For sending auto-replies)
// ---------------------------------------------------------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL, pass: PASSWORD }
});

// ---------------------------------------------------------
// 5. IMAP CONFIGURATION (For receiving and listening to emails)
// ---------------------------------------------------------
const imap = new Imap({
  user: EMAIL,
  password: PASSWORD,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  keepalive: { interval: 10000, idleInterval: 300000, forceNoop: true } 
});

// --- IMAP CONNECTION EVENT LISTENERS ---
imap.once('ready', () => {
  console.log('[IMAP] Connection Successful. Listening for incoming emails...');
  
  imap.openBox('INBOX', false, (err, box) => {
    if (err) {
      console.error('[IMAP ERROR] Failed to open INBOX:', err.message);
      return;
    }
    
    // Triggered instantly when a new email arrives in the INBOX
    imap.on('mail', (numNewMsgs) => {
      console.log(`[ALERT] New mail detected: ${numNewMsgs} message(s) in queue.`);
      processUnseenEmails();
    });
  });
});

imap.on('error', (err) => {
  console.error('[IMAP ERROR] Connection issue:', err.message);
});

imap.once('end', () => {
  console.log('[IMAP WARNING] Connection ended unexpectedly. Reconnecting in 10 seconds...');
  setTimeout(() => imap.connect(), 10000);
});

// ---------------------------------------------------------
// 6. CORE LOGIC: FETCH AND FILTER EMAILS (360-Degree Optimized)
// ---------------------------------------------------------
function processUnseenEmails() {
  imap.search(['UNSEEN'], (err, results) => {
    if (err || !results || results.length === 0) return;

    // markSeen: true instantly marks the email as 'Read' to prevent duplicate processing
    const fetchStream = imap.fetch(results, { bodies: '', markSeen: true }); 

    fetchStream.on('message', (msg, seqno) => {
      msg.on('body', (stream, info) => {
        
        // simpleParser streams data efficiently without overloading the 512MB RAM
        simpleParser(stream, async (err, parsed) => {
          if (err) {
            console.error('[PARSE ERROR] Failed to parse email body:', err.message);
            return;
          }
          
          const sender = parsed.from.value[0].address;
          const subject = parsed.subject || 'No Subject';
          const emailDate = parsed.date;

          // --- STRICT SECURITY FILTERS ---
          
          // Filter A: Ignore emails received before the bot started
          if (emailDate < startupTime) {
            console.log(`[FILTERED] Skipped Old Backlog Email: Subject [${subject}]`);
            return;
          }
          
          // Filter B: Ignore emails sent by the bot itself (Infinite Loop Prevention)
          if (sender.toLowerCase() === EMAIL.toLowerCase()) {
            console.log(`[FILTERED] Skipped Self-Email (Loop Prevention): Subject [${subject}]`);
            return;
          }
          
          // Filter C: Ignore automated systems, daemons, and no-reply addresses
          if (/noreply|no-reply|daemon|mailer|postmaster/i.test(sender)) {
            console.log(`[FILTERED] Skipped Automated Sender: [${sender}]`);
            return;
          }

          console.log(`[VALIDATED] Processing Email from: [${sender}] | Subject: [${subject}]`);
          sendAutoReply(sender, subject);
        });
      });
    });

    fetchStream.once('error', (err) => {
      console.error('[FETCH ERROR] Stream error occurred:', err.message);
    });
  });
}

// ---------------------------------------------------------
// 7. AUTO-REPLY GENERATOR
// ---------------------------------------------------------
async function sendAutoReply(toEmail, originalSubject) {
  const replyBody = `Hello,

Thank you for contacting us regarding "${originalSubject}".

This is an automated acknowledgment to confirm that we have successfully received your message. Our team will review your inquiry and get back to you with a comprehensive response as soon as possible.

Best Regards,
Support Team

---
[System Note: This is an auto-generated message. Please do not reply directly to this email.]`;
  
  try {
    await transporter.sendMail({
      from: EMAIL,
      to: toEmail,
      subject: `Re: ${originalSubject} (Auto-Reply)`,
      text: replyBody
    });
    console.log(`[SUCCESS] Auto-reply dispatched to: [${toEmail}]`);
  } catch (error) {
    console.error(`[SEND ERROR] Failed to dispatch reply to [${toEmail}]:`, error.message);
  }
}

// Initialize the IMAP connection to start the bot
imap.connect();
