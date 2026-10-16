
require("dotenv").config();

const nodemailer = require("nodemailer");

async function testEmail() {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT || 465),
      secure: process.env.MAIL_SECURE === "true",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    await transporter.verify();

    console.log("SMTP CONNECTION SUCCESSFUL");

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to: process.env.MAIL_USER,
      subject: "JEWELLERY CART - Test Email",
      text: "Your JEWELLERY CART email system is working!",
    });

    console.log("EMAIL SENT SUCCESSFULLY");
    console.log("Message ID:", info.messageId);
  } catch (error) {
    console.error("EMAIL TEST FAILED:", error.message);
  }
}

testEmail();
