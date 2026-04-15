# 버그 수정: SignalR 패널 연결 상태 불일치

**날짜**: 2026-04-14  
**브랜치**: low-latency-tuning  
**파일**: `Mobile-Panel/src/core/transport/TransportProvider.tsx`  
**파일**: `Mobile-Panel/src/core/transport/SignalRTransport.ts`

---

## 증상

- 브라우저 콘솔: `connected` 상태로 표시됨
- ASP.NET 서버 로그: 연결/해제가 반복됨

```
Panel connected.    ConnectionId=FFfMDUH6FXFdYrouHmU9RQ
Panel disconnected. ConnectionId=FFfMDUH6FXFdYrouHmU9RQ, Error=(null)
Panel connected.    ConnectionId=YT5MV2WD72d2-E2tdRsZvw
Panel disconnected. ConnectionId=YT5MV2WD72d2-E2tdRsZvw, Error=(null)
...
```

- Emotion 버튼 클릭 시: `✗ Happy — Not connected` 오류 표시

---

## 원인

### React StrictMode 이중 실행

`main.tsx`의 `<StrictMode>`는 개발 환경에서 `useEffect`를 **두 번** 실행한다.  
(마운트 → 클린업 → 재마운트)

기존 코드는 `useMemo`로 transport 인스턴스를 **하나만** 생성하고,  
두 effect가 해당 인스턴스를 **공유**했다.

### 실행 순서 (버그 발생 흐름)

```
1. useMemo → transport 인스턴스 T 생성 (공유)

2. [Effect 1 실행]
   - listener1 등록
   - T.start() 호출 → SignalR 연결 시작 (async, startPromise1)

3. [Cleanup 1 실행] ← StrictMode가 강제 실행
   - isMounted1 = false
   - unsubscribe1() → listener1 제거
   - startPromise1.finally(() => T.dispose()) 예약  ← 비동기! 나중에 실행됨

4. [Effect 2 실행]
   - listener2 등록
   - T.start() 호출
     → _connection.state === Connecting (이미 1번이 진행 중)
     → early return, 아무것도 안 함

5. startPromise1 완료 (SignalR 연결 성공)
   → T._setState('connected')
   → listener2 호출 → setConnectionState('connected')
   → UI: "connected" 표시  ✓ (일단 맞게 표시됨)

6. finally() 실행 → T.dispose() 호출
   → _isDisposed = true
   → _listeners.clear()  ← listener2 삭제됨!
   → _connection.stop() 호출

7. SignalR 연결 종료 → onclose 이벤트
   → T._setState('disconnected')
   → _listeners가 비어있음 → 아무도 알림 못 받음
   → UI: "connected" stuck  ✗

8. Emotion 버튼 클릭
   → transport.send()
   → _connection.state !== Connected  (실제론 Disconnected)
   → return { ok: false, error: 'Not connected' }  ✗
```

### 핵심 문제

`startPromise.finally(dispose)`가 **비동기**이기 때문에,  
Effect 2가 `listener2`를 등록한 **이후에** dispose가 실행되어 listener2를 지워버린다.  
결과적으로 UI state는 `'connected'`에 고정되지만 실제 연결은 끊긴 상태가 된다.

---

## 수정 내용

### 수정 파일 1: `TransportProvider.tsx`

**핵심 변경**: `useMemo` → `useRef` + effect 내에서 매번 새 인스턴스 생성

#### Before

```tsx
export const TransportProvider: React.FC<{...}> = ({ baseUrl, mode = 'signalr', transport: customTransport, children }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  // ❌ useMemo: StrictMode에서 두 effect가 동일한 인스턴스를 공유
  const transport = useMemo(() => {
    if (customTransport) return customTransport;
    if (mode === 'signalr') return new SignalRTransport(baseUrl);
    return new HttpTransport(baseUrl);
  }, [baseUrl, mode, customTransport]);

  useEffect(() => {
    if (!(transport instanceof SignalRTransport)) {
      setConnectionState('connected');
      return () => { /* dispose */ };
    }

    let isMounted = true;
    const unsubscribe = transport.onStateChange((state) => {
      if (isMounted) setConnectionState(state);
    });

    // ❌ start()의 Promise를 추적하여 완료 후 비동기 dispose
    const startPromise = transport.start();

    return () => {
      isMounted = false;
      unsubscribe();
      // ❌ 비동기! Effect 2의 listener 등록 이후에 dispose가 실행될 수 있음
      startPromise.finally(() => transport.dispose());
    };
  }, [transport]);

  const value = useMemo(
    () => ({ transport, connectionState }),
    [transport, connectionState],
  );

  return (
    <TransportContext.Provider value={value}>
      {children}
    </TransportContext.Provider>
  );
};
```

#### After

