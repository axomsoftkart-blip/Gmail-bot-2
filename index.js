const express = require('express');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');

// ---------------------------------------------------------
// 1. DUMMY HTTP SERVER (Render ko active rakhne ke liye)
// ---------------------------------------------------------
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.status(200).send('Direct Auto-Responder is Live!'));
app.listen(port, () => console.log(`[SERVER] HTTP Server active on port ${port}`));

// ---------------------------------------------------------
// 2. CREDENTIALS
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// 3. HYBRID LISTENER (Turant pakadna + Har 45 sec mein check karna)
// ---------------------------------------------------------
imap.once('ready', () => {
  console.log('[IMAP] Connection Successful. Inbox monitoring started...');
  
  imap.openBox('INBOX', false, (err, box) => {
    if (err) throw err;
    
    // Push Event (Jaise hi mail aayega)
    imap.on('mail', () => {
      console.log('[ALERT] New email push received!');
      replyToUnreadEmails();
    });

    // Guaranteed Pull (Agar Push fail ho jaye, toh har 45 seconds mein jabardasti check karega)
    setInterval(() => {
      replyToUnreadEmails();
    }, 45000);
  });
});

imap.on('error', (err) => console.error('[IMAP ERROR]', err.message));
imap.once('end', () => setTimeout(() => imap.connect(), 10000));

// ---------------------------------------------------------
// 4. DIRECT CORE LOGIC (No Intelligence, Just Action)
// ---------------------------------------------------------
function replyToUnreadEmails() {
  // Sirf Unread mails uthao
  imap.search(['UNSEEN'], (err, results) => {
    if (err || !results || results.length === 0) return;

    // Mail uthate hi usko 'Read' mark kar do
    const fetchStream = imap.fetch(results, { bodies: '', markSeen: true }); 

    fetchStream.on('message', (msg) => {
      msg.on('body', (stream) => {
        simpleParser(stream, async (err, parsed) => {
          if (err) return;
          
          const senderEmail = parsed.from.value[0].address;
          const originalSubject = parsed.subject || 'No Subject';

          // Sirf ek filter: Bot khud ko reply na kare (Infinite loop rokne ke liye)
          if (senderEmail.toLowerCase() === EMAIL.toLowerCase()) return;

          console.log(`[ACTION] Reading done. Sending reply to: ${senderEmail}`);
          
          // DIRECT AUTO-REPLY
          const replyBody = `Hello,

Thank you for your message. This is an automated response to confirm that we have received your email. 

Our team will get back to you shortly.

Best Regards,
Support Team`;
          
          try {
            await transporter.sendMail({
              from: EMAIL,
              to: senderEmail,
              subject: `Re: ${originalSubject}`,
              text: replyBody
            });
            console.log(`[SUCCESS] Reply delivered to: ${senderEmail}`);
          } catch (error) {
            console.error(`[ERROR] Failed to send reply:`, error.message);
          }
        });
      });
    });
  });
}

// Bot Start Karein
imap.connect();
