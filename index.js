const express = require('express');
const imap = require('imap-simple');
const nodemailer = require('nodemailer');

const EMAIL = process.env.EMAIL_USER;
const PASSWORD = process.env.EMAIL_PASS;

// --- DUMMY SERVER ---
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Advanced Bot is Live!'));
app.listen(port, () => console.log(`Web server started on port ${port}`));

// --- EMAIL SENDER SETTING ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL, pass: PASSWORD }
});

// --- EMAIL RECEIVER SETTING ---
const config = {
  imap: {
    user: EMAIL,
    password: PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    authTimeout: 10000,
    tlsOptions: { rejectUnauthorized: false }
  }
};

// 🔴 SABSE ZARURI FIX: Bot kis waqt start hua, uski exact timing note kar lo
const botStartTime = new Date(); 
console.log(`Bot is Booting up at: ${botStartTime}`);

async function checkNewEmails() {
  let connection;
  try {
    connection = await imap.connect(config);
    await connection.openBox('INBOX');

    // Sirf Unread emails search karo
    const searchCriteria = ['UNSEEN'];
    const fetchOptions = { bodies: ['HEADER'], markSeen: true };

    const results = await connection.search(searchCriteria, fetchOptions);

    for (let item of results) {
      const header = item.parts.find(part => part.which === 'HEADER');
      if (header && header.body) {
        
        const rawFrom = header.body.from ? header.body.from[0] : '';
        const rawDate = header.body.date ? header.body.date[0] : '';
        const subject = header.body.subject ? header.body.subject[0] : 'No Subject';
        
        const emailMatch = rawFrom.match(/<(.+)>/);
        const senderEmail = emailMatch ? emailMatch[1] : rawFrom;
        const emailDate = new Date(rawDate); // Email aane ka time

        // ---------------------------------------------------------
        // 🛡️ LOOPHOLE FILTERS (Kisko reply NAHI karna hai)
        // ---------------------------------------------------------
        
        // 1. Agar email bot start hone se pehle ka hai (Purana backlog) -> SKIP
        if (emailDate < botStartTime) {
          console.log(`Skipped Old Backlog Email: ${senderEmail}`);
          continue; 
        }

        // 2. Agar sender bot khud hai (Infinite loop se bachne ke liye) -> SKIP
        if (senderEmail.toLowerCase() === EMAIL.toLowerCase()) {
          console.log(`Skipped Own Email (Loop Prevention).`);
          continue;
        }

        // 3. Agar email kisi 'noreply' ya automated system se aayi hai -> SKIP
        if (senderEmail.toLowerCase().includes('noreply') || senderEmail.toLowerCase().includes('no-reply') || senderEmail.toLowerCase().includes('daemon')) {
          console.log(`Skipped Automated/No-reply Email: ${senderEmail}`);
          continue;
        }

        // ---------------------------------------------------------
        // ✅ VALID EMAIL (Ab isko reply bhejo)
        // ---------------------------------------------------------
        console.log(`New Valid Mail Detected -> Sender: ${senderEmail} | Subject: ${subject}`);

        const replyMessage = `Hello,

Thank you for reaching out. 

This is an automated response to confirm that we have successfully received your email regarding "${subject}". 

Please note that our team is currently reviewing your message, and we will get back to you with a proper response as soon as possible. 

Best regards,
Support Team

---
Note: This is an auto-generated email. Please do not reply to this message.`;

        // Error handling ke sath bhejna (Taki ek fail ho toh bot crash na ho)
        try {
          await transporter.sendMail({
            from: EMAIL,
            to: senderEmail,
            subject: `Re: ${subject} (Auto-Reply)`,
            text: replyMessage
          });
          console.log(`✅ Auto-reply successfully sent to: ${senderEmail}`);
        } catch (sendErr) {
          console.error(`❌ Reply bhejne mein fail hua (${senderEmail}):`, sendErr.message);
        }
      }
    }
    
    connection.end(); 
  } catch (error) {
    console.error('Email checking process mein error aaya:', error.message);
    if (connection) connection.end(); // Error aane par connection reset karega
  }
}

// Har 30 seconds mein check karega
setInterval(checkNewEmails, 30000);
console.log("Advanced Bot Start ho gaya hai! Purane mails ignore karke sirf naye mails ka wait kar raha hai...");
checkNewEmails();
