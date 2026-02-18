export type InputSnapshot = {
  forward: number;
  strafe: number;
  turn: number;
  sprint: boolean;
  shoot: boolean;
};

export type RemotePlayerState = {
  sessionId: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  hp: number;
  ammo: number;
};
