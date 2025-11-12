// Simple logger wrapper used across the app.
// This keeps the same call sites (logger.info, logger.error, etc.) working.
const util = require('util');

function formatArgs(args) {
	return args.map(a => (typeof a === 'string' ? a : util.inspect(a, { depth: 2 }))).join(' ');
}

module.exports = {
	info: (...args) => console.log('[INFO]', formatArgs(args)),
	warn: (...args) => console.warn('[WARN]', formatArgs(args)),
	error: (...args) => console.error('[ERROR]', formatArgs(args)),
	debug: (...args) => console.debug('[DEBUG]', formatArgs(args))
};
