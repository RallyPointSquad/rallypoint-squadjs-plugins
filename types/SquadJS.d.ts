import EventEmitter from 'node:events';


// https://github.com/Team-Silver-Sphere/SquadJS/blob/master/core/rcon.js
export class Rcon extends EventEmitter {

  execute(command: string): Promise<unknown>;

}

// https://github.com/Team-Silver-Sphere/SquadJS/blob/master/squad-server/rcon.js
export class SquadRcon extends Rcon {
}

// https://github.com/Team-Silver-Sphere/SquadJS/blob/master/squad-server/layers/layer.js
export class Layer {

  name: string;
  classname: string;
  layerid: string;
  map: {
    name: string;
  };
  gamemode: string;
  // gamemodeType: ???;
  version: string;
  size: string;
  sizeType: string;
  // numberOfCapturePoints: ???;
  lighting: {
    name: string;
    classname: string;
  };
  teams: unknown[];

}

// https://github.com/Team-Silver-Sphere/SquadJS/blob/master/squad-server/index.js
// https://github.com/Team-Silver-Sphere/SquadJS/blob/master/squad-server/rcon.js
export class Player {

  playerID: number;
  name: string;
  isLeader: boolean;
  teamID: number|null;
  squadID: number|null;
  steamID?: string;

}

// https://github.com/Team-Silver-Sphere/SquadJS/blob/master/squad-server/index.js
export class SquadServer extends EventEmitter {

  //~ Direct instance properties

  id: string;
  options: Record<string, unknown>;
  layerHistory: unknown[];
  players: Player[];
  squads: unknown[];
  admins: unknown;
  adminsInAdminCam: unknown;
  plugins: unknown[];
  rcon: SquadRcon;

  //~ Resolved properties via RCON or log parsing

  playerCount?: number;
  currentLayer?: Layer;

}
