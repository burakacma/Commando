const path = require('path');
const CommandArgument = require('./command-argument');

/** A command that can be run in a client */
class Command {
	/**
	 * @typedef {Object} CommandInfo
	 * @property {string} name - The name of the command (must be lowercase)
	 * @property {string[]} [aliases] - Alternative names for the command (all must be lowercase)
	 * @property {boolean} [autoAliases=true] - Whether automatic aliases should be added
	 * @property {string} group - The ID of the group the command belongs to (must be lowercase)
	 * @property {string} memberName - The member name of the command in the group (must be lowercase)
	 * @property {string} description - A short description of the command
	 * @property {string} [format=name] - The command usage format string
	 * @property {string} [details] - A detailed description of the command and its functionality
	 * @property {string[]} [examples] - Usage examples of the command
	 * @property {boolean} [guildOnly=false] - Whether or not the command should only function in a guild channel
	 * @property {boolean} [defaultHandling=true] - Whether or not the default command handling should be used.
	 * If false, then only patterns will trigger the command.
	 * @property {string} [argsType=single] - One of 'single' or 'multiple'.
	 * When 'single', the entire argument string will be passed to run as one argument.
	 * When 'multiple', it will be passed as multiple arguments.
	 * @property {number} [argsCount=0] - The number of arguments to parse from the command string.
	 * Only applicable when argsType is 'multiple'. If nonzero, it should be at least 2.
	 * When this is 0, the command argument string will be split into as many arguments as it can be.
	 * When nonzero, it will be split into a maximum of this number of arguments.
	 * @property {boolean} [argsSingleQuotes=true] - Whether or not single quotes should be allowed to box-in arguments
	 * in the command string.
	 * @property {RegExp[]} [patterns] - Patterns to use for triggering the command
	 * @property {boolean} [guarded=false] - Whether the command should be protected from disabling
	 */

	/**
	 * @param {CommandoClient} client - The client the command is for
	 * @param {CommandInfo} info - The command information
	 */
	constructor(client, info) { // eslint-disable-line complexity
		if(!client) throw new Error('A client must be specified.');
		if(!info) throw new Error('Command info must be specified.');
		if(!info.name) throw new Error('Command must have a name specified.');
		if(info.name !== info.name.toLowerCase()) throw new Error('Command name must be lowercase.');
		if(info.aliases && !Array.isArray(info.aliases)) throw new TypeError('Command aliases must be an array.');
		if(info.aliases && info.aliases.some(ali => ali !== ali.toLowerCase())) {
			throw new Error('Command aliases must be lowercase.');
		}
		if(!info.group) throw new Error('Command must have a group specified.');
		if(info.group !== info.group.toLowerCase()) throw new Error('Command group must be lowercase.');
		if(!info.memberName) throw new Error('Command must have a memberName specified.');
		if(info.memberName !== info.memberName.toLowerCase()) throw new Error('Command memberName must be lowercase.');
		if(!info.description) throw new Error('Command must have a description specified.');
		if(info.examples && !Array.isArray(info.examples)) throw new TypeError('Command examples must be an array.');
		if(info.args && !Array.isArray(info.args)) throw new TypeError('Command args must be an array.');
		if(info.argsType && !['single', 'multiple'].includes(info.argsType)) {
			throw new RangeError('Command argsType must be one of "single" or "multiple".');
		}
		if(info.argsType === 'multiple' && info.argsCount && info.argsCount < 2) {
			throw new RangeError('Command argsCount must be at least 2.');
		}
		if(info.patterns && !Array.isArray(info.patterns)) throw new TypeError('Command patterns must be an array.');

		/**
		 * Client that this command is for
		 * @type {CommandoClient}
		 */
		this.client = client;

		/**
		 * Name of this command
		 * @type {string}
		 */
		this.name = info.name;

		/**
		 * Aliases for this command
		 * @type {string[]}
		 */
		this.aliases = info.aliases || [];
		if(typeof info.autoAliases === 'undefined' || info.autoAliases) {
			if(this.name.includes('-')) this.aliases.push(this.name.replace(/-/g, ''));
			for(const alias of this.aliases) {
				if(alias.includes('-')) this.aliases.push(alias.replace(/-/g, ''));
			}
		}

		/**
		 * ID of the group the command belongs to
		 * @type {string}
		 */
		this.groupID = info.group;

		/**
		 * The group the command belongs to, assigned upon registration
		 * @type {?CommandGroup}
		 */
		this.group = null;

		/**
		 * Name of the command within the group
		 * @type {string}
		 */
		this.memberName = info.memberName;

		/**
		 * Short description of the command
		 * @type {string}
		 */
		this.description = info.description;

		/**
		 * Usage format string of the command
		 * @type {string}
		 */
		this.format = info.format || info.name;

		/**
		 * Long description of the command
		 * @type {?string}
		 */
		this.details = info.details || null;

		/**
		 * Example usage strings
		 * @type {?string[]}
		 */
		this.examples = info.examples || null;

		/**
		 * Whether the command can only be run in a guild channel
		 * @type {boolean}
		 */
		this.guildOnly = !!info.guildOnly;

		/**
		 * Whether the default command handling is enabled for the command
		 * @type {boolean}
		 */
		this.defaultHandling = 'defaultHandling' in info ? info.defaultHandling : true;

		/**
		 * The arguments for the command
		 * @type {?CommandArgument[]}
		 */
		this.args = info.args || null;
		if(this.args) {
			for(let i = 0; i < this.args.length; i++) this.args[i] = new CommandArgument(this, this.args[i]);
		}

		/**
		 * How the arguments are split when passed to the command's run method
		 * @type {string}
		 */
		this.argsType = info.argsType || 'single';

		/**
		 * Maximum number of arguments that will be split
		 * @type {number}
		 */
		this.argsCount = info.argsCount || 0;

		/**
		 * Whether single quotes are allowed to encapsulate an argument
		 * @type {boolean}
		 */
		this.argsSingleQuotes = 'argsSingleQuotes' in info ? info.argsSingleQuotes : true;

		/**
		 * Regular expression triggers
		 * @type {RegExp[]}
		 */
		this.patterns = info.patterns || null;

		/**
		 * Whether the command is protected from being disabled
		 * @type {boolean}
		 */
		this.guarded = info.guarded || false;

		this._globalEnabled = true;
	}

