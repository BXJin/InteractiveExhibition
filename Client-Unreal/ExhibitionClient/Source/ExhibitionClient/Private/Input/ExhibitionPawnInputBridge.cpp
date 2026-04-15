#include "Input/ExhibitionPawnInputBridge.h"

#include "EnhancedInputSubsystems.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/Pawn.h"
#include "InputActionValue.h"
#include "Realtime/ExhibitionRealtimeSubsystem.h"

DEFINE_LOG_CATEGORY_STATIC(LogExhibitionInput, Log, All);

// ─────────────────────────────────────────────────────────────────────────────
// 생성자
// ─────────────────────────────────────────────────────────────────────────────

UExhibitionPawnInputBridge::UExhibitionPawnInputBridge()
{
    // 이동 주입을 위해 Tick이 반드시 필요.
    // 비활성 시에는 bHasPendingMove가 false라 실질 비용은 거의 없음.
    PrimaryComponentTick.bCanEverTick = true;
    PrimaryComponentTick.bStartWithTickEnabled = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 생명주기
// ─────────────────────────────────────────────────────────────────────────────

void UExhibitionPawnInputBridge::BeginPlay()
{
    Super::BeginPlay();

    UGameInstance* GI = GetWorld() ? GetWorld()->GetGameInstance() : nullptr;
    if (!GI)
    {
        UE_LOG(LogExhibitionInput, Warning, TEXT("[InputBridge] GameInstance not found."));
        return;
    }

    UExhibitionRealtimeSubsystem* Subsystem =
        GI->GetSubsystem<UExhibitionRealtimeSubsystem>();

    if (!Subsystem)
    {
        UE_LOG(LogExhibitionInput, Warning, TEXT("[InputBridge] ExhibitionRealtimeSubsystem not found."));
        return;
    }

    // Dynamic Multicast Delegate → AddDynamic 매크로 사용.
    // 바인딩 함수는 반드시 UFUNCTION()이어야 함 (.h에 선언됨).
    Subsystem->OnMoveDirection.AddDynamic(this, &UExhibitionPawnInputBridge::HandleMoveDirection);
    Subsystem->OnRotate.AddDynamic(this, &UExhibitionPawnInputBridge::HandleRotate);
    Subsystem->OnConnectionChanged.AddDynamic(this, &UExhibitionPawnInputBridge::HandleConnectionChanged);

    bBoundToSubsystem = true;

    UE_LOG(LogExhibitionInput, Log,
        TEXT("[InputBridge] Bound to subsystem. CharacterId=%s"), *BoundCharacterId);
}

void UExhibitionPawnInputBridge::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    // Subsystem보다 먼저 소멸할 수 있으므로 반드시 수동 해제.
    // RemoveDynamic은 (Object, FunctionPtr) 쌍으로 바인딩을 찾아 제거.
    if (bBoundToSubsystem)
    {
        if (UGameInstance* GI = GetWorld() ? GetWorld()->GetGameInstance() : nullptr)
        {
            if (UExhibitionRealtimeSubsystem* Subsystem =
                    GI->GetSubsystem<UExhibitionRealtimeSubsystem>())
            {
                Subsystem->OnMoveDirection.RemoveDynamic(
                    this, &UExhibitionPawnInputBridge::HandleMoveDirection);
                Subsystem->OnRotate.RemoveDynamic(
                    this, &UExhibitionPawnInputBridge::HandleRotate);
                Subsystem->OnConnectionChanged.RemoveDynamic(
                    this, &UExhibitionPawnInputBridge::HandleConnectionChanged);
            }
        }
        bBoundToSubsystem = false;
    }

    // 이동 상태 초기화 — EndPlay 후 Tick이 혹시라도 호출되어도 안전.
    bHasPendingMove = false;
    PendingMoveInput = FVector2D::ZeroVector;

    Super::EndPlay(EndPlayReason);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tick — 이동 입력 주입
// ─────────────────────────────────────────────────────────────────────────────

void UExhibitionPawnInputBridge::TickComponent(
    float DeltaTime,
    ELevelTick TickType,
    FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    if (bHasPendingMove)
    {
        // Dead man's switch: 마지막 수신으로부터 MoveInputTimeoutSec 초과 시 강제 정지.
        // 패널 앱 백그라운드 전환 / 네트워크 단절 시 (0,0) 명령이 오지 않아도 멈춤.
        const float Now = GetWorld()->GetTimeSeconds();
        if (Now - LastMoveInputTime > MoveInputTimeoutSec)
        {
            ClearMoveInput();
        }
        else
        {
            InjectMoveInput();
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 이벤트 핸들러
// ─────────────────────────────────────────────────────────────────────────────

void UExhibitionPawnInputBridge::HandleMoveDirection(
    const FString& CharacterId,
    FVector Direction,
    float /*Speed*/,
    float /*DurationSeconds*/)
{
    if (CharacterId != BoundCharacterId)
    {
        return;
    }

    // 패널 조이스틱: X = 오른쪽, Y = 앞쪽 (서버에서 y반전 처리됨)
    // FVector.X → EIS Axis2D.X(Right), FVector.Y → Axis2D.Y(Forward)
    PendingMoveInput   = FVector2D(Direction.X, Direction.Y);
    bHasPendingMove    = !PendingMoveInput.IsNearlyZero();
    LastMoveInputTime  = GetWorld()->GetTimeSeconds();

    if (bDebugDraw)
    {
        GEngine->AddOnScreenDebugMessage(
            1, 0.12f, FColor::Cyan,
            FString::Printf(TEXT("[Move] X=%.2f Y=%.2f"), Direction.X, Direction.Y));
    }
}

void UExhibitionPawnInputBridge::HandleRotate(
    const FString& CharacterId,
    FRotator Rotation)
{
    if (CharacterId != BoundCharacterId)
    {
        return;
    }

    APlayerController* PC = GetOwnerController();
    if (!PC)
    {
        return;
    }

    // ── 왜 EIS InjectInputForAction 대신 AddYawInput/AddPitchInput인가 ─────────
    // 이동(IA_Move)은 "지금 얼마나 누르고 있나"의 절댓값 → Tick마다 재주입 필요.
    // 회전은 "이번 제스처에서 손가락이 얼마나 움직였나"의 델타값 → 1회 적용으로 충분.
    //
    // UE5 ThirdPerson의 IA_Look 바인딩도 내부적으로 AddControllerYawInput/PitchInput을
    // 호출할 뿐이므로 직접 호출하면 EIS를 거치지 않고도 동일한 결과.
    // 오히려 EIS inject는 IA_Look의 Modifier 스택(Dead Zone, Scale 등)을 타서
    // 예상치 못한 감도 변화가 생길 수 있음.
    // ─────────────────────────────────────────────────────────────────────────
    PC->AddYawInput(Rotation.Yaw   * RotationSensitivity);
    PC->AddPitchInput(Rotation.Pitch * RotationSensitivity);

    if (bDebugDraw)
    {
        GEngine->AddOnScreenDebugMessage(
            2, 0.12f, FColor::Yellow,
            FString::Printf(TEXT("[Rotate] Yaw=%.2f Pitch=%.2f"),
                Rotation.Yaw, Rotation.Pitch));
    }
}

void UExhibitionPawnInputBridge::HandleConnectionChanged(bool bConnected)
{
    if (!bConnected)
    {
        // 연결 끊김 → 타임아웃 대기 없이 즉시 정지.
        ClearMoveInput();

        UE_LOG(LogExhibitionInput, Log,
            TEXT("[InputBridge] Connection lost — move input cleared."));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 내부 유틸
// ─────────────────────────────────────────────────────────────────────────────

void UExhibitionPawnInputBridge::ClearMoveInput()
{
    bHasPendingMove  = false;
    PendingMoveInput = FVector2D::ZeroVector;
}

void UExhibitionPawnInputBridge::InjectMoveInput()
{
    APlayerController* PC = GetOwnerController();
    if (!PC)
    {
        return;
    }

    ULocalPlayer* LP = PC->GetLocalPlayer();
    if (!LP)
    {
        return;
    }

    UEnhancedInputLocalPlayerSubsystem* EIS =
        ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(LP);

    if (!EIS)
    {
        UE_LOG(LogExhibitionInput, Warning,
            TEXT("[InputBridge] EnhancedInputLocalPlayerSubsystem not found. "
                 "Check that the character uses an EnhancedInputComponent."));
        return;
    }

    if (!MoveAction)
    {
        UE_LOG(LogExhibitionInput, Warning,
            TEXT("[InputBridge] MoveAction is null. "
                 "Assign IA_Move asset in the component details panel."));
        return;
    }

    // InjectInputForAction은 이번 프레임 한 번만 유효.
    // Tick에서 매 프레임 호출하기 때문에 조이스틱을 누르는 동안 연속 이동이 보장됨.
    const FInputActionValue Value(PendingMoveInput);
    EIS->InjectInputForAction(MoveAction, Value, {}, {});
}

APlayerController* UExhibitionPawnInputBridge::GetOwnerController() const
{
    const APawn* Pawn = Cast<APawn>(GetOwner());
    if (!Pawn)
    {
        return nullptr;
    }

    APlayerController* PC = Cast<APlayerController>(Pawn->GetController());
    if (!PC)
    {
        // AI Controller나 컨트롤러 없는 상태에서는 조용히 무시
        return nullptr;
    }

    return PC;
}
