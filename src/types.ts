export interface Point {
  x: number;
  y: number;
}

export enum EntityState {
  ACTIVE = 'active',
  CAUGHT = 'caught',
  SAFE = 'safe'
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  radius: number;
  speed: number;
  state: EntityState;
  color: string;
  emoji: string;
}

export interface GameState {
  rats: Entity[];
  cats: Entity[];
  score: number;
  status: 'playing' | 'won' | 'lost' | 'start';
  level: number;
  activeRatIndex: number;
}
