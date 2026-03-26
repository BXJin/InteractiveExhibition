# 1-Character Interactive Exhibition Prototype

휴대폰 웹 패널에서 입력한 명령에 따라 PC 화면의 Unreal 캐릭터와 공간 연출이 실시간으로 반응하는 전시형 인터랙티브 콘텐츠 프로토타입입니다.  
저비용 MVP를 목표로 하며, 향후 2캐릭터 상호작용, MetaHuman, 고급 실시간 통신 구조까지 확장 가능한 형태를 전제로 설계합니다.

---

## 1. Project Overview

### 목표
- 휴대폰을 리모컨처럼 사용하여 Unreal 캐릭터의 감정, 애니메이션, 이동, 공간 연출을 제어
- 1 캐릭터 기반 MVP를 먼저 완성
- 이후 2 캐릭터, MetaHuman, 고도화된 실시간 통신 구조로 확장 가능하도록 설계

### 핵심 산출물
- Unreal 실행 화면
- 휴대폰 웹 패널
- 1~2분 데모 영상
- 구조/설계 문서

### MVP 범위
- 1 캐릭터
- 감정 상태 기반 반응
- 공간 연출 연동
- 실시간 명령 처리

### 확장 방향
- 2 캐릭터 상호작용
- MetaHuman 적용
- WebRTC / gRPC PoC
- 음성 입력
- 운영 로그 고도화

---

## 2. Why This Project

이 프로젝트의 핵심은 단순히 "휴대폰으로 Unreal 화면을 조작하는 장난감"이 아니라,  
**입력 → 해석 → 캐릭터 반응 → 공간 연출**로 이어지는  
**전시형 실시간 콘텐츠 시스템**을 설계하고 구현하는 데 있습니다.

포트폴리오 관점에서는 다음 두 방향 모두를 커버할 수 있습니다.

- **실시간 캐릭터 인터랙션 시스템**
- **몰입형 전시 / 실감형 콘텐츠 프로토타입**

---

## 3. Recommended Tech Stack

| 영역 | MVP 스택 | 역할 | 확장 방향 |
|---|---|---|---|
| 실시간 3D 클라이언트 | Unreal Engine 5 + C++ + Blueprint | 캐릭터 상태, 애니메이션, 이동, 공간 연출 처리 | MetaHuman, 2 캐릭터 동기화, 고급 연출 |
| 모바일 입력 UI | TypeScript + React + Vite | 휴대폰 리모컨 UI 제공 | PWA, Flutter 앱 전환 |
| 실시간 통신 | WebSocket 또는 SignalR | 모바일 명령을 서버/Unreal로 실시간 전달 | gRPC, WebRTC, 멀티세션 |
| 서버 | ASP.NET Core | 명령 수신, 상태 관리, 로그, 관리자 기능 | 인증, 세션 관리, AI 응답 연동 |
| 데이터 구조 | JSON 중심 설정 구조 | Character / Emotion / Animation / Stage 정의 | SQLite, PostgreSQL, Redis |
| 에셋 | Mixamo 기반 humanoid 캐릭터 | 빠른 MVP 제작 및 애니메이션 검증 | MetaHuman 교체 |

---

## 4. Why This Stack

### Unreal Engine 5 + C++ + Blueprint
- 핵심 로직은 C++로 관리
- 연출 연결과 반복 작업은 Blueprint로 처리
- 포트폴리오 설명력과 개발 속도를 동시에 확보 가능

### React + Vite 기반 웹 패널
- 앱 설치 없이 바로 테스트 가능
- 버튼/패널 중심 리모컨 UI에 적합
- MVP 단계에서 가장 빠르게 검증 가능

### ASP.NET Core 서버
- 현재 역량과 가장 잘 맞는 백엔드 스택
- 학습 비용을 줄이고 명령 처리, 로그, 관리자 기능을 빠르게 구현 가능

### WebSocket / SignalR
- MVP 목적에 충분한 실시간성 확보
- 현재 단계에서 WebRTC, gRPC까지 들어가면 범위가 과도하게 커짐

---

## 5. Core Concept

### 사용자 경험 시나리오
관람객 또는 운영자가 휴대폰 웹 패널에서 인사, 감정, 분위기, 질문 버튼을 누르거나 텍스트를 입력하면  
PC 화면의 캐릭터가 표정, 애니메이션, 대사, 시선, 카메라, 조명, 사운드로 반응합니다.

