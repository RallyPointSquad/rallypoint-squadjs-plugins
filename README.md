# RallyPoint SquadJS Plugins

Here you will find different custom plugins for [SquadJS](https://github.com/Team-Silver-Sphere/SquadJS).


## Available Plugins

### Seeding Map Setter

This plugin is intended to bring more variety into the seeding layers and layers that are played when the seeding
ends. Once SquadJS starts and loads the plugin, it will attempt to set the current layer to one randomly chosen
from configured options. It will also attempt to set the next layer in the same way.

Example configuration:

```json
{
    "plugin": "SeedMapSetter",
    "enabled": true,
    "seedingLayers": [
        "Logar_Seed_v1 USA WPMC",
        "Sumari_Seed_v1 USA WPMC",
        "Fallujah_Seed_v1 USA WPMC"
    ],
    "afterSeedingLayers": [
        "Narva_RAAS_v1 USA+LightInfantry RGF+LightInfantry",
        "Mutaha_RAAS_v1 USA+LightInfantry RGF+LightInfantry",
        "Harju_RAAS_v2 USA+LightInfantry RGF+LightInfantry"
    ]
}
```


### Discord Seed Call

This plugin is intended to publish discord announcement message at specified time of the day.

Example configuration:

```json
{
    "plugin": "DiscordSeedCall",
    "enabled": true,
    "discordClient": "discord",
    "channelID": "667741905228136459",
    "time": "15:00",
    "message": "Seeding has started",
    "pingGroups": ["500455137626554379"]
}
```


### Playtime Tracker

This plugin tracks the number of minutes players spend on the server. The plugin uses server population to
differentiate between seeding and normal play.

Tracked playtime can be associated with a specific clan based on clan membership extracted from a whitelist
published by Whitelister.

Example configuration:

```json
{
    "plugin": "PlaytimeTracker",
    "enabled": true,
    "database": "sqlite",
    "seedingStartsAt": 4,
    "seedingEndsAt": 60,
    "whitelisterClient": "whitelister"
}
```


### Playtime Report

This plugin can send cumulative clan players' playtime report to Discord.

Plugin uses data collected by _Playtime Tracker_ plugin. Report is generated and sent in response to
`SEND_PLAYTIME_REPORT` event that can be triggered by _Task Scheduler_ plugin.

Example configuration:

```json
{
    "plugin": "PlaytimeReport",
    "enabled": true,
    "database": "sqlite",
    "discordClient": "discord",
    "whitekisterClient": "whitelister",
    "channelID": "1340314500031450080"
}
```


### Task Scheduler

Generic task scheduler plugin that emits configured events to other plugins based on CRON expressions.
The plugin itself does not offer any functionality other than scheduling events.

Plugin dependencies:

* [node-cron](https://www.npmjs.com/package/node-cron) library (add it to package.json's `"dependencies"`)

Example configuration:

```json
{
    "plugin": "TaskScheduler",
    "enabled": true,
    "tasks": [
        {
            "name": "Emit custom event every hour",
            "cron": "0 * * * *",
            "event": "MY_CUSTOM_EVENT"
        }
    ]
}
```


### Whitelister Connector

Connector plugin that enabled other plugins to communicate with Whitelister.

Example configuration:

```json
{
    "plugin": "WhitelisterConnector",
    "enabled": true,
    "whitelisterUrl": "http://whitelister.local",
    "whitelistPath": "wl",
    "whitelistGroup": "whitelist"
}
```


### Monkey Patch

Plugin that tweaks SquadJS behavior by monkey patching its internals.

Applied patches by the plugin:

* increase listener limit on RCON connection to prevent `MaxListenersExceededWarning`

Example configuration:

```json
{
    "plugin": "MonkeyPatch",
    "enabled": true
}
```


## Plugin Development

Working with the project requires Node.js 21 or newer. Initialize project dependencies by running `npm install`.

All common development tasks are available as NPM scripts:

* `npm run clean` - removes compiled JavaScript files
* `npm run build` - compiles TypeScript sources into JavaScript (output in `dist` directory)
* `npm run test` - runs Vitest to execute unit tests
* `npm run lint` - runs ESLint to check for linting errors
* `npm run check` - runs TypeScript type checking

To build only a specific set of plugins, use `BUILD_PLUGINS` environment variable (multiple plugin names separated by comma):

```bash
BUILD_PLUGINS=PlaytimeTracker npm run build
```

To run unit test for only a specific plugin, use the test filename as CLI argument:

```bash
npm run test ./tests/plugin/PlaytimeTracker.spec.ts
```
