#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "ExhibitionPawnInputBridge.generated.h"

class UInputAction;
class UExhibitionRealtimeSubsystem;

/**
 * 모바일 패널 WebSocket 입력 → UE5 캐릭터 입력 변환 컴포넌트.
 *
 * 이 컴포넌트를 Pawn/Character에 붙이면 패널의 조이스틱/터치패드 입력이
 * 기존 Enhanced Input 바인딩(IA_Move)과 캐릭터 컨트롤러 회전으로 자동 연결됩니다.
 *
 * ── 왜 컴포넌트인가 ───────────────────────────────────────────────────────────
 * - Character 클래스를 건드리지 않고 탈부착 가능
 * - CharacterId 기반 필터링으로 2캐릭터 확장 시 그대로 재활용
 * - MoveAction은 에디터에서 에셋 참조로 설정 → 코드 변경 없이 교체 가능
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── 이동 vs 회전 처리 방식 차이 ─────────────────────────────────────────────
 * [이동] 패널 조이스틱은 현재 축 절댓값(-1~1)을 80ms마다 전송.
 *        InjectInputForAction은 1프레임만 유효하므로 Tick마다 재주입해야 부드럽다.
 *        → PendingMoveInput을 저장 후 TickComponent에서 매 프레임 InjectInputForAction.
 *
 * [회전] 패널 터치패드는 이번 이벤트의 델타값을 전송 (마우스 이동량과 동일한 개념).
 *        EIS를 거칠 필요 없이 AddYawInput/AddPitchInput 직접 호출이 더 단순하고 동일한 결과.
 *        → 수신 즉시 1회 호출, Tick 불필요.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 사용법:
 *   1. BP_ThirdPersonCharacter에 이 컴포넌트 추가
 *   2. MoveAction에 IA_Move 에셋 할당
 *   3. BoundCharacterId를 서버와 일치시킴 (기본값 "Character_01")
 *   4. 끝. BeginPlay에서 자동으로 Subsystem에 바인딩됨
 */
UCLASS(ClassGroup="Exhibition", meta=(BlueprintSpawnableComponent),
       DisplayName="Exhibition Pawn Input Bridge")
class EXHIBITIONCLIENT_API UExhibitionPawnInputBridge : public UActorComponent
{
    GENERATED_BODY()

public:
    UExhibitionPawnInputBridge();

    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType,
                               FActorComponentTickFunction* ThisTickFunction) override;

    // ── 설정 ─────────────────────────────────────────────────────────────────

    /**
     * 이동에 사용할 Enhanced Input Action 에셋 (IA_Move).
     * Value 타입: Axis2D (Vector2D). X=Right, Y=Forward.
     * 에디터에서 IA_Move 에셋을 드래그하여 할당하세요.
     */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Exhibition|Input",
              meta=(DisplayName="Move Input Action (IA_Move)"))
    TObjectPtr<UInputAction> MoveAction;

    /**
     * 이 컴포넌트가 처리할 캐릭터 ID.
     * 서버 커맨드의 characterId와 일치해야 이벤트를 처리합니다.
     * 2캐릭터 확장 시 두 번째 캐릭터에 붙인 컴포넌트는 다른 ID로 설정하세요.
     */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Exhibition|Input",
              meta=(DisplayName="Bound Character ID"))
    FString BoundCharacterId = TEXT("Character_01");

    /**
     * 회전 감도 배율.
     * 패널의 터치패드 값(pitch, yaw)에 곱해집니다.
     * 기본값 1.0. 너무 빠르면 줄이세요.
     */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Exhibition|Input",
              meta=(ClampMin="0.1", ClampMax="5.0", DisplayName="Rotation Sensitivity"))
    float RotationSensitivity = 1.0f;

    // ── 디버그 ────────────────────────────────────────────────────────────────

    /** true이면 수신된 이동/회전 값을 화면에 출력합니다. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Exhibition|Input|Debug")
    bool bDebugDraw = false;

private:
    // ── 이벤트 핸들러 ─────────────────────────────────────────────────────────

    UFUNCTION()
    void HandleMoveDirection(const FString& CharacterId, FVector Direction,
                             float Speed, float DurationSeconds);

    UFUNCTION()
    void HandleRotate(const FString& CharacterId, FRotator Rotation);

    /** 연결 끊김 시 즉시 이동 입력 초기화 */
    UFUNCTION()
    void HandleConnectionChanged(bool bConnected);

    // ── 내부 유틸 ─────────────────────────────────────────────────────────────

    /** Tick에서 호출. EIS에 이동 입력을 주입합니다. */
    void InjectMoveInput();

    /** 이동 입력을 즉시 초기화합니다 (연결 끊김·타임아웃 공통 처리). */
    void ClearMoveInput();

    /** 현재 Pawn의 PlayerController를 반환. nullptr이면 조용히 무시. */
    APlayerController* GetOwnerController() const;

    // ── 상태 ──────────────────────────────────────────────────────────────────

    /** 마지막으로 받은 이동 방향 (패널 조이스틱 X, Y). */
    FVector2D PendingMoveInput = FVector2D::ZeroVector;

    /** true이면 Tick에서 InjectInputForAction을 호출합니다. */
    bool bHasPendingMove = false;

    /**
     * 마지막으로 moveDirection 명령을 수신한 월드 시간 (초).
     * 이 값으로부터 MoveInputTimeoutSec 이상 지나면 이동 입력을 자동 초기화합니다.
     *
     * 왜 필요한가:
     *   패널 앱이 백그라운드로 가거나 네트워크가 끊기면 (0,0) 명령이 전송되지 않아
     *   bHasPendingMove가 true인 채로 남아 캐릭터가 무한히 이동합니다.
     *   타임아웃으로 마지막 수신 후 일정 시간이 지나면 강제 정지합니다.
     */
    float LastMoveInputTime = 0.f;

    /**
     * moveDirection 수신이 없을 때 이동을 멈추기까지의 대기 시간 (초).
     * 패널 전송 간격(80ms)의 약 3배. 네트워크 지터로 인한 오탐을 방지합니다.
     */
    UPROPERTY(EditAnywhere, Category="Exhibition|Input",
              meta=(ClampMin="0.1", ClampMax="1.0", DisplayName="Move Input Timeout (sec)"))
    float MoveInputTimeoutSec = 0.25f;

    // Dynamic Multicast Delegate는 AddDynamic/RemoveDynamic 사용.
    bool bBoundToSubsystem = false;
};
