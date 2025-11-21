// email.js
const nodemailer = require("nodemailer");
const { emailConfig } = require("./email.config");

const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
  });

  const mailOptions = {
    from: `"CarePad Clinic" <${emailConfig.user}>`,
    to: to,
    subject: subject,
    html: html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent successfully to ${to}`);
  } catch (err) {
    console.error("❌ Email sending failed:", err);
  }
};

module.exports = { sendEmail };
