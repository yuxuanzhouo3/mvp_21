function baseTemplate(title: string, intro: string, code: string, accentColor: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${accentColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .code { font-size: 32px; font-weight: bold; color: ${accentColor}; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; letter-spacing: 8px; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
    </div>
    <div class="content">
      <p>您好，</p>
      <p>${intro}</p>
      <div class="code">${code}</div>
      <p>验证码有效期为 <strong>10 分钟</strong>。</p>
      <p>如果这不是您的操作，请忽略这封邮件。</p>
    </div>
    <div class="footer">
      <p>此邮件由系统自动发送，请勿直接回复。</p>
    </div>
  </div>
</body>
</html>
`;
}

export function getRegisterVerificationTemplate(code: string): string {
  return baseTemplate("注册验证码", "请使用下面的验证码完成注册：", code, "#4F46E5");
}

export function getPasswordResetTemplate(code: string): string {
  return baseTemplate("密码重置验证码", "请使用下面的验证码继续重置密码：", code, "#DC2626");
}

