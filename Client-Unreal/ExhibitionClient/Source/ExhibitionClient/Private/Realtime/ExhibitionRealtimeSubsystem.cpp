#include "Realtime/ExhibitionRealtimeSubsystem.h"

#include "Async/Async.h"
#include "Dom/JsonObject.h"
#include "Engine/World.h"
#include "IWebSocket.h"
#include "Modules/ModuleManager.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "TimerManager.h"
#include "WebSocketsModule.h"

DEFINE_LOG_CATEGORY_STATIC(LogExhibitionRealtime, Log, All);

void UExhibitionRealtimeSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);

    UE_LOG(LogExhibitionRealtime, Log, TEXT("Initialize (AutoConnect=%s, Url=%s)"),
        bAutoConnect ? TEXT("true") : TEXT("false"),
        *WebSocketUrl);

    if (bAutoConnect)
    {
        ConnectInternal();
    }
}

void UExhibitionRealtimeSubsystem::Deinitialize()
{
    DisconnectInternal(true);
    ClearReconnectTimer();

    Super::Deinitialize();
}

void UExhibitionRealtimeSubsystem::Connect()
{
    ConnectInternal();
}

void UExhibitionRealtimeSubsystem::Disconnect()
{
    DisconnectInternal(true);
}

bool UExhibitionRealtimeSubsystem::IsConnected() const
{
    return Socket.IsValid() && Socket->IsConnected() && bConnected;
}

void UExhibitionRealtimeSubsystem::ConnectInternal()
{
    if (WebSocketUrl.IsEmpty())
    {
        UE_LOG(LogExhibitionRealtime, Warning, TEXT("WebSocketUrl is empty."));
        return;
    }

    if (bConnecting || IsConnected())
    {
        return;
    }

    bDisconnectRequested = false;
    bConnecting = true;

    ClearReconnectTimer();
    ResetSocket();

    FWebSocketsModule& WsModule = FModuleManager::LoadModuleChecked<FWebSocketsModule>("WebSockets");
    Socket = WsModule.CreateWebSocket(WebSocketUrl);

    TWeakObjectPtr<UExhibitionRealtimeSubsystem> WeakThis(this);

    ConnectedHandle = Socket->OnConnected().AddLambda([WeakThis]()
    {
        AsyncTask(ENamedThreads::GameThread, [WeakThis]()
        {
            if (WeakThis.IsValid())
            {
                WeakThis->HandleConnected();
            }
        });
    });

    ConnectionErrorHandle = Socket->OnConnectionError().AddLambda([WeakThis](const FString& Error)
    {
        const FString ErrorCopy = Error;

        AsyncTask(ENamedThreads::GameThread, [WeakThis, ErrorCopy]()
        {
            if (WeakThis.IsValid())
            {
                WeakThis->HandleConnectionError(ErrorCopy);
            }
        });
    });

    ClosedHandle = Socket->OnClosed().AddLambda([WeakThis](int32 StatusCode, const FString& Reason, bool bWasClean)
    {
        const FString ReasonCopy = Reason;

        AsyncTask(ENamedThreads::GameThread, [WeakThis, StatusCode, ReasonCopy, bWasClean]()
        {
            if (WeakThis.IsValid())
            {
                WeakThis->HandleClosed(StatusCode, ReasonCopy, bWasClean);
            }
        });
    });

    MessageHandle = Socket->OnMessage().AddLambda([WeakThis](const FString& Message)
    {
        const FString MessageCopy = Message;

        AsyncTask(ENamedThreads::GameThread, [WeakThis, MessageCopy]()
        {
            if (WeakThis.IsValid())
            {
                WeakThis->HandleMessage(MessageCopy);
            }
        });
    });

    UE_LOG(LogExhibitionRealtime, Log, TEXT("Connecting... %s"), *WebSocketUrl);
    Socket->Connect();
}

void UExhibitionRealtimeSubsystem::DisconnectInternal(bool bWasManual)
{
    bDisconnectRequested = bWasManual;
    bConnecting = false;

    ClearReconnectTimer();

    const bool bWasConnected = bConnected;
    bConnected = false;

    if (Socket.IsValid())
    {
        if (ConnectedHandle.IsValid())
        {
            Socket->OnConnected().Remove(ConnectedHandle);
            ConnectedHandle.Reset();
        }

        if (ConnectionErrorHandle.IsValid())
        {
            Socket->OnConnectionError().Remove(ConnectionErrorHandle);
            ConnectionErrorHandle.Reset();
        }

        if (ClosedHandle.IsValid())
        {
            Socket->OnClosed().Remove(ClosedHandle);
            ClosedHandle.Reset();
        }

        if (MessageHandle.IsValid())
        {
            Socket->OnMessage().Remove(MessageHandle);
            MessageHandle.Reset();
        }

        if (Socket->IsConnected())
        {
            Socket->Close();
        }

        Socket.Reset();
    }

    if (bWasConnected)
    {
        OnConnectionChanged.Broadcast(false);
    }
}

