import { MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") declare name: string;
  @type("number") declare x: number;
  @type("number") declare y: number;
  @type("number") declare z: number;
  @type("number") declare rotY: number;
  @type("number") declare hp: number;
  @type("number") declare mana: number;
  @type("number") declare respawnIn: number;

  constructor(name: string, x: number, y: number, z: number) {
    super();
    this.name = name;
    this.x = x;
    this.y = y;
    this.z = z;
    this.rotY = 0;
    this.hp = 100;
    this.mana = 90;
    this.respawnIn = 0;
  }
}

export class Cat extends Schema {
  @type("string") declare type: string;
  @type("number") declare x: number;
  @type("number") declare y: number;
  @type("number") declare z: number;
  @type("number") declare rotY: number;
  @type("number") declare hp: number;

  constructor(type: string, x: number, y: number, z: number) {
    super();
    this.type = type;
    this.x = x;
    this.y = y;
    this.z = z;
    this.rotY = 0;
    this.hp = type === "boss" || type === "red" ? 20 : 10;
  }
}

export class Projectile extends Schema {
  @type("string") declare ownerId: string;
  @type("number") declare x: number;
  @type("number") declare y: number;
  @type("number") declare z: number;
  @type("number") declare vx: number;
  @type("number") declare vy: number;
  @type("number") declare vz: number;
  @type("number") declare life: number;
  @type("number") declare damage: number;

  constructor(
    ownerId: string,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    damage: number,
  ) {
    super();
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.life = life;
    this.damage = damage;
  }
}

export class Pickup extends Schema {
  @type("string") declare kind: string;
  @type("number") declare x: number;
  @type("number") declare y: number;
  @type("number") declare z: number;
  @type("number") declare amount: number;

  constructor(kind: string, x: number, y: number, z: number, amount: number) {
    super();
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.z = z;
    this.amount = amount;
  }
}

export class BattleState extends Schema {
  @type("number") declare level: number;
  @type("boolean") declare portalActive: boolean;
  @type({ map: Player })
  declare players: MapSchema<Player>;
  @type({ map: Cat })
  declare cats: MapSchema<Cat>;
  @type({ map: Projectile })
  declare projectiles: MapSchema<Projectile>;
  @type({ map: Pickup })
  declare pickups: MapSchema<Pickup>;

  constructor() {
    super();
    this.level = 0;
    this.portalActive = false;
    this.players = new MapSchema<Player>();
    this.cats = new MapSchema<Cat>();
    this.projectiles = new MapSchema<Projectile>();
    this.pickups = new MapSchema<Pickup>();
  }
}
