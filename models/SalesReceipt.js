const mongoose = require("mongoose");

const salesReceiptSchema = new mongoose.Schema(
{
    _id: { type: String, required: true }, // QuickBooks Receipt ID
    txnDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    customerRef: { type: String, ref: "Customer", required: true }
},
{ timestamps: true, _id: false }
);

module.exports = mongoose.model("SalesReceipt", salesReceiptSchema);
