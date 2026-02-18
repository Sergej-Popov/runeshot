export type PotionSpriteId = "mana" | "health" | "poison" | "speed" | "fire" | "smoke" | "freeze";

export type SpriteFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const POTION_SPRITE_ATLAS_URL = "/sprites/potions-sprites.clean.png";
export const POTION_SPRITE_ATLAS_SIZE = {
  width: 1408,
  height: 768,
} as const;

export const POTION_SPRITE_FRAMES: Record<PotionSpriteId, SpriteFrame> = {
  health: { x: 398, y: 34, width: 260, height: 318 },
  mana: { x: 52, y: 40, width: 254, height: 312 },
  poison: { x: 762, y: 40, width: 236, height: 312 },
  speed: { x: 1096, y: 40, width: 254, height: 312 },
  freeze: { x: 234, y: 416, width: 236, height: 317 },
  fire: { x: 574, y: 416, width: 248, height: 317 },
  smoke: { x: 903, y: 416, width: 300, height: 317 },
};

export const POTION_SPRITE_TEXTURE_URLS: Record<PotionSpriteId, string> = {
  mana: "/sprites/potions/mana.png",
  health: "/sprites/potions/health.png",
  poison: "/sprites/potions/poison.png",
  speed: "/sprites/potions/speed.png",
  fire: "/sprites/potions/fire.png",
  smoke: "/sprites/potions/smoke.png",
  freeze: "/sprites/potions/freeze.png",
};
