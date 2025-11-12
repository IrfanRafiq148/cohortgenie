const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
{
    _id: { type: String, required: true },  // QuickBooks ID
    displayName: { type: String, required: true }
}, 
{ timestamps: true, _id: false }
);

module.exports = mongoose.model("Customer", customerSchema);