void UExhibitionRealtimeSubsystem::ResetSocket()
{
    if (!Socket.IsValid())
    {
        return;
    }

    if (ConnectedHandle.IsValid())
    {
        Socket->OnConnected().Remove(ConnectedHandle);
        ConnectedHandle.Reset();
    }

    if (ConnectionErrorHandle.IsValid())
    {
        Socket->OnConnectionError().Remove(ConnectionErrorHandle);
        ConnectionErrorHandle.Reset();
    }

    if (ClosedHandle.IsValid())
    {
        Socket->OnClosed().Remove(ClosedHandle);
        ClosedHandle.Reset();
    }

    if (MessageHandle.IsValid())
    {
        Socket->OnMessage().Remove(MessageHandle);
        MessageHandle.Reset();
    }

    if (Socket->IsConnected())
    {
        Socket->Close();
    }

    Socket.Reset();
}

void UExhibitionRealtimeSubsystem::ClearReconnectTimer()
{
    if (UWorld* World = GetWorld())
    {
        World->GetTimerManager().ClearTimer(ReconnectTimerHandle);
    }
}

void UExhibitionRealtimeSubsystem::ScheduleReconnect()
{
    if (!bAutoReconnect || bDisconnectRequested)
    {
        return;
    }

    UWorld* World = GetWorld();
    if (World == nullptr)
    {
        return;
    }

    World->GetTimerManager().ClearTimer(ReconnectTimerHandle);
    World->GetTimerManager().SetTimer(
        ReconnectTimerHandle,
        this,
        &UExhibitionRealtimeSubsystem::ConnectInternal,
        ReconnectDelaySeconds,
        false);
}

void UExhibitionRealtimeSubsystem::HandleConnected()
{
    bConnecting = false;
    bConnected = true;

    UE_LOG(LogExhibitionRealtime, Log, TEXT("Connected."));
    OnConnectionChanged.Broadcast(true);
}

void UExhibitionRealtimeSubsystem::HandleConnectionError(const FString& Error)
{
    bConnecting = false;

    UE_LOG(LogExhibitionRealtime, Error, TEXT("Connection error: %s"), *Error);

    const bool bWasConnected = bConnected;
    bConnected = false;

    if (bWasConnected)
    {
        OnConnectionChanged.Broadcast(false);
    }

    ResetSocket();
    ScheduleReconnect();
}

void UExhibitionRealtimeSubsystem::HandleClosed(int32 StatusCode, const FString& Reason, bool bWasClean)
{
    bConnecting = false;

    UE_LOG(LogExhibitionRealtime, Warning, TEXT("Closed (Code=%d, Clean=%s): %s"),
        StatusCode,
        bWasClean ? TEXT("true") : TEXT("false"),
        *Reason);

    const bool bWasConnected = bConnected;
    bConnected = false;

    if (bWasConnected)
    {
        OnConnectionChanged.Broadcast(false);
    }

    ResetSocket();
    ScheduleReconnect();
}

void UExhibitionRealtimeSubsystem::HandleMessage(const FString& Message)
{
	UE_LOG(LogExhibitionRealtime, Warning, TEXT("Command received: %s"), *Message.Left(512));

	// Raw도 유지(디버그/툴링용)
	OnCommandReceived.Broadcast(Message);

	// type 기반 분기
	if (!TryDispatchCommand(Message))
	{
		UE_LOG(LogExhibitionRealtime, Warning, TEXT("Command dispatch failed (invalid json or unknown type)."));
	}
}

