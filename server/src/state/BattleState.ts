import { MapSchema, Schema, type } from "@colyseus/schema";

export const POTION_KINDS = ["health", "mana", "poison", "speed", "freeze"] as const;
export type PotionKind = (typeof POTION_KINDS)[number];
export const MAX_POTIONS_PER_KIND = 5;

export class Player extends Schema {
  @type("string") declare name: string;
  @type("number") declare x: number;
  @type("number") declare y: number;
  @type("number") declare z: number;
  @type("number") declare rotY: number;
  @type("number") declare hp: number;
  @type("number") declare mana: number;
  @type("number") declare respawnIn: number;

  // Potion inventory (synced to client)
  @type("number") declare potionHealth: number;
  @type("number") declare potionMana: number;
  @type("number") declare potionPoison: number;
  @type("number") declare potionSpeed: number;
  @type("number") declare potionFreeze: number;

  // Status effects (synced to client)
  @type("boolean") declare poisoned: boolean;
  @type("boolean") declare speedBoosted: boolean;
  @type("boolean") declare frozen: boolean;

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
    this.potionHealth = 0;
    this.potionMana = 0;
    this.potionPoison = 0;
    this.potionSpeed = 0;
    this.potionFreeze = 0;
    this.poisoned = false;
    this.speedBoosted = false;
    this.frozen = false;
  }

  getPotionCount(kind: PotionKind): number {
    switch (kind) {
      case "health": return this.potionHealth;
      case "mana": return this.potionMana;
      case "poison": return this.potionPoison;
      case "speed": return this.potionSpeed;
      case "freeze": return this.potionFreeze;
    }
  }

  setPotionCount(kind: PotionKind, count: number): void {
    switch (kind) {
      case "health": this.potionHealth = count; break;
      case "mana": this.potionMana = count; break;
      case "poison": this.potionPoison = count; break;
      case "speed": this.potionSpeed = count; break;
      case "freeze": this.potionFreeze = count; break;
    }
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

export class PoisonCloud extends Schema {
  @type("number") declare x: number;
  @type("number") declare y: number;
  @type("number") declare z: number;
  @type("number") declare life: number;

  constructor(x: number, y: number, z: number, life: number) {
    super();
    this.x = x;
    this.y = y;
    this.z = z;
    this.life = life;
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
  @type({ map: PoisonCloud })
  declare clouds: MapSchema<PoisonCloud>;

  constructor() {
    super();
    this.level = 0;
    this.portalActive = false;
    this.players = new MapSchema<Player>();
    this.cats = new MapSchema<Cat>();
    this.projectiles = new MapSchema<Projectile>();
    this.pickups = new MapSchema<Pickup>();
    this.clouds = new MapSchema<PoisonCloud>();
  }
}
