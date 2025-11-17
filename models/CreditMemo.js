const mongoose = require("mongoose");

const creditMemoSchema = new mongoose.Schema(
{
    _id: { type: String, required: true }, // QuickBooks CreditMemo ID
    txnDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    customerRef: { type: String, ref: "Customer", required: true },
    realmId: { type: String, required: true }
},
{ timestamps: true, _id: false }
);

module.exports = mongoose.model("CreditMemo", creditMemoSchema);
