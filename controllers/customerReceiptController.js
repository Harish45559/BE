const { Order } = require("../models");
const PdfPrinter = require("pdfmake/src/printer");
const vfsFonts = require("pdfmake/build/vfs_fonts");

const fonts = {
  Roboto: {
    normal: Buffer.from(vfsFonts["Roboto-Regular.ttf"], "base64"),
    bold: Buffer.from(vfsFonts["Roboto-Medium.ttf"], "base64"),
    italics: Buffer.from(vfsFonts["Roboto-Italic.ttf"], "base64"),
    bolditalics: Buffer.from(vfsFonts["Roboto-MediumItalic.ttf"], "base64"),
  },
};

// GET /api/customer/orders/:id/receipt
exports.downloadReceipt = async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, customer_id: req.customer.id },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const items = order.items || [];

    // ── Thermal receipt format (80mm wide = ~226pt) ───────────────────────
    const docDefinition = {
      pageSize: { width: 226, height: 900 },
      pageMargins: [14, 14, 14, 14],
      content: [
        // Brand
        { text: "Mirchi Mafiya", style: "brand" },
        { text: "Order Receipt", style: "sub" },
        { text: "--------------------------------", style: "divider" },

        // Order info
        { text: `Order: #${order.order_number}`, style: "info" },
        { text: `Date: ${order.date}`, style: "info" },
        { text: `Type: ${order.order_type}`, style: "info" },
        ...(order.pickup_time
          ? [{ text: `Pickup: ${order.pickup_time}`, style: "info" }]
          : []),

        { text: "--------------------------------", style: "divider" },

        // Items
        ...items.map((it) => ({
          columns: [
            { text: `${it.name} x${it.qty}`, fontSize: 9, width: "*" },
            { text: `£${(it.price * it.qty).toFixed(2)}`, fontSize: 9, alignment: "right", width: "auto" },
          ],
          margin: [0, 2, 0, 0],
        })),

        { text: "--------------------------------", style: "divider" },

        // Total
        {
          columns: [
            { text: "TOTAL", fontSize: 11, bold: true, width: "*" },
            { text: `£${parseFloat(order.final_amount).toFixed(2)}`, fontSize: 11, bold: true, alignment: "right", width: "auto" },
          ],
        },

        { text: " " },

        // Payment
        { text: `Payment: ${order.payment_method}`, style: "info" },
        {
          text: order.payment_status === "paid" ? "Status: Paid" : "Status: Pay on Collection",
          style: "info",
        },

        { text: "--------------------------------", style: "divider" },
        { text: "Thank you for your order!", style: "footer" },
        { text: "Spice so good, it should be illegal.", style: "tagline" },
      ],
      styles: {
        brand: {
          fontSize: 16,
          bold: true,
          alignment: "center",
          margin: [0, 0, 0, 2],
        },
        sub: {
          fontSize: 9,
          alignment: "center",
          color: "#555555",
          margin: [0, 0, 0, 2],
        },
        divider: {
          fontSize: 8,
          color: "#cccccc",
          margin: [0, 4, 0, 4],
        },
        info: {
          fontSize: 9,
          margin: [0, 1, 0, 1],
        },
        footer: {
          fontSize: 9,
          alignment: "center",
          bold: true,
          margin: [0, 4, 0, 2],
        },
        tagline: {
          fontSize: 8,
          alignment: "center",
          color: "#888888",
          italics: true,
          margin: [0, 0, 0, 0],
        },
      },
      defaultStyle: { font: "Roboto" },
    };

    const printer = new PdfPrinter(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=receipt-${order.order_number}.pdf`
    );

    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Receipt error:", err.message);
    }
    return res.status(500).json({ success: false, message: "Failed to generate receipt" });
  }
};