```tsx
export const TransportProvider: React.FC<{...}> = ({ baseUrl, mode = 'signalr', transport: customTransport, children }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  // ✅ useRef: transport 교체 시 불필요한 re-render 없이 최신 인스턴스 유지
  const transportRef = useRef<ITransport | null>(null);

  // 첫 렌더링에서 consumers가 null을 받지 않도록 placeholder 생성
  // (연결은 하지 않음 — start()는 effect에서만 호출)
  if (transportRef.current === null) {
    transportRef.current = customTransport ?? (
      mode === 'signalr' ? new SignalRTransport(baseUrl) : new HttpTransport(baseUrl)
    );
  }

  // transport 교체 시 consumers re-render를 트리거하는 카운터
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    // ✅ 매 mount마다 새 인스턴스 생성
    // StrictMode: Effect 1 cleanup → Effect 2 = 두 개의 독립된 인스턴스
    const t: ITransport = customTransport ?? (
      mode === 'signalr' ? new SignalRTransport(baseUrl) : new HttpTransport(baseUrl)
    );

    // 이전 인스턴스(placeholder 또는 이전 effect의 transport) dispose
    const prev = transportRef.current;
    if (prev !== null && prev !== t) {
      (prev as Partial<Pick<SignalRTransport, 'dispose'>>).dispose?.();
    }

    transportRef.current = t;
    setRevision((r) => r + 1);

    if (!(t instanceof SignalRTransport)) {
      setConnectionState('connected');
      return () => {
        (t as Partial<Pick<SignalRTransport, 'dispose'>>).dispose?.();
      };
    }

    let isMounted = true;
    const unsubscribe = t.onStateChange((state) => {
      if (isMounted) setConnectionState(state);
    });

    t.start();

    return () => {
      isMounted = false;
      unsubscribe();
      // ✅ 즉시 동기 dispose
      // SignalRTransport.start()의 _isDisposed 체크가 race condition을 처리함
      t.dispose();
    };
  }, [baseUrl, mode, customTransport]);

  const value = useMemo(
    () => ({ transport: transportRef.current!, connectionState }),
    // revision이 바뀌면 transport도 새 인스턴스 → memo 재계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision, connectionState],
  );

  return (
    <TransportContext.Provider value={value}>
      {children}
    </TransportContext.Provider>
  );
};
```

---

### 수정 파일 2: `SignalRTransport.ts`

**핵심 변경**: `dispose()` 에서 listener 삭제 전에 `'disconnected'` 상태 통지

#### Before

```ts
dispose(): void {
  if (this._isDisposed) return;
  this._isDisposed = true;
  // ❌ listener에 알리지 않고 바로 clear
  this._listeners.clear();
  this._connection.stop().catch(() => {});
}
```

#### After

```ts
dispose(): void {
  if (this._isDisposed) return;
  this._isDisposed = true;
  // ✅ 살아있는 listener가 있다면 먼저 'disconnected' 상태를 전달
  // (cleanup 외부에서 dispose 호출 시 consumers가 상태 변화를 인지할 수 있음)
  this._setState('disconnected');
  this._listeners.clear();
  this._connection.stop().catch(() => {});
}
```

---

## 수정 후 StrictMode 실행 흐름

```
1. 렌더링: transportRef에 placeholder P 생성 (연결 안 함)

2. [Effect 1 실행]
   - T1 = new SignalRTransport() 새로 생성
   - P.dispose() → placeholder 정리
   - transportRef = T1
   - T1.onStateChange(listener1)
   - T1.start() → 연결 시작

3. [Cleanup 1 실행] ← StrictMode 강제
   - isMounted1 = false
   - unsubscribe1() → listener1 제거
   - T1.dispose() ← 즉시 동기 실행, T1 연결 종료

4. [Effect 2 실행]
   - T2 = new SignalRTransport() 새로 생성  ← 완전히 새 인스턴스!
   - T1.dispose() → 이미 disposed, no-op
   - transportRef = T2
   - T2.onStateChange(listener2)
   - T2.start() → 정상 연결 시작

5. T2 연결 성공
   → T2._setState('connected')
   → listener2 호출 → setConnectionState('connected')
   → UI: "connected"  ✓

6. Emotion 버튼 클릭
   → transport.send()
   → T2._connection.state === Connected  ✓
   → 서버로 커맨드 전송 성공  ✓
```

---

## 참고: 왜 production에서도 문제가 됐는가

StrictMode는 개발 환경에서만 동작하지만,  
`startPromise.finally(dispose)` 패턴은 **production에서도** race condition을 내포한다.  
네트워크 지연이 짧거나 컴포넌트가 빠르게 언마운트/리마운트되는 상황에서 동일한 증상이 재현될 수 있다.  
동기 dispose + 인스턴스 격리 방식이 더 안전하다.
