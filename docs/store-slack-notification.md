# 하이픈 스토어 신청 Slack 알림

승인이 필요한 상품의 새 `PENDING` 주문을 저장한 뒤 `STORE_APPLICATION` 이벤트를 보낸다. 즉시 교환, 취소, 반려, 교환 완료는 발송 대상이 아니다. 기존 신청은 소급 발송하지 않는다.

서버가 `store_orders`, `users`, `haifn_items` 원본을 조회하고 학생 이름·학교·상품·포인트·처리 필요 안내를 구성한다. 기본 목적지는 기존 하이픈 Slack 채널이며 LINE 및 이높플레이스는 기본 OFF다. 관리자 설정의 지점별 알림 경로에서 스토어 신청을 조정할 수 있다. 기존 설정에 새 키가 없으면 이 기본값으로 보완한다.

주문 UUID를 중복 방지 키로 사용한다. 알림 실패는 저장된 신청을 실패로 처리하지 않는다. 로컬 개발에서는 기존 외부 알림 차단 정책을 유지한다.

## 운영 적용 전 검토

`supabase/manual/proposals/20261002_store_notification_category.sql`은 알림 기록의 허용 카테고리에 `store`를 추가한다. 운영 적용 전 실제 제약조건 이름과 정의를 읽어 확인해야 한다. 기존 네 카테고리 모두 유지하며 주문·포인트·로그 행을 변경하거나 삭제하지 않는다. 제약조건 교체는 단일 트랜잭션이며 검증 실패 시 전체 롤백된다. 테이블 제약조건 변경으로 짧은 잠금이 발생할 수 있다.

운영 스키마는 사용자 승인 후 적용한다. 그 뒤 변경된 공유 모듈을 포함한 `dispatch-notification` 함수와 프런트엔드의 배포가 필요하다. Firebase Hosting 배포 역시 사용자의 명시적 배포 지시 후 수행한다. 운영 알림 테스트는 실제 Slack 메시지를 보내므로 별도 지시 없이 수행하지 않는다.

## 검증

- `node scripts/test-store-notification.mjs`: 원본 정보 사용, PENDING 상태 검증, 하이픈 Slack 기본 경로, OFF 설정, 동일 주문의 중복 방지 키, 저장 실패 시 미발송, 알림 실패 시 접수 유지, 즉시 교환 미발송.
- 같은 테스트의 PGlite 검증: 변경 전 기존 행 네 개가 변경 후 동일하고 새 `store` 값만 추가 허용됨. 운영 DB에 연결하지 않는다.
- `node scripts/test-notification-routing.mjs`: 기존 알림 경로 회귀 검증.

## 2026-10-02 운영 적용

사용자 승인 후 `scripts/migrate-store-notification.mjs --dry-run`으로 운영 제약조건의 원래 정의를 확인하고 변경을 롤백 검증했다. 기존 알림 기록은 커피챗 2건, 프로그램 73건, 방문 388건으로 변경 전후 동일했다. `--apply`로 동일 변경을 커밋하고 `--verify`로 `store` 카테고리와 하이픈 Slack 스토어 경로 활성화를 재확인했다.

`dispatch-notification` 함수를 `erecqalsxoxrufggvmcc` 프로젝트에 배포했다. 실제 주문 생성 및 Slack 시험 메시지 발송은 수행하지 않았다.

Firebase Hosting `sci-center-6f265` 배포도 완료했다. 사전 빌드 및 인증 릴리스 검사 후 `verify-store-notification-release.mjs`로 공개 HTML의 파일 목록과 스토어 이벤트가 포함된 파일의 SHA-256이 로컬 빌드와 동일함을 확인했다.