### 데모 흐름
1. 대기 상태
2. 휴대폰 접속
3. 인사 명령 입력
4. 캐릭터 반응
5. 감정 또는 분위기 변경
6. 배경 연출 변화
7. 인터랙션 종료

### 반드시 지켜야 할 제한
- MVP에서는 1 캐릭터만 구현
- 음성 스트리밍, 얼굴 추적, 2 캐릭터 동기화, WebRTC/gRPC 실전 적용은 제외
- 단, 구조는 나중에 얹을 수 있도록 설계

---

## 6. System Design Principles

### 1) 1 캐릭터 MVP, 하지만 2 캐릭터 확장 전제
현재 구현은 1 캐릭터 기준으로 진행하되, 내부 구조는 단일 캐릭터 전용으로 고정하지 않습니다.

- `CharacterId`
- `TargetId`
- `StageCommand`

이 개념을 분리하여 향후 다중 캐릭터/다중 오브젝트로 확장 가능한 구조를 유지합니다.

### 2) Data-Driven 설계
감정, 애니메이션, 대사, 카메라, 조명, 사운드 매핑을 코드 하드코딩 대신 데이터 중심으로 관리합니다.

예시:
- Data Table
- JSON
- ReactionData 구조체/DTO

### 3) 입력 / 해석 / 실행 분리
- **입력 계층**: 웹 패널, API, WebSocket
- **도메인 계층**: 명령 해석, 우선순위, 쿨다운, 중복 방지
- **실행 계층**: 캐릭터, 카메라, 조명, 사운드 실행

이 분리가 있어야 이후 WebRTC, gRPC, 2 캐릭터 동기화로 확장할 때 구조가 무너지지 않습니다.

---

## 7. Main Features

| 기능 영역 | MVP 기능 | 구현 방식 | 확장 포인트 |
|---|---|---|---|
| 입력/제어 | 휴대폰 웹 패널에서 버튼/텍스트 입력 | 웹 UI + REST API 또는 WebSocket | 음성 입력, 관리자/관람객 모드 분리 |
| 캐릭터 반응 | 감정별 애니메이션/표정/대사 반응 | Unreal Character Blueprint, Animation Blueprint, Data Table | 2 캐릭터 동시 반응, 우선순위 큐 |
| 공간 연출 | 조명/카메라/사운드 변화 | Blueprint 제어, Level Sequence, Light/Camera/Sound Cue | 씬 전환, 장면 프리셋 |
| 상태 관리 | 명령 해석, 쿨다운, 중복 방지 | Command DTO, Resolver, State Manager | 행동 큐, 인터럽트 정책 |
| 실시간 통신 | 화면 반응 지연 최소화 | 초기 HTTP or WebSocket | 다중 클라이언트, 저지연 구조 |
| 운영성 | 테스트 버튼, 로그 확인, 시연 모드 | 운영 패널, 로그 출력, 디버그 HUD | 이벤트 저장, 리플레이 |
| 문서화 | 구조 설명, 시연 포장 | 아키텍처 다이어그램, 상태 전이도, 데모 영상 | 포트폴리오 사이트 |

---

## 8. Data Structures to Separate Early

확장성을 위해 아래 데이터 구조는 반드시 분리합니다.

- `CharacterDefinition`
  - 캐릭터 종류
  - 스폰 정보
  - 사용 에셋

- `EmotionProfile`
  - 감정 상태별 표정
  - 대기 모션
  - 대사
  - 연출 정보

- `AnimationProfile`
  - 애니메이션 키
  - 재생 규칙

- `StageProfile`
  - 조명
  - 카메라
  - 사운드
  - 배경 모드

- `CommandPayload`
  - `SetEmotion`
  - `PlayAnimation`
  - `MoveToPoint`
  - `MoveDirection`
  - `Rotate`
  - `TriggerStageEvent`

- `CharacterId`
  - 모든 명령에 포함
  - 나중에 2 캐릭터 이상 제어 가능하도록 유지

---

## 9. Architecture Summary

| 계층 | 책임 | 대표 기술 |
|---|---|---|
| 입력 계층 | 휴대폰 웹 패널, 명령 전송, 운영 모드/관람객 모드 분리 | React, REST API, WebSocket |
| 도메인 계층 | 명령 해석, 상태 전이, 우선순위, 쿨다운, CharacterId / StageCommand 분리 | ASP.NET Core, DTO, Resolver, Manager |
| 실행 계층 | 캐릭터 애니메이션, 표정, 대사 UI, 조명, 카메라, 사운드 실행 | Unreal Blueprint, Animation Blueprint, Level Sequence |
| 관측 계층 | 로그, 디버그 HUD, 시연 상태 확인 | 로그 출력, HUD 위젯, 테스트 패널 |

