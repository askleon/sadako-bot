import { Client, User } from 'discord.js';
import { EventEmitter } from 'events';
import { Database, CursedDocument } from './database';
import { readFileSync } from 'fs';
import { join } from 'path';

const curse: EventEmitter = new EventEmitter();

enum SadakoMessages {
	curse = "<https://youtu.be/Gw492Uz-EVg>",
	pact = "Seven days",
	eliminate = "<https://youtu.be/c80-nyjP9Hg>",
	atone = "<https://youtu.be/5OlSgtKB37s>"
}

interface SadakoConfig {
	token: string;
	uri: string;
	dbName: string;
	guild: string;
	roles: {
		cursed: string;
		dead: string;
	};
}

class SadakoConfigManager {
	_config: SadakoConfig;

	constructor() {
		const path = join(__dirname,'../', 'config', 'sadako.json');
		this._config = JSON.parse(readFileSync(path).toString());
	}

	get token() {
		return this._config.token;
	}
	
	get uri() {
		return this._config.uri;
	}

	get dbName() {
		return this._config.dbName;
	}

	get guild() {
		return this._config.guild;
	}

	get roles() {
		return this._config.roles;
	}
}

export class Sadako {
	private readonly _db: Database;
	private _client = new Client();
	private _preys: Prey[] = [];
	private _config = new SadakoConfigManager();

	constructor() {
		this._db = new Database(this._config.uri, this._config.dbName);
		this.ready();
		this.userJoinedServer();
		this.kill();
		this.test();
		this.initCursed();
		this._client.login(this._config.token);
	}

	private get guild() {
		const guild = this._client.guilds.get(this._config.guild);
		if (!guild) {
			throw new Error("Guild not found.");
		}
		return guild;
	}

	private getGuildMember(id: string) {
		return this.guild.members.get(id);
	}

	private async initCursed() {
		const arr = await this._db.getAllCursed();
		this._preys = arr.map(cursed => new Prey(cursed));
	}

	private async ready() {
		this._client.on("ready", () => console.log("Did it just get cold in here?"));
	}

	private async userJoinedServer() {
		this._client.on("guildMemberAdd", member => {
			setTimeout(() => {
				member.user.send(SadakoMessages.pact, { tts: true });
			}, (60000));
			member.addRole(this._config.roles.cursed);
			const end = member.joinedAt;
			end.setDate(end.getDate() + 7);
			this.addCursed({ memberID: member.id, end });
		});
	}

	private async kill() {
		curse.on("ended", async (prey: Prey) => {
			let user: User;
			try {
				user = await this._client.fetchUser(prey.cursed.memberID);
			} catch (e) {
				if (e instanceof Error) {
					console.log(e.message);
				}
				return;
			}

			const member = this.getGuildMember(prey.cursed.memberID);
			if (member) {
				member.removeRole(this._config.roles.cursed);
				member.addRole(this._config.roles.dead);
			}

			user.send(SadakoMessages.eliminate);
			this.deleteCursed(prey);
		});
	}

	private async test() {
		this._client.on("message", msg => {
			if (msg.content === "test") {
				const ids = this._preys.map(prey => prey.cursed.memberID);
				if (ids.includes(msg.author.id)) {
					const prey = this._preys.find(prey => prey.cursed.memberID === msg.author.id);
					if (prey) {
						const daysLeft = Math.ceil((prey.cursed.end.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
						msg.author.send(`${daysLeft} days`, { tts: true });
					}
				} else {
					msg.author.send(SadakoMessages.curse, { tts: true });
					msg.author.send(SadakoMessages.pact, { tts: true });

					const member = this.getGuildMember(msg.author.id);
					if (member) {
						member.addRole(this._config.roles.cursed);
					}

					const end = msg.createdAt;
					end.setDate(end.getDate() + 7);
					this.addCursed({ memberID: msg.author.id, end });
				}
			}
		});
	}

	private async addCursed(cursed: Cursed) {
		const result = await this._db.addCursed(cursed);
		this._preys.push(new Prey(result));
		console.log(result);
	}

	private async deleteCursed(prey: Prey) {
		this._preys = this._preys.filter(p => p.cursed.memberID !== prey.cursed.memberID);
		const result = await this._db.deleteCursed(prey.cursed);
		console.log(result);
	}
}

export interface Cursed {
	memberID: string;
	end: Date;
}

class Prey {
	private interval: NodeJS.Timeout;

	constructor(public cursed: CursedDocument) {
		this.interval = setInterval(() => this.ended(), 60000);
	}

	private async ended() {
		if (this.cursed.end <= new Date()) {
			clearInterval(this.interval);
			curse.emit("ended", this);
		}
	}
}