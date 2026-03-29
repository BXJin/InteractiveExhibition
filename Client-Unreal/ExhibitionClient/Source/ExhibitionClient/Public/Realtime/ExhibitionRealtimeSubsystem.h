#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "ExhibitionRealtimeSubsystem.generated.h"

class IWebSocket;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FExhibitionRealtimeCommandReceived, const FString&, Json);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FExhibitionRealtimeConnectionChanged, bool, bConnected);

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FExhibitionSetEmotionReceived, const FString&, CharacterId, const FString&, EmotionKey);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FExhibitionPlayAnimationReceived, const FString&, CharacterId, const FString&, AnimationKey, bool, bLoop);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FExhibitionTriggerStageEventReceived, const FString&, CharacterId, const FString&, StageEventKey);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FExhibitionMoveToPointReceived, const FString&, CharacterId, FVector, Position, float, Speed);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_FourParams(FExhibitionMoveDirectionReceived, const FString&, CharacterId, FVector, Direction, float, Speed, float, DurationSeconds);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FExhibitionRotateReceived, const FString&, CharacterId, FRotator, Rotation);

UCLASS(Config=Game, DefaultConfig)
class EXHIBITIONCLIENT_API UExhibitionRealtimeSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	UFUNCTION(BlueprintCallable, Category="Exhibition|Realtime")
	void Connect();

	UFUNCTION(BlueprintCallable, Category="Exhibition|Realtime")
	void Disconnect();

	UFUNCTION(BlueprintPure, Category="Exhibition|Realtime")
	bool IsConnected() const;

	UPROPERTY(BlueprintAssignable, Category="Exhibition|Realtime")
	FExhibitionRealtimeCommandReceived OnCommandReceived;

	UPROPERTY(BlueprintAssignable, Category="Exhibition|Realtime")
	FExhibitionRealtimeConnectionChanged OnConnectionChanged;

	// type 기반 이벤트(서버 DTO와 1:1)
	UPROPERTY(BlueprintAssignable, Category="Exhibition|Realtime|Commands")
	FExhibitionSetEmotionReceived OnSetEmotion;

	UPROPERTY(BlueprintAssignable, Category="Exhibition|Realtime|Commands")
	FExhibitionPlayAnimationReceived OnPlayAnimation;

	UPROPERTY(BlueprintAssignable, Category="Exhibition|Realtime|Commands")
	FExhibitionTriggerStageEventReceived OnTriggerStageEvent;

	UPROPERTY(BlueprintAssignable, Category="Exhibition|Realtime|Commands")
	FExhibitionMoveToPointReceived OnMoveToPoint;

	UPROPERTY(BlueprintAssignable, Category="Exhibition|Realtime|Commands")
	FExhibitionMoveDirectionReceived OnMoveDirection;

	UPROPERTY(BlueprintAssignable, Category="Exhibition|Realtime|Commands")
	FExhibitionRotateReceived OnRotate;

private:
	void ConnectInternal();
	void DisconnectInternal(bool bWasManual);

	void ResetSocket();
	void ClearReconnectTimer();
	void ScheduleReconnect();

	void HandleConnected();
	void HandleConnectionError(const FString& Error);
	void HandleClosed(int32 StatusCode, const FString& Reason, bool bWasClean);
	void HandleMessage(const FString& Message);

	bool TryDispatchCommand(const FString& Message);

	static bool TryGetVector3(const TSharedPtr<class FJsonObject>& Obj, const FString& FieldName, FVector& Out);
	static bool TryGetRotator(const TSharedPtr<class FJsonObject>& Obj, const FString& FieldName, FRotator& Out);

private:
	UPROPERTY(Config)
	FString WebSocketUrl = TEXT("ws://127.0.0.1:5225/ws/unreal");

	UPROPERTY(Config)
	bool bAutoConnect = true;

	UPROPERTY(Config)
	bool bAutoReconnect = true;

	UPROPERTY(Config)
	float ReconnectDelaySeconds = 2.0f;

	bool bConnected = false;
	bool bDisconnectRequested = false;
	bool bConnecting = false;

	TSharedPtr<IWebSocket> Socket;

	FDelegateHandle ConnectedHandle;
	FDelegateHandle ConnectionErrorHandle;
	FDelegateHandle ClosedHandle;
	FDelegateHandle MessageHandle;

	FTimerHandle ReconnectTimerHandle;
};
