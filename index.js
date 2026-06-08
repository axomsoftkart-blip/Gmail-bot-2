const express = require('express');
const imap = require('imap-simple');
const nodemailer = require('nodemailer');

// Render se variables lena
const EMAIL = process.env.EMAIL_USER;
const PASSWORD = process.env.EMAIL_PASS;

// --- DUMMY SERVER (Render ko active rakhne ke liye) ---
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is Live and Running!'));
app.listen(port, () => console.log(`Web server started on port ${port}`));

// --- EMAIL BHEJNE KI SETTING (Nodemailer) ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL, pass: PASSWORD }
});

// --- EMAIL PADHNE KI SETTING (IMAP) ---
const config = {
  imap: {
    user: EMAIL,
    password: PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    authTimeout: 5000,
    tlsOptions: { rejectUnauthorized: false }
  }
};

async function checkNewEmails() {
  try {
    const connection = await imap.connect(config);
    await connection.openBox('INBOX');

    // Sirf 'Unread' (naye) emails dhundho
    const searchCriteria = ['UNSEEN'];
    const fetchOptions = {
      bodies: ['HEADER'],
      markSeen: true // Padhne ke baad email ko 'Read' mark kar dega
    };

    const results = await connection.search(searchCriteria, fetchOptions);

    if (results.length > 0) {
      console.log(`Total naye emails mile: ${results.length}`);
    }

    for (let item of results) {
      const header = item.parts.find(part => part.which === 'HEADER');
      if (header && header.body && header.body.from) {
        
        const rawFrom = header.body.from[0];
        const subject = header.body.subject ? header.body.subject[0] : 'No Subject';
        
        // Sender ka actual email address nikalna
        const emailMatch = rawFrom.match(/<(.+)>/);
        const senderEmail = emailMatch ? emailMatch[1] : rawFrom;

        console.log(`Naya mail aaya -> Sender: ${senderEmail} | Subject: ${subject}`);

        // --- PROFESSIONAL AUTO-REPLY MESSAGE ---
        const replyMessage = `Hello,

Thank you for reaching out. 

This is an automated response to confirm that we have successfully received your email regarding "${subject}". 

Please note that our team is currently reviewing your message, and we will get back to you with a proper response as soon as possible. 

Best regards,
Support Team

---
Note: This is an auto-generated email. Please do not reply to this message.`;

        // Reply Bhejna
        await transporter.sendMail({
          from: EMAIL,
          to: senderEmail,
          subject: `Re: ${subject} (Auto-Reply)`,
          text: replyMessage
        });

        console.log(`Auto-reply successfully sent to: ${senderEmail}`);
      }
    }
    
    connection.end(); // Kaam khatam hone par connection close
  } catch (error) {
    console.error('Email check karne mein error aaya:', error);
  }
}

// Bot ko har 30 seconds mein naye emails check karne ka order dena
setInterval(checkNewEmails, 30000);
console.log("Bot Start ho gaya hai! Har 30 seconds mein inbox check karega...");

// Turant ek baar check karo
checkNewEmails();