bool UExhibitionRealtimeSubsystem::TryDispatchCommand(const FString& Message)
{
	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Message);

	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		return false;
	}

	FString Type;
	if (!Root->TryGetStringField(TEXT("type"), Type))
	{
		return false;
	}

	FString CharacterId;
	Root->TryGetStringField(TEXT("characterId"), CharacterId);

	if (Type == TEXT("setEmotion"))
	{
		FString EmotionKey;
		if (!Root->TryGetStringField(TEXT("emotionKey"), EmotionKey))
		{
			return false;
		}

		OnSetEmotion.Broadcast(CharacterId, EmotionKey);
		return true;
	}

	if (Type == TEXT("playAnimation"))
	{
		FString AnimationKey;
		if (!Root->TryGetStringField(TEXT("animationKey"), AnimationKey))
		{
			return false;
		}

		bool bLoop = false;
		Root->TryGetBoolField(TEXT("loop"), bLoop);

		OnPlayAnimation.Broadcast(CharacterId, AnimationKey, bLoop);
		return true;
	}

	if (Type == TEXT("triggerStageEvent"))
	{
		FString StageEventKey;
		if (!Root->TryGetStringField(TEXT("stageEventKey"), StageEventKey))
		{
			return false;
		}

		OnTriggerStageEvent.Broadcast(CharacterId, StageEventKey);
		return true;
	}

	if (Type == TEXT("moveToPoint"))
	{
		FVector Position(0.0f, 0.0f, 0.0f);
		if (!TryGetVector3(Root, TEXT("position"), Position))
		{
			return false;
		}

		double SpeedDouble = 0.0;
		float Speed = 0.0f;
		if (Root->TryGetNumberField(TEXT("speed"), SpeedDouble))
		{
			Speed = static_cast<float>(SpeedDouble);
		}

		OnMoveToPoint.Broadcast(CharacterId, Position, Speed);
		return true;
	}

	if (Type == TEXT("moveDirection"))
	{
		FVector Direction(0.0f, 0.0f, 0.0f);
		if (!TryGetVector3(Root, TEXT("direction"), Direction))
		{
			return false;
		}

		double SpeedDouble = 0.0;
		float Speed = 0.0f;
		if (Root->TryGetNumberField(TEXT("speed"), SpeedDouble))
		{
			Speed = static_cast<float>(SpeedDouble);
		}

		double DurationDouble = 0.0;
		float DurationSeconds = 0.0f;
		if (Root->TryGetNumberField(TEXT("durationSeconds"), DurationDouble))
		{
			DurationSeconds = static_cast<float>(DurationDouble);
		}

		OnMoveDirection.Broadcast(CharacterId, Direction, Speed, DurationSeconds);
		return true;
	}

	if (Type == TEXT("rotate"))
	{
		FRotator Rotation(0.0f, 0.0f, 0.0f);
		if (!TryGetRotator(Root, TEXT("rotation"), Rotation))
		{
			return false;
		}

		OnRotate.Broadcast(CharacterId, Rotation);
		return true;
	}

	return false;
}

bool UExhibitionRealtimeSubsystem::TryGetVector3(const TSharedPtr<FJsonObject>& Obj, const FString& FieldName, FVector& Out)
{
	const TSharedPtr<FJsonObject>* VectorObjPtr = nullptr;
	if (!Obj->TryGetObjectField(FieldName, VectorObjPtr) || VectorObjPtr == nullptr || !VectorObjPtr->IsValid())
	{
		return false;
	}

	double X = 0.0;
	double Y = 0.0;
	double Z = 0.0;

	if (!(*VectorObjPtr)->TryGetNumberField(TEXT("x"), X) ||
		!(*VectorObjPtr)->TryGetNumberField(TEXT("y"), Y) ||
		!(*VectorObjPtr)->TryGetNumberField(TEXT("z"), Z))
	{
		return false;
	}

	Out = FVector(static_cast<float>(X), static_cast<float>(Y), static_cast<float>(Z));
	return true;
}

bool UExhibitionRealtimeSubsystem::TryGetRotator(const TSharedPtr<FJsonObject>& Obj, const FString& FieldName, FRotator& Out)
{
	const TSharedPtr<FJsonObject>* RotObjPtr = nullptr;
	if (!Obj->TryGetObjectField(FieldName, RotObjPtr) || RotObjPtr == nullptr || !RotObjPtr->IsValid())
	{
		return false;
	}

	double Pitch = 0.0;
	double Yaw = 0.0;
	double Roll = 0.0;

	if (!(*RotObjPtr)->TryGetNumberField(TEXT("pitch"), Pitch) ||
		!(*RotObjPtr)->TryGetNumberField(TEXT("yaw"), Yaw) ||
		!(*RotObjPtr)->TryGetNumberField(TEXT("roll"), Roll))
	{
		return false;
	}

	Out = FRotator(static_cast<float>(Pitch), static_cast<float>(Yaw), static_cast<float>(Roll));
	return true;
}
