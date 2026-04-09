// ASP.NET ExhibitionCommand 형식과 1:1 대응

export type EmotionKey = 'happy' | 'sad' | 'angry' | 'surprise';

export interface SetEmotionCommand {
  type: 'setEmotion';
  characterId: string;
  emotionKey: EmotionKey;
}

export interface PlayAnimationCommand {
  type: 'playAnimation';
  characterId: string;
  animationKey: string;
  loop?: boolean;
}

export interface TriggerStageEventCommand {
  type: 'triggerStageEvent';
  characterId: string;
  stageEventKey: string;
}

export interface MoveDirectionCommand {
  type: 'moveDirection';
  characterId: string;
  direction: { x: number; y: number; z: number };
  speed?: number;
  durationSeconds?: number;
}

export interface RotateCommand {
  type: 'rotate';
  characterId: string;
  rotation: { pitch: number; yaw: number; roll: number };
}

export type ExhibitionCommand =
  | SetEmotionCommand
  | PlayAnimationCommand
  | TriggerStageEventCommand
  | MoveDirectionCommand
  | RotateCommand;

export interface CommandResult {
  commandId: string;
  createdAt: string;
  unrealConnections: number;
  broadcastAttempted: number;
  broadcastSent: number;
}
