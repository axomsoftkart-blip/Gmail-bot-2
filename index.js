const express = require('express');
const Imap = require('node-imap');
const nodemailer = require('nodemailer');

const imap = new Imap({
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

function openInbox(cb) {
  imap.openBox('INBOX', false, cb);
}

imap.once('ready', function() {
  openInbox(function(err, box) {
    if (err) throw err;
    console.log("✅ Connection Successful. Listening for new emails...");
    
    imap.on('mail', function(numNew) {
      console.log(`📩 ${numNew} new email(s) detected!`);
      // Naya mail aate hi check karo
      fetchNewEmails();
    });
  });
});

function fetchNewEmails() {
  imap.search(['UNSEEN'], function(err, results) {
    if (err || !results.length) return;
    
    results.forEach(function(res) {
      const f = imap.fetch(res, { bodies: '' });
      f.on('message', function(msg) {
        msg.on('body', function(stream) {
          // Yahan email ka subject/sender nikal kar reply bhejo
          // (Simple logic: reply bhejne ke baad msg ko 'seen' mark karo)
          console.log("Processing new email...");
          sendReply(); 
        });
      });
    });
  });
}

function sendReply() {
    // Reply logic
    console.log("✅ Auto-reply sent!");
}

imap.connect();

// Dummy Server for Render
const app = express();
app.listen(process.env.PORT || 3000);
