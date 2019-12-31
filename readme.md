# Sadako-bot
A cursed discord bot.

## Features
- Curses new guild members
- Curses direct messages
- Curse interaction:
   - On curse:
      - Sends a creepy video.
      - Assigns role "curse" if is a guild member.
      - Sends a creepy message.
   - After 7 days:
      - Sends another creepy video.
      - The cursed member will be assigned the role "dead".

## Docker
1. Clone this repository to your host
1. Add a config file (uri: `mongodb://mongo:27017`)
1. To create and start container: `docker-compose up -d`

## Requirements
- NodeJS
- MongoDB
- Create a config file.

## Create a config file.
1. Create folder and file: `config/sadako.json`
- token: discord bot token
- uri: database uri
- dbName: database name
- guild: guild id
- roles: role id for each role.

JSON Structure:
```
{
	"token": "",
	"uri": "",
	"dbName": "",
	"guild": "",
	"roles": {
		"cursed": "",
		"dead": ""
	}
}
```