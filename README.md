# 온라인 강의실 (학습용 실시간 방송 솔루션)

브라우저에서 화면 공유·웹캠으로 강의를 송출하고, 수강생은 WebRTC(지연 1초 미만) 또는 LL-HLS(지연 2~4초)로 시청합니다.
개인 PC(localhost)에서 실행하는 학습용 프로젝트입니다.

## 구조

```
[강사 브라우저] --WHIP--> [MediaMTX] --WHEP / LL-HLS--> [수강생 브라우저]
                              ^
                              | 제어 API (방송 상태, 시청자 수, 강제 종료)
                      [Node API 서버 (Fastify + SQLite)] <--/api-- [웹 (Vite + React)]
```

| 폴더 | 내용 |
|---|---|
| `apps/server` | Fastify API 서버. 강의실 CRUD, MediaMTX 상태 조회 (`node:sqlite` 사용) |
| `apps/web` | Vite + React 프론트엔드. WHIP/WHEP 클라이언트는 `src/lib/`에 직접 구현 |
| `packages/shared` | 서버와 웹이 함께 쓰는 타입 |
| `media/` | MediaMTX 실행 파일과 설정 (`mediamtx.yml`) |
| `data/` | SQLite DB, 녹화 파일 (Git 제외) |

## 준비물

- Node.js 24 이상, pnpm
- MediaMTX v1.21.1: [릴리스 페이지](https://github.com/bluenviron/mediamtx/releases/tag/v1.21.1)에서 `mediamtx_v1.21.1_windows_amd64.zip`을 내려받아 `mediamtx.exe`를 `media/` 폴더에 넣습니다. (이미 넣어둠)

## 실행

```bash
pnpm install
pnpm dev
```

`pnpm dev` 하나로 MediaMTX, API 서버, 웹이 함께 실행됩니다. 브라우저에서 http://localhost:5173 을 엽니다.

## 사용해보기

1. 강의실을 만들고 **강의하기**를 누릅니다.
2. 입력으로 **화면 공유 / 웹캠 / 테스트 화면** 중 하나를 고르고 **강의 시작**을 누릅니다.
3. **수강생 화면: 새 탭에서 열기**로 시청 화면을 엽니다.
4. 시청 방식(WebRTC / LL-HLS)을 바꿔가며 지연 시간을 비교합니다. 테스트 화면의 시계와 시청 화면 아래 **현재 시각**의 차이가 실제 지연입니다.

OBS로 송출하려면 강의 화면의 "OBS로 송출하기"에 나온 서버 주소와 스트림 키를 사용합니다. (OBS 음성은 AAC라서 WebRTC로는 소리가 안 나옵니다. LL-HLS로 시청하세요.)

## 포트

| 포트 | 용도 |
|---|---|
| 5173 | 웹 (Vite) |
| 3000 | API 서버 (`API_PORT`로 변경 가능) |
| 8889 | MediaMTX WebRTC 신호 교환 (WHIP/WHEP) |
| 8189 (UDP) | MediaMTX WebRTC 영상 전송 (ICE) — 아래 참고 |
| 8888 | MediaMTX LL-HLS |
| 1935 | MediaMTX RTMP (OBS) |
| 9997 | MediaMTX 제어 API (서버 내부용) |

UDP 8189를 뺀 모든 포트는 `127.0.0.1`에만 열려 있어서 다른 기기에서는 접속할 수 없습니다.

UDP 8189는 예외로 모든 주소에서 받습니다. Chrome은 `127.0.0.1`(루프백)로는 WebRTC 영상 연결을 시도하지 않기 때문입니다.
연결을 맺으려면 `127.0.0.1:8889`에서만 받을 수 있는 인증 정보가 필요하므로 외부에서 이 포트만으로는 접속할 수 없습니다.
Windows 방화벽 경고가 뜨면 "취소"해도 같은 PC 안의 연결은 동작합니다.

> 강의 화면의 연결 상태가 `connecting`에서 멈추면 영상 경로(UDP)가 막힌 것입니다. 10초 뒤 오류로 표시됩니다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 서버와 MediaMTX 상태 |
| GET | `/api/classrooms` | 강의실 목록 (방송 상태, 시청자 수 포함) |
| POST | `/api/classrooms` | 강의실 만들기 `{ title, description? }` |
| GET | `/api/classrooms/:id` | 강의실 하나 |
| GET | `/api/classrooms/:id/media` | WHIP/WHEP/HLS/RTMP 주소 |
| DELETE | `/api/classrooms/:id` | 삭제 (방송 중이면 송출도 끊음) |

## 진행 단계

- [x] **1단계**: 모노레포, MediaMTX 연동, 브라우저 송출(WHIP), WebRTC·LL-HLS 시청, 강의실 관리
- [ ] **2단계**: 회원·역할, MediaMTX HTTP 인증 훅으로 송출/시청 권한 확인, 채팅, 질문, 손들기
- [ ] **3단계**: 녹화와 다시보기, 출석, 화면+웹캠 합성, 강사 대시보드
- [ ] **4단계**: 수강생 발언권, 투표, mediasoup으로 SFU 직접 구현
