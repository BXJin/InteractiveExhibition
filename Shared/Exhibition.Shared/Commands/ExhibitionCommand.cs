using System.Text.Json.Serialization;

namespace Exhibition.Shared.Commands
{
    [JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
    [JsonDerivedType(typeof(SetEmotionCommand), "setEmotion")]
    [JsonDerivedType(typeof(PlayAnimationCommand), "playAnimation")]
    [JsonDerivedType(typeof(TriggerStageEventCommand), "triggerStageEvent")]
    [JsonDerivedType(typeof(MoveToPointCommand), "moveToPoint")]
    [JsonDerivedType(typeof(MoveDirectionCommand), "moveDirection")]
    [JsonDerivedType(typeof(RotateCommand), "rotate")]
    public abstract record ExhibitionCommand
    {
        /// <summary>
        /// 1캐릭터 MVP라도, 2캐릭터 확장을 위해 모든 명령에 포함합니다.
        /// </summary>
        public required string CharacterId { get; init; }

        /// <summary>
        /// 캐릭터 외 타겟(오브젝트/카메라/조명 등)이 생길 때를 대비한 확장 포인트입니다.
        /// </summary>
        public string? TargetId { get; init; }

        /// <summary>
        /// 요청 상관관계 추적(로그/디버그 HUD)을 위한 ID 입니다.
        /// </summary>
        public Guid CommandId { get; init; } = Guid.NewGuid();

        public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    }

    public sealed record SetEmotionCommand : ExhibitionCommand
    {
        /// <summary>
        /// 예: "happy", "sad", "angry", "surprise"
        /// </summary>
        public required string EmotionKey { get; init; }
    }

    public sealed record PlayAnimationCommand : ExhibitionCommand
    {
        /// <summary>
        /// 예: "wave", "bow", "clap"
        /// </summary>
        public required string AnimationKey { get; init; }

        public bool Loop { get; init; }
    }

    public sealed record TriggerStageEventCommand : ExhibitionCommand
    {
        /// <summary>
        /// 예: "stage.day", "stage.night", "light.spotOn"
        /// </summary>
        public required string StageEventKey { get; init; }
    }

    public sealed record MoveToPointCommand : ExhibitionCommand
    {
        public required Vector3Dto Position { get; init; }

        public float? Speed { get; init; }
    }

    public sealed record MoveDirectionCommand : ExhibitionCommand
    {
        /// <summary>
        /// 정규화된 방향 벡터를 권장합니다.
        /// </summary>
        public required Vector3Dto Direction { get; init; }

        public float? Speed { get; init; }

        public float? DurationSeconds { get; init; }
    }

    public sealed record RotateCommand : ExhibitionCommand
    {
        public required RotatorDto Rotation { get; init; }
    }

    public sealed record Vector3Dto
    {
        public required float X { get; init; }
        public required float Y { get; init; }
        public required float Z { get; init; }
    }

    public sealed record RotatorDto
    {
        public required float Pitch { get; init; }
        public required float Yaw { get; init; }
        public required float Roll { get; init; }
    }
}