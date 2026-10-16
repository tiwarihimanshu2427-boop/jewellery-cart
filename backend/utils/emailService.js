
const nodemailer = require("nodemailer");

const FRONTEND_URL = (
  process.env.FRONTEND_URL || "http://localhost:5173"
).replace(/\/$/, "");

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]
  );
}

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function actualAWB(value) {
  const number = String(value || "").trim();
  return /^JC-AWB-\d+$/i.test(number) ? "" : number;
}

function createTransporter() {
  if (
    !process.env.MAIL_HOST ||
    !process.env.MAIL_USER ||
    !process.env.MAIL_PASSWORD
  ) {
    throw new Error("Email SMTP settings are missing.");
  }

  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 465),
    secure: process.env.MAIL_SECURE === "true",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
  });
}

async function sendOrderEmail({ type, order, email }) {
  const recipient = String(email || "").trim();

  if (!recipient || !order?.id) {
    throw new Error("Recipient email or order ID is missing.");
  }

  const templates = {
    placed: {
      subject: `Order #${order.id} Placed | JEWELLERY CART`,
      title: "Thank You for Your Order!",
      description:
        "Your jewellery order has been placed successfully. We will keep you updated.",
      status: "Order Placed",
    },
    shipped: {
      subject: `Order #${order.id} Shipped | JEWELLERY CART`,
      title: "Your Order Is On Its Way!",
      description:
        "Your jewellery order has been shipped. Check your tracking details below.",
      status: "Shipped",
    },
    delivered: {
      subject: `Order #${order.id} Delivered | JEWELLERY CART`,
      title: "Your Order Has Been Delivered!",
      description:
        "Your jewellery order has been marked as delivered. Thank you for shopping with us.",
      status: "Delivered",
    },
  };

  const template = templates[type];

  if (!template) {
    throw new Error("Unsupported email notification type.");
  }

  const trackingURL =
    `${FRONTEND_URL}/track-order?id=${encodeURIComponent(order.id)}`;

  const awb = actualAWB(order.tracking_number);
  const courierName = String(order.courier_name || "").trim();

  const courierSection =
    type === "shipped" && awb
      ? `
        <p><strong>Courier:</strong> ${escapeHTML(courierName || "Assigned")}</p>
        <p><strong>AWB Number:</strong> ${escapeHTML(awb)}</p>
      `
      : "";

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHTML(template.subject)}</title>
    </head>
    <body style="margin:0;padding:25px 12px;background:#f8f2eb;font-family:Arial,sans-serif;color:#35271e;">
      <div style="max-width:600px;margin:auto;background:white;border:1px solid #ead9c5;border-radius:16px;overflow:hidden;">
        <div style="background:#30231c;color:white;text-align:center;padding:32px 15px;">
          <h1 style="font-family:Georgia,serif;letter-spacing:2px;margin:0;">
            JEWELLERY CART
          </h1>
          <p style="color:#e4c19a;letter-spacing:3px;font-size:11px;">
            TIMELESS ELEGANCE
          </p>
        </div>

        <div style="padding:32px 26px;">
          <p style="color:#ac7d4b;font-size:12px;letter-spacing:2px;">
            ORDER NOTIFICATION
          </p>
          <h2 style="font-family:Georgia,serif;font-size:27px;">
            ${escapeHTML(template.title)}
          </h2>

          <p>Hello ${escapeHTML(order.full_name || "Customer")},</p>
          <p style="line-height:1.7;color:#6d5b4d;">
            ${escapeHTML(template.description)}
          </p>

          <div style="background:#faf6f1;border:1px solid #eee0d1;border-radius:12px;padding:18px;margin:25px 0;">
            <p><strong>Order Number:</strong> #${escapeHTML(order.id)}</p>
            <p><strong>Order Status:</strong> ${escapeHTML(template.status)}</p>
            <p><strong>Total Amount:</strong> ${escapeHTML(formatMoney(order.total_amount))}</p>
            ${courierSection}
          </div>

          <div style="text-align:center;margin:30px 0;">
            <a href="${trackingURL}"
              style="display:inline-block;padding:15px 28px;background:#30231c;color:white;text-decoration:none;border-radius:8px;">
              Track Your Order
            </a>
          </div>

          <p style="color:#8a796c;font-size:12px;line-height:1.6;">
            Log in to your JEWELLERY CART account to view your order.
            Website tracking is not live courier GPS tracking.
          </p>
        </div>

        <div style="background:#faf6f1;text-align:center;padding:20px;color:#937b65;font-size:12px;">
          JEWELLERY CART · Timeless Elegance
        </div>
      </div>
    </body>
    </html>
  `;

  const text = [
    "JEWELLERY CART",
    template.title,
    `Hello ${order.full_name || "Customer"},`,
    template.description,
    `Order #${order.id}`,
    `Status: ${template.status}`,
    `Amount: ${formatMoney(order.total_amount)}`,
    ...(type === "shipped" && awb
      ? [`Courier: ${courierName}`, `AWB: ${awb}`]
      : []),
    `Track Order: ${trackingURL}`,
  ].join("\n");

  const transporter = createTransporter();

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: recipient,
    subject: template.subject,
    html,
    text,
  });

  console.log(
    `EMAIL SENT: ${type} | Order #${order.id} | ${info.messageId}`
  );

  return info;
}

function sendOrderEmailInBackground(options) {
  void sendOrderEmail(options).catch((error) => {
    console.error(
      `EMAIL ERROR: Order #${options.order?.id}`,
      error.message
    );
  });
}

module.exports = {
  sendOrderEmail,
  sendOrderEmailInBackground,
};