	/**
	 * Checks a user's permission in a guild
	 * @param {CommandMessage} message - The triggering command message
	 * @return {boolean}
	 */
	hasPermission(message) { // eslint-disable-line no-unused-vars
		return true;
	}

	// eslint-disable-next-line valid-jsdoc
	/**
	 * Runs the command
	 * @param {CommandMessage} message - The message the command is being run for
	 * @param {string|string[]} args - The arguments for the command, or the matches from a pattern. If argsType is
	 * single, then only one string will be passed. If multiple, an array of strings will be passed. When fromPattern
	 * is true, this is the matches array from the pattern match.
	 * @param {boolean} fromPattern - Whether or not the command is being run from a pattern match
	 * @return {Promise<?Message|?Array<Message>>}
	 */
	async run(message, args, fromPattern) { // eslint-disable-line no-unused-vars
		throw new Error(`${this.constructor.name} doesn't have a run() method.`);
	}

	/**
	 * Enables or disables the command in a guild
	 * @param {?GuildResolvable} guild - Guild to enable/disable the command in
	 * @param {boolean} enabled - Whether the command should be enabled or disabled
	 */
	setEnabledIn(guild, enabled) {
		if(typeof guild === 'undefined') throw new TypeError('Guild must not be undefined.');
		if(typeof enabled === 'undefined') throw new TypeError('Enabled must not be undefined.');
		if(this.guarded) throw new Error('The command is guarded.');
		if(!guild) {
			this._globalEnabled = enabled;
			this.client.emit('commandStatusChange', null, this, enabled);
			return;
		}
		guild = this.client.resolver.resolveGuild(guild);
		guild.setCommandEnabled(this, enabled);
	}

	/**
	 * Checks if the command is enabled in a guild
	 * @param {?GuildResolvable} guild - Guild to check in
	 * @return {boolean}
	 */
	isEnabledIn(guild) {
		if(this.guarded) return true;
		if(!guild) return this.group._globalEnabled && this._globalEnabled;
		guild = this.client.resolver.resolveGuild(guild);
		return guild.isGroupEnabled(this.group) && guild.isCommandEnabled(this);
	}

	/**
	 * Checks if the command is usable for a message
	 * @param {?Message} message - The message
	 * @return {boolean}
	 */
	isUsable(message = null) {
		if(!message) return this._defaultEnabled;
		if(this.guildOnly && message && !message.guild) return false;
		return this.isEnabledIn(message.guild) && this.hasPermission(message);
	}

	/**
	 * Creates a usage string for the command
	 * @param {string} [argString] - A string of arguments for the command
	 * @param {string} [prefix=this.client.commandPrefix] - Prefix to use for the prefixed command format
	 * @param {User} [user=this.client.user] - User to use for the mention command format
	 * @return {string}
	 */
	usage(argString, prefix = this.client.commandPrefix, user = this.client.user) {
		return this.constructor.usage(`${this.name}${argString ? ` ${argString}` : ''}`, prefix, user);
	}

	/**
	 * Reloads the command
	 * @return {boolean} Whether the reload was successful
	 */
	reload() {
		let cmdPath, cached, newCmd;
		try {
			cmdPath = path.join(this.client.registry.commandsPath, this.groupID, `${this.memberName}.js`);
			cached = require.cache[cmdPath];
			delete require.cache[cmdPath];
			newCmd = require(cmdPath);
		} catch(err) {
			if(cached) require.cache[cmdPath] = cached;
			try {
				cmdPath = path.join(__dirname, 'commands', this.groupID, `${this.memberName}.js`);
				cached = require.cache[cmdPath];
				delete require.cache[cmdPath];
				newCmd = require(cmdPath);
			} catch(err2) {
				if(cached) require.cache[cmdPath] = cached;
				return false;
			}
		}

		this.client.registry.reregisterCommand(newCmd, this);
		return true;
	}

	/**
	 * Creates a usage string for a command
	 * @param {string} command - A command + arg string
	 * @param {string} [prefix] - Prefix to use for the prefixed command format
	 * @param {User} [user] - User to use for the mention command format
	 * @return {string}
	 */
	static usage(command, prefix = null, user = null) {
		const nbcmd = command.replace(/ /g, '\xa0');
		if(!prefix && !user) return `\`${nbcmd}\``;

		let prefixPart;
		if(prefix) {
			if(prefix.length > 1 && !prefix.endsWith(' ')) prefix += ' ';
			prefix = prefix.replace(/ /g, '\xa0');
			prefixPart = `\`${prefix}${nbcmd}\``;
		}

		let mentionPart;
		if(user) mentionPart = `\`@${user.username.replace(/ /g, '\xa0')}#${user.discriminator}\xa0${nbcmd}\``;

		return `${prefixPart || ''}${prefix && user ? ' or ' : ''}${mentionPart || ''}`;
	}
}

module.exports = Command;
