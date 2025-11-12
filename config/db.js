const mongoose = require('mongoose');

const connectDB = async () => {
	const uri = process.env.MONGO_URI;
	if (!uri) {
		console.error('MONGO_URI is not defined in environment. Please set it in your .env file.');
		process.exit(1);
	}

	// Detect placeholder values early to give a clearer error to the developer
	if (uri.includes('<') || uri.includes('>') || uri.includes('PASSWORD') || uri.includes('your_password')) {
		console.error('MONGO_URI looks like a template or contains placeholder tokens (e.g. <db_password>).');
		console.error('Please update your `.env` and replace the placeholder with your real DB password (URL-encode it if it contains special characters).');
		process.exit(1);
	}

	try {
		// No extra options are necessary for current drivers/mongoose versions; keep it simple to avoid deprecation warnings
		await mongoose.connect(uri);
		console.log('MongoDB connected');
	} catch (err) {
		const msg = (err && err.message) ? err.message : String(err);
		console.error('Failed to connect to MongoDB:', msg);
		// Provide targeted hints for common auth/network issues
		const lowered = msg.toLowerCase();
		if (lowered.includes('auth') || lowered.includes('authentication failed') || lowered.includes('bad auth')) {
			console.error('\nHint: Authentication failed. Common fixes:');
			console.error('- Verify the MongoDB user and password in your MONGO_URI.');
			console.error('- If the password contains special characters (e.g. @, /, :), URL-encode it.');
			console.error('- Ensure the Atlas user exists and the password is correct.');
			console.error('- Check Atlas Network Access IP whitelist (or allow 0.0.0.0/0 for testing).');
		} else if (lowered.includes('network') || lowered.includes('timeout') || lowered.includes('failed to connect')) {
			console.error('\nHint: Network/connectivity issue. Common fixes:');
			console.error('- Ensure your machine can reach the Atlas cluster (no firewall blocking).');
			console.error('- Check cluster name/host in the URI.');
		}
		process.exit(1);
	}
};

module.exports = connectDB;
