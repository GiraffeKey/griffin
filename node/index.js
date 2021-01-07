const griffin = require("griffin-core")
const Gun = require("gun")
require("gun/sea")

function Griffin(options) {
	return griffin.Griffin({
		gun: Gun({
			s3: options?.s3,
			// peers: ["https://griffin-gun.lib/gun"],
			peers: options?.relays || [],
		}),
		SEA: Gun.SEA,
		relays: options?.relays || [],
		skynet: options?.skynet || "https://siasky.net",
	})
}

module.exports = Griffin
