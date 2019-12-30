import * as mongoose from 'mongoose';
import { Cursed } from './sadako';

const cursedSchema = new mongoose.Schema({ memberID: String, end: Date }, { collection: 'cursed' });

export interface CursedDocument extends Cursed, mongoose.Document {
}

export class Database {
	private _collection = mongoose.model<CursedDocument>('cursed', cursedSchema);

	constructor(uri: string, dbName: string) {
		mongoose.connect(uri, { dbName, useNewUrlParser: true, useUnifiedTopology: true }, err => {
			if (err) {
				throw err;
			} else {
				console.log("Connected to db server.");
			}
		});
	}

	public async addCursed(cursed: Cursed) {
		const newCursed = new this._collection(cursed);
		return newCursed.save();
	}

	public async getAllCursed() {
		return this._collection.find().exec();
	}

	public async deleteCursed(cursed: CursedDocument) {
		return cursed.remove();
	}
}