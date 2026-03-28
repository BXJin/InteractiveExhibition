#include "Realtime/ExhibitionRealtimeSubsystem.h"

#include "Async/Async.h"
#include "Engine/World.h"
#include "HAL/PlatformTime.h"
#include "Modules/ModuleManager.h"
#include "TimerManager.h"
#include "WebSocketsModule.h"
#include "IWebSocket.h"

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
    OnCommandReceived.Broadcast(Message);
}