---

## 10. Development Priority

### Step 1. 콘셉트 고정
- 전시 씬 분위기 확정
- 캐릭터 1종 확정
- 감정 상태 수 결정 (권장 4개)
- 배경 모드 수 결정 (권장 2~3개)
- 입력 방식 결정 (버튼 / 텍스트)

### Step 2. Unreal 내부 반응 시스템 먼저 구현
- 키보드 입력만으로 감정 변경 동작
- Happy / Sad / Angry / Surprise 등의 반응 구성
- 완료 기준: 입력에 따라 캐릭터가 즉시 다르게 보일 것

### Step 3. 반응 데이터 구조화
- `EmotionType`
- `CharacterId`
- `ReactionCommand`
- `StageCommand`
- `ReactionData`

코드의 if-else 분기보다 **명령 → 데이터 → 실행** 흐름 중심으로 정리

### Step 4. 공간 연출 연동
- 캐릭터 반응과 함께 카메라 / 조명 / 배경 사운드 변화
- 전시 씬 전체가 반응하는 인상 확보

### Step 5. 휴대폰 웹 패널 연결
- 동일 네트워크 내 모바일 브라우저 접속
- 버튼 입력부터 연결
- 텍스트 입력은 후순위
- 초기 통신은 REST API 또는 WebSocket

### Step 6. 실시간 명령 처리 레이어 정리
- 수신 → 해석 → 실행 흐름 분리
- 중복 입력 방지
- 쿨다운 정책
- 실행 중 반응 우선순위 처리

### Step 7. 운영 모드 / 시연 모드 분리
- 운영 모드: 전체 명령 노출
- 시연 모드: 최소 버튼만 노출
- 디버그 HUD로 현재 상태, 마지막 명령, 지연 시간 표시

### Step 8. 데모 시나리오 제작
- 시작 / 중간 / 하이라이트 / 종료 흐름 설계
- 1~2분 데모 시퀀스 구성

### Step 9. 문서화 및 패키징
- 기능 목록
- 구조도
- 상태 전이도
- 향후 확장 항목
- 시연 영상 정리

---

## 11. Priority by Technology

### 반드시 포함
- Unreal Engine 5
- C++
- Blueprint
- React
- ASP.NET Core
- WebSocket
- JSON

### 있으면 좋음
- SignalR
- SQLite
- 관리자 패널
- 로그 뷰어

### 나중 확장
- MetaHuman
- 2 캐릭터
- AI 응답
- WebRTC
- gRPC
- Redis

---

## 12. Not in MVP

초기 범위에서 제외할 항목:

- MetaHuman Animator 중심 고사양 파이프라인
- 실시간 얼굴 추적
- WebRTC 미디어 스트리밍 실전 적용
- 2 캐릭터 전체 구조 동시 구현
- 복잡한 음성 인식 / 생성 자동화

---

## 13. Future Extensions

- 2 캐릭터 상호작용 씬
- WebSocket 기반 저지연 이벤트 HUD
- gRPC 또는 WebRTC PoC
- 운영 로그 저장 및 리플레이
- 장면 프리셋 전환
- 시나리오 편집기
- MetaHuman 적용

---

## 14. Final Decision

현재 가장 현실적인 전체 기술 스택은 다음과 같습니다.

**Unreal Engine 5 + C++ + Blueprint + TypeScript/React/Vite + ASP.NET Core + WebSocket(또는 SignalR) + JSON**

이 조합은
- 현재 역량과 가장 잘 맞고
- 1 캐릭터 MVP를 빠르게 완성할 수 있으며
- 향후 2 캐릭터, MetaHuman, 더 고도화된 실시간 구조로 확장하기에도 적합합니다.

---

## 15. Positioning for Portfolio

이 프로젝트는 다음 두 방향으로 설명 가능합니다.

### 실시간 캐릭터 인터랙션 엔지니어링 관점
- 입력 장치와 Unreal 캐릭터 시스템 연동
- 상태 관리와 실시간 명령 처리 구조 설계
- 확장 가능한 인터랙션 아키텍처 구현

### 몰입형 전시형 콘텐츠 시스템 관점
- 캐릭터 반응과 공간 연출의 통합
- 운영 가능한 전시형 콘텐츠 구조
- 저비용 장비 기반 실감형 프로토타입 설계

---