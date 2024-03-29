import { Client, User, GuildMember, DMChannel, Message } from 'discord.js';
import { EventEmitter } from 'events';
import { Database, CursedDocument } from './database';
import { readFileSync } from 'fs';
import { join } from 'path';

declare interface Curse<T> extends EventEmitter {
	on(event: 'end', listener: (cursed: T) => void): this;
}

class Curse<T> extends EventEmitter {
	end(cursed: T) {
		this.emit('end', cursed);
	}
}

const curse = new Curse<Prey>();

enum SadakoMessages {
	curse = "<https://youtu.be/Gw492Uz-EVg>",
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
		const path = join(__dirname, '../', 'config', 'sadako.json');
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
		this.directMessage();
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

	private createEndDate() {
		const end = new Date();
		end.setDate(end.getDate() + 7);
		return end;
	}

	private getGuildMember(id: string) {
		return this.guild.members.get(id);
	}

	private async initCursed() {
		const arr = await this._db.getAllCursed();
		this._preys = arr.map(cursed => new Prey(cursed));
	}

	private async ready() {
		this._client.on("ready", () => {
			console.log("Did it just get cold in here?");
			this._preys.forEach(v => v.ended());
		});
	}

	private async userJoinedServer() {
		this._client.on("guildMemberAdd", member => {
			this.curse(member.id);
		});
	}

	private isCursed(id: string) {
		const ids = this._preys.map(prey => prey.cursed.memberID);
		return ids.includes(id);
	}

	private async curse(id: string) {
		if (this.isCursed(id)) {
			this.remindCurse(id);
		} else {
			const victim = this.getGuildMember(id) ?? await this._client.fetchUser(id);
			victim instanceof GuildMember ? this.curseMember(victim) : this.curseUser(victim);
		}
	}

	private async curseMember(member: GuildMember) {
		member.addRole(this._config.roles.cursed);
		this.curseUser(member.user);
	}

	private async curseUser(user: User) {
		user.send(SadakoMessages.curse, { tts: true });

		setTimeout(() => {
			this.remindCurse(user.id);
		}, (60000));

		this.addCursed(user.id);
	}

	private async remindCurse(id: string) {
		const prey = this._preys.find(prey => prey.cursed.memberID === id);
		const user = await this._client.fetchUser(id);
		if (prey) {
			const daysLeft = Math.ceil((prey.cursed.end.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
			user.send(`${daysLeft} days`, { tts: true });
		}
	}

	private async kill() {
		curse.on("end", async (prey: Prey) => {
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

	private async atone(id: string) {
		const victim = this.getGuildMember(id) ?? await this._client.fetchUser(id);
		const prey = this._preys.find(v => v.cursed.memberID === id);
		if (prey) {
			if (victim instanceof GuildMember) {
				victim.removeRole(this._config.roles.cursed);
			}
			victim.send(SadakoMessages.atone);
			this.deleteCursed(prey);
		} else {
			this.curse(id);
		}
	}

	private async directMessage() {
		this._client.on("message", async msg => {
			if (msg.channel instanceof DMChannel) {
				if (msg.author.id !== this._client.user.id) {
					const args = msg.content.split(" ");
					this.runCommand(args, msg);
				}
			}
		});
	}

	private async runCommand(args: string[], msg: Message) {
		switch (args[0].toLowerCase()) {
			case "curse":
				if (args.length > 1) {
					this.invokeCurse(args[1], msg);
					break;
				}
			default:
				this.curse(msg.author.id);
		}
	}

	private async invokeCurse(victimId: string, msg: Message) {
		const victim = await this._client.fetchUser(victimId);

		if (victim && !this.isCursed(victim.id)) {
			if (victim.id === this._client.user.id) {
				msg.react('👻');
			} else {
				this.curse(victim.id);
				this.atone(msg.author.id);
				return;
			}
		}

		this.curse(msg.author.id);
	}

	private async addCursed(id: string) {
		const result = await this._db.addCursed({memberID: id, end: this.createEndDate()});
		this._preys.push(new Prey(result));
	}

	private async deleteCursed(prey: Prey) {
		this._preys = this._preys.filter(p => p.cursed.memberID !== prey.cursed.memberID);
		const result = await this._db.deleteCursed(prey.cursed);
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

	public async ended() {
		if (this.cursed.end <= new Date()) {
			clearInterval(this.interval);
			curse.end(this);
		}
	}
}