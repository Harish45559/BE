const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendPasswordResetEmail(toEmail, resetUrl) {
  await transporter.sendMail({
    from: `"Mirchi Mafiya" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: "Reset Your Password — Mirchi Mafiya",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fff8f5;border-radius:12px;">
        <div style="text-align:center;margin-bottom:20px;">
          <h2 style="color:#dd3a00;margin:0;">🌶️ Mirchi Mafiya</h2>
          <p style="color:#666;font-size:0.9rem;margin-top:4px;">Spice So Good, It Should Be Illegal</p>
        </div>
        <h3 style="color:#1a1a1a;">Reset Your Password</h3>
        <p style="color:#444;line-height:1.6;">
          We received a request to reset your password. Click the button below to set a new one.
          This link expires in <strong>1 hour</strong>.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${resetUrl}" style="background:#dd3a00;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem;">
            Reset Password
          </a>
        </div>
        <p style="color:#999;font-size:0.8rem;">
          If you didn't request this, you can safely ignore this email. Your password won't change.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
        <p style="color:#bbb;font-size:0.75rem;text-align:center;">Mirchi Mafiya, Luton</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
