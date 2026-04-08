export type EmotionType = 'HAPPY' | 'SAD' | 'ANGRY' | 'SURPRISE' | 'IDLE';

export interface StageCommand {
  characterId: string;
  type: 'EMOTION' | 'GREETING' | 'ATMOSPHERE' | 'RESET' | 'MOVE' | 'ROTATE' | 'GYRO';
  value: any;
  metadata?: Record<string, any>;
}

export interface ExecutionLog {
  id: string;
  timestamp: number;
  command: StageCommand;
}
