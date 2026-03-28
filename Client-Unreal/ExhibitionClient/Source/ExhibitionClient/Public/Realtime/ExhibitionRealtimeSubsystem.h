#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "ExhibitionRealtimeSubsystem.generated.h"

class IWebSocket;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FExhibitionRealtimeCommandReceived, const FString&, Json);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FExhibitionRealtimeConnectionChanged, bool, bConnected);

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
