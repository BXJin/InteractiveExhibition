/**
 * Exhibition 커맨드 팩토리.
 *
 * ASP.NET ExhibitionCommand 형식의 JSON payload를 생성합니다.
 * 이 파일만 ASP.NET Shared 모델과 1:1로 대응.
 * core/ 레이어는 이 형식을 모름 → 게임이 바뀌면 이 파일만 교체.
 */

const CHARACTER_ID = 'Character_01';

export const ExhibitionCommands = {
  setEmotion(emotionKey: string) {
    return {
      type: 'setEmotion' as const,
      characterId: CHARACTER_ID,
      emotionKey,
    };
  },

  playAnimation(animationKey: string, loop = false) {
    return {
      type: 'playAnimation' as const,
      characterId: CHARACTER_ID,
      animationKey,
      loop,
    };
  },

  triggerStageEvent(stageEventKey: string) {
    return {
      type: 'triggerStageEvent' as const,
      characterId: CHARACTER_ID,
      stageEventKey,
    };
  },

  moveDirection(x: number, y: number, z = 0) {
    return {
      type: 'moveDirection' as const,
      characterId: CHARACTER_ID,
      direction: { x, y, z },
    };
  },

  rotate(pitch: number, yaw: number, roll = 0) {
    return {
      type: 'rotate' as const,
      characterId: CHARACTER_ID,
      rotation: { pitch, yaw, roll },
    };
  },

  reset() {
    return this.triggerStageEvent('scene.reset');
  },
} as const;
