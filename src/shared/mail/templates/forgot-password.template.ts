export const forgotPasswordTemplate = (
  fullName: string,
  resetLink: string,
  expiresIn: string,
): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - StreamHub</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');

    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #050816;
      color: #ffffff;
      -webkit-font-smoothing: antialiased;
      -ms-text-size-adjust: 100%;
      -webkit-text-size-adjust: 100%;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #050816;
      padding: 40px 0;
    }
    .main-content {
      max-width: 580px;
      margin: 0 auto;
      background-color: #0c0d19;
      border: 1px solid #1c1e3a;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
    }
    .top-glow {
      height: 4px;
      background: #f97316;
      background: linear-gradient(90deg, #f97316 0%, #ef4444 100%);
    }
    .header {
      padding: 35px 40px 20px 40px;
      text-align: center;
    }
    .logo {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #ffffff;
      text-decoration: none;
      text-transform: uppercase;
    }
    .logo-accent {
      color: #f97316;
    }
    .body-content {
      padding: 20px 40px 40px 40px;
      text-align: left;
    }
    .body-content h2 {
      margin-top: 0;
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 20px;
    }
    .body-content p {
      color: #a5aabf;
      font-size: 15px;
      line-height: 1.6;
      margin: 16px 0;
    }
    .btn-container {
      text-align: center;
      margin: 35px 0;
    }
    .btn {
      display: inline-block;
      padding: 14px 36px;
      background-color: #f97316;
      background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.5px;
      border-radius: 9999px;
      box-shadow: 0 4px 15px rgba(249, 115, 22, 0.35);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .link-container {
      background-color: #070812;
      border: 1px dashed #1c1e3a;
      border-radius: 8px;
      padding: 12px 16px;
      margin-top: 15px;
      word-break: break-all;
    }
    .link-raw {
      color: #f97316;
      text-decoration: none;
      font-size: 13px;
      font-family: 'Courier New', Courier, monospace;
    }
    .footer {
      padding: 30px 40px;
      text-align: center;
      background-color: #080914;
      border-top: 1px solid #16172e;
    }
    .footer p {
      margin: 0;
      color: #5f6480;
      font-size: 12px;
      line-height: 1.6;
    }
    .footer p a {
      color: #a5aabf;
      text-decoration: none;
    }

    /* === MOBILE RESPONSIVE STYLES === */
    @media only screen and (max-width: 600px) {
      .wrapper {
        padding: 20px 15px !important;
      }
      .main-content {
        border-radius: 12px !important;
      }
      .header {
        padding: 25px 20px 15px 20px !important;
      }
      .logo {
        font-size: 22px !important;
      }
      .body-content {
        padding: 15px 20px 30px 20px !important;
      }
      .body-content h2 {
        font-size: 20px !important;
        margin-bottom: 15px !important;
      }
      .btn-container {
        margin: 25px 0 !important;
      }
      .btn {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        padding: 16px 20px !important;
      }
      .footer {
        padding: 20px !important;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-content">
      <div class="top-glow"></div>
      
      <div class="header">
        <a href="#" class="logo">Stream<span class="logo-accent">Hub</span></a>
      </div>
      
      <div class="body-content">
        <h2>Hello ${fullName},</h2>
        <p>We received a request to reset the password for your StreamHub account. If you made this request, please click the button below to set a new password:</p>
        
        <div class="btn-container">
          <a href="${resetLink}" class="btn">Reset Password</a>
        </div>
        
        <p>This link will expire in <strong>${expiresIn}</strong>.</p>
        
        <p>If you're having trouble clicking the button, copy and paste the URL below into your web browser:</p>
        <div class="link-container">
          <a href="${resetLink}" class="link-raw">${resetLink}</a>
        </div>
        
        <p style="margin-top: 30px; font-size: 14px; color: #787d99;">If you did not request to reset your password, you can safely ignore this email. Your account remains secure.</p>
      </div>
      
      <div class="footer">
        <p>&copy; 2026 <a href="#">StreamHub</a>. All rights reserved.</p>
        <p style="margin-top: 4px;">This is an automated message, please do not reply.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;
